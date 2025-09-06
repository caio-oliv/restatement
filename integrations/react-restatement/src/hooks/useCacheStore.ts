import type { CacheStore } from 'restatement';
import { useRestatementConfig } from '@/context/RestatementContext';

/**
 * Returns an instance of the cache store
 * @returns Cache store
 */
export function useCacheStore<T = unknown>(): CacheStore<string, T> {
	const config = useRestatementConfig();
	return config.cache.store as CacheStore<string, T>;
}
