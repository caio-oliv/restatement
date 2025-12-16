import type { Client, DetachedClient, Patch } from '@/core/Client';
import { cacheEntryRemainTTL, type CacheStore } from '@/core/Cache';
import type { RestatementConfig } from '@/Config';
import { ClientImpl } from '@/client/ClientImpl';
import { DetachedClientImpl } from '@/client/DetachedClientImpl';

/**
 * Make an instance of the {@link Client} interface
 * @param config Restatement Config
 * @returns Client instance
 */
export function makeClient(config: RestatementConfig): Client {
	return new ClientImpl(config);
}

/**
 * Make an instance of the {@link DetachedClient Detached Client} interface
 * @param config Restatement Config
 * @returns Detached Client instance
 */
export function makeDetachedClient(config: RestatementConfig): DetachedClient {
	return new DetachedClientImpl(config);
}

/**
 * Apply patchs into cache store
 * @param patch Patch
 * @param store Cache store
 */
export async function patchCacheStore<V>(
	patch: Patch,
	store: CacheStore<string, V>
): Promise<void> {
	await Promise.all(
		patch
			.filter(p => cacheEntryRemainTTL(p) > 0)
			.map(p => store.set(p.hash, p.data as V, cacheEntryRemainTTL(p)))
	);
}
