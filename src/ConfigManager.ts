import type { KeepCacheOnErrorFn, KeyHashFn, Millisecond } from '@/core/Type';
import type { RetryHandlerFn, RetryPolicy } from '@/core/RetryPolicy';
import type { QueryProvider, QueryInput } from '@/plumbing/QueryType';
import type { CacheStore } from '@/cache/CacheStore';
import type { MutationControlInput } from '@/controller/MutationControl';
import { type CacheManagerInput, CacheManager } from '@/cache/CacheManager';
import { DEFAULT_RETRY_POLICY, defaultFilterFn } from '@/Default';

export interface RetryConfig<E = unknown> {
	readonly retryPolicy: RetryPolicy<E>;
	readonly retryHandler: RetryHandlerFn<E> | null;
}

export interface CacheConfig {
	readonly store: CacheStore<string, unknown>;
	readonly fresh: Millisecond;
	readonly ttl: Millisecond;
}

export interface RestatementConfig<E = unknown> {
	readonly cache: CacheConfig;
	readonly provider: QueryProvider<unknown, E>;
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
		provider: config.provider as QueryProvider<unknown, unknown>,
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
	QueryInput<K, T, E>,
	| 'queryFn'
	| 'placeholder'
	| 'fresh'
	| 'ttl'
	| 'keepCacheOnErrorFn'
	| 'filterFn'
	| 'retryPolicy'
	| 'retryHandleFn'
	| 'stateFn'
	| 'dataFn'
	| 'errorFn'
>;

export type QueryControlMutableInput<K extends ReadonlyArray<unknown>, T, E = unknown> = Pick<
	QueryInput<K, T, E>,
	'queryFn' | 'keepCacheOnErrorFn' | 'filterFn' | 'retryHandleFn' | 'stateFn' | 'dataFn' | 'errorFn'
>;

/**
 * Make QueryControl input based on the global config
 * @param config config object
 * @param custom custom query input
 * @returns QueryControl input
 */
export function makeQueryInput<K extends ReadonlyArray<unknown>, T, E = unknown>(
	config: RestatementConfig<E>,
	custom: CustomQueryControlInput<K, T, E>
): Required<QueryInput<K, T, E>> {
	return {
		queryFn: custom.queryFn,
		store: config.cache.store as CacheStore<string, T>,
		fresh: custom.fresh ?? config.cache.fresh,
		ttl: custom.ttl ?? config.cache.ttl,
		keepCacheOnErrorFn: custom.keepCacheOnErrorFn ?? config.keepCacheOnErrorFn,
		keyHashFn: config.keyHashFn,
		provider: config.provider as QueryProvider<T, E>,
		retryPolicy: custom.retryPolicy ?? DEFAULT_RETRY_POLICY,
		retryHandleFn: custom.retryHandleFn ?? config.query.retryHandler,
		dataFn: custom.dataFn ?? null,
		errorFn: custom.errorFn ?? null,
		stateFn: custom.stateFn ?? null,
		placeholder: custom.placeholder ?? null,
		filterFn: custom.filterFn ?? defaultFilterFn,
	};
}

export type CustomMutationControlInput<I, T, E> = Pick<
	MutationControlInput<I, T, E>,
	| 'mutationFn'
	| 'placeholder'
	| 'filterFn'
	| 'retryPolicy'
	| 'retryHandleFn'
	| 'stateFn'
	| 'dataFn'
	| 'errorFn'
>;

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
		retryPolicy: custom.retryPolicy ?? DEFAULT_RETRY_POLICY,
		retryHandleFn: custom.retryHandleFn ?? config.mutation.retryHandler,
		filterFn: custom.filterFn ?? defaultFilterFn,
		dataFn: custom.dataFn ?? null,
		errorFn: custom.errorFn ?? null,
		stateFn: custom.stateFn ?? null,
		placeholder: custom.placeholder ?? null,
	};
}
