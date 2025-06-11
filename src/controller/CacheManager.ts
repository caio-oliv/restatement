import type {
	CacheHandler,
	KeyHashFn,
	Millisecond,
	QueryProviderState,
	QueryStatePromise,
} from '@/Type';
import type { CacheStore } from '@/Cache';
import type { PubSub } from '@/PubSub';
import { defaultKeyHashFn, DEFAULT_TTL_DURATION } from '@/Default';
import { blackhole } from '@/Internal';

export interface CacheManagerInput {
	keyHashFn?: KeyHashFn<ReadonlyArray<unknown>>;
	/**
	 * @description Time To Live (duration) of cache entries.
	 * @default 3 * 60 * 1000 // 3 minutes
	 */
	ttl?: Millisecond;
	/**
	 * Cache store.
	 */
	cache: CacheStore<string, unknown>;
	/**
	 * State provider.
	 */
	provider?: CacheManagerProvider<unknown, unknown> | null;
}

export type CacheManagerProvider<T, E> = PubSub<QueryProviderState<T, E>, QueryStatePromise<T, E>>;

export class CacheManager implements CacheHandler {
	public readonly keyHashFn: KeyHashFn<ReadonlyArray<unknown>>;
	/**
	 * @summary Default TTL (duration)
	 * @description Default Time To Live (duration) of cache entries set through this manager.
	 */
	public readonly ttl: Millisecond;

	public constructor({
		keyHashFn = defaultKeyHashFn,
		ttl = DEFAULT_TTL_DURATION,
		cache,
		provider,
	}: CacheManagerInput) {
		this.keyHashFn = keyHashFn;
		this.ttl = ttl;
		this.#cache = cache;
		this.#provider = provider;
	}

	public async set<K extends ReadonlyArray<unknown>, T>(
		key: K,
		data: T,
		ttl: Millisecond = this.ttl
	): Promise<void> {
		const hash = this.keyHashFn(key);
		await this.#cache.set(hash, data, ttl).catch(blackhole);
		this.#provider?.publish(hash, {
			state: { data, error: null, status: 'success' },
			metadata: { source: 'mutation', origin: 'provider', cache: 'none' },
		});
	}

	public async get<K extends ReadonlyArray<unknown>, T>(key: K): Promise<T | undefined> {
		const hash = this.keyHashFn(key);
		return (await this.#cache.get(hash).catch(blackhole)) as T | undefined;
	}

	public async delete<K extends ReadonlyArray<unknown>>(key: K): Promise<void> {
		const hash = this.keyHashFn(key);
		await this.#cache.delete(hash).catch(blackhole);
	}

	public async invalidate<K extends ReadonlyArray<unknown>>(key: K): Promise<void> {
		const hash = this.keyHashFn(key);
		await this.#cache.deletePrefix(hash).catch(blackhole);
	}

	readonly #cache: CacheStore<string, unknown>;
	readonly #provider?: CacheManagerProvider<unknown, unknown> | null;
}
