import { LRUCache } from 'lru-cache';
import type { CacheStore } from '@/core/Cache';
import { LRUCacheAdapter, REQUIRED_LRU_CACHE_OPTIONS } from '@/integration/lru-cache';

/**
 * @description Make a CacheStore instance with the underlying cache implementation.
 * @returns cache store instance
 */
export function makeCache<T>(): CacheStore<string, T> {
	const cache = new LRUCache({ max: 1000, ...REQUIRED_LRU_CACHE_OPTIONS }) as LRUCache<
		string,
		object,
		unknown
	>;
	const adapter = new LRUCacheAdapter(cache);
	return adapter as CacheStore<string, T>;
}
