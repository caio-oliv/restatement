import type { KeepCacheOnErrorFn, KeyHashFn, Millisecond } from '@/core/Type';
import type { RetryHandlerFn, RetryPolicy } from '@/core/RetryPolicy';
import type { QueryProvider, QueryInput, LocalQueryInput } from '@/plumbing/QueryType';
import type { CacheStore } from '@/cache/CacheStore';
import type { MutationControlInput } from '@/controller/MutationControl';
import { type CacheManagerInput, CacheManager } from '@/cache/CacheManager';
import { DEFAULT_RETRY_POLICY, defaultExtractTTLFn, defaultFilterFn } from '@/Default';

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
export function makeCacheManagerInput<E = unknown>(
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
	return new CacheManager(makeCacheManagerInput(config));
}

/**
 * Make QueryControl input based on the global config
 * @param config config object
 * @param local local query input
 * @returns QueryControl input
 */
export function makeQueryInput<K extends ReadonlyArray<unknown>, T, E = unknown>(
	config: RestatementConfig<E>,
	local: LocalQueryInput<K, T, E>
): Required<QueryInput<K, T, E>> {
	return {
		placeholder: local.placeholder ?? null,
		store: config.cache.store as CacheStore<string, T>,
		queryFn: local.queryFn,
		keyHashFn: config.keyHashFn,
		retryPolicy: local.retryPolicy ?? DEFAULT_RETRY_POLICY,
		retryHandleFn: local.retryHandleFn ?? config.query.retryHandler,
		keepCacheOnErrorFn: local.keepCacheOnErrorFn ?? config.keepCacheOnErrorFn,
		extractTTLFn: local.extractTTLFn ?? defaultExtractTTLFn,
		ttl: local.ttl ?? config.cache.ttl,
		fresh: local.fresh ?? config.cache.fresh,
		stateFn: local.stateFn ?? null,
		dataFn: local.dataFn ?? null,
		errorFn: local.errorFn ?? null,
		filterFn: local.filterFn ?? defaultFilterFn,
		provider: config.provider as QueryProvider<T, E>,
	};
}

export type LocalMutationInput<I, T, E> = Pick<
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
 * @param local local mutation input
 * @returns MutationControl input
 */
export function makeMutationInput<I, T, E = unknown>(
	config: RestatementConfig<E>,
	local: LocalMutationInput<I, T, E>
): Required<MutationControlInput<I, T, E>> {
	return {
		mutationFn: local.mutationFn,
		cache: makeCacheManager(config),
		retryPolicy: local.retryPolicy ?? DEFAULT_RETRY_POLICY,
		retryHandleFn: local.retryHandleFn ?? config.mutation.retryHandler,
		filterFn: local.filterFn ?? defaultFilterFn,
		dataFn: local.dataFn ?? null,
		errorFn: local.errorFn ?? null,
		stateFn: local.stateFn ?? null,
		placeholder: local.placeholder ?? null,
	};
}
