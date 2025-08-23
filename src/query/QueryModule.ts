import type {
	QueryState,
	QueryProviderData,
	KeyPair,
	KeyHashFn,
	CacheDirective,
	QueryStateNoCacheSource,
	QueryStateMetadata,
	QueryExecutionResult,
	Millisecond,
	ResetOptions,
} from '@/core/Type';
import type {
	QueryContext,
	QueryContextMutFns,
	QueryInput,
	QueryProvider,
} from '@/query/QueryContext';
import { blackhole, makeAbortSignal, makeObservablePromise, nullpromise } from '@/Internal';
import { isCacheEntryFresh } from '@/core/Cache';
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
 * Make a new query context
 * @typeParam K Tuple with the query function inputs
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 * @param input Query input
 * @param input.placeholder Idle state placeholder
 * @param input.store Cache store
 * @param input.queryFn Query function
 * @param input.keyHashFn Key hasher
 * @param input.retryPolicy Retry policy
 * @param input.retryHandleFn Retry handler
 * @param input.keepCacheOnErrorFn Keep cache on error
 * @param input.extractTTLFn Extract TTL function
 * @param input.ttl Default TTL duration
 * @param input.fresh Cache fresh duration
 * @param input.stateFn Query state handler
 * @param input.dataFn Query data handler
 * @param input.errorFn Query error handler
 * @param input.filterFn Query state filter
 * @param input.provider State provider
 * @returns Query context
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
			? new SubscriberHandle(function listener(hash: string, data: QueryProviderData<T, E>) {
					updateQuery(context, hash, data);
				}, provider)
			: new DummySubscriber(),
	};

	return context;
}

/**
 * Execute query options
 */
export interface ExecuteQueryOptions {
	/**
	 * Cache directive
	 * @default 'stale'
	 */
	cache?: CacheDirective;
	/**
	 * Fallback TTL
	 */
	ttl?: Millisecond;
	/**
	 * Abort signal
	 */
	signal?: AbortSignal;
}

/**
 * Execute a query
 * @description Execute a query based on the provided {@link CacheDirective cache directive}.
 * @typeParam K Tuple with the query function inputs
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 * @param ctx Query context
 * @param key Key value
 * @param options Execute query options
 * @param options.cache Cache directive
 * @param options.ttl TTL
 * @param options.signal Abort signal
 * @returns Query execution result
 */
export async function executeQuery<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>,
	key: K,
	{ cache = 'stale', ttl = ctx.ttl, signal = makeAbortSignal() }: ExecuteQueryOptions = {}
): Promise<QueryExecutionResult<T, E>> {
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
		updateQuery(ctx, hash, { state, metadata: { origin: 'self', source: 'cache', cache } });
		return { state, next: nullpromise };
	}

	if (cache === 'stale') {
		// Stale from cache (greater time than fresh duration).
		const state: QueryState<T, E> = { status: 'stale', error: null, data: entry.data };
		updateQuery(ctx, hash, { state, metadata: { origin: 'self', source: 'cache', cache } });

		// eslint-disable-next-line @typescript-eslint/return-await
		return runBackgroundQuery(ctx, state, { key, hash }, { ttl, signal });
	}

	// eslint-disable-next-line @typescript-eslint/return-await
	return runActiveQuery(ctx, { key, hash }, { cache, ttl, signal });
}

/**
 * Use provided query key
 * @description Reset the {@link QueryState query state} and subscribe to the provided key.
 *
 * ##### Target option
 *
 * Refer to the {@link ResetTarget reset target} documentation for the `target` option.
 * @typeParam K Tuple with the query function inputs
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 * @param ctx Query context
 * @param key Key value
 * @param options Reset options
 * @param options.target Reset target
 */
export function useQueryKey<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>,
	key: K,
	{ target = 'context' }: ResetOptions = {}
): void {
	const hash = ctx.keyHashFn(key);
	ctx.subscriber.useTopic(hash);
	ctx.state = { data: ctx.placeholder, error: null, status: 'idle' };

	if (target === 'handler') {
		stateInitialization(ctx);
	}
}

/**
 * Reset query context
 * @description Reset the query to its {@link IdleQueryState initial state}.
 *
 * ##### Target option
 *
 * Refer to the {@link ResetTarget reset target} documentation for the `target` option.
 * @typeParam K Tuple with the query function inputs
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 * @param ctx Query context
 * @param options Reset options
 * @param options.target Reset target
 */
export function resetQuery<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>,
	{ target = 'context' }: ResetOptions = {}
): void {
	ctx.subscriber.unsubscribe();
	ctx.state = { data: ctx.placeholder, error: null, status: 'idle' };

	if (target === 'handler') {
		stateInitialization(ctx);
	}
}

/**
 * Send initialization event
 * @description Send an initialization event through the state handler.
 * @typeParam K Tuple with the query function inputs
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 * @param ctx Query context
 */
function stateInitialization<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>
): void {
	ctx
		.stateFn?.(ctx.state, { cache: 'none', origin: 'self', source: 'initialization' }, ctx.cache)
		?.catch(blackhole);
}

/**
 * Dispose the query
 * @description Dispose the query by {@link Subscriber#unsubscribe unsubscribing} from
 * the {@link QueryProvider provider}.
 * @typeParam K Tuple with the query function inputs
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 * @param ctx Query context
 */
export function disposeQuery<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>
): void {
	ctx.subscriber.unsubscribe();
}

/**
 * Run active query options
 */
export interface RunActiveQueryOptions {
	/**
	 * Cache directive
	 * @default 'stale'
	 */
	cache?: CacheDirective;
	/**
	 * Fallback TTL
	 */
	ttl?: Millisecond;
	/**
	 * Abort signal
	 */
	signal?: AbortSignal;
}

/**
 * Run active query
 * @description Try to reuse active query or run a new query in the foreground.
 * @typeParam K Tuple with the query function inputs
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 * @param ctx Query context
 * @param key Key pair
 * @param key.key key value
 * @param key.hash Key hash
 * @param options Run active query options
 * @param options.cache Cache directive
 * @param options.ttl TTL
 * @param options.signal Abort signal
 * @returns Query execution result
 */
export async function runActiveQuery<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>,
	{ key, hash }: KeyPair<K>,
	{ cache = 'stale', ttl = ctx.ttl, signal = makeAbortSignal() }: RunActiveQueryOptions = {}
): Promise<QueryExecutionResult<T, E>> {
	const state: QueryState<T, E> = { status: 'loading', data: ctx.state.data, error: null };
	const metadata: QueryStateMetadata = { origin: 'self', source: 'query', cache };

	updateQuery(ctx, hash, { state, metadata });

	const currPromise = ctx.subscriber.getCurrentState();
	if (currPromise?.status === 'pending') {
		currPromise.then((state: QueryState<T, E>) => {
			updateQuery(ctx, hash, { state, metadata: { origin: 'self', source: 'query', cache } });
		});

		return { state: await currPromise, next: nullpromise };
	}

	const promise = runQuery(ctx, { key, hash }, { cache, source: 'query', ttl, signal });
	ctx.subscriber.setCurrentState(makeObservablePromise(promise));
	return { state: await promise, next: nullpromise };
}

/**
 * Run background query options
 */
export interface RunBackgroundQueryOptions {
	/**
	 * Fallback TTL
	 */
	ttl?: Millisecond;
	/**
	 * Abort signal
	 */
	signal?: AbortSignal;
}

/**
 * Run background query
 * @description Return the {@link QueryExecutionResult} with the provided state and try
 * to reuse the active query or create a new one for
 * the {@link QueryExecutionResult#next next background query}.
 * @typeParam K Tuple with the query function inputs
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 * @param ctx Query context
 * @param state Query state
 * @param key Key pair
 * @param key.key Key value
 * @param key.hash Key hash
 * @param options Run background query options
 * @param options.ttl TTL
 * @param options.signal Abort signal
 * @returns Query execution result
 */
export async function runBackgroundQuery<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>,
	state: QueryState<T, E>,
	{ key, hash }: KeyPair<K>,
	{ ttl = ctx.ttl, signal = makeAbortSignal() }: RunBackgroundQueryOptions = {}
): Promise<QueryExecutionResult<T, E>> {
	const currPromise = ctx.subscriber.getCurrentState();
	if (currPromise?.status === 'pending') {
		currPromise.then((state: QueryState<T, E>) => {
			updateQuery(ctx, hash, {
				state,
				metadata: { origin: 'self', source: 'background-query', cache: 'stale' },
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

/**
 * Run query options
 */
export interface RunQueryOptions {
	/**
	 * Cache directive
	 * @default 'stale'
	 */
	cache?: CacheDirective;
	/**
	 * State source
	 * @default 'query'
	 */
	source?: QueryStateNoCacheSource;
	/**
	 * Fallback TTL
	 */
	ttl?: Millisecond;
	/**
	 * Abort signal
	 */
	signal?: AbortSignal;
}

/**
 * Run the query function
 * @description
 * Run the {@link QueryFn query function}, update the {@link QueryContext context}, and returns
 * the new {@link QueryState query state} in a promise.
 *
 * ##### Safe `Promise`
 *
 * This function **does not** throw any errors. Callers can rely that the Promise
 * returned by this function is safe to **not** be awaited.
 * @typeParam K Tuple with the query function inputs
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 * @param ctx Query context
 * @param key Key pair
 * @param key.hash Key hash
 * @param key.key Key value
 * @param options Run query options
 * @param options.cache Cache directive
 * @param options.source Query source
 * @param options.ttl Fallback TTL
 * @param options.signal Abort signal
 * @returns Query state
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
 * Resolve query execution
 * @description Resolve the query with the provided data, updates and returns
 * the {@link QueryState query state}.
 * @typeParam K Tuple with the query function inputs
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 * @param ctx Query context
 * @param data Data
 * @param hash Key hash
 * @param cache Cache directive
 * @param source Query source
 * @param ttl Fallback TTL
 * @returns Query state
 */
export async function queryResolve<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>,
	data: T,
	hash: string,
	cache: CacheDirective,
	source: QueryStateNoCacheSource,
	ttl: Millisecond = ctx.ttl
): Promise<QueryState<T, E>> {
	const state: QueryState<T, E> = { status: 'success', error: null, data };
	await ctx.internalCache.set(hash, data, ctx.extractTTLFn(data, ttl)).catch(blackhole);
	updateQuery(ctx, hash, { state, metadata: { origin: 'self', source, cache } });
	return state;
}

/**
 * Reject query execution
 * @description Reject the query with the provided error, updates and returns
 * the {@link QueryState query state}.
 *
 * ##### Cache invalidation
 *
 * The cache will be removed based on
 * the {@link QueryContext#keepCacheOnErrorFn keep cache on error function} from
 * the query context.
 * @typeParam K Tuple with the query function inputs
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 * @param ctx Query context
 * @param err Error
 * @param hash Key hash
 * @param cache Cache directive
 * @param source Query source
 * @returns Query state
 */
export async function queryReject<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>,
	err: unknown,
	hash: string,
	cache: CacheDirective,
	source: QueryStateNoCacheSource
): Promise<QueryState<T, E>> {
	const state: QueryState<T, E> = { status: 'error', error: err as E, data: null };
	if (!ctx.keepCacheOnErrorFn(err as E)) {
		await ctx.internalCache.delete(hash).catch(blackhole);
	}
	updateQuery(ctx, hash, { state, metadata: { origin: 'self', source, cache } });
	return state;
}

/**
 * Update the query state
 * @description Update the {@link QueryState query state}, call function handlers and publish the new state.
 * @typeParam K Tuple with the query function inputs
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 * @param ctx Query context
 * @param hash Key hash
 * @param event State event
 * @param event.state Query state
 * @param event.metadata Query state metadata
 */
export function updateQuery<K extends ReadonlyArray<unknown>, T, E>(
	ctx: QueryContext<K, T, E>,
	hash: string,
	{ state, metadata }: QueryProviderData<T, E>
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

	if (metadata.origin === 'self') {
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
 * Update {@link QueryContext `QueryContext`} functions
 * @typeParam K Tuple with the query function inputs
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 * @param ctx Query context
 * @param fns Replacing functions
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
