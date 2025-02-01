import type { CacheEntry, CacheStore } from '@/Cache';

export interface LRUCacheEntry<T> {
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

function mapLRUCacheEntryToCacheEntry<T>(entry: LRUCacheEntry<T>): CacheEntry<T> {
	const remain_ttl = entry.ttl - (Date.now() - entry.date);
	return { data: entry.data, ttl: entry.ttl, remain_ttl };
}

/**
 * Aproximate LRU Cache
 *
 * @see https://redis.io/docs/reference/eviction/#approximated-lru-algorithm
 * @see http://oldblog.antirez.com/post/redis-as-LRU-cache.html
 * @see http://antirez.com/news/109
 */
export class AproximateLRUCache<T> implements CacheStore<string, T> {
	public readonly storage: Map<string, LRUCacheEntry<T>>;

	public constructor(
		storage: Map<string, LRUCacheEntry<T>>,
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

	public async getEntry(key: string): Promise<CacheEntry<T> | undefined> {
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
		return mapLRUCacheEntryToCacheEntry(entry);
	}

	public async get(key: string): Promise<T | undefined> {
		return (await this.getEntry(key))?.data;
	}

	public async set(key: string, data: T, ttl: number): Promise<void> {
		if (this.length >= this.capacity) {
			this.evict(this.eviction_count, this.tru_duration_threshold, true);
		}

		const now = Date.now();
		this.length++;
		this.storage.set(key, { data, tru: now, ttl, date: now });
	}

	public async delete(key: string): Promise<void> {
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
