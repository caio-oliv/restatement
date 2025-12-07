import type { CacheEntry, CacheStore } from '@/core/Cache';

export class TrackingCache<K, V> implements CacheStore<K, V> {
	public readonly inner: CacheStore<K, V>;
	public readonly storage: Map<K, CacheEntry<V>>;

	public constructor(inner: CacheStore<K, V>, storage = new Map<K, CacheEntry<V>>()) {
		this.inner = inner;
		this.storage = storage;
	}

	public get(key: K): Promise<V | undefined> {
		return this.inner.get(key);
	}

	public getEntry(key: K): Promise<CacheEntry<V> | undefined> {
		return this.inner.getEntry(key);
	}

	public set(key: K, data: V, ttl: number): Promise<void> {
		this.storage.set(key, { data, time: Date.now(), ttl });
		return this.inner.set(key, data, ttl);
	}

	public delete(key: K): Promise<void> {
		return this.inner.delete(key);
	}

	public deletePrefix(prefix: K): Promise<void> {
		return this.inner.deletePrefix(prefix);
	}

	public clear(): Promise<void> {
		return this.inner.clear();
	}
}
