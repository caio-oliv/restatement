import type { QueryProvider } from 'restatement';
import { useRestatementConfig } from '@/context/RestatementContext';

/**
 * Returns the query provider
 * @returns Query provider
 */
export function useQueryProvider<T, E>(): QueryProvider<T, E> | null {
	const config = useRestatementConfig();
	return config.provider as QueryProvider<T, E> | null;
}
