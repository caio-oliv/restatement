import type { Millisecond } from '@/core/Type';
import type { CacheEntry } from '@/cache/CacheStore';

/**
 * Returns the cache entry duration.
 * @param entry cache entry
 * @returns duration in milliseconds
 */
export function cacheEntryDuration<T>(entry: CacheEntry<T>): Millisecond {
	return entry.ttl - entry.remain_ttl;
}

/**
 * Returns `true` if the cache entry is fresh, `false` otherwise.
 * @param entry cache entry
 * @param fresh fresh duration
 * @returns boolean
 */
export function isCacheEntryFresh<T>(entry: CacheEntry<T>, fresh: Millisecond): boolean {
	return entry.ttl - entry.remain_ttl < fresh;
}
