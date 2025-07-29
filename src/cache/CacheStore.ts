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
	 * Remain Time To Live in milliseconds (duration).
	 */
	readonly remain_ttl: number;
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
}
