import type {
	CacheDirective,
	ExtractTTLFn,
	GenericQueryKey,
	KeepCacheOnErrorFn,
	KeyPair,
	Millisecond,
	MutationFn,
	MutationState,
	QueryExecutionResult,
	QueryFn,
	QueryState,
} from '@/core/Type';
import type { CacheEntry } from '@/core/Cache';
import type { RetryHandlerFn, RetryPolicy } from '@/core/RetryPolicy';

export interface ClientExecuteQueryOptions<K extends GenericQueryKey, T, E = unknown> {
	/**
	 * Query key
	 */
	key: K;
	/**
	 * Query function
	 * @description Async function that will be called to query the data `T`.
	 */
	queryFn: QueryFn<K, T>;
	/**
	 * Retry policy
	 */
	retryPolicy?: RetryPolicy<E>;
	/**
	 * Retry handler
	 * @description Callback executed **before** every retry
	 */
	retryHandleFn?: RetryHandlerFn<E> | null;
	/**
	 * Keep cache on error
	 * @description Check whether the current cache entry should be kept after a failed query execution.
	 */
	keepCacheOnErrorFn?: KeepCacheOnErrorFn<E>;
	/**
	 * Extract TTL function
	 */
	extractTTLFn?: ExtractTTLFn<T>;
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
	 * Cache fresh duration
	 */
	fresh?: Millisecond;
	/**
	 * Abort signal
	 */
	signal?: AbortSignal;
}

export interface ClientRunQueryOptions<K extends GenericQueryKey, T, E = unknown> {
	/**
	 * Query key
	 */
	key: K;
	/**
	 * Query function
	 * @description Async function that will be called to query the data `T`.
	 */
	queryFn: QueryFn<K, T>;
	/**
	 * Retry policy
	 */
	retryPolicy?: RetryPolicy<E>;
	/**
	 * Retry handler
	 * @description Callback executed **before** every retry
	 */
	retryHandleFn?: RetryHandlerFn<E> | null;
	/**
	 * Keep cache on error
	 * @description Check whether the current cache entry should be kept after a failed query execution.
	 */
	keepCacheOnErrorFn?: KeepCacheOnErrorFn<E>;
	/**
	 * Extract TTL function
	 */
	extractTTLFn?: ExtractTTLFn<T>;
	/**
	 * Fallback TTL
	 */
	ttl?: Millisecond;
	/**
	 * Cache fresh duration
	 */
	fresh?: Millisecond;
	/**
	 * Abort signal
	 */
	signal?: AbortSignal;
}

export interface ClientExecuteMutationOptions<I, T, E> {
	/**
	 * Mutation input
	 */
	input: I;
	/**
	 * Mutation function
	 */
	mutationFn: MutationFn<I, T>;
	/**
	 * Retry policy
	 */
	retryPolicy?: RetryPolicy<E>;
	/**
	 * Retry handler
	 * @description Callback executed **before** every retry
	 */
	retryHandleFn?: RetryHandlerFn<E> | null;
	/**
	 * Abort signal
	 */
	signal?: AbortSignal;
}

export interface ClientActiveData<T> {
	/**
	 * Query key hash
	 */
	readonly hash: string;
	/**
	 * Query data
	 */
	readonly data: T | undefined;
}

export interface PatchRank extends CacheEntry<unknown> {
	readonly hash: string;
}

export type Patch = ReadonlyArray<PatchRank>;

/**
 * Client interface
 * @description Client interface can run standalone queries, interact with the cache and pending query promises.
 */
export interface Client {
	/**
	 * Execute query. See {@link executeQuery}.
	 * @param options Client execute query options
	 */
	executeQuery<K extends GenericQueryKey, T, E>(
		options: ClientExecuteQueryOptions<K, T, E>
	): Promise<QueryExecutionResult<T, E>>;
	/**
	 * Run active query. See {@link runActiveQuery}.
	 * @param options Client run query options
	 */
	runActiveQuery<K extends GenericQueryKey, T, E>(
		options: ClientRunQueryOptions<K, T, E>
	): Promise<QueryState<T, E>>;
	/**
	 * Run query. See {@link runQuery}.
	 * @param options Client run query options
	 */
	runQuery<K extends GenericQueryKey, T, E>(
		options: ClientRunQueryOptions<K, T, E>
	): Promise<QueryState<T, E>>;
	/**
	 * Execute mutation. See {@link executeMutation}.
	 * @param options Client execute mutation options
	 */
	executeMutation<I, T, E>(
		options: ClientExecuteMutationOptions<I, T, E>
	): Promise<MutationState<T, E>>;

	/**
	 * Get cached data. See {@link CacheHandler#get}.
	 * @param key Query key
	 */
	get<K extends GenericQueryKey, T>(key: K): Promise<T | undefined>;
	/**
	 * Set a cache entry. See {@link CacheHandler#set}.
	 * @param key Query key
	 * @param data Data
	 * @param ttl TTL
	 */
	set<K extends GenericQueryKey, T>(key: K, data: T, ttl?: Millisecond): Promise<void>;
	/**
	 * Invalidate all cache entries that match the prefix of the provided key. See {@link CacheHandler#invalidate}.
	 * @param key Query key
	 */
	invalidate<K extends GenericQueryKey>(key: K): Promise<void>;
	/**
	 * Delete a cache entry with the provided key. See {@link CacheHandler#delete}.
	 * @param key Query key
	 */
	delete<K extends GenericQueryKey>(key: K): Promise<void>;
	/**
	 * Delete all cache entries. See {@link CacheHandler#clear}.
	 */
	clear(): Promise<void>;

	/**
	 * Get all query keys that are in the {@link QuerySharedState shared state}
	 */
	getActiveKeys<K extends GenericQueryKey>(): Array<KeyPair<K>>;
	/**
	 * Get all query data that are in the {@link QuerySharedState shared state}
	 */
	getActiveData<T>(): Promise<Array<ClientActiveData<T>>>;
	/**
	 * Return the number of pending queries that are in the {@link QuerySharedState shared state}
	 */
	loading(): number;
	/**
	 * Wait for all pending queries that are in the {@link QuerySharedState shared state}
	 */
	waitAll(): Promise<number>;
}

/**
 * Detached Client
 * @description A detached client uses its own separated {@link QuerySharedState shared state} and does not
 * emit events in the {@link QueryProvider query provider}.
 *
 * All successful query executions are stored in this instance and can be retrieved
 * with the {@link DetachedClient#commit commit} method.
 */
export interface DetachedClient extends Client {
	/**
	 * Get a patch with all the data acquired from queries executed by this client.
	 * @returns Patch
	 */
	commit(): Promise<Patch>;
}
