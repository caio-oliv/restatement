import type { CacheHandler } from 'restatement';
import { useRestatementConfig } from '@/context/RestatementContext';

/**
 * Returns an instance of the cache handler
 * @returns Cache handler
 */
export function useQueryCache(): CacheHandler {
	const config = useRestatementConfig();
	return config.cache.handler;
}
