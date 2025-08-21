import type { MutationState, ResetOptions } from '@/core/Type';
import type { MutationContext, MutationInput } from '@/plumbing/MutationType';
import type { CacheManager } from '@/cache/CacheManager';
import {
	executeMutation,
	makeMutationContext,
	resetMutation,
	type ExecuteMutationOptions,
} from '@/plumbing/Mutation';

export class Mutation<I, T, E = unknown> {
	/**
	 * Mutation context
	 */
	public readonly ctx: MutationContext<I, T, E>;
	/**
	 * Cache manager
	 */
	public readonly cache: CacheManager;

	public constructor(ctx: MutationContext<I, T, E>) {
		this.ctx = ctx;
		this.cache = this.ctx.cache;
	}

	/**
	 * Create a new mutation
	 * @typeParam I Mutation input
	 * @typeParam T Return value of a successful mutation
	 * @typeParam E Error from a failed {@link MutationFn mutation} execution
	 * @param input Mutation input
	 * @returns Mutation
	 */
	public static create<I, T, E = unknown>(input: MutationInput<I, T, E>): Mutation<I, T, E> {
		return new Mutation(makeMutationContext(input));
	}

	/**
	 * Execute mutation
	 * @param input Mutation input
	 * @param options Execute mutation options
	 * @returns Mutation state
	 */
	public execute(input: I, options?: ExecuteMutationOptions): Promise<MutationState<T, E>> {
		return executeMutation(this.ctx, input, options);
	}

	/**
	 * Reset mutation state
	 * @param options Reset options
	 */
	public reset(options?: ResetOptions): void {
		resetMutation(this.ctx, options);
	}

	/**
	 * Get the {@link MutationState mutation state}
	 * @returns Mutation state
	 */
	public getState(): MutationState<T, E> {
		return this.ctx.state;
	}
}
