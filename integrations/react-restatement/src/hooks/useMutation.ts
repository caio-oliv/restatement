import { useRestatementConfig } from '@/lib';
import { useState } from 'react';
import {
	type LocalMutationInput,
	makeMutationInput,
	Mutation,
	updateMutationContextFn,
} from 'restatement';

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
		const input = makeMutationInput(contextConfig, config);
		return Mutation.create(input);
	});

	updateMutationContextFn(mutation.ctx, config);

	return mutation;
}
