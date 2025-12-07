import type { CacheEntry, CacheStore } from '@/core/Cache';
import { anyAsString } from '@/Internal';

export class PersistentCache<K, V> implements CacheStore<K, V> {
	public readonly storage: Map<K, CacheEntry<V>>;

	public constructor(storage?: Map<K, CacheEntry<V>>) {
		this.storage = storage ?? new Map<K, CacheEntry<V>>();
	}

	public async get(key: K): Promise<V | undefined> {
		return this.storage.get(key)?.data;
	}

	public async getEntry(key: K): Promise<CacheEntry<V> | undefined> {
		return this.storage.get(key);
	}

	public async set(key: K, data: V, ttl: number): Promise<void> {
		this.storage.set(key, { data, time: Date.now(), ttl });
	}

	public async delete(key: K): Promise<void> {
		this.storage.delete(key);
	}

	public async deletePrefix(prefix: K): Promise<void> {
		const pre = anyAsString(prefix);
		for (const key of this.storage.keys()) {
			if (anyAsString(key).startsWith(pre)) {
				this.storage.delete(key);
			}
		}
	}

	public async clear(): Promise<void> {
		this.storage.clear();
	}
}
