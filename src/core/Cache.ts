import type { Millisecond } from '@/core/Type';

/**
 * Cache entry
 * @typeParam T Data type
 */
export interface CacheEntry<T> {
	/**
	 * Entry data.
	 */
	readonly data: T;
	/**
	 * Time To Live in milliseconds (duration).
	 */
	readonly ttl: number;
	/**
	 * Creation time in milliseconds since Unix epoch.
	 */
	readonly time: number;
}

/**
 * Cache store
 * @typeParam K Comparable key type
 * @typeParam V Value type
 */
export interface CacheStore<K, V> {
	/**
	 * Get the data of a cache entry of a key
	 * @param key Unique key
	 */
	get(key: K): Promise<V | undefined>;
	/**
	 * Get the entire cache entry of a key
	 * @param key Unique key
	 */
	getEntry(key: K): Promise<CacheEntry<V> | undefined>;
	/**
	 * Set an entry for this key in the cache
	 * @param key Unique key that references this data
	 * @param data Data being cached
	 * @param ttl Time To Live of this cache entry (duration)
	 */
	set(key: K, data: V, ttl: number): Promise<void>;
	/**
	 * Delete the cache entry of a key
	 * @param key Unique key
	 */
	delete(key: K): Promise<void>;
	/**
	 * Delete all entries that starts with a prefix
	 * @param prefix Key prefix
	 */
	deletePrefix(prefix: K): Promise<void>;
	/**
	 * Delete **ALL** entries
	 */
	clear(): Promise<void>;
}

/**
 * Returns the remain TTL of {@link CacheEntry cache entry}
 * @param entry Cache entry
 * @returns Remain Time To Live
 */
export function cacheEntryRemainTTL<T>(entry: CacheEntry<T>): Millisecond {
	return Math.max(entry.ttl - (Date.now() - entry.time), 0);
}

/**
 * Returns the {@link CacheEntry cache entry} duration in {@link Millisecond milliseconds}
 * @param entry Cache entry
 * @returns Duration in milliseconds
 * @typeParam T Data type
 */
export function cacheEntryDuration<T>(entry: CacheEntry<T>): Millisecond {
	return Date.now() - entry.time;
}

/**
 * Returns `true` if the {@link CacheEntry cache entry} is *fresh*, `false` otherwise
 * @param entry Cache entry
 * @param fresh Fresh duration
 * @returns Boolean
 * @typeParam T Data type
 */
export function isCacheEntryFresh<T>(entry: CacheEntry<T>, fresh: Millisecond): boolean {
	return Date.now() - entry.time < fresh;
}
