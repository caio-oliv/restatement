import { createContext, useContext } from 'react';
import type { RestatementConfig } from 'restatement';

export const RestatementContext = createContext({} as RestatementConfig);

/**
 * @returns Restatement Context data
 */
export function useRestatementContext<T = unknown, E = unknown>(): RestatementConfig<T, E> {
	return useContext(RestatementContext) as RestatementConfig<T, E>;
}
