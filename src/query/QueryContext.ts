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
	QueryProviderEvent,
	ExtractTTLFn,
	QuerySharedState,
} from '@/core/Type';
import type { PubSub, Subscriber } from '@/PubSub';
import type { RetryHandlerFn, RetryPolicy } from '@/core/RetryPolicy';
import type { CacheStore } from '@/core/Cache';
import type { CacheManager } from '@/cache/CacheManager';

/**
 * Query subscriber
 * @description {@link Subscriber} for {@link QueryProviderEvent query events} and {@link QuerySharedState shared state}.
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 */
export type QuerySubscriber<T, E> = Subscriber<QueryProviderEvent<T, E>, QuerySharedState<T, E>>;

/**
 * Query provider
 * @description {@link PubSub Provider} for {@link QueryProviderEvent query events} and {@link QuerySharedState shared state}.
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 */
export type QueryProvider<T, E> = PubSub<QueryProviderEvent<T, E>, QuerySharedState<T, E>>;

/**
 * Query context
 * @description A query context describes the state and behavior of a particular query.
 *
 * It is an aggregate of every component that makes a query.
 * @typeParam K Tuple with the query function inputs
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
 */
export interface QueryContext<K extends ReadonlyArray<unknown>, T, E = unknown> {
	/**
	 * Idle state placeholder
	 */
	readonly placeholder: T | null;
	/**
	 * Cache store
	 * @description Internal cache store interface.
	 */
	readonly internalCache: CacheStore<string, T>;
	/**
	 * Cache manager
	 * @description Public cache interface for interacting with cached query data.
	 */
	readonly cache: CacheManager;
	/**
	 * PubSub subscriber
	 */
	readonly subscriber: QuerySubscriber<T, E>;
	/**
	 * Retry policy
	 */
	readonly retryPolicy: RetryPolicy<E>;
	/**
	 * Default TTL duration
	 */
	readonly ttl: Millisecond;
	/**
	 * Cache fresh duration
	 */
	readonly fresh: Millisecond;
	/**
	 * Key hasher
	 */
	readonly keyHashFn: KeyHashFn<K>;
	/**
	 * Query function
	 */
	queryFn: QueryFn<K, T>;
	/**
	 * Retry handler
	 * @description Callback executed **before** every retry
	 */
	retryHandleFn: RetryHandlerFn<E> | null;
	/**
	 * Keep cache on error
	 * @description Check whether the current cache entry should be kept after a failed query execution.
	 */
	keepCacheOnErrorFn: KeepCacheOnErrorFn<E>;
	/**
	 * Extract TTL function
	 */
	extractTTLFn: ExtractTTLFn<T>;
	/**
	 * Query state handler
	 */
	stateFn: QueryStateHandler<T, E> | null;
	/**
	 * Query data handler
	 */
	dataFn: QueryDataHandler<T> | null;
	/**
	 * Query error handler
	 */
	errorFn: QueryErrorHandler<E> | null;
	/**
	 * Query state filter
	 */
	filterFn: QueryFilterFn<T, E>;
	/**
	 * Query state
	 */
	state: QueryState<T, E>;
}

/**
 * Query context mutable attributes
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
 * Query context mutable functions
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
 * Query input
 * @description Query input options that make up the query context.
 * @typeParam K Tuple with the query function inputs
 * @typeParam T Return value of a successful query
 * @typeParam E Error from a failed {@link QueryFn query} execution
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
	 * @description Async function that will be called to query the data `T`.
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
	 * Default TTL duration
	 * @description Time To Live (duration) of cache entries.
	 *
	 * ### Invariant
	 *
	 * Must be greater than or equal {@link fresh} cache duration.
	 */
	ttl?: Millisecond;
	/**
	 * Cache fresh duration
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
	 * Query state handler
	 */
	stateFn?: QueryStateHandler<T, E> | null;
	/**
	 * Query data handler
	 */
	dataFn?: QueryDataHandler<T> | null;
	/**
	 * Query error handler
	 */
	errorFn?: QueryErrorHandler<E> | null;
	/**
	 * Query state filter
	 */
	filterFn?: QueryFilterFn<T, E>;
	/**
	 * State provider.
	 */
	provider?: QueryProvider<T, E> | null;
}

/**
 * Local query input
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
