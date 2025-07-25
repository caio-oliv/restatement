import type { MutationFn, MutationState, MutationControlHandler, MutationFilterFn } from '@/Type';
import { type RetryDelay, type RetryHandlerFn, retryAsyncOperation } from '@/AsyncModule';
import { DEFAULT_RETRY_DELAY, defaultFilterFn } from '@/Default';
import { blackhole } from '@/Internal';
import type { CacheManager } from '@/cache/CacheManager';

export interface MutationControlInput<I, T, E> {
	placeholder?: T | null;
	mutationFn: MutationFn<I, T>;
	cache: CacheManager;
	retry?: number;
	retryDelay?: RetryDelay<E>;
	retryHandleFn?: RetryHandlerFn<E> | null;
	handler?: MutationControlHandler<T, E>;
	filterFn?: MutationFilterFn<T, E>;
}

export class MutationControl<I, T, E> {
	public readonly retry: number;
	public readonly retryDelay: RetryDelay<E>;
	public readonly cache: CacheManager;

	public constructor({
		placeholder = null,
		mutationFn,
		cache,
		retry = 0,
		retryDelay = DEFAULT_RETRY_DELAY.delay,
		retryHandleFn = null,
		handler = { stateFn: undefined, dataFn: undefined, errorFn: undefined },
		filterFn = defaultFilterFn,
	}: MutationControlInput<I, T, E>) {
		this.#placeholder = placeholder;
		this.#mutationFn = mutationFn;
		this.retry = retry;
		this.retryDelay = retryDelay;
		this.cache = cache;
		this.#handler = handler;
		this.#filterFn = filterFn;
		this.#retryHandleFn = retryHandleFn;
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

	public reset(): void {
		this.#state = { status: 'idle', data: this.#placeholder, error: null };
	}

	async #runMutation(input: I, ctl: AbortController): Promise<MutationState<T, E>> {
		try {
			const data = await retryAsyncOperation(
				() => this.#mutationFn(input, ctl.signal),
				this.retryDelay,
				this.retry,
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
			this.#handler.dataFn?.(this.#state.data, this.cache)?.catch(blackhole);
		}
		if (this.#state.error !== null) {
			this.#handler.errorFn?.(this.#state.error, this.cache)?.catch(blackhole);
		}
		this.#handler.stateFn?.(this.#state, this.cache)?.catch(blackhole);
	}

	#state: MutationState<T, E>;
	readonly #placeholder: T | null;
	readonly #handler: MutationControlHandler<T, E>;
	readonly #filterFn: MutationFilterFn<T, E>;
	readonly #mutationFn: MutationFn<I, T>;
	readonly #retryHandleFn: RetryHandlerFn<E> | null;
}
