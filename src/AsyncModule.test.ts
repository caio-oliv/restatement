import { assert, describe, it, expect, vi } from 'vitest';
import { retryAsyncOperation } from '@/lib';

async function failedOperation(): Promise<void> {
	throw new Error('failed');
}

async function successOperation(): Promise<string> {
	return 'OK';
}

describe('retryAsyncOperation', () => {
	it('resolve operation', async () => {
		const value = await retryAsyncOperation<string>(successOperation, () => -1, 1);

		assert.strictEqual(value, 'OK');
	});

	it('reject operation after 3 retries', async () => {
		let retries = 0;
		let handler = 0;
		const retryDelay = () => {
			retries += 1;
			return 0;
		};
		const retryHandler = () => {
			handler += 1;
		};

		await expect(() =>
			retryAsyncOperation(failedOperation, retryDelay, 3, retryHandler)
		).rejects.toThrowError(new Error('failed'));

		assert.strictEqual(retries, 3);
		assert.strictEqual(handler, 3);
	});

	it('reject operation if retry delay is negative', async () => {
		let retryDelayCalled = 0;
		let handler = 0;
		const retryDelay = () => {
			retryDelayCalled += 1;
			return -1;
		};
		const retryHandler = () => {
			handler += 1;
		};

		await expect(() =>
			retryAsyncOperation(failedOperation, retryDelay, 2, retryHandler)
		).rejects.toThrowError(new Error('failed'));

		assert.strictEqual(retryDelayCalled, 1);
		assert.strictEqual(handler, 0);
	});

	it('not retry if retryCount is negative', async () => {
		let retryDelayCalled = 0;
		let handler = 0;
		const retryDelay = () => {
			retryDelayCalled += 1;
			return -1;
		};
		const retryHandler = () => {
			handler += 1;
		};

		await expect(() =>
			retryAsyncOperation(failedOperation, retryDelay, -1, retryHandler)
		).rejects.toThrowError(new Error('failed'));

		assert.strictEqual(retryDelayCalled, 0);
		assert.strictEqual(handler, 0);
	});

	it('not retry if retryCount is zero', async () => {
		let retryDelayCalled = 0;
		let handler = 0;
		const retryDelay = () => {
			retryDelayCalled += 1;
			return -1;
		};
		const retryHandler = () => {
			handler += 1;
		};

		await expect(() =>
			retryAsyncOperation(failedOperation, retryDelay, 0, retryHandler)
		).rejects.toThrowError(new Error('failed'));

		assert.strictEqual(retryDelayCalled, 0);
		assert.strictEqual(handler, 0);
	});

	it('call the retry handler before every retry', async () => {
		const operationSpan: Array<number> = [];
		async function operation() {
			operationSpan.push(Date.now());
			throw new Error('failed');
		}
		function retryDelay() {
			return 20;
		}
		const handlerSpan: Array<number> = [];
		const handler = vi.fn(() => {
			handlerSpan.push(Date.now());
		});

		await expect(() => retryAsyncOperation(operation, retryDelay, 5, handler)).rejects.toThrowError(
			new Error('failed')
		);

		assert.strictEqual(operationSpan.length, 6);
		assert.strictEqual(handlerSpan.length, 5);

		operationSpan.shift();

		for (const i of operationSpan.keys()) {
			const operationTime: number = operationSpan[i]!;
			const handlerTime: number = handlerSpan[i]!;

			assert.isAtLeast(operationTime, handlerTime);
			assert.isAtMost(operationTime - handlerTime, 5);
		}
	});
});
