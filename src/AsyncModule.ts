/**
 * @param retryAttempt current retry attempt.
 * @param error error returned from the operation.
 * @returns retry delay in milliseconds. If a negative number is returned, the
 * operation will be rejected with the current error.
 */
export type RetryDelay<E> = (retryAttempt: number, error: E) => number;

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
 * @param retryDelay retry delay function
 * @param retryCount maximum number of retries
 * @param retryHandleFn retry callback handler, called before every retry
 * @returns promise with the result of all the retry attempts.
 */
export async function retryAsyncOperation<T, E = unknown>(
	operation: AsyncOperation<T>,
	retryDelay: RetryDelay<E>,
	retryCount: number,
	retryHandleFn: RetryHandlerFn<E> | null = null
): Promise<T> {
	let retryAttempt = 0;
	let lastError: E;

	while (true) {
		try {
			return await operation();
		} catch (err) {
			lastError = err as E;
			retryAttempt += 1;
			if (retryCount < retryAttempt) break;

			const delay = retryDelay(retryAttempt, lastError);
			if (delay < 0) throw lastError;
			await waitUntil(delay);
			retryHandleFn?.(retryAttempt, lastError);
		}
	}

	throw lastError;
}
