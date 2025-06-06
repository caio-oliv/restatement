import type { CacheEntry, CacheStore } from '@/Cache';

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace LRUCache {
	export type Milliseconds = number;

	export type Size = number;

	export interface LRUCacheEntry<V> {
		value: V;
		ttl?: Milliseconds;
		size?: Size;
		start?: Milliseconds;
	}

	export interface Status<V> {
		set?: 'add' | 'update' | 'replace' | 'miss';
		ttl?: Milliseconds;
		start?: Milliseconds;
		now?: Milliseconds;
		remainingTTL?: Milliseconds;
		entrySize?: Size;
		totalCalculatedSize?: Size;
		maxEntrySizeExceeded?: true;
		oldValue?: V;
		has?: 'hit' | 'stale' | 'miss';
		fetch?: 'get' | 'inflight' | 'miss' | 'hit' | 'stale' | 'refresh';
		fetchDispatched?: true;
		fetchUpdated?: true;
		fetchError?: Error;
		fetchAborted?: true;
		fetchAbortIgnored?: true;
		fetchResolved?: true;
		fetchRejected?: true;
		get?: 'stale' | 'hit' | 'miss';
		returnedStale?: true;
	}

	export interface SetOptions<V> {
		ttl?: Milliseconds;
		noUpdateTTL?: boolean;
		size?: Size;
		start?: Milliseconds;
		status?: Status<V>;
	}

	export interface GetOptions<V> {
		status?: Status<V>;
		allowStale?: boolean;
		updateAgeOnGet?: boolean;
		noDeleteOnStaleGet?: boolean;
	}

	export type ForEachFn<V, K> = (v: V, k: K, self: LRUCache.LRUCache<K, V>) => void;

	export interface LRUCache<K, V> {
		info(key: K): LRUCacheEntry<V> | undefined;
		get(k: K, getOptions?: GetOptions<V>): V | undefined;
		set(k: K, v: V | undefined, setOptions?: SetOptions<V>): LRUCache<K, V>;
		delete(k: K): boolean;
		forEach(fn: ForEachFn<V, K>, thisp?: this): void;
	}
}

export const REQUIRED_LRU_CACHE_OPTIONS = {
	allowStale: false,
	noUpdateTTL: true,
	updateAgeOnGet: false,
	updateAgeOnHas: false,
} as const;

export class LRUCacheAdapter<K = unknown, V = unknown> implements CacheStore<K, V> {
	public readonly cache: LRUCache.LRUCache<K, V>;

	public constructor(cache: LRUCache.LRUCache<K, V>) {
		this.cache = cache;
	}

	public async get(key: K): Promise<V | undefined> {
		return (await this.getEntry(key))?.data;
	}

	public async getEntry(key: K): Promise<CacheEntry<V> | undefined> {
		const status: LRUCache.Status<V> = {};

		const data = this.cache.get(key, { status });
		if (!data || !status.ttl || !status.start) return;

		const remain_ttl = Math.trunc(status.ttl - (Date.now() - status.start));
		if (remain_ttl <= 0) return undefined;

		return { data, remain_ttl, ttl: status.ttl };
	}

	public async set(key: K, data: V, ttl: number): Promise<void> {
		this.cache.set(key, data, { start: Date.now(), ttl, noUpdateTTL: false });
	}

	public async delete(key: K): Promise<void> {
		this.cache.delete(key);
	}

	public async deletePrefix(prefix: K): Promise<void> {
		this.cache.forEach((_value, key, instance) => {
			if ((key as string).startsWith(prefix as string)) {
				instance.delete(key);
			}
		});
	}
}
