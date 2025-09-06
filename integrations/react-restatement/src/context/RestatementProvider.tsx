import React, { type ReactNode } from 'react';
import type { RestatementConfig } from 'restatement';
import { RestatementContext } from '@/context/RestatementContext';

export interface RestatementProviderProps<E> {
	children: ReactNode;
	config: RestatementConfig<E>;
}

/**
 * @description Restatement Context Provider
 * @param props - Provider props
 * @param props.config - Restatement config
 * @param props.children - Provider children
 * @returns Provider JSX Element
 */
export function RestatementProvider<E = unknown>({
	config,
	children,
}: Readonly<RestatementProviderProps<E>>): JSX.Element {
	return (
		<RestatementContext.Provider value={config as RestatementConfig}>
			{children}
		</RestatementContext.Provider>
	);
}
