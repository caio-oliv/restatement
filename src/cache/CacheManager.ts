import type { CacheHandler, KeyHashFn, Millisecond } from '@/core/Type';
import type { QueryProvider } from '@/plumbing/QueryType';
import type { CacheStore } from '@/cache/CacheStore';
import { defaultKeyHashFn, DEFAULT_TTL_DURATION } from '@/Default';

export interface CacheManagerInput<T = unknown, E = unknown> {
	/**
	 * @summary Key hasher
	 */
	keyHashFn?: KeyHashFn<ReadonlyArray<unknown>>;
	/**
	 * @summary Default TTL duration
	 */
	ttl?: Millisecond;
	/**
	 * @summary Cache store
	 */
	store: CacheStore<string, unknown>;
	/**
	 * @summary State provider.
	 */
	provider?: QueryProvider<T, E> | null;
}

export class CacheManager implements CacheHandler {
	/**
	 * @summary Key hasher
	 */
	public readonly keyHashFn: KeyHashFn<ReadonlyArray<unknown>>;
	/**
	 * @summary Default TTL duration
	 * @description Time To Live of cache entries.
	 */
	public readonly ttl: Millisecond;

	public constructor({
		keyHashFn = defaultKeyHashFn,
		ttl = DEFAULT_TTL_DURATION,
		store,
		provider = null,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	}: CacheManagerInput<any, any>) {
		this.keyHashFn = keyHashFn;
		this.ttl = ttl;
		this.#internalCache = store;
		this.#provider = provider;
	}

	public async set<K extends ReadonlyArray<unknown>, T>(
		key: K,
		data: T,
		ttl: Millisecond = this.ttl
	): Promise<void> {
		const hash = this.keyHashFn(key);
		await this.#internalCache.set(hash, data, ttl);
		this.#provider?.publish(hash, {
			state: { data, error: null, status: 'success' },
			metadata: { source: 'mutation', origin: 'provider', cache: 'none' },
		});
	}

	public async get<K extends ReadonlyArray<unknown>, T>(key: K): Promise<T | undefined> {
		const hash = this.keyHashFn(key);
		return (await this.#internalCache.get(hash)) as T | undefined;
	}

	public async delete<K extends ReadonlyArray<unknown>>(key: K): Promise<void> {
		const hash = this.keyHashFn(key);
		await this.#internalCache.delete(hash);
	}

	public async invalidate<K extends ReadonlyArray<unknown>>(key: K): Promise<void> {
		const hash = this.keyHashFn(key);
		await this.#internalCache.deletePrefix(hash);
	}

	readonly #internalCache: CacheStore<string, unknown>;
	readonly #provider: QueryProvider<unknown, unknown> | null;
}
