export interface CacheEntry<T> {
	data: T;
	/**
	 * Time To Live in milliseconds.
	 */
	ttl: number;
	/**
	 * Time Recently Used in milliseconds.
	 */
	tru: number;
	/**
	 * Time that the entry was created.
	 */
	date: number;
}

export interface CacheStore<T> {
	/**
	 * Get the data of a cache entry of a key.
	 *
	 * @param key Unique key.
	 */
	get(key: string): T | undefined;
	/**
	 * Get the entire cache entry of a key.
	 *
	 * @param key Unique key.
	 */
	getEntry(key: string): CacheEntry<T> | undefined;
	/**
	 * Set a entry for this key in the cache.
	 *
	 * @param key Unique key that references this data.
	 * @param data Data being cached.
	 * @param ttl Time To Live of this cache entry.
	 */
	set(key: string, data: T, ttl: number): void;
	/**
	 * Delete the cache entry of a key.
	 *
	 * @param key Unique key.
	 */
	delete(key: string): void;
}

export interface MapStorage<Data> {
	get(key: string): Data | undefined;
	set(key: string, value: Data): void;
	delete(key: string): void;
}

// NOTE: interface for IndexedDB
// export interface BTreeStorage<Data> {
// 	get(key: string): Data | undefined;
// 	set(key: string, value: Data): void;
// 	delete(key: string): void;
// 	entries(): IterableIterator<[string, Data]>;
// }

/**
 * Aproximate LRU Cache
 *
 * @see https://redis.io/docs/reference/eviction/#approximated-lru-algorithm
 * @see http://oldblog.antirez.com/post/redis-as-LRU-cache.html
 * @see http://antirez.com/news/109
 */
export class AproximateLRUCache<T> implements CacheStore<T> {
	public readonly storage: Map<string, CacheEntry<T>>;

	public constructor(
		storage: Map<string, CacheEntry<T>>,
		capacity: number,
		// TODO: remove tru_duration_threshold for configuration simplicity
		tru_duration_threshold: number,
		length: number = 0
	) {
		this.capacity = capacity;
		this.storage = storage;
		this.length = length;
		this.eviction_count = Math.min(Math.ceil(capacity * 0.05), 64);
		this.tru_duration_threshold = tru_duration_threshold;
	}

	public getEntry(key: string): CacheEntry<T> | undefined {
		const entry = this.storage.get(key);
		if (entry === undefined) return;

		const now = Date.now();
		if (now >= entry.ttl) {
			this.storage.delete(key);
			return;
		}
		// Is assumed that the store references the data. So this mutation
		// also changes the stored value.
		entry.tru = now;
		return entry;
	}

	public get(key: string): T | undefined {
		return this.getEntry(key)?.data;
	}

	public set(key: string, data: T, ttl: number): void {
		if (this.length >= this.capacity) {
			this.evict(this.eviction_count, this.tru_duration_threshold, true);
		}

		const now = Date.now();
		this.length++;
		this.storage.set(key, { data, tru: now, ttl, date: now });
	}

	public delete(key: string): void {
		this.length--;
		this.storage.delete(key);
	}

	public evict(
		count: number,
		tru_duration_threshold: number,
		continue_on_deletion: boolean = false
	): number {
		const now = Date.now();
		const tru_threshold = now - tru_duration_threshold;
		let deleted = 0;

		// TODO: Start at a random index of this map
		// https://github.com/tc39/proposal-iterator-helpers#droplimit
		for (const [key, entry] of this.storage.entries()) {
			if (now >= entry.ttl || entry.tru <= tru_threshold) {
				deleted++;
				this.storage.delete(key);
				if (continue_on_deletion) continue;
			}

			if (deleted === count) break;
		}

		this.length -= deleted;
		return deleted;
	}

	public getCapacity(): number {
		return this.capacity;
	}

	private capacity: number;
	private length: number;
	private eviction_count: number;
	private tru_duration_threshold: number;
}
