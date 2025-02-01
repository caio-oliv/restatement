import { CacheEntry, CacheStore } from '@/Cache';

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace TTLCache {
	export interface SetOptions {
		noDisposeOnSet?: boolean;
		noUpdateTTL?: boolean;
		ttl?: number;
	}

	export interface GetOptions {
		updateAgeOnGet?: boolean;
		checkAgeOnGet?: boolean;
		ttl?: number;
	}

	export interface TTLCache<K, V> {
		get<T = V>(key: K, options?: TTLCache.GetOptions): T | undefined;
		getRemainingTTL(key: K): number;
		set(key: K, value: V, options?: TTLCache.SetOptions): void;
		delete(key: K): boolean;
	}
}

export class TTLCacheAdapter<K, V> implements CacheStore<K, V> {
	public readonly cache: TTLCache.TTLCache<K, V>;

	public constructor(cache: TTLCache.TTLCache<K, V>) {
		this.cache = cache;
	}

	public async get(key: K): Promise<V | undefined> {
		return this.cache.get(key);
	}

	public async getEntry(key: K): Promise<CacheEntry<V> | undefined> {
		const data = this.cache.get(key);
		if (!data) return;

		const remain = this.cache.getRemainingTTL(key);
		// TODO: get the ttl from the cache entry
		return { data, remain_ttl: remain, ttl: 0 };
	}

	public async set(key: K, data: V, ttl: number): Promise<void> {
		this.cache.set(key, data, { ttl });
	}

	public async delete(key: K): Promise<void> {
		this.cache.delete(key);
	}
}
