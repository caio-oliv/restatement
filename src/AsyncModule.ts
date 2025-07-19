import type { RetryPolicy } from '@/RetryPolicy';

export type AsyncOperation<T> = () => Promise<T>;

export type RetryHandlerFn<E> = (retryAttempt: number, error: E) => void;

/**
 * @param time wait time in milliseconds
 * @returns promise that will resolve after specified time.
 */
export function waitUntil(time: number): Promise<void> {
	return new Promise(resolve => {
		setTimeout(resolve, time);
	});
}

/**
 * @param operation async operation
 * @param retryPolicy retry policy
 * @param retryHandleFn retry callback handler, called before every retry
 * @returns promise with the result of all the retry attempts.
 */
export async function retryAsyncOperation<T, E = unknown>(
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
