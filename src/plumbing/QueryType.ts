import type {
	KeyHashFn,
	QueryFn,
	KeepCacheOnErrorFn,
	Millisecond,
	QueryState,
	QueryStateHandler,
	QueryDataHandler,
	QueryErrorHandler,
	QueryFilterFn,
	QueryProviderData,
	QueryStatePromise,
	ExtractTTLFn,
} from '@/core/Type';
import type { PubSub, Subscriber } from '@/PubSub';
import type { RetryHandlerFn, RetryPolicy } from '@/core/RetryPolicy';
import type { CacheStore } from '@/cache/CacheStore';
import type { CacheManager } from '@/cache/CacheManager';

/**
 * @summary Query subscriber
 * @description Query state subscriber
 */
export type QuerySubscriber<T, E> = Subscriber<QueryProviderData<T, E>, QueryStatePromise<T, E>>;

/**
 * @summary Query provider
 * @description Query state provider
 */
export type QueryProvider<T, E> = PubSub<QueryProviderData<T, E>, QueryStatePromise<T, E>>;

/**
 * @summary Query context
 */
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
	/**
	 * @summary Default TTL duration
	 */
	readonly ttl: Millisecond;
	/**
	 * @summary Cache fresh duration
	 */
	readonly fresh: Millisecond;
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
	 * @summary Extract TTL function
	 */
	extractTTLFn: ExtractTTLFn<T>;
	/**
	 * @summary Query state handler
	 */
	stateFn: QueryStateHandler<T, E> | null;
	/**
	 * @summary Query data handler
	 */
	dataFn: QueryDataHandler<T> | null;
	/**
	 * @summary Query error handler
	 */
	errorFn: QueryErrorHandler<E> | null;
	/**
	 * @summary Query state filter
	 */
	filterFn: QueryFilterFn<T, E>;
	/**
	 * @summary Query state
	 */
	state: QueryState<T, E>;
}

/**
 * @description Query context mutable attributes
 */
export type QueryContextMut<K extends ReadonlyArray<unknown>, T, E = unknown> = Pick<
	QueryContext<K, T, E>,
	| 'queryFn'
	| 'retryHandleFn'
	| 'keepCacheOnErrorFn'
	| 'extractTTLFn'
	| 'stateFn'
	| 'dataFn'
	| 'errorFn'
	| 'filterFn'
	| 'state'
>;

/**
 * @description Query context mutable functions
 */
export type QueryContextMutFns<K extends ReadonlyArray<unknown>, T, E = unknown> = Pick<
	QueryContext<K, T, E>,
	| 'queryFn'
	| 'retryHandleFn'
	| 'keepCacheOnErrorFn'
	| 'extractTTLFn'
	| 'stateFn'
	| 'dataFn'
	| 'errorFn'
	| 'filterFn'
>;

/**
 * @summary Query input
 * @description Query input options that make up the query context.
 */
export interface QueryInput<K extends ReadonlyArray<unknown>, T, E = unknown> {
	/**
	 * @summary Idle state placeholder
	 */
	placeholder?: T | null;
	/**
	 * @summary Cache store
	 */
	store: CacheStore<string, T>;
	/**
	 * @summary Query function
	 * @description Async function that will be called to query the data `T`.
	 */
	queryFn: QueryFn<K, T>;
	/**
	 * @summary Key hasher
	 */
	keyHashFn?: KeyHashFn<K>;
	/**
	 * @summary Retry policy
	 */
	retryPolicy?: RetryPolicy<E>;
	/**
	 * @summary Retry handler
	 * @description Callback executed **before** every retry
	 */
	retryHandleFn?: RetryHandlerFn<E> | null;
	/**
	 * @summary Keep cache on error
	 * @description Check whether the current cache entry should be kept after a failed query execution.
	 */
	keepCacheOnErrorFn?: KeepCacheOnErrorFn<E>;
	/**
	 * @summary Extract TTL function
	 */
	extractTTLFn?: ExtractTTLFn<T>;
	/**
	 * @summary Default TTL duration
	 * @description Time To Live (duration) of cache entries.
	 *
	 * ### Invariant
	 *
	 * Must be greater than or equal {@link fresh} cache duration.
	 */
	ttl?: Millisecond;
	/**
	 * @summary Cache fresh duration
	 * @description Duration in which cache entries will be fresh.
	 *
	 * ### Invariant
	 *
	 * Must be less than or equal the cache {@link ttl}.
	 *
	 * ### Pro tip
	 *
	 * If all of the cache results **must be stale**, set the fresh
	 * option to zero.
	 *
	 * If all of the cache results **must be fresh**, set the fresh
	 * option equal to the cache {@link ttl}.
	 */
	fresh?: Millisecond;
	/**
	 * @summary Query state handler
	 */
	stateFn?: QueryStateHandler<T, E> | null;
	/**
	 * @summary Query data handler
	 */
	dataFn?: QueryDataHandler<T> | null;
	/**
	 * @summary Query error handler
	 */
	errorFn?: QueryErrorHandler<E> | null;
	/**
	 * @summary Query state filter
	 */
	filterFn?: QueryFilterFn<T, E>;
	/**
	 * @summary State provider.
	 */
	provider?: QueryProvider<T, E> | null;
}

/**
 * @summary Local query input
 * @description Local input options for a query context
 */
export type LocalQueryInput<K extends ReadonlyArray<unknown>, T, E = unknown> = Pick<
	QueryInput<K, T, E>,
	| 'placeholder'
	| 'queryFn'
	| 'retryPolicy'
	| 'retryHandleFn'
	| 'keepCacheOnErrorFn'
	| 'extractTTLFn'
	| 'ttl'
	| 'fresh'
	| 'stateFn'
	| 'dataFn'
	| 'errorFn'
	| 'filterFn'
>;
