import { AproximateLRUCache, type LRUCacheEntry } from '@/Cache/AproximateLRUCache';

/**
 *
 * @param capacity AproximateLRUCache capacity
 * @param tru_duration_threshold AproximateLRUCache TRU duration threshold. Default of `5` seconds
 */
export function makeCache<T>(
	capacity: number = 10,
	tru_duration_threshold: number = 5 * 1000
): [Map<string, LRUCacheEntry<T>>, AproximateLRUCache<T>] {
	const storage = new Map<string, LRUCacheEntry<T>>();
	const cache = new AproximateLRUCache<T>(storage, capacity, tru_duration_threshold);
	return [storage, cache];
}
