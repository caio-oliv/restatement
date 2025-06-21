import type {
	KeepCacheOnErrorFn,
	KeyHashFn,
	Millisecond,
	MutationControlHandler,
	QueryControlHandler,
} from '@/Type';
import type { CacheStore } from '@/cache/CacheStore';
import type { RetryDelay, RetryHandlerFn } from '@/AsyncModule';
import type { MutationControlInput } from '@/controller/MutationControl';
import type { QueryControlInput, QueryControlProvider } from '@/controller/QueryControl';
import { type CacheManagerInput, CacheManager } from '@/cache/CacheManager';
import { defaultFilterFn } from '@/Default';

export interface RetryConfig<E = unknown> {
	readonly retryDelay: RetryDelay<E>;
	readonly retry: number;
	readonly retryHandler: RetryHandlerFn<E> | null;
}

export interface CacheConfig {
	readonly store: CacheStore<string, unknown>;
	readonly fresh: Millisecond;
	readonly ttl: Millisecond;
}

export interface RestatementConfig<E = unknown> {
	readonly cache: CacheConfig;
	readonly provider: QueryControlProvider<unknown, E>;
	readonly keyHashFn: KeyHashFn<ReadonlyArray<unknown>>;
	readonly keepCacheOnErrorFn: KeepCacheOnErrorFn<E>;

	readonly query: RetryConfig<E>;
	readonly mutation: RetryConfig<E>;
}

/**
 * Make CacheManager input based on the global config
 * @param config config object
 * @returns cache manager input
 */
export function makeCacheInput<E = unknown>(
	config: RestatementConfig<E>
): Required<CacheManagerInput> {
	return {
		store: config.cache.store,
		keyHashFn: config.keyHashFn,
		provider: config.provider as QueryControlProvider<unknown, unknown>,
		ttl: config.cache.ttl,
	};
}

/**
 * Make CacheManager based on the global config
 * @param config config object
 * @returns CacheManager instance
 */
export function makeCacheManager<E = unknown>(config: RestatementConfig<E>): CacheManager {
	return new CacheManager(makeCacheInput(config));
}

export type CustomQueryControlInput<K extends ReadonlyArray<unknown>, T, E = unknown> = Pick<
	QueryControlInput<K, T, E>,
	| 'queryFn'
	| 'placeholder'
	| 'fresh'
	| 'ttl'
	| 'keepCacheOnErrorFn'
	| 'filterFn'
	| 'retry'
	| 'retryDelay'
	| 'retryHandleFn'
> &
	QueryControlHandler<T, E>;

/**
 * Make QueryControl input based on the global config
 * @param config config object
 * @param custom custom query input
 * @returns QueryControl input
 */
export function makeQueryInput<K extends ReadonlyArray<unknown>, T, E = unknown>(
	config: RestatementConfig<E>,
	custom: CustomQueryControlInput<K, T, E>
): Required<QueryControlInput<K, T, E>> {
	return {
		queryFn: custom.queryFn,
		store: config.cache.store as CacheStore<string, T>,
		fresh: custom.fresh ?? config.cache.fresh,
		ttl: custom.ttl ?? config.cache.ttl,
		keepCacheOnErrorFn: custom.keepCacheOnErrorFn ?? config.keepCacheOnErrorFn,
		keyHashFn: config.keyHashFn,
		provider: config.provider as QueryControlProvider<T, E>,
		retry: custom.retry ?? config.query.retry,
		retryDelay: custom.retryDelay ?? config.query.retryDelay,
		retryHandleFn: custom.retryHandleFn ?? config.query.retryHandler,
		handler: { dataFn: custom.dataFn, errorFn: custom.errorFn, stateFn: custom.stateFn },
		placeholder: custom.placeholder ?? null,
		filterFn: custom.filterFn ?? defaultFilterFn,
	};
}

export type CustomMutationControlInput<I, T, E> = Pick<
	MutationControlInput<I, T, E>,
	'mutationFn' | 'placeholder' | 'filterFn' | 'retry' | 'retryDelay' | 'retryHandleFn'
> &
	MutationControlHandler<T, E>;

/**
 * Make MutationControl input based on the global config
 * @param config config object
 * @param custom custom mutation input
 * @returns MutationControl input
 */
export function makeMutationInput<I, T, E = unknown>(
	config: RestatementConfig<E>,
	custom: CustomMutationControlInput<I, T, E>
): Required<MutationControlInput<I, T, E>> {
	return {
		mutationFn: custom.mutationFn,
		cache: makeCacheManager(config),
		retry: custom.retry ?? config.mutation.retry,
		retryDelay: custom.retryDelay ?? config.mutation.retryDelay,
		retryHandleFn: custom.retryHandleFn ?? config.mutation.retryHandler,
		handler: { dataFn: custom.dataFn, errorFn: custom.errorFn, stateFn: custom.stateFn },
		filterFn: custom.filterFn ?? defaultFilterFn,
		placeholder: custom.placeholder ?? null,
	};
}
