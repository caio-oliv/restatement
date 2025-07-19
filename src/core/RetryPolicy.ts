import type { Millisecond } from '@/core/Type';
import type { BackoffTimer } from '@/core/BackoffTimer';

export type OperationResult = 'success' | 'fail';

export type AsyncOperation<T> = () => Promise<T>;

export type RetryHandlerFn<E> = (retryAttempt: number, error: E) => void;

export interface RetryPolicy<E = unknown> {
	/**
	 * @summary Retry count limit
	 */
	readonly limit: number;

	/**
	 * @description Returns `true` if the operation should be retried, `false`
	 * otherwise.
	 * @param attempt current retry attempt
	 * @param error resulting error from the previous retry
	 */
	shouldRetry(attempt: number, error: E): boolean;

	/**
	 * @description Returns the delay in milliseconds for the next attempt if
	 * the operation **should** be retried. It returns a negative integer in case
	 * the operation **should not** be retried.
	 * @param attempt current retry attempt
	 * @param error resulting error from the previous retry
	 * @returns positive delay in milliseconds or a negative integer.
	 */
	delay(attempt: number, error: E): Millisecond;

	/**
	 * @summary Notify success and failure rates.
	 * @description Notify the retry policy if the operation succeeded or failed.
	 * @param result attempt result
	 */
	notify(result: OperationResult): void;
}

export class BasicRetryPolicy implements RetryPolicy {
	public readonly limit: number;
	public readonly timer: BackoffTimer;

	public constructor(limit: number, timer: BackoffTimer) {
		this.limit = limit;
		this.timer = timer;
	}

	public shouldRetry(attempt: number): boolean {
		return attempt <= this.limit;
	}

	public delay(attempt: number): Millisecond {
		if (!this.shouldRetry(attempt)) return -1;
		return this.timer.delay(attempt);
	}

	// eslint-disable-next-line class-methods-use-this, @typescript-eslint/class-methods-use-this
	public notify(): void {
		// no-op
	}
}

export class NoRetryPolicy implements RetryPolicy {
	public readonly limit: number;

	public constructor() {
		this.limit = 0;
	}

	// eslint-disable-next-line class-methods-use-this, @typescript-eslint/class-methods-use-this
	public shouldRetry(): boolean {
		return false;
	}

	// eslint-disable-next-line class-methods-use-this, @typescript-eslint/class-methods-use-this
	public delay(): Millisecond {
		return -1;
	}

	// eslint-disable-next-line class-methods-use-this, @typescript-eslint/class-methods-use-this
	public notify(): void {
		// no-op
	}
}

/**
 * @summary Wait until timeout
 * @param time wait time in milliseconds
 * @returns promise that will resolve after specified time.
 */
export function waitUntil(time: number): Promise<void> {
	return new Promise(resolve => {
		setTimeout(resolve, time);
	});
}

/**
 * @summary Execute async operation
 * @param operation async operation
 * @param retryPolicy retry policy
 * @param retryHandleFn retry callback handler, called before every retry
 * @returns promise with the result of all the retry attempts.
 */
export async function execAsyncOperation<T, E = unknown>(
	operation: AsyncOperation<T>,
	retryPolicy: RetryPolicy<E>,
	retryHandleFn: RetryHandlerFn<E> | null = null
): Promise<T> {
	let retryAttempt = 0;
	let lastError: E;

	while (true) {
		try {
			const value = await operation();
			retryPolicy.notify('success');
			return value;
		} catch (err) {
			retryPolicy.notify('fail');
			lastError = err as E;
			retryAttempt += 1;

			const delay = retryPolicy.delay(retryAttempt, lastError);
			if (delay < 0) throw lastError;

			await waitUntil(delay);
			retryHandleFn?.(retryAttempt, lastError);
		}
	}
}
