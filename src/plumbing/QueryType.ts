import type {
	KeyHashFn,
	QueryFn,
	KeepCacheOnErrorFn,
	Millisecond,
	QueryState,
	QueryStateHandler,
	DataHandler,
	ErrorHandler,
	QueryFilterFn,
	QueryProviderState,
	QueryStatePromise,
} from '@/core/Type';
import type { PubSub, Subscriber } from '@/PubSub';
import type { RetryHandlerFn, RetryPolicy } from '@/core/RetryPolicy';
import type { CacheStore } from '@/cache/CacheStore';
import type { CacheManager } from '@/cache/CacheManager';

export type QuerySubscriber<T, E> = Subscriber<QueryProviderState<T, E>, QueryStatePromise<T, E>>;

export interface QueryContext<K extends ReadonlyArray<unknown>, T, E = unknown> {
	/**
	 * @summary Idle state placeholder
	 */
	readonly placeholder: T | null;
	/**
	 * @summary Cache store
	 * @description Internal cache store interface.
	 */
	readonly internalCache: CacheStore<string, T>;
	/**
	 * @summary Cache manager
	 * @description Public cache interface for interacting with cached query data.
	 */
	readonly cache: CacheManager;
	/**
	 * @summary PubSub subscriber
	 */
	readonly subscriber: QuerySubscriber<T, E>;
	/**
	 * @summary Retry policy
	 */
	readonly retryPolicy: RetryPolicy<E>;
	readonly fresh: Millisecond;
	readonly ttl: Millisecond;
	/**
	 * @summary Key hasher
	 */
	readonly keyHashFn: KeyHashFn<K>;
	/**
	 * @summary Query function
	 */
	queryFn: QueryFn<K, T>;
	/**
	 * @summary Retry handler
	 * @description Callback executed **before** every retry
	 */
	retryHandleFn: RetryHandlerFn<E> | null;
	/**
	 * @summary Keep cache on error
	 * @description Check whether the current cache entry should be kept after a failed query execution.
	 */
	keepCacheOnErrorFn: KeepCacheOnErrorFn<E>;
	/**
	 * @summary Query state handler
	 */
	stateFn: QueryStateHandler<T, E> | null;
	/**
	 * @summary Query data handler
	 */
	dataFn: DataHandler<T> | null;
	/**
	 * @summary Query error handler
	 */
	errorFn: ErrorHandler<E> | null;
	/**
	 * @summary Query state filter
	 */
	filterFn: QueryFilterFn<T, E>;
	/**
	 * @summary Query state
	 */
	state: QueryState<T, E>;
}

export type QueryContextMut<K extends ReadonlyArray<unknown>, T, E = unknown> = Pick<
	QueryContext<K, T, E>,
	| 'queryFn'
	| 'retryHandleFn'
	| 'keepCacheOnErrorFn'
	| 'stateFn'
	| 'dataFn'
	| 'errorFn'
	| 'filterFn'
	| 'state'
>;

export type QueryContextMutFns<K extends ReadonlyArray<unknown>, T, E = unknown> = Pick<
	QueryContext<K, T, E>,
	'queryFn' | 'retryHandleFn' | 'keepCacheOnErrorFn' | 'stateFn' | 'dataFn' | 'errorFn' | 'filterFn'
>;

export type QueryProvider<T, E> = PubSub<QueryProviderState<T, E>, QueryStatePromise<T, E>>;

/**
 * @summary Query input
 * @description Query input options that make up the query context.
 */
export interface QueryInput<K extends ReadonlyArray<unknown>, T, E = unknown> {
	/**
	 * Idle state placeholder
	 */
	placeholder?: T | null;
	/**
	 * Cache store
	 */
	store: CacheStore<string, T>;
	/**
	 * Query function
	 *
	 * The function that will be called to query the data `T`.
	 */
	queryFn: QueryFn<K, T>;
	/**
	 * Key hasher
	 */
	keyHashFn?: KeyHashFn<K>;
	/**
	 * Retry policy
	 */
	retryPolicy?: RetryPolicy<E>;
	/**
	 * Retry handler function
	 */
	retryHandleFn?: RetryHandlerFn<E> | null;
	/**
	 * @summary Keep cache on error
	 * @description Check whether the current cache entry should be kept after a failed query execution.
	 */
	keepCacheOnErrorFn?: KeepCacheOnErrorFn<E>;
	/**
	 * @description Duration in which cache entries will be fresh.
	 *
	 * ## Pro tip
	 *
	 * If all of the cache results **must be stale**, set the fresh
	 * option to zero.
	 *
	 * If all of the cache results **must be fresh**, set the fresh
	 * option equal to the cache {@link ttl}.
	 *
	 * ## Invariant
	 *
	 * Must be less than or equal the cache {@link ttl}.
	 * @default 30 * 1000; // 30 seconds
	 */
	fresh?: Millisecond;
	/**
	 * @description Time To Live (duration) of cache entries.
	 *
	 * ## Invariant
	 *
	 * Must be greater than or equal {@link fresh} cache duration.
	 * @default 3 * 60 * 1000 // 3 minutes
	 */
	ttl?: Millisecond;
	/**
	 * @summary Query state handler
	 */
	stateFn?: QueryStateHandler<T, E> | null;
	/**
	 * @summary Query data handler
	 */
	dataFn?: DataHandler<T> | null;
	/**
	 * @summary Query error handler
	 */
	errorFn?: ErrorHandler<E> | null;
	/**
	 * Query state filter function
	 */
	filterFn?: QueryFilterFn<T, E>;
	/**
	 * State provider.
	 */
	provider?: QueryProvider<T, E> | null;
}
