import type { MutationState, ResetOptions } from '@/core/Type';
import type { MutationContext, MutationInput } from '@/plumbing/MutationType';
import { execAsyncOperation } from '@/core/RetryPolicy';
import { DEFAULT_RETRY_POLICY, defaultFilterFn } from '@/Default';
import { blackhole, makeAbortSignal } from '@/Internal';

/**
 * @summary Make a new mutation context
 * @param input mutation input
 * @param input.placeholder idle state placeholder
 * @param input.cache cache manager
 * @param input.mutationFn mutation function
 * @param input.retryPolicy retry policy
 * @param input.retryHandleFn retry handler
 * @param input.stateFn mutation state handler
 * @param input.dataFn mutation data handler
 * @param input.errorFn mutation error handler
 * @param input.filterFn mutation state filter
 * @returns mutation context
 */
export function makeMutationContext<I, T, E>({
	placeholder = null,
	cache,
	mutationFn,
	retryPolicy = DEFAULT_RETRY_POLICY,
	retryHandleFn = null,
	stateFn = null,
	dataFn = null,
	errorFn = null,
	filterFn = defaultFilterFn,
}: MutationInput<I, T, E>): MutationContext<I, T, E> {
	return {
		placeholder,
		cache,
		retryPolicy,
		mutationFn,
		retryHandleFn,
		stateFn,
		dataFn,
		errorFn,
		filterFn,
		state: { status: 'idle', data: placeholder, error: null },
	};
}

export interface ExecuteMutationOptions {
	/**
	 * @summary Abort signal
	 */
	signal?: AbortSignal;
}

/**
 * @summary Execute mutation
 * @param ctx mutation context
 * @param input mutation input
 * @param options execute mutation options
 * @param options.signal abort signal
 * @returns mutation state
 */
export async function executeMutation<I, T, E>(
	ctx: MutationContext<I, T, E>,
	input: I,
	{ signal = makeAbortSignal() }: ExecuteMutationOptions = {}
): Promise<MutationState<T, E>> {
	updateMutation<I, T, E>(ctx, { status: 'loading', data: null, error: null });

	// eslint-disable-next-line @typescript-eslint/return-await
	return runMutation(ctx, input, signal);
}

/**
 * @summary Reset mutation state
 * @param ctx mutation context
 * @param options reset options
 * @param options.target reset target
 */
export function resetMutation<I, T, E>(
	ctx: MutationContext<I, T, E>,
	{ target = 'state' }: ResetOptions = {}
): void {
	ctx.state = { status: 'idle', data: ctx.placeholder, error: null };

	if (target === 'handler') {
		ctx.stateFn?.(ctx.state, ctx.cache)?.catch(blackhole);
	}
}

/**
 * @summary Run the mutation function
 * @description Runs the mutation function with the provided retry policy
 * and returns the new mutation state within a promise.
 *
 * ## Invariant
 *
 * This function **does not** throw any errors. Callers can rely on the contract
 * that the promise returned by this function is safe to **not** be awaited.
 * @param ctx mutation context
 * @param input mutation input
 * @param signal abort signal
 * @returns mutation state
 */
export async function runMutation<I, T, E>(
	ctx: MutationContext<I, T, E>,
	input: I,
	signal: AbortSignal
): Promise<MutationState<T, E>> {
	try {
		const localMutationFn = ctx.mutationFn;
		const data = await execAsyncOperation(
			() => localMutationFn(input, signal),
			ctx.retryPolicy,
			ctx.retryHandleFn
		);

		return mutationResolve(ctx, data);
	} catch (err: unknown) {
		return mutationReject(ctx, err as E);
	}
}

/**
 * @summary Resolve mutation execution
 * @description Resolve the mutation with the provided data, updates and returns the mutation state.
 * @param ctx mutation context
 * @param data data
 * @returns mutation state
 */
export function mutationResolve<I, T, E>(
	ctx: MutationContext<I, T, E>,
	data: T
): MutationState<T, E> {
	const state: MutationState<T, E> = { status: 'success', data, error: null };
	updateMutation(ctx, state);
	return state;
}

/**
 * @summary Reject mutation execution
 * @description Reject the mutation with the provided error, updates and returns the mutation state.
 * @param ctx mutation context
 * @param error error
 * @returns mutation state
 */
export function mutationReject<I, T, E>(
	ctx: MutationContext<I, T, E>,
	error: E
): MutationState<T, E> {
	const state: MutationState<T, E> = { status: 'error', data: null, error };
	updateMutation(ctx, state);
	return state;
}

/**
 * @summary Update the mutation state
 * @description Update the mutation state and call function handlers.
 * @param ctx mutation context
 * @param state mutation state
 */
export function updateMutation<I, T, E>(
	ctx: MutationContext<I, T, E>,
	state: MutationState<T, E>
): void {
	if (!ctx.filterFn({ current: ctx.state, next: state })) {
		return;
	}

	ctx.state = state;

	if (ctx.state.data !== null) {
		ctx.dataFn?.(ctx.state.data, ctx.cache)?.catch(blackhole);
	}
	if (ctx.state.error !== null) {
		ctx.errorFn?.(ctx.state.error, ctx.cache)?.catch(blackhole);
	}
	ctx.stateFn?.(ctx.state, ctx.cache)?.catch(blackhole);
}
