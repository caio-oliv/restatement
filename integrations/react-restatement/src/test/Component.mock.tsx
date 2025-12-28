import React, { type JSXElementConstructor } from 'react';
import { RestatementProvider, type RestatementConfig } from '@/lib';

/**
 * Create a RestatementProviderWrapper with the Restatement config provided
 * @param config Restatement config
 * @returns RestatementProviderWrapper
 */
export function makeRestatementProviderWrapper(
	config: RestatementConfig
): JSXElementConstructor<{ children: React.ReactNode }> {
	return function wrapper({ children }): JSX.Element {
		return <RestatementProvider config={config}>{children}</RestatementProvider>;
	};
}
