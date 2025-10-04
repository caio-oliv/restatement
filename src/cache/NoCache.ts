import type { CacheEntry, CacheStore } from '@/core/Cache';

export class NoCache<K, V> implements CacheStore<K, V> {
	// eslint-disable-next-line class-methods-use-this, @typescript-eslint/class-methods-use-this
	public async get(): Promise<V | undefined> {
		return undefined;
	}

	// eslint-disable-next-line class-methods-use-this, @typescript-eslint/class-methods-use-this
	public async getEntry(): Promise<CacheEntry<V> | undefined> {
		return undefined;
	}

	// eslint-disable-next-line class-methods-use-this, @typescript-eslint/class-methods-use-this
	public async set(): Promise<void> {
		/* no-op */
	}

	// eslint-disable-next-line class-methods-use-this, @typescript-eslint/class-methods-use-this
	public async delete(): Promise<void> {
		/* no-op */
	}

	// eslint-disable-next-line class-methods-use-this, @typescript-eslint/class-methods-use-this
	public async deletePrefix(): Promise<void> {
		/* no-op */
	}
}

export const NO_CACHE = new NoCache();
