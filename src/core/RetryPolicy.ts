import type { Millisecond } from '@/core/Type';
import type { BackoffTimer } from '@/core/BackoffTimer';

/**
 * Operation result
 * @description All possible results of a {@link AsyncOperation retriable operation}.
 */
export type OperationResult = 'success' | 'fail';

/**
 * Async operation
 * @description Any async operation that can be retried.
 * @typeParam T Async operation success value
 */
export type AsyncOperation<T> = () => Promise<T>;

/**
 * Retry handler function
 * @description Handler function **called before every retry**.
 * @param retryAttempt Current retry attempt
 * @param error Resulting error from the previous retry
 * @typeParam E Async operation error value
 */
export type RetryHandlerFn<E> = (retryAttempt: number, error: E) => void;

/**
 * Retry policy interface
 * @typeParam E Async operation error value
 */
export interface RetryPolicy<E = unknown> {
	/**
	 * Retry count limit
	 */
	readonly limit: number;

	/**
	 * @description Returns `true` if the operation should be retried, `false`
	 * otherwise.
	 * @param attempt Current retry attempt
	 * @param error Resulting error from the previous retry
	 */
	shouldRetry(attempt: number, error: E): boolean;

	/**
	 * @description Returns the delay in {@link Millisecond milliseconds} for the next attempt if
	 * the operation **should** be retried. It returns a negative integer in case
	 * the operation **should not** be retried.
	 * @param attempt Current retry attempt
	 * @param error Resulting error from the previous retry
	 * @returns Positive delay in milliseconds or a negative integer.
	 */
	delay(attempt: number, error: E): Millisecond;

	/**
	 * Notify success and failure rates.
	 * @description Notify the retry policy if the operation succeeded or failed.
	 * @param result Attempt result
	 */
	notify(result: OperationResult): void;
}

/**
 * Basic retry policy
 * @description Retry policy that limits the maximum number of retries
 * by the constant `limit` field.
 * @example
 * ```
 * const policy = new BasicRetryPolicy(3, timer);
 *
 * console.log(policy.shouldRetry(1)); // Expected output: true
 * console.log(policy.shouldRetry(2)); // Expected output: true
 * console.log(policy.shouldRetry(3)); // Expected output: true
 * console.log(policy.shouldRetry(4)); // Expected output: false
 * ```
 */
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

/**
 * No retry policy
 * @description Retry policy that denies all retries.
 * @example
 * ```
 * const policy = new NoRetryPolicy();
 *
 * console.log(policy.shouldRetry()); // Expected output: false
 * ```
 */
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

export const NO_RETRY_POLICY = new NoRetryPolicy();

/**
 * Wait until timeout
 * @param time Wait time in {@link Millisecond milliseconds}
 * @returns Promise that will resolve after specified time.
 */
export function waitUntil(time: Millisecond): Promise<void> {
	return new Promise(resolve => {
		setTimeout(resolve, time);
	});
}

/**
 * Execute async operation
 * @param operation Async operation
 * @param policy Retry policy
 * @param retryHandleFn Retry callback handler, called before every retry
 * @returns Promise with the result of all the retry attempts.
 * @typeParam T Async operation success value
 * @typeParam E Async operation error value
 */
export async function execAsyncOperation<T, E = unknown>(
	operation: AsyncOperation<T>,
	policy: RetryPolicy<E>,
	retryHandleFn: RetryHandlerFn<E> | null = null
): Promise<T> {
	let retryAttempt = 0;
	let lastError: E;

	while (true) {
		try {
			const value = await operation();
			policy.notify('success');
			return value;
		} catch (err) {
			policy.notify('fail');
			lastError = err as E;
			retryAttempt += 1;

			const delay = policy.delay(retryAttempt, lastError);
			if (delay < 0) throw lastError;

			await waitUntil(delay);
			retryHandleFn?.(retryAttempt, lastError);
		}
	}
}
