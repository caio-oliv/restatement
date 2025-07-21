import type {
	QueryState,
	QueryProviderState,
	KeyPair,
	KeyHashFn,
	QueryCache,
	QueryStateNoCacheSource,
	QueryStateMetadata,
	QueryExecutorResult,
	Millisecond,
	ResetOptions,
} from '@/core/Type';
import type {
	QueryContext,
	QueryContextMutFns,
	QueryInput,
	QueryProvider,
} from '@/plumbing/QueryType';
import { blackhole, makeAbortSignal, makeObservablePromise, nullpromise } from '@/Internal';
import { isCacheEntryFresh } from '@/cache/CacheHelper';
import { DummySubscriber, SubscriberHandle } from '@/PubSub';
import { CacheManager } from '@/cache/CacheManager';
import {
	defaultKeyHashFn,
	DEFAULT_RETRY_POLICY,
	defaultKeepCacheOnErrorFn,
	defaultFilterFn,
	defaultExtractTTLFn,
	DEFAULT_TTL_DURATION,
	DEFAULT_FRESH_DURATION,
} from '@/Default';
import { execAsyncOperation } from '@/core/RetryPolicy';

/**
 * @summary Make a new query context
 * @param input query input
 * @param input.placeholder idle state placeholder
 * @param input.store cache store
 * @param input.queryFn query function
 * @param input.keyHashFn key hasher
 * @param input.retryPolicy retry policy
 * @param input.retryHandleFn retry handler
 * @param input.keepCacheOnErrorFn keep cache on error
 * @param input.extractTTLFn extract TTL function
 * @param input.ttl default TTL duration
 * @param input.fresh cache fresh duration
 * @param input.stateFn query state handler
 * @param input.dataFn query data handler
 * @param input.errorFn query error handler
 * @param input.filterFn query state filter
 * @param input.provider state provider
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
	extractTTLFn = defaultExtractTTLFn,
	ttl = DEFAULT_TTL_DURATION,
	fresh = DEFAULT_FRESH_DURATION,
	stateFn = null,
	dataFn = null,
	errorFn = null,
	filterFn = defaultFilterFn,
	provider = null,
}: QueryInput<K, T, E>): QueryContext<K, T, E> {
	const context: QueryContext<K, T, E> = {
		placeholder,
		internalCache: store,
		keyHashFn,
		queryFn,
		retryPolicy,
		ttl,
		fresh,
		retryHandleFn,
		keepCacheOnErrorFn,
		extractTTLFn,
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

export interface ExecuteQueryOptions {
	/**
	 * @summary Cache directive
	 * @default 'stale'
	 */
	cache?: QueryCache;
	/**
	 * @summary Fallback TTL
	 */
	ttl?: Millisecond;
	/**
	 * @summary Abort signal
	 */
	signal?: AbortSignal;
}

/**
 * @summary Execute a query
 * @description Execute a query based on the provided cache directive.
 * @param ctx query context
 * @param key key value
 * @param options execute query options
 * @param options.cache cache directive
 * @param options.ttl TTL
 * @param options.signal abort signal
 * @returns query execution result
 */
export async function executeQuery<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>,
	key: K,
	{ cache = 'stale', ttl = ctx.ttl, signal = makeAbortSignal() }: ExecuteQueryOptions = {}
): Promise<QueryExecutorResult<T, E>> {
	const hash = ctx.keyHashFn(key);
	ctx.subscriber.useTopic(hash);

	if (cache === 'no-cache') {
		// eslint-disable-next-line @typescript-eslint/return-await
		return runActiveQuery(ctx, { key, hash }, { cache, ttl, signal });
	}

	const entry = await ctx.internalCache.getEntry(hash).catch(blackhole);
	if (entry === undefined) {
		// eslint-disable-next-line @typescript-eslint/return-await
		return runActiveQuery(ctx, { key, hash }, { cache, ttl, signal });
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
		return runBackgroundQuery(ctx, state, { key, hash }, { ttl, signal });
	}

	// eslint-disable-next-line @typescript-eslint/return-await
	return runActiveQuery(ctx, { key, hash }, { cache, ttl, signal });
}

/**
 * @summary Use provided query key
 * @description Reset query state and subscribe to the provided key.
 * @param ctx query context
 * @param key key value
 * @param options reset options
 * @param options.target reset target
 */
export function useQueryKey<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>,
	key: K,
	{ target = 'state' }: ResetOptions = {}
): void {
	const hash = ctx.keyHashFn(key);
	ctx.subscriber.useTopic(hash);
	ctx.state = { data: ctx.placeholder, error: null, status: 'idle' };

	if (target === 'handler') {
		stateInitialization(ctx);
	}
}

/**
 * @summary Reset query state and context
 * @param ctx query context
 * @param options reset options
 * @param options.target reset target
 */
export function resetQuery<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>,
	{ target = 'state' }: ResetOptions = {}
): void {
	ctx.subscriber.unsubscribe();
	ctx.state = { data: ctx.placeholder, error: null, status: 'idle' };

	if (target === 'handler') {
		stateInitialization(ctx);
	}
}

/**
 * @summary Send initialization event
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
 * @summary Dispose the query
 * @param ctx query context
 */
export function disposeQuery<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>
): void {
	ctx.subscriber.unsubscribe();
}

export interface RunActiveQueryOptions {
	/**
	 * @summary Cache directive
	 * @default 'stale'
	 */
	cache?: QueryCache;
	/**
	 * @summary Fallback TTL
	 */
	ttl?: Millisecond;
	/**
	 * @summary Abort signal
	 */
	signal?: AbortSignal;
}

/**
 * @summary Run active query
 * @description Try to reuse active query or run a new query in the foreground.
 * @param ctx query context
 * @param key key pair
 * @param key.key key value
 * @param key.hash key hash
 * @param options run active query options
 * @param options.cache cache directive
 * @param options.ttl TTL
 * @param options.signal abort signal
 * @returns query execution result
 */
export async function runActiveQuery<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>,
	{ key, hash }: KeyPair<K>,
	{ cache = 'stale', ttl = ctx.ttl, signal = makeAbortSignal() }: RunActiveQueryOptions = {}
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

	const promise = runQuery(ctx, { key, hash }, { cache, source: 'query', ttl, signal });
	ctx.subscriber.setCurrentState(makeObservablePromise(promise));
	return { state: await promise, next: nullpromise };
}

export interface RunBackgroundQueryOptions {
	/**
	 * @summary Fallback TTL
	 */
	ttl?: Millisecond;
	/**
	 * @summary Abort signal
	 */
	signal?: AbortSignal;
}

/**
 * @summary Run background query
 * @description Return the {@link QueryExecutorResult} with the provided state and try
 * to reuse the active query or create a new one for the next background query.
 * @param ctx query context
 * @param state query state
 * @param key key pair
 * @param key.key key value
 * @param key.hash key hash
 * @param options run background query options
 * @param options.ttl TTL
 * @param options.signal abort signal
 * @returns query execution result
 */
export async function runBackgroundQuery<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>,
	state: QueryState<T, E>,
	{ key, hash }: KeyPair<K>,
	{ ttl = ctx.ttl, signal = makeAbortSignal() }: RunBackgroundQueryOptions = {}
): Promise<QueryExecutorResult<T, E>> {
	const currPromise = ctx.subscriber.getCurrentState();
	if (currPromise?.status === 'pending') {
		currPromise.then((state: QueryState<T, E>) => {
			updateQuery(ctx, hash, {
				state,
				metadata: { origin: 'control', source: 'background-query', cache: 'stale' },
			});
		});

		return { state, next: () => currPromise };
	}

	/**
	 * `runQuery` should run in the background, so it's promise
	 * **must not** be awaited.
	 */
	const queryPromise = runQuery(
		ctx,
		{ key, hash },
		{ cache: 'stale', source: 'background-query', ttl, signal }
	);
	ctx.subscriber.setCurrentState(makeObservablePromise(queryPromise));
	return { state, next: () => queryPromise };
}

export interface RunQueryOptions {
	/**
	 * @summary Cache directive
	 * @default 'stale'
	 */
	cache?: QueryCache;
	/**
	 * @summary State source
	 * @default 'query'
	 */
	source?: QueryStateNoCacheSource;
	/**
	 * @summary Fallback TTL
	 */
	ttl?: Millisecond;
	/**
	 * @summary Abort signal
	 */
	signal?: AbortSignal;
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
 * @param options run query options
 * @param options.cache cache directive
 * @param options.source query source
 * @param options.ttl fallback TTL
 * @param options.signal abort signal
 * @returns query state
 * @example
 * ```
 * // move `queryPromise` to somewhere else
 * const queryPromise = runQuery(ctx, { key, hash });
 * takeNextQuery(queryPromise);
 *
 * // or
 *
 * // not be `await`'ed
 * runQuery(ctx, { key, hash }, { source: 'background-query' });
 * ```
 */
export async function runQuery<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>,
	{ key, hash }: KeyPair<K>,
	{
		cache = 'stale',
		source = 'query',
		ttl = ctx.ttl,
		signal = makeAbortSignal(),
	}: RunQueryOptions = {}
): Promise<QueryState<T, E>> {
	try {
		const localQueryFn = ctx.queryFn;
		const val = await execAsyncOperation(
			() => localQueryFn(key, signal),
			ctx.retryPolicy,
			ctx.retryHandleFn
		);
		return (await queryResolve(ctx, val, hash, cache, source, ttl).catch(blackhole)) ?? ctx.state;
	} catch (err) {
		return (await queryReject(ctx, err, hash, cache, source).catch(blackhole)) ?? ctx.state;
	}
}

/**
 * @summary Resolve query execution
 * @description Resolve the query with the provided data, updates and returns the query state.
 * @param ctx query context
 * @param data data
 * @param hash key hash
 * @param cache cache directive
 * @param source query source
 * @param ttl fallback TTL
 * @returns query state
 */
export async function queryResolve<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>,
	data: T,
	hash: string,
	cache: QueryCache,
	source: QueryStateNoCacheSource,
	ttl: Millisecond = ctx.ttl
): Promise<QueryState<T, E>> {
	const state: QueryState<T, E> = { status: 'success', error: null, data };
	await ctx.internalCache.set(hash, data, ctx.extractTTLFn(data, ttl)).catch(blackhole);
	updateQuery(ctx, hash, { state, metadata: { origin: 'control', source, cache } });
	return state;
}

/**
 * @summary Reject query execution
 * @description Reject the query with the provided error, updates and returns the query state.
 * @param ctx query context
 * @param err error
 * @param hash key hash
 * @param cache cache directive
 * @param source query source
 * @returns query state
 */
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

/**
 * @summary Update the query state
 * @description Update the query state, call function handlers and publish the new state.
 * @param ctx query context
 * @param hash key hash
 * @param event state event
 * @param event.state query state
 * @param event.metadata query state metadata
 */
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
 * @summary Update {@link QueryContext `QueryContext`} functions
 * @param ctx query context
 * @param fns replacing functions
 */
export function updateQueryContextFn<K extends ReadonlyArray<unknown>, T, E = unknown>(
	ctx: QueryContext<K, T, E>,
	fns: Partial<QueryContextMutFns<K, T, E>>
): void {
	if (fns.queryFn !== undefined) ctx.queryFn = fns.queryFn;
	if (fns.retryHandleFn !== undefined) ctx.retryHandleFn = fns.retryHandleFn;
	if (fns.keepCacheOnErrorFn !== undefined) ctx.keepCacheOnErrorFn = fns.keepCacheOnErrorFn;
	if (fns.extractTTLFn !== undefined) ctx.extractTTLFn = fns.extractTTLFn;
	if (fns.stateFn !== undefined) ctx.stateFn = fns.stateFn;
	if (fns.dataFn !== undefined) ctx.dataFn = fns.dataFn;
	if (fns.errorFn !== undefined) ctx.errorFn = fns.errorFn;
	if (fns.filterFn !== undefined) ctx.filterFn = fns.filterFn;
}
