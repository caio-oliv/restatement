/**
 * Duration in millisecond precision (signed integer)
 */
export type Millisecond = number;

/**
 * Query cache directive
 * @description Cache directives that dictate how cached results should be used.
 *
 * ##### `no-cache`
 *
 * Does not use the cache to get query results.
 *
 * ##### `fresh`
 *
 * Uses the cached value if the cache entry duration is *fresh* (cache entry duration <
 * {@link QueryContext#fresh `QueryContext.fresh`}).
 *
 * ##### `stale`
 *
 * Uses the cached value if it exists. However, stale cache entries (cache entry
 * duration >= {@link QueryContext#fresh `QueryContext.fresh`}) trigger a background query (available
 * in {@link QueryExecutionResult#next `QueryExecutionResult.next()`}).
 * @default 'stale'
 */
export type CacheDirective = 'no-cache' | 'fresh' | 'stale';

/**
 * Query function type
 * @typeParam K Tuple with the query function inputs
 * @typeParam T Return value of a successful query
 */
export type QueryFn<K extends ReadonlyArray<unknown>, T> = (
	key: K,
	signal: AbortSignal
) => Promise<T>;

/**
 * Key hash function
 * @description Hash the query function inputs into a string.
 *
 * ##### Tuple order
 *
 * The hash function **must** preserve the order and structure of the input tuple.
 * Specifically, if one tuple is a prefix of another, the resulting hash of the
 * shorter tuple must be a prefix of the longer one’s hash.
 *
 * ```ts
 * const out1 = hashfn(['car', 10, 'home', null]);
 * const out2 = hashfn(['car', 10]);
 *
 * console.log(out1.startsWith(out2)); // Expected output: true
 * ```
 * @typeParam K Tuple with the query function inputs
 */
export type KeyHashFn<K extends ReadonlyArray<unknown>> = (key: K) => string;

/**
 * Key value and hash pair
 * @description A pair of a key tuple value and its hash produced by
 * a {@link KeyHashFn key hash function}.
 * @typeParam K Tuple with the query function inputs
 * @example
 * ```ts
 * const key = ['car', 10];
 * const hash = hashfn(key);
 *
 * const pair: KeyPair<[string, number]> = { key, hash };
 * ```
 */
export interface KeyPair<K extends ReadonlyArray<unknown>> {
	readonly key: K;
	readonly hash: string;
}

/**
 * Keep cache on error function
 * @description Verify if the provided error from a failed {@link QueryFn query}
 * execution should invalidate the current cache entry.
 * @typeParam E Error from a failed {@link QueryFn query} execution
 */
export type KeepCacheOnErrorFn<E> = (err: E) => boolean;

/**
 * Extract TTL function
 * @description Extract the cache TTL from the data that will be cached.
 *
 * Useful for HTTP responses that return the
 * {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#max-age `max-age`} in
 * the {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control Cache-Control header}.
 * @typeParam T Data that will be cached with returned TTL
 * @example
 * ```ts
 * interface HttpResponse<Data> {
 * 	body: Data;
 * 	headers: Headers;
 * }
 *
 * function extractMaxAgeTTL(res: HttpResponse<unknown>, fallbackTTL: Millisecond): Millisecond {
 * 	const maxAge: number | null = getMaxAgeFromHeader(res.headers);
 * 	if (maxAge === null) {
 * 		return fallbackTTL;
 * 	}
 *
 * 	return maxAge * 1000;
 * }
 * ```
 */
export type ExtractTTLFn<T> = (data: T, fallbackTTL: Millisecond) => Millisecond;

/**
 * Cache handler interface
 * @description Primary cache interface to interact with the same keys used
 * in {@link QueryFn query functions}.
 */
export interface CacheHandler {
	/**
	 * Set a cache entry and update all queries that are subscribed to this key.
	 * @description The primary way to mutate the data on already resolved queries.
	 *
	 * The provided state will have the {@link MutationStateMetadata mutation metadata}.
	 * @typeParam K Tuple with the query inputs
	 * @typeParam T Data that will be cached
	 * @param key Query key
	 * @param data Sucessful query data
	 * @param ttl Cache entry TTL
	 */
	set<K extends ReadonlyArray<unknown>, T>(key: K, data: T, ttl?: Millisecond): Promise<void>;
	/**
	 * Get the cached data with the provided query key.
	 * @typeParam K Tuple with the query inputs
	 * @param key Query key
	 * @returns Optional cached data
	 */
	get<K extends ReadonlyArray<unknown>, T>(key: K): Promise<T | undefined>;
	/**
	 * Invalidate all cache entries that match the prefix of the provided key.
	 * @typeParam K Tuple with the query inputs
	 * @param key Query key
	 * @example
	 * ```ts
	 * await cache.invalidate(['account', 'user']);
	 *
	 * console.log(await cache.get(['account', 'user', 1])); // Expected output: undefined
	 * console.log(await cache.get(['account', 'user', 'username:john'])); // Expected output: undefined
	 * console.log(await cache.get(['account', 'organization', 42])); // Expected output: { ... }
	 * ```
	 */
	invalidate<K extends ReadonlyArray<unknown>>(key: K): Promise<void>;
	/**
	 * Delete a cache entry with the provided key.
	 * @typeParam K Tuple with the query inputs
	 * @param key Query key
	 */
	delete<K extends ReadonlyArray<unknown>>(key: K): Promise<void>;
}

/**
 * Idle query state
 * @description Initial state of any query.
 *
 * The `data` property will always be the {@link QueryContext#placeholder query placeholder} value.
 * @typeParam T Return value of a successful query
 */
export interface IdleQueryState<T> {
	/**
	 * {@link QueryContext#placeholder Query placeholder} value.
	 */
	readonly data: T | null;
	/**
	 * Idle error field. Always `null`.
	 */
	readonly error: null;
	readonly status: 'idle';
}

/**
 * Loading query state
 * @description Loading state of a query.
 *
 * The query state can be transitioned to `loading` while keeping the `data`, allowing
 * to get the previous value while loading the next.
 *
 * In case the previous state is an {@link ErrorQueryState error}, the error value will be reset to `null`.
 * @typeParam T Return value of a successful query
 */
export interface LoadingQueryState<T> {
	/**
	 * Previous data or `null`.
	 */
	readonly data: T | null;
	/**
	 * Loading error field. Always `null`.
	 */
	readonly error: null;
	readonly status: 'loading';
}

/**
 * Stale query state
 * @description Stale state of a query.
 *
 * The stale query state will always have the current cached data while
 * a new query can happen in the background.
 * @typeParam T Return value of a successful query
 */
export interface StaleQueryState<T> {
	/**
	 * Stale data field.
	 */
	readonly data: T;
	/**
	 * Stale error field. Always `null`.
	 */
	readonly error: null;
	readonly status: 'stale';
}

/**
 * Success query state
 * @description Success state of a query.
 *
 * The `data` field can be set from the return of a successful query
 * or a fresh cache entry.
 * @typeParam T Return value of a successful query
 */
export interface SuccessQueryState<T> {
	/**
	 * Success data field.
	 */
	readonly data: T;
	/**
	 * Success error field. Always `null`.
	 */
	readonly error: null;
	readonly status: 'success';
}

/**
 * Error query state
 * @description Error state of a query.
 *
 * The `error` field is always set after the query fails all retries.
 * @typeParam E Error from a failed {@link QueryFn query} execution
 */
export interface ErrorQueryState<E> {
	/**
	 * Error data field. Always `null`.
	 */
	readonly data: null;
	/**
	 * Error field.
	 */
	readonly error: E;
	readonly status: 'error';
}

/**
 * Union of all possible query states.
 *
 * - {@link IdleQueryState idle}
 * - {@link LoadingQueryState loading}
 * - {@link StaleQueryState stale}
 * - {@link SuccessQueryState success}
 * - {@link ErrorQueryState error}
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 */
export type QueryState<T, E> =
	| IdleQueryState<T>
	| LoadingQueryState<T>
	| StaleQueryState<T>
	| SuccessQueryState<T>
	| ErrorQueryState<E>;

/**
 * Source of a {@link QueryState query state}
 * @description Which type of source the current state came from.
 *
 * ##### `query`
 *
 * From active query.
 *
 * ##### `cache`
 *
 * From cache (fresh or stale).
 *
 * ##### `background-query`
 *
 * From background query.
 */
export type QueryStateSource = 'query' | 'cache' | 'background-query';

/**
 * {@link QueryStateSource Query state source} without the `cache` variant
 */
export type QueryStateNoCacheSource = 'query' | 'background-query';

/**
 * Origin of a {@link QueryState query state}
 * @description Where the current query state originated.
 *
 * ##### `self`
 *
 * From the current {@link QueryContext query context}.
 *
 * ##### `provider`
 *
 * From the {@link QueryProvider query state provider}.
 */
export type QueryStateOrigin = 'self' | 'provider';

/**
 * Query state metadata
 * @description Describe meta information about the query state.
 *
 * Query states that have this metadata can only be created from executing
 * queries with its own context or provided through other contexts.
 */
export interface QueryStateMetadata {
	readonly origin: QueryStateOrigin;
	readonly source: QueryStateSource;
	readonly cache: CacheDirective;
}

/**
 * Initial state metadata
 * @description Describe meta information about the {@link IdleQueryState initial query state}.
 *
 * This metadata is only provided when the query state is reset with
 * the {@link ResetOptions#target target option} to `handler`, making
 * the {@link QueryStateHandler query state handler} be called.
 */
export interface InitialStateMetadata {
	readonly origin: 'self';
	readonly source: 'initialization';
	readonly cache: 'none';
}

/**
 * Mutation state metadata
 * @description Describe meta information about the mutated query state.
 *
 * Provided by setting a cache entry through the {@link CacheHandler CacheHandler} interface.
 */
export interface MutationStateMetadata {
	readonly origin: 'provider';
	readonly source: 'mutation';
	readonly cache: 'none';
}

/**
 * State metadata
 * @description Union of all metadata the {@link QueryState query state} can have.
 */
export type StateMetadata = QueryStateMetadata | MutationStateMetadata | InitialStateMetadata;

/**
 * Query provider data
 * @description Data composed by the {@link QueryState query state} and
 * its {@link StateMetadata metadata} that is propagated by
 * the {@link QueryProvider query provider}.
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 */
export interface QueryProviderData<T, E> {
	readonly state: QueryState<T, E>;
	readonly metadata: StateMetadata;
}

/**
 * Promise status
 * @description All possible states a promise could be represented.
 * @see JavaScript {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise Promise} documentation.
 */
export type PromiseStatus = 'pending' | 'fulfilled' | 'rejected';

/**
 * Observable promise
 * @description A `Promise` object that has its state as a `status` property.
 * @augments Promise
 */
export interface ObservablePromise<T> extends Promise<T> {
	/**
	 * Current promise status
	 */
	readonly status: PromiseStatus;
}

/**
 * Query state promise
 * @description A {@link ObservablePromise observable promise} that returns
 * a {@link QueryState query state}.
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 */
export type QueryStatePromise<T, E> = ObservablePromise<QueryState<T, E>>;

/**
 * Query shared state
 * @description State shared by all queries subscribed to the same key.
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 */
export interface QuerySharedState<T, E> {
	/**
	 * Query state promise
	 */
	promise: QueryStatePromise<T, E> | null;
}

/**
 * Query state transition
 * @description A object that represents the transition of a {@link QueryState query state}.
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 */
export interface QueryStateTransition<T, E> {
	/**
	 * Current query state
	 */
	readonly current: QueryState<T, E>;
	/**
	 * Next query state
	 */
	readonly next: QueryState<T, E>;
	/**
	 * Metadata of the **next** query state
	 */
	readonly metadata: StateMetadata;
}

/**
 * Query filter function
 * @description A {@link QueryStateTransition query state transition} predicate function.
 *
 * Executed for each transition. Should return `true` to allow the state transition.
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 */
export type QueryFilterFn<T, E> = (transition: QueryStateTransition<T, E>) => boolean;

/**
 * Query state handler
 * @description Handler function that is executed for **every** new {@link QueryState query state}.
 * @param state Current query state
 * @param metadata State metadata
 * @param cache Cache handler
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 */
export type QueryStateHandler<T, E> = (
	state: QueryState<T, E>,
	metadata: StateMetadata,
	cache: CacheHandler
) => Promise<void>;

/**
 * Query data handler
 * @description Handler function that is executed for **every** new {@link QueryState query state} that
 * has a `data` field.
 * @param data Query state `data` field
 * @param metadata State metadata
 * @param cache Cache handler
 * @typeParam T Return value of a successful query
 */
export type QueryDataHandler<T> = (
	data: T,
	metadata: StateMetadata,
	cache: CacheHandler
) => Promise<void>;

/**
 * Query error handler
 * @description Handler function that is executed for **every** new {@link QueryState query state} that
 * has an `error` field.
 * @param error Query state `error` field
 * @param metadata State metadata
 * @param cache Cache handler
 * @typeParam E Error from a failed {@link QueryFn query} execution
 */
export type QueryErrorHandler<E> = (
	error: E,
	metadata: StateMetadata,
	cache: CacheHandler
) => Promise<void>;

/**
 * Query handler
 * @description Object with all optional query handlers.
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 */
export interface QueryHandler<T, E> {
	stateFn: QueryStateHandler<T, E> | null;
	dataFn: QueryDataHandler<T> | null;
	errorFn: QueryErrorHandler<E> | null;
}

/**
 * Next query state
 * @description The return value of a background query.
 *
 * When `null`, no background query was needed.
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 */
export type NextQueryState<T, E> = QueryState<T, E> | null;

/**
 * Query execution result
 * @description Returned as a promise, the execution result always has the
 * current {@link QueryState query state} in its `state` property, and optionally
 * the {@link NextQueryState next query}, retrieved through a background query.
 *
 * ##### `next` function
 *
 * Calling the next function is **optional**, since it just returns a promise of the same background query.
 *
 * The `next` function is also {@link https://en.wikipedia.org/wiki/Idempotence idempotent}, so it can be called multiple
 * times, as the same state will be returned for multiple calls.
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 */
export interface QueryExecutionResult<T, E> {
	/**
	 * Current query state
	 */
	readonly state: QueryState<T, E>;
	/**
	 * Next query state
	 * @description Produces the next query state if there is any.
	 * @see {@link QueryExecutionResult Query execution result} documentation of the `next` function.
	 */
	next(): Promise<NextQueryState<T, E>>;
}

/**
 * Reset state target
 * @description At which level the state should be reset.
 *
 * ##### `context`
 *
 * The context state will be reset to `idle`. This transition will be silent and only the context will be updated.
 *
 * ##### `handler`
 *
 * The context state will be reset to `idle` and the state function handler will be called.
 */
export type ResetTarget = 'context' | 'handler';

/**
 * Reset state options
 */
export interface ResetOptions {
	/**
	 * Reset target
	 * @default 'context'
	 */
	target?: ResetTarget;
}

/**
 * Mutation function type
 * @typeParam I Mutation input
 * @typeParam T Return value of a successful mutation
 */
export type MutationFn<I, T> = (input: I, signal: AbortSignal) => Promise<T>;

/**
 * Idle mutation state
 * @description Initial state of any mutation.
 *
 * The `data` property will always be the {@link MutationContext#placeholder mutation placeholder} value.
 * @typeParam T Return value of a successful mutation
 */
export interface IdleMutationState<T> {
	/**
	 * The {@link MutationContext#placeholder mutation placeholder} value.
	 */
	readonly data: T | null;
	/**
	 * The idle error field. Always `null`.
	 */
	readonly error: null;
	readonly status: 'idle';
}

/**
 * Loading mutation state
 * @description Loading state of a mutation.
 *
 * While the mutation is on the `loading` state, there will be no `data` nor `error` field set.
 */
export interface LoadingMutationState {
	/**
	 * Loading data field. Always `null`.
	 */
	readonly data: null;
	/**
	 * Loading error field. Always `null`.
	 */
	readonly error: null;
	readonly status: 'loading';
}

/**
 * Success mutation state
 * @description Success state of a mutation.
 *
 * The `data` field is always set with the return of a successful mutation.
 * @typeParam T Return value of a successful mutation
 */
export interface SuccessMutationState<T> {
	/**
	 * Success data field.
	 */
	readonly data: T;
	/**
	 * Success error field. Always `null`.
	 */
	readonly error: null;
	readonly status: 'success';
}

/**
 * Error mutation state
 * @description Error state of a mutation.
 *
 * The `error` field is always set after the mutation fails all retries.
 * @typeParam E Error from a failed {@link MutationFn mutation} execution
 */
export interface ErrorMutationState<E> {
	/**
	 * Error data field. Always `null`.
	 */
	readonly data: null;
	/**
	 * Error field.
	 */
	readonly error: E;
	readonly status: 'error';
}

/**
 * Union of all possible mutation states.
 *
 * - {@link IdleMutationState idle}
 * - {@link LoadingMutationState loading}
 * - {@link SuccessMutationState success}
 * - {@link ErrorMutationState error}
 * @typeParam T Return value of a successful mutation
 * @typeParam E Error from a failed {@link MutationFn mutation} execution
 */
export type MutationState<T, E> =
	| IdleMutationState<T>
	| LoadingMutationState
	| SuccessMutationState<T>
	| ErrorMutationState<E>;

/**
 * Mutation state transition
 * @description A object that represents the transition of a {@link MutationState mutation state}.
 * @typeParam T Return value of a successful mutation
 * @typeParam E Error from a failed {@link MutationFn mutation} execution
 */
export interface MutationStateTransition<T, E> {
	/**
	 * Current mutation state
	 */
	readonly current: MutationState<T, E>;
	/**
	 * Next mutation state
	 */
	readonly next: MutationState<T, E>;
}

/**
 * Mutation filter function
 * @description A {@link MutationStateTransition mutation state transition} predicate function.
 *
 * Executed for each transition. Should return `true` to allow the state transition.
 * @typeParam T Return value of a successful mutation
 * @typeParam E Error from a failed {@link MutationFn mutation} execution
 */
export type MutationFilterFn<T, E> = (transition: MutationStateTransition<T, E>) => boolean;

/**
 * Mutation state handler
 * @description Handler function that is executed for **every** new {@link MutationState mutation state}.
 * @param state Current mutation state
 * @param cache Cache handler
 * @typeParam T Return value of a successful mutation
 * @typeParam E Error from a failed {@link MutationFn mutation} execution
 */
export type MutationStateHandler<T, E> = (
	state: MutationState<T, E>,
	cache: CacheHandler
) => Promise<void>;

/**
 * Mutation data handler
 * @description Handler function that is executed for **every**
 * new {@link MutationState mutation state} that has a `data` field.
 * @param data Mutation state `data` field
 * @param cache Cache handler
 * @typeParam T Return value of a successful mutation
 */
export type MutationDataHandler<T> = (data: T, cache: CacheHandler) => Promise<void>;

/**
 * Mutation error handler
 * @description Handler function that is executed for **every**
 * new {@link MutationState mutation state} that has an `error` field.
 * @param error Mutation state `error` field
 * @param cache Cache handler
 * @typeParam E Error from a failed {@link MutationFn mutation} execution
 */
export type MutationErrorHandler<E> = (error: E, cache: CacheHandler) => Promise<void>;

/**
 * Mutation handler
 * @description Object with all optional mutation handlers.
 * @typeParam T Return value of a successful mutation
 * @typeParam E Error from a failed {@link MutationFn mutation} execution
 */
export interface MutationHandler<T, E> {
	stateFn: MutationStateHandler<T, E> | null;
	dataFn: MutationDataHandler<T> | null;
	errorFn: MutationErrorHandler<E> | null;
}
