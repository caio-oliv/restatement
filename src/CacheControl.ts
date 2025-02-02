import type { KeyHashFn, Millisecond, QueryState } from '@/Type';
import type { CacheStore } from '@/Cache';
import { defaultKeyHashFn, DEFAULT_STALE_TIME } from '@/Default';
import { PubSub } from '@/PubSub';

export interface CacheControlInput {
	keyHashFn?: KeyHashFn<unknown>;
	/**
	 * Cache duration.
	 */
	duration?: Millisecond;
	/**
	 * Cache store.
	 */
	cacheStore: CacheStore<string, unknown>;
	/**
	 * State provider.
	 */
	stateProvider?: PubSub<QueryState<unknown, unknown>> | null;
}

export class CacheControl {
	public readonly keyHashFn: KeyHashFn<unknown>;
	public readonly duration: Millisecond;

	public constructor({
		keyHashFn = defaultKeyHashFn,
		duration = DEFAULT_STALE_TIME,
		cacheStore,
		stateProvider,
	}: CacheControlInput) {
		this.keyHashFn = keyHashFn;
		this.duration = duration;
		this.cacheStore = cacheStore;
		this.stateProvider = stateProvider;
	}

	public async setValue<K, T>(key: K, data: T, duration?: Millisecond): Promise<void> {
		const keyHash = this.keyHashFn(key);
		await this.cacheStore.set(keyHash, data, (duration ?? this.duration) + Date.now());
		this.stateProvider?.publish(keyHash, {
			data,
			error: null,
			status: 'success',
		});
	}

	public async getValue<K, T>(key: K): Promise<T | undefined> {
		const keyHash = this.keyHashFn(key);
		return await (this.cacheStore as CacheStore<string, T>).get(keyHash);
	}

	private readonly cacheStore: CacheStore<string, unknown>;
	private readonly stateProvider?: PubSub<QueryState<unknown, unknown>> | null;
}
