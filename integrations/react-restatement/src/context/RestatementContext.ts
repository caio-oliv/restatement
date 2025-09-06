import { createContext, useContext } from 'react';
import type { RestatementConfig } from 'restatement';

export const RestatementContext = createContext({} as RestatementConfig);

/**
 * Get restatement config from the context
 * @returns Restatement config
 */
export function useRestatementConfig<T = unknown, E = unknown>(): RestatementConfig<T, E> {
	return useContext(RestatementContext) as RestatementConfig<T, E>;
}
