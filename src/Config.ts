import type {
	ExtractTTLFn,
	KeepCacheOnErrorFn,
	KeyHashFn,
	Millisecond,
	MutationFilterFn,
	QueryFilterFn,
} from '@/core/Type';
import type { RetryHandlerFn, RetryPolicy } from '@/core/RetryPolicy';
import type { QueryProvider, QueryInput, LocalQueryInput } from '@/plumbing/QueryType';
import type { LocalMutationInput, MutationInput } from '@/plumbing/MutationType';
import type { CacheStore } from '@/cache/CacheStore';
import { type CacheManagerInput, CacheManager } from '@/cache/CacheManager';
import { PubSub } from '@/PubSub';
import {
	DEFAULT_FRESH_DURATION,
	DEFAULT_RETRY_POLICY,
	DEFAULT_TTL_DURATION,
	defaultExtractTTLFn,
	defaultFilterFn,
	defaultKeepCacheOnErrorFn,
	defaultKeyHashFn,
} from '@/Default';

export interface RestatementConfig<T = unknown, E = unknown> {
	readonly cache: CacheConfig;
	readonly provider: QueryProvider<T, E>;
	readonly keyHashFn: KeyHashFn<ReadonlyArray<unknown>>;
	readonly keepCacheOnErrorFn: KeepCacheOnErrorFn<E>;

	readonly query: QueryConfig<T, E>;
	readonly mutation: MutationConfig<T, E>;
}

export interface CacheConfig {
	readonly ttl: Millisecond;
	readonly fresh: Millisecond;
	readonly store: CacheStore<string, unknown>;
}

export interface QueryConfig<T = unknown, E = unknown> {
	readonly retry: RetryConfig<E>;
	readonly extractTTLFn: ExtractTTLFn<T>;
	readonly filterFn: QueryFilterFn<T, E>;
}

export interface MutationConfig<T = unknown, E = unknown> {
	readonly retry: RetryConfig<E>;
	readonly filterFn: MutationFilterFn<T, E>;
}

export interface RetryConfig<E = unknown> {
	readonly policy: RetryPolicy<E>;
	readonly handleFn: RetryHandlerFn<E> | null;
}

export type PartialRestatementConfig<T = unknown, E = unknown> = Partial<
	Omit<RestatementConfig<T, E>, 'cache' | 'query' | 'mutation'>
> & {
	readonly cache?: PartialCacheConfig;
	readonly query?: PartialQueryConfig<T, E>;
	readonly mutation?: PartialMutationConfig<T, E>;
};

export type PartialCacheConfig = Partial<Omit<CacheConfig, 'store'>>;

export type PartialQueryConfig<T = unknown, E = unknown> = Partial<
	Omit<QueryConfig<T, E>, 'retry'>
> & {
	readonly retry?: PartialRetryConfig<E>;
};

export type PartialMutationConfig<T = unknown, E = unknown> = Partial<
	Omit<MutationConfig<T, E>, 'retry'>
> & {
	readonly retry?: PartialRetryConfig<E>;
};

export type PartialRetryConfig<E = unknown> = Partial<RetryConfig<E>>;

/**
 * @description Make a {@link RestatementConfig} object.
 * @param store cache store instance
 * @param config partial restatement config
 * @returns restatement config
 */
// eslint-disable-next-line complexity
export function restatementConfig<T = unknown, E = unknown>(
	store: CacheStore<string, E>,
	config: PartialRestatementConfig<T, E> = {}
): RestatementConfig<T, E> {
	return {
		cache: {
			ttl: config.cache?.ttl ?? DEFAULT_TTL_DURATION,
			fresh: config.cache?.fresh ?? DEFAULT_FRESH_DURATION,
			store,
		},
		provider: config.provider ?? new PubSub(),
		keyHashFn: config.keyHashFn ?? defaultKeyHashFn,
		keepCacheOnErrorFn: config.keepCacheOnErrorFn ?? defaultKeepCacheOnErrorFn,
		query: {
			retry: {
				policy: config.query?.retry?.policy ?? DEFAULT_RETRY_POLICY,
				handleFn: config.query?.retry?.handleFn ?? null,
			},
			extractTTLFn: config.query?.extractTTLFn ?? defaultExtractTTLFn,
			filterFn: config.query?.filterFn ?? defaultFilterFn,
		},
		mutation: {
			retry: {
				policy: config.mutation?.retry?.policy ?? DEFAULT_RETRY_POLICY,
				handleFn: config.mutation?.retry?.handleFn ?? null,
			},
			filterFn: config.mutation?.filterFn ?? defaultFilterFn,
		},
	};
}

/**
 * @description Make a {@link CacheManagerInput `CacheManagerInput`} based on the {@link RestatementConfig global config}.
 * @param config config object
 * @returns CacheManager input
 */
export function makeCacheManagerInput<T = unknown, E = unknown>(
	config: RestatementConfig<T, E>
): Required<CacheManagerInput> {
	return {
		store: config.cache.store,
		keyHashFn: config.keyHashFn,
		provider: config.provider as QueryProvider<unknown, unknown>,
		ttl: config.cache.ttl,
	};
}

/**
 * @description Make a {@link CacheManager `CacheManager`} based on the {@link RestatementConfig global config}.
 * @param config config object
 * @returns CacheManager instance
 */
export function makeCacheManager<T = unknown, E = unknown>(
	config: RestatementConfig<T, E>
): CacheManager {
	return new CacheManager(makeCacheManagerInput(config));
}

/**
 * @description Make a {@link QueryInput `QueryInput`} based on the {@link RestatementConfig global config}.
 * @param config config object
 * @param local local query input
 * @returns query input
 */
export function makeQueryInput<K extends ReadonlyArray<unknown>, T, E = unknown>(
	config: RestatementConfig<T, E>,
	local: LocalQueryInput<K, T, E>
): Required<QueryInput<K, T, E>> {
	return {
		placeholder: local.placeholder ?? null,
		store: config.cache.store as CacheStore<string, T>,
		queryFn: local.queryFn,
		keyHashFn: config.keyHashFn,
		retryPolicy: local.retryPolicy ?? config.query.retry.policy,
		retryHandleFn: local.retryHandleFn ?? config.query.retry.handleFn,
		keepCacheOnErrorFn: local.keepCacheOnErrorFn ?? config.keepCacheOnErrorFn,
		extractTTLFn: local.extractTTLFn ?? config.query.extractTTLFn,
		ttl: local.ttl ?? config.cache.ttl,
		fresh: local.fresh ?? config.cache.fresh,
		stateFn: local.stateFn ?? null,
		dataFn: local.dataFn ?? null,
		errorFn: local.errorFn ?? null,
		filterFn: local.filterFn ?? config.query.filterFn,
		provider: config.provider as QueryProvider<T, E>,
	};
}

/**
 * @description Make a {@link MutationInput `MutationInput`} based on the {@link RestatementConfig global config}.
 * @param config config object
 * @param local local mutation input
 * @returns mutation input
 */
export function makeMutationInput<I, T, E = unknown>(
	config: RestatementConfig<T, E>,
	local: LocalMutationInput<I, T, E>
): Required<MutationInput<I, T, E>> {
	return {
		placeholder: local.placeholder ?? null,
		cache: makeCacheManager(config),
		mutationFn: local.mutationFn,
		retryPolicy: local.retryPolicy ?? config.mutation.retry.policy,
		retryHandleFn: local.retryHandleFn ?? config.mutation.retry.handleFn,
		stateFn: local.stateFn ?? null,
		dataFn: local.dataFn ?? null,
		errorFn: local.errorFn ?? null,
		filterFn: local.filterFn ?? config.mutation.filterFn,
	};
}
