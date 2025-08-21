import type { MutationState, ResetOptions } from '@/core/Type';
import type { MutationContext, MutationInput } from '@/plumbing/MutationType';
import { execAsyncOperation } from '@/core/RetryPolicy';
import { DEFAULT_RETRY_POLICY, defaultFilterFn } from '@/Default';
import { blackhole, makeAbortSignal } from '@/Internal';

/**
 * Make a new mutation context
 * @typeParam I Mutation input
 * @typeParam T Return value of a successful mutation
 * @typeParam E Error from a failed {@link MutationFn mutation} execution
 * @param input Mutation input
 * @param input.placeholder Idle state placeholder
 * @param input.cache Cache manager
 * @param input.mutationFn Mutation function
 * @param input.retryPolicy Retry policy
 * @param input.retryHandleFn Retry handler
 * @param input.stateFn Mutation state handler
 * @param input.dataFn Mutation data handler
 * @param input.errorFn Mutation error handler
 * @param input.filterFn Mutation state filter
 * @returns Mutation context
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

/**
 * Execute mutation options
 */
export interface ExecuteMutationOptions {
	/**
	 * Abort signal
	 */
	signal?: AbortSignal;
}

/**
 * Execute mutation
 * @typeParam I Mutation input
 * @typeParam T Return value of a successful mutation
 * @typeParam E Error from a failed {@link MutationFn mutation} execution
 * @param ctx Mutation context
 * @param input Mutation input
 * @param options Execute mutation options
 * @param options.signal Abort signal
 * @returns Mutation state
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
 * Reset mutation state
 * @typeParam I Mutation input
 * @typeParam T Return value of a successful mutation
 * @typeParam E Error from a failed {@link MutationFn mutation} execution
 * @param ctx Mutation context
 * @param options Reset options
 * @param options.target Reset target
 */
export function resetMutation<I, T, E>(
	ctx: MutationContext<I, T, E>,
	{ target = 'context' }: ResetOptions = {}
): void {
	ctx.state = { status: 'idle', data: ctx.placeholder, error: null };

	if (target === 'handler') {
		ctx.stateFn?.(ctx.state, ctx.cache)?.catch(blackhole);
	}
}

/**
 * Run the mutation function
 * @description Run the mutation function with the provided retry policy
 * and returns the new mutation state within a promise.
 *
 * ## Invariant
 *
 * This function **does not** throw any errors. Callers can rely on the contract
 * that the promise returned by this function is safe to **not** be awaited.
 * @typeParam I Mutation input
 * @typeParam T Return value of a successful mutation
 * @typeParam E Error from a failed {@link MutationFn mutation} execution
 * @param ctx Mutation context
 * @param input Mutation input
 * @param signal Abort signal
 * @returns Mutation state
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
 * Resolve mutation execution
 * @description Resolve the mutation with the provided data, updates and returns the mutation state.
 * @typeParam I Mutation input
 * @typeParam T Return value of a successful mutation
 * @typeParam E Error from a failed {@link MutationFn mutation} execution
 * @param ctx Mutation context
 * @param data Data
 * @returns Mutation state
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
 * Reject mutation execution
 * @description Reject the mutation with the provided error, updates and returns the mutation state.
 * @typeParam I Mutation input
 * @typeParam T Return value of a successful mutation
 * @typeParam E Error from a failed {@link MutationFn mutation} execution
 * @param ctx Mutation context
 * @param error Error
 * @returns Mutation state
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
 * Update the mutation state
 * @description Update the mutation state and call function handlers.
 * @typeParam I Mutation input
 * @typeParam T Return value of a successful mutation
 * @typeParam E Error from a failed {@link MutationFn mutation} execution
 * @param ctx Mutation context
 * @param state Mutation state
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
