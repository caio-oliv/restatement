import type {
	QueryState,
	QueryProviderState,
	KeyPair,
	KeyHashFn,
	QueryCache,
	QueryStateNoCacheSource,
	QueryStateMetadata,
	QueryExecutorResult,
	QueryResetTarget,
} from '@/core/Type';
import type {
	QueryContext,
	QueryContextMutFns,
	QueryInput,
	QueryProvider,
} from '@/plumbing/QueryType';
import { blackhole, makeObservablePromise, nullpromise } from '@/Internal';
import { isCacheEntryFresh } from '@/cache/CacheHelper';
import { DummySubscriber, SubscriberHandle } from '@/PubSub';
import { CacheManager } from '@/cache/CacheManager';
import {
	defaultKeyHashFn,
	DEFAULT_RETRY_POLICY,
	defaultKeepCacheOnErrorFn,
	DEFAULT_FRESH_DURATION,
	DEFAULT_TTL_DURATION,
	defaultFilterFn,
} from '@/Default';
import { execAsyncOperation } from '@/core/RetryPolicy';

// eslint-disable-next-line jsdoc/require-param
/**
 * @summary Make a new query context
 * @returns query context
 */
export function makeQueryContext<K extends ReadonlyArray<unknown>, T, E = unknown>({
	placeholder = null,
	store,
	queryFn,
	keyHashFn = defaultKeyHashFn,
	retryPolicy = DEFAULT_RETRY_POLICY,
	retryHandleFn = null,
	keepCacheOnErrorFn = defaultKeepCacheOnErrorFn,
	fresh = DEFAULT_FRESH_DURATION,
	ttl = DEFAULT_TTL_DURATION,
	filterFn = defaultFilterFn,
	stateFn = null,
	dataFn = null,
	errorFn = null,
	provider = null,
}: QueryInput<K, T, E>): QueryContext<K, T, E> {
	const context: QueryContext<K, T, E> = {
		placeholder,
		internalCache: store,
		keyHashFn,
		queryFn,
		retryPolicy,
		retryHandleFn,
		keepCacheOnErrorFn,
		fresh,
		ttl,
		cache: new CacheManager({
			store,
			keyHashFn: keyHashFn as KeyHashFn<ReadonlyArray<unknown>>,
			provider: provider as QueryProvider<unknown, unknown>,
			ttl,
		}),
		state: { status: 'idle', data: placeholder, error: null },
		stateFn,
		dataFn,
		errorFn,
		filterFn,
		subscriber: provider
			? new SubscriberHandle(function listener(hash: string, data: QueryProviderState<T, E>) {
					updateQuery(context, hash, data);
				}, provider)
			: new DummySubscriber(),
	};

	return context;
}

/**
 *
 * @param ctx query context
 * @param key key value
 * @param cache cache directive
 * @param ctl abort controller
 * @returns query execution result
 */
export async function executeQuery<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>,
	key: K,
	cache: QueryCache = 'stale',
	ctl: AbortController = new AbortController()
): Promise<QueryExecutorResult<T, E>> {
	const hash = ctx.keyHashFn(key);
	ctx.subscriber.useTopic(hash);

	if (cache === 'no-cache') {
		// eslint-disable-next-line @typescript-eslint/return-await
		return tryCurrentPromiseOrRunQuery(ctx, { key, hash }, cache, ctl);
	}

	const entry = await ctx.internalCache.getEntry(hash).catch(blackhole);
	if (entry === undefined) {
		// eslint-disable-next-line @typescript-eslint/return-await
		return tryCurrentPromiseOrRunQuery(ctx, { key, hash }, cache, ctl);
	}

	if ((cache === 'fresh' || cache === 'stale') && isCacheEntryFresh(entry, ctx.fresh)) {
		// Fresh from cache (less time than fresh duration).
		const state: QueryState<T, E> = { status: 'success', error: null, data: entry.data };
		updateQuery(ctx, hash, { state, metadata: { origin: 'control', source: 'cache', cache } });
		return { state, next: nullpromise };
	}

	if (cache === 'stale') {
		// Stale from cache (greater time than fresh duration).
		const state: QueryState<T, E> = { status: 'stale', error: null, data: entry.data };
		updateQuery(ctx, hash, { state, metadata: { origin: 'control', source: 'cache', cache } });

		// eslint-disable-next-line @typescript-eslint/return-await
		return tryCurrentPromiseOrRunBackgroundQuery(ctx, state, { key, hash }, cache, ctl);
	}

	// eslint-disable-next-line @typescript-eslint/return-await
	return tryCurrentPromiseOrRunQuery(ctx, { key, hash }, cache, ctl);
}

/**
 *
 * @param ctx query context
 * @param key key value
 * @param target query reset target
 */
export function useQueryKey<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>,
	key: K,
	target: QueryResetTarget = 'state'
): void {
	const hash = ctx.keyHashFn(key);
	ctx.subscriber.useTopic(hash);
	ctx.state = { data: ctx.placeholder, error: null, status: 'idle' };

	if (target === 'handler') {
		stateInitialization(ctx);
	}
}

/**
 *
 * @param ctx query context
 * @param target query reset target
 */
export function resetQuery<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>,
	target: QueryResetTarget = 'state'
): void {
	ctx.subscriber.unsubscribe();
	ctx.state = { data: ctx.placeholder, error: null, status: 'idle' };

	if (target === 'handler') {
		stateInitialization(ctx);
	}
}

/**
 *
 * @param ctx query context
 */
function stateInitialization<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>
): void {
	ctx
		.stateFn?.(ctx.state, { cache: 'none', origin: 'control', source: 'initialization' }, ctx.cache)
		?.catch(blackhole);
}

/**
 *
 * @param ctx query context
 */
export function disposeQuery<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>
): void {
	ctx.subscriber.unsubscribe();
}

// TODO: rename
// eslint-disable-next-line jsdoc/require-jsdoc
export async function tryCurrentPromiseOrRunQuery<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>,
	{ key, hash }: KeyPair<K>,
	cache: QueryCache,
	ctl: AbortController
): Promise<QueryExecutorResult<T, E>> {
	const state: QueryState<T, E> = { status: 'loading', data: ctx.state.data, error: null };
	const metadata: QueryStateMetadata = { origin: 'control', source: 'query', cache };

	updateQuery(ctx, hash, { state, metadata });

	const currPromise = ctx.subscriber.getCurrentState();
	if (currPromise?.status === 'pending') {
		currPromise.then((state: QueryState<T, E>) => {
			updateQuery(ctx, hash, { state, metadata: { origin: 'control', source: 'query', cache } });
		});

		return { state: await currPromise, next: nullpromise };
	}

	const promise = runQuery(ctx, { key, hash }, cache, 'query', ctl);
	ctx.subscriber.setCurrentState(makeObservablePromise(promise));
	return { state: await promise, next: nullpromise };
}

// TODO: rename
// eslint-disable-next-line jsdoc/require-jsdoc
export async function tryCurrentPromiseOrRunBackgroundQuery<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>,
	state: QueryState<T, E>,
	{ key, hash }: KeyPair<K>,
	cache: QueryCache,
	ctl: AbortController
): Promise<QueryExecutorResult<T, E>> {
	const currPromise = ctx.subscriber.getCurrentState();
	if (currPromise?.status === 'pending') {
		currPromise.then((state: QueryState<T, E>) => {
			updateQuery(ctx, hash, {
				state,
				metadata: { origin: 'control', source: 'background-query', cache },
			});
		});

		return { state, next: () => currPromise };
	}

	/**
	 * `runQuery` should run in the background, so it's promise
	 * **must not** be awaited.
	 */
	const queryPromise = runQuery(ctx, { key, hash }, cache, 'background-query', ctl);
	ctx.subscriber.setCurrentState(makeObservablePromise(queryPromise));
	return { state, next: () => queryPromise };
}

/**
 * @summary Run the query function
 * @description Runs the query function with the provided retry policy
 * and returns the new query state within a promise.
 *
 * ## Invariant
 *
 * This function **does not** throw any errors. Callers can rely on the contract
 * that the promise returned by this function is safe to **not** be awaited.
 * @param ctx query context
 * @param key key pair
 * @param key.hash key hash
 * @param key.key key value
 * @param cache cache directive
 * @param source query source
 * @param ctl abort controller
 * @returns query state
 * @example
 * ```
 * // move `queryPromise` to somewhere else
 * const queryPromise = runQuery(ctx, { key, hash }, 'stale', 'query', new AbortController());
 * takeNextQuery(queryPromise);
 *
 * // or
 *
 * // not be `await`'ed
 * runQuery(ctx, { key, hash }, 'stale', 'background-query', new AbortController());
 * ```
 */
export async function runQuery<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>,
	{ key, hash }: KeyPair<K>,
	cache: QueryCache,
	source: QueryStateNoCacheSource,
	ctl: AbortController
): Promise<QueryState<T, E>> {
	try {
		const localQueryFn = ctx.queryFn;
		const result = await execAsyncOperation(
			() => localQueryFn(key, ctl.signal),
			ctx.retryPolicy,
			ctx.retryHandleFn
		);
		return (await queryResolve(ctx, result, hash, cache, source).catch(blackhole)) ?? ctx.state;
	} catch (err) {
		return (await queryReject(ctx, err, hash, cache, source).catch(blackhole)) ?? ctx.state;
	}
}

// eslint-disable-next-line jsdoc/require-jsdoc
export async function queryResolve<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>,
	data: T,
	hash: string,
	cache: QueryCache,
	source: QueryStateNoCacheSource
): Promise<QueryState<T, E>> {
	const state: QueryState<T, E> = { status: 'success', error: null, data };
	await ctx.internalCache.set(hash, data, ctx.ttl).catch(blackhole);
	updateQuery(ctx, hash, { state, metadata: { origin: 'control', source, cache } });
	return state;
}

// eslint-disable-next-line jsdoc/require-jsdoc
export async function queryReject<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>,
	err: unknown,
	hash: string,
	cache: QueryCache,
	source: QueryStateNoCacheSource
): Promise<QueryState<T, E>> {
	const state: QueryState<T, E> = { status: 'error', error: err as E, data: null };
	if (!ctx.keepCacheOnErrorFn(err as E)) {
		await ctx.internalCache.delete(hash).catch(blackhole);
	}
	updateQuery(ctx, hash, { state, metadata: { origin: 'control', source, cache } });
	return state;
}

// eslint-disable-next-line jsdoc/require-jsdoc
export function updateQuery<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>,
	hash: string,
	{ state, metadata }: QueryProviderState<T, E>
): void {
	if (ctx.subscriber.currentTopic() !== hash) {
		return;
	}

	if (!ctx.filterFn({ current: ctx.state, next: state, metadata })) {
		return;
	}

	ctx.state = state;

	if (ctx.state.data !== null) {
		ctx.dataFn?.(ctx.state.data, metadata, ctx.cache)?.catch(blackhole);
	}
	if (ctx.state.error !== null) {
		ctx.errorFn?.(ctx.state.error, metadata, ctx.cache)?.catch(blackhole);
	}
	ctx.stateFn?.(ctx.state, metadata, ctx.cache)?.catch(blackhole);

	if (metadata.origin === 'control') {
		ctx.subscriber.publishTopic(hash, {
			state: ctx.state,
			metadata: {
				origin: 'provider',
				source: metadata.source,
				cache: metadata.cache,
			} as QueryStateMetadata,
		});
	}
}

/**
 * Update `QueryContext` functions
 * @param ctx query context
 * @param fns replacing functions
 */
export function updateQueryContext<K extends ReadonlyArray<unknown>, T, E = unknown>(
	ctx: QueryContext<K, T, E>,
	fns: Partial<QueryContextMutFns<K, T, E>>
): void {
	if (fns.queryFn) ctx.queryFn = fns.queryFn;
	if (fns.retryHandleFn) ctx.retryHandleFn = fns.retryHandleFn;
	if (fns.keepCacheOnErrorFn) ctx.keepCacheOnErrorFn = fns.keepCacheOnErrorFn;
	if (fns.stateFn) ctx.stateFn = fns.stateFn;
	if (fns.dataFn) ctx.dataFn = fns.dataFn;
	if (fns.errorFn) ctx.errorFn = fns.errorFn;
	if (fns.filterFn) ctx.filterFn = fns.filterFn;
}
