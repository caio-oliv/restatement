import { type RetryDelay, retryAsyncOperation } from '@/AsyncModule';
import type { MutationFn, MutationState, MutationControlHandler } from '@/Type';
import { DEFAULT_RETRY_DELAY, defaultMutationHandler, defaultMutationState } from '@/Default';

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
		handler = defaultMutationHandler(),
	}: MutationControlInput<I, T, E>) {
		this.mutationFn = mutationFn;
		this.retry = retry;
		this.retryDelay = retryDelay;
		this.handler = handler;
		this.state = defaultMutationState();
	}

	public execute = (input: I, ctl: AbortController = new AbortController()): void => {
		this.state.status = 'loading';
		this.handler.stateFn?.({ ...this.state });
		retryAsyncOperation(() => this.mutationFn(input, ctl.signal), this.retryDelay, this.retry)
			.then(this.mutationResolve)
			.catch(this.mutationReject);
	};

	public executeAsync = async (
		input: I,
		ctl: AbortController = new AbortController()
	): Promise<T | E> => {
		try {
			this.state.status = 'loading';
			this.handler.stateFn?.({ ...this.state });
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

	private mutationResolve = (data: T) => {
		this.state.error = null;
		this.state.data = data;
		this.state.status = 'success';
		this.handler.dataFn?.(data);
		this.handler.stateFn?.({ ...this.state });
	};

	private mutationReject = (err: E) => {
		this.state.error = err;
		this.state.data = null;
		this.state.status = 'error';
		this.handler.errorFn?.(err);
		this.handler.stateFn?.({ ...this.state });
	};

	private readonly handler: MutationControlHandler<T, E>;
	private readonly mutationFn: MutationFn<I, T>;
	private state: MutationState<T, E>;
}
