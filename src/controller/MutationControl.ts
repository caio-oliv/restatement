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
	 * @summary Mutation context
	 */
	public readonly ctx: MutationContext<I, T, E>;
	/**
	 * @summary Cache manager
	 */
	public readonly cache: CacheManager;

	public constructor(ctx: MutationContext<I, T, E>) {
		this.ctx = ctx;
		this.cache = this.ctx.cache;
	}

	public static create<I, T, E = unknown>(input: MutationInput<I, T, E>): Mutation<I, T, E> {
		return new Mutation(makeMutationContext(input));
	}

	/**
	 * @summary Execute mutation
	 * @param input mutation input
	 * @param options execute mutation options
	 * @returns mutation state
	 */
	public execute(input: I, options?: ExecuteMutationOptions): Promise<MutationState<T, E>> {
		return executeMutation(this.ctx, input, options);
	}

	/**
	 * @summary Reset mutation state
	 * @param options reset mutation options
	 */
	public reset(options?: ResetOptions): void {
		resetMutation(this.ctx, options);
	}

	/**
	 * @summary Get mutation state
	 * @returns mutation state
	 */
	public getState(): MutationState<T, E> {
		return this.ctx.state;
	}
}
