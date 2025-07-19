import type {
	MutationFn,
	MutationState,
	MutationFilterFn,
	MutationStateHandler,
	MutationDataHandler,
	MutationErrorHandler,
} from '@/Type';
import { type RetryHandlerFn, retryAsyncOperation } from '@/AsyncModule';
import { DEFAULT_RETRY_POLICY, defaultFilterFn } from '@/Default';
import { blackhole } from '@/Internal';
import type { CacheManager } from '@/cache/CacheManager';
import type { RetryPolicy } from '@/RetryPolicy';

export interface MutationControlInput<I, T, E> {
	placeholder?: T | null;
	mutationFn: MutationFn<I, T>;
	cache: CacheManager;
	retryPolicy?: RetryPolicy<E>;
	retryHandleFn?: RetryHandlerFn<E> | null;
	filterFn?: MutationFilterFn<T, E>;
	stateFn?: MutationStateHandler<T, E> | null;
	dataFn?: MutationDataHandler<T> | null;
	errorFn?: MutationErrorHandler<E> | null;
}

export type MutationResetTarget = 'state' | 'handler';

export class MutationControl<I, T, E> {
	public readonly retryPolicy: RetryPolicy<E>;
	public readonly cache: CacheManager;
	public readonly stateFn: MutationStateHandler<T, E> | null;
	public readonly dataFn: MutationDataHandler<T> | null;
	public readonly errorFn: MutationErrorHandler<E> | null;

	public constructor({
		placeholder = null,
		mutationFn,
		cache,
		retryPolicy = DEFAULT_RETRY_POLICY,
		retryHandleFn = null,
		filterFn = defaultFilterFn,
		stateFn = null,
		dataFn = null,
		errorFn = null,
	}: MutationControlInput<I, T, E>) {
		this.#placeholder = placeholder;
		this.#mutationFn = mutationFn;
		this.retryPolicy = retryPolicy;
		this.#retryHandleFn = retryHandleFn;
		this.cache = cache;
		this.#filterFn = filterFn;
		this.stateFn = stateFn;
		this.dataFn = dataFn;
		this.errorFn = errorFn;
		this.#state = { data: this.#placeholder, error: null, status: 'idle' };
	}

	public async execute(
		input: I,
		ctl: AbortController = new AbortController()
	): Promise<MutationState<T, E>> {
		const state: MutationState<T, E> = { status: 'loading', data: null, error: null };
		this.#updateState(state);

		// eslint-disable-next-line @typescript-eslint/return-await
		return this.#runMutation(input, ctl);
	}

	public getState(): MutationState<T, E> {
		return this.#state;
	}

	public reset(target: MutationResetTarget = 'state'): void {
		this.#state = { status: 'idle', data: this.#placeholder, error: null };

		if (target === 'handler') {
			this.stateFn?.(this.#state, this.cache)?.catch(blackhole);
		}
	}

	async #runMutation(input: I, ctl: AbortController): Promise<MutationState<T, E>> {
		try {
			const data = await retryAsyncOperation(
				() => this.#mutationFn(input, ctl.signal),
				this.retryPolicy,
				this.#retryHandleFn
			);

			return this.#mutationResolve(data);
		} catch (err: unknown) {
			return this.#mutationReject(err as E);
		}
	}

	#mutationResolve(data: T): MutationState<T, E> {
		const state: MutationState<T, E> = { status: 'success', data, error: null };
		this.#updateState(state);
		return state;
	}

	#mutationReject(error: E): MutationState<T, E> {
		const state: MutationState<T, E> = { status: 'error', data: null, error };
		this.#updateState(state);
		return state;
	}

	#updateState(state: MutationState<T, E>): void {
		if (!this.#filterFn({ current: this.#state, next: state })) {
			return;
		}

		this.#state = state;

		if (this.#state.data !== null) {
			this.dataFn?.(this.#state.data, this.cache)?.catch(blackhole);
		}
		if (this.#state.error !== null) {
			this.errorFn?.(this.#state.error, this.cache)?.catch(blackhole);
		}
		this.stateFn?.(this.#state, this.cache)?.catch(blackhole);
	}

	#state: MutationState<T, E>;
	readonly #placeholder: T | null;
	readonly #filterFn: MutationFilterFn<T, E>;
	readonly #mutationFn: MutationFn<I, T>;
	readonly #retryHandleFn: RetryHandlerFn<E> | null;
}
