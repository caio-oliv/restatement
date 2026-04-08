import { assert, describe, it, expect, vi } from 'vitest';
import {
	execAsyncOperation,
	NO_RETRY_POLICY,
	waitTimeout,
	type Millisecond,
	type OperationResult,
} from '@/lib';

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

	it('do not retry if operation is aborted', async () => {
		async function operation(signal: AbortSignal) {
			await waitTimeout(1_000, signal);
		}

		const retryPolicy = retryPolicyMock();
		retryPolicy.delay.mockImplementation(attempt => (attempt <= 5 ? 20 : -1));
		retryPolicy.limit = 5;

		const signal = AbortSignal.timeout(50);

		await expect(() =>
			execAsyncOperation(() => operation(signal), retryPolicy, null, signal)
		).rejects.toThrowError();

		expect(retryPolicy.notify).toHaveBeenCalledTimes(0);
		expect(retryPolicy.delay).toHaveBeenCalledTimes(0);
	});

	it('do not notify failure if operation is aborted', async () => {
		let operationRetries = 2;

		async function operation(signal: AbortSignal) {
			await waitTimeout(operationRetries ? 10 : 1_000, signal);
			if (operationRetries) {
				operationRetries -= 1;
				throw new Error('Normal ocasional error');
			}
		}

		const retryPolicy = retryPolicyMock();
		retryPolicy.delay.mockImplementation(attempt => (attempt <= 5 ? 10 : -1));
		retryPolicy.limit = 5;

		const signal = AbortSignal.timeout(100);

		await expect(() =>
			execAsyncOperation(() => operation(signal), retryPolicy, null, signal)
		).rejects.toThrowError();

		expect(retryPolicy.notify).toHaveBeenCalledTimes(2);
		expect(retryPolicy.delay).toHaveBeenCalledTimes(2);
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

describe('waitTimeout', () => {
	it('wait until 100 milliseconds is elapsed', async () => {
		const TIMEOUT: Millisecond = 100;

		const start = Date.now();
		await waitTimeout(TIMEOUT);
		const elapsed = Date.now() - start;

		assert.isAtLeast(elapsed, TIMEOUT);
	});

	it('wait until 10 milliseconds is elapsed', async () => {
		const TIMEOUT: Millisecond = 10;

		const start = Date.now();
		await waitTimeout(TIMEOUT);
		const elapsed = Date.now() - start;

		assert.isAtLeast(elapsed, TIMEOUT);
	});

	it('abort timer before timeout', async () => {
		const TIMEOUT: Millisecond = 100;

		const signal = AbortSignal.timeout(10);

		await expect(() => waitTimeout(TIMEOUT, signal)).rejects.toThrowError();
	});

	it('abort timer before 1 millisecond timeout', async () => {
		const TIMEOUT: Millisecond = 1;

		const signal = AbortSignal.abort(new Error('AlreadyAborted'));

		await expect(() => waitTimeout(TIMEOUT, signal)).rejects.toThrowError(
			new Error('AlreadyAborted')
		);
	});

	it('abort timer before 0 millisecond timeout', async () => {
		const TIMEOUT: Millisecond = 0;

		const controller = new AbortController();
		const signal = controller.signal;

		const error = new Error('AbortPrecedence');

		controller.abort(error);

		await expect(() => waitTimeout(TIMEOUT, signal)).rejects.toThrowError(error);
	});

	it('try abort the timer after resolution timeout', async () => {
		const TIMEOUT: Millisecond = 10;

		const signal = AbortSignal.timeout(100);

		await waitTimeout(TIMEOUT, signal);

		assert.strictEqual(signal.aborted, false);

		await waitTimeout(100);

		assert.strictEqual(signal.aborted, true);
	});

	it('try abort the timer after resolution', async () => {
		const TIMEOUT: Millisecond = 10;

		const controller = new AbortController();
		const signal = controller.signal;

		await waitTimeout(TIMEOUT, signal);

		assert.strictEqual(signal.aborted, false);

		controller.abort(new Error('AbortAfter'));

		assert.strictEqual(signal.aborted, true);
		assert.deepStrictEqual(signal.reason, new Error('AbortAfter'));
	});
});
