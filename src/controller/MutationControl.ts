import type { MutationFn, MutationState, MutationControlHandler } from '@/Type';
import { type RetryDelay, retryAsyncOperation } from '@/AsyncModule';
import { DEFAULT_RETRY_DELAY } from '@/Default';

export interface MutationControlInput<I, T, E> {
	mutationFn: MutationFn<I, T>;
	retry?: number;
	retryDelay?: RetryDelay<E>;
	handler?: MutationControlHandler<T, E>;
}

export class MutationControl<I, T, E> {
	public readonly retry: number;
	public readonly retryDelay: RetryDelay<E>;

	public constructor({
		mutationFn,
		retry = 3,
		retryDelay = DEFAULT_RETRY_DELAY.delay,
		handler = { stateFn: undefined, dataFn: undefined, errorFn: undefined },
	}: MutationControlInput<I, T, E>) {
		this.mutationFn = mutationFn;
		this.retry = retry;
		this.retryDelay = retryDelay;
		this.handler = handler;
		this.state = { data: null, error: null, status: 'idle' };
	}

	public execute = (input: I, ctl: AbortController = new AbortController()): void => {
		const state: MutationState<T, E> = {
			status: 'loading',
			data: this.state.data,
			error: this.state.error,
		};
		this.state = state;
		this.handler.stateFn?.(this.state);
		retryAsyncOperation(() => this.mutationFn(input, ctl.signal), this.retryDelay, this.retry)
			.then(this.mutationResolve)
			.catch(this.mutationReject);
	};

	public executeAsync = async (
		input: I,
		ctl: AbortController = new AbortController()
	): Promise<T | E> => {
		try {
			const state: MutationState<T, E> = {
				status: 'loading',
				data: this.state.data,
				error: this.state.error,
			};
			this.state = state;
			this.handler.stateFn?.(this.state);
			const data = await retryAsyncOperation(
				() => this.mutationFn(input, ctl.signal),
				this.retryDelay,
				this.retry
			);
			this.mutationResolve(data);
			return data;
		} catch (err: unknown) {
			this.mutationReject(err as E);
			return err as E;
		}
	};

	public getState = (): MutationState<T, E> => {
		return this.state;
	};

	private readonly mutationResolve = (data: T): void => {
		const state: MutationState<T, E> = {
			status: 'success',
			data,
			error: null,
		};
		this.state = state;
		this.handler.dataFn?.(data);
		this.handler.stateFn?.({ ...this.state });
	};

	private readonly mutationReject = (error: E): void => {
		const state: MutationState<T, E> = {
			status: 'error',
			data: null,
			error,
		};
		this.state = state;
		this.handler.errorFn?.(error);
		this.handler.stateFn?.({ ...this.state });
	};

	private readonly handler: MutationControlHandler<T, E>;
	private readonly mutationFn: MutationFn<I, T>;
	private state: MutationState<T, E>;
}
