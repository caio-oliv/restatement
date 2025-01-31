/**
 *
 * @param retryAttempt current retry attempt.
 * @param error error returned from the operation.
 *
 * @returns retry delay in milliseconds. If a negative number is returned, the
 * operation will be rejected with the current error.
 */
export type RetryDelay<E> = (retryAttempt: number, error: E) => number;

export type AsyncOperation<T> = () => Promise<T>;

export type RetryHandlerFn = (retryAttempt: number) => void;

export function waitUntil(time: number) {
	return new Promise(resolve => setTimeout(resolve, time));
}

/**
 *
 * @param operation async operation
 * @param retryDelay retry delay function
 * @param retryCount maximum number of retries.
 */
export async function retryAsyncOperation<T, E = unknown>(
	operation: AsyncOperation<T>,
	retryDelay: RetryDelay<E>,
	retryCount: number,
	retryHandleFn: RetryHandlerFn | null = null
): Promise<T> {
	let retryAttempt = 0;
	let lastError: E;

	// eslint-disable-next-line no-constant-condition
	while (true) {
		try {
			return await operation();
		} catch (err) {
			lastError = err as E;
			retryAttempt++;
			if (retryCount < retryAttempt) break;

			const delay = retryDelay(retryAttempt, lastError);
			if (delay < 0) throw lastError;
			await waitUntil(delay);
			retryHandleFn?.(retryAttempt);
		}
	}

	throw lastError;
}
