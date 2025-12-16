import type {
	CacheHandler,
	ExtractTTLFn,
	GenericQueryKey,
	KeyHashFn,
	Millisecond,
} from '@/core/Type';
import type { CacheStore } from '@/core/Cache';
import type { QueryProvider } from '@/query/QueryContext';
import { defaultKeyHashFn, DEFAULT_TTL_DURATION, defaultExtractTTLFn } from '@/Default';

/**
 * Cache manager input
 */
export interface CacheManagerInput<T = unknown, E = unknown> {
	/**
	 * Key hash function
	 */
	keyHashFn?: KeyHashFn<ReadonlyArray<unknown>>;
	/**
	 * Extract TTL function
	 */
	extractTTLFn?: ExtractTTLFn<T>;
	/**
	 * Default TTL duration
	 */
	ttl?: Millisecond;
	/**
	 * Cache store
	 */
	store: CacheStore<string, unknown>;
	/**
	 * State provider.
	 */
	provider?: QueryProvider<T, E> | null;
}

/**
 * Cache manager
 * @description Default implementation for a {@link CacheHandler cache handler}.
 * @see {@link CacheHandler Cache handler}
 */
export class CacheManager implements CacheHandler {
	/**
	 * Key hash function
	 */
	public readonly keyHashFn: KeyHashFn<ReadonlyArray<unknown>>;
	/**
	 * Extract TTL function
	 */
	public readonly extractTTLFn: ExtractTTLFn<unknown>;
	/**
	 * Default TTL duration
	 * @description Time To Live of cache entries.
	 */
	public readonly ttl: Millisecond;

	public constructor({
		keyHashFn = defaultKeyHashFn,
		ttl = DEFAULT_TTL_DURATION,
		extractTTLFn = defaultExtractTTLFn,
		store,
		provider = null,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	}: CacheManagerInput<any, any>) {
		this.keyHashFn = keyHashFn;
		this.extractTTLFn = extractTTLFn;
		this.ttl = ttl;
		this.#internalCache = store;
		this.#provider = provider;
	}

	public async set<K extends GenericQueryKey, T>(
		key: K,
		data: T,
		ttl: Millisecond = this.ttl
	): Promise<void> {
		const hash = this.keyHashFn(key);
		await this.#internalCache.set(hash, data, this.extractTTLFn(data, ttl));
		this.#provider?.publish(hash, {
			type: 'mutation',
			origin: 'provider',
			state: { status: 'success', data, error: null },
		});
	}

	public async get<K extends GenericQueryKey, T>(key: K): Promise<T | undefined> {
		const hash = this.keyHashFn(key);
		return (await this.#internalCache.get(hash)) as T | undefined;
	}

	public async delete<K extends GenericQueryKey>(key: K): Promise<void> {
		const hash = this.keyHashFn(key);
		await this.#internalCache.delete(hash);
		this.#provider?.publish(hash, { type: 'invalidation', origin: 'provider' });
	}

	public async invalidate<K extends GenericQueryKey>(key: K): Promise<void> {
		const hash = this.keyHashFn(key);
		await this.#internalCache.deletePrefix(hash);
		for (const topic of this.#provider?.topics() ?? []) {
			if (topic.startsWith(hash)) {
				this.#provider?.publish(topic, { type: 'invalidation', origin: 'provider' });
			}
		}
	}

	public async clear(): Promise<void> {
		await this.#internalCache.clear();
	}

	readonly #internalCache: CacheStore<string, unknown>;
	readonly #provider: QueryProvider<unknown, unknown> | null;
}
