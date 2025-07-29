import type { Millisecond } from '@/core/Type';
import type { CacheEntry } from '@/cache/CacheStore';

/**
 * Returns the {@link CacheEntry cache entry} duration in {@link Millisecond milliseconds}
 * @param entry Cache entry
 * @returns Duration in milliseconds
 * @typeParam T Data type
 */
export function cacheEntryDuration<T>(entry: CacheEntry<T>): Millisecond {
	return entry.ttl - entry.remain_ttl;
}

/**
 * Returns `true` if the {@link CacheEntry cache entry} is *fresh*, `false` otherwise
 * @param entry Cache entry
 * @param fresh Fresh duration
 * @returns Boolean
 * @typeParam T Data type
 */
export function isCacheEntryFresh<T>(entry: CacheEntry<T>, fresh: Millisecond): boolean {
	return entry.ttl - entry.remain_ttl < fresh;
}
