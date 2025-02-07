import { LRUCache } from 'lru-cache';
import type { CacheStore } from '@/Cache';
import { LRUCacheAdapter, REQUIRED_LRU_CACHE_OPTIONS } from '@/integration/lru-cache';

export function makeCache<T>(): CacheStore<string, T> {
	const cache = new LRUCache({ max: 1000, ...REQUIRED_LRU_CACHE_OPTIONS }) as LRUCache<
		string,
		object,
		unknown
	>;
	const adapter = new LRUCacheAdapter(cache);
	return adapter as CacheStore<string, T>;
}
