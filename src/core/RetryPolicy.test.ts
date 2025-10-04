import { assert, describe, it, expect, vi } from 'vitest';
import { execAsyncOperation, NO_RETRY_POLICY, type Millisecond, type OperationResult } from '@/lib';

async function failedOperation(): Promise<void> {
	throw new Error('failed');
}

async function successOperation(): Promise<string> {
	return 'OK';
}

function retryPolicyMock<E>() {
	return {
		limit: 0,
		shouldRetry: vi.fn<(attempt: number, error: E) => boolean>(),
		delay: vi.fn<(attempt: number, error: E) => Millisecond>(),
		notify: vi.fn<(result: OperationResult) => void>(),
	};
}

describe('retryAsyncOperation', () => {
	it('resolve operation', async () => {
		const value = await execAsyncOperation<string>(successOperation, NO_RETRY_POLICY);

		assert.strictEqual(value, 'OK');
	});

	it('reject operation after 3 retries', async () => {
		const retryHandler = vi.fn();

		const retryPolicy = retryPolicyMock();
		retryPolicy.delay.mockImplementation(attempt => (attempt <= 3 ? 0 : -1));
		retryPolicy.limit = 3;

		await expect(() =>
			execAsyncOperation(failedOperation, retryPolicy, retryHandler)
		).rejects.toThrowError(new Error('failed'));

		expect(retryPolicy.delay).toHaveBeenCalledTimes(4);
		expect(retryHandler).toHaveBeenCalledTimes(3);
		expect(retryPolicy.notify).toHaveBeenCalledTimes(4);
	});

	it('reject operation if retry delay is negative', async () => {
		const retryHandler = vi.fn();

		const retryPolicy = retryPolicyMock();
		retryPolicy.delay.mockReturnValue(-1);
		retryPolicy.limit = 2;

		await expect(() =>
			execAsyncOperation(failedOperation, retryPolicy, retryHandler)
		).rejects.toThrowError(new Error('failed'));

		expect(retryPolicy.delay).toHaveBeenCalledTimes(1);
		expect(retryHandler).toHaveBeenCalledTimes(0);
		expect(retryPolicy.notify).toHaveBeenCalledTimes(1);
	});

	it('call the retry handler before every retry', async () => {
		const operationSpan: Array<number> = [];
		async function operation() {
			operationSpan.push(Date.now());
			throw new Error('failed');
		}
		const handlerSpan: Array<number> = [];
		const handler = vi.fn(() => {
			handlerSpan.push(Date.now());
		});

		const retryPolicy = retryPolicyMock();
		retryPolicy.delay.mockImplementation(attempt => (attempt <= 5 ? 20 : -1));
		retryPolicy.limit = 5;

		await expect(() => execAsyncOperation(operation, retryPolicy, handler)).rejects.toThrowError(
			new Error('failed')
		);

		assert.strictEqual(operationSpan.length, 6);
		assert.strictEqual(handlerSpan.length, 5);

		expect(retryPolicy.notify).toHaveBeenCalledTimes(6);

		operationSpan.shift();

		for (const i of operationSpan.keys()) {
			const operationTime: number = operationSpan[i]!;
			const handlerTime: number = handlerSpan[i]!;

			assert.isAtLeast(operationTime, handlerTime);
			assert.isAtMost(operationTime - handlerTime, 5);
		}
	});
});

describe('NoRetryPolicy', () => {
	it('should not retry', () => {
		const policy = NO_RETRY_POLICY;

		assert.strictEqual(policy.shouldRetry(), false);
	});

	it('retry limit as zero', () => {
		const policy = NO_RETRY_POLICY;

		assert.strictEqual(policy.limit, 0);
	});

	it('must return negative delay', () => {
		const policy = NO_RETRY_POLICY;

		assert.strictEqual(policy.delay(), -1);
	});

	it('noop notify', () => {
		const policy = NO_RETRY_POLICY;

		assert.strictEqual(policy.notify(), undefined);
	});
});
