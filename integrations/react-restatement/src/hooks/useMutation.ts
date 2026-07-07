import { useState } from 'react';
import {
	type LocalMutationInput,
	mutationInput,
	Mutation,
	updateMutationContextFn,
} from 'restatement';
import { useRestatementConfig } from '@/context/RestatementContext';

/**
 * Mutation hook
 * @param config Mutation config
 * @returns Mutation
 */
export function useMutation<I, T, E = unknown>(
	config: LocalMutationInput<I, T, E>
): Mutation<I, T, E> {
	const contextConfig = useRestatementConfig<T, E>();

	const [mutation] = useState(() => {
		const input = mutationInput(contextConfig, config);
		return Mutation.create(input);
	});

	updateMutationContextFn(mutation.ctx, config);

	return mutation;
}
