import { assert, describe, it, expect } from 'vitest';
import { retryAsyncOperation } from '@/lib';

describe('retryAsyncOperation', () => {
	it('resolve operation', async () => {
		const operation = async () => 'OK';
		const value = await retryAsyncOperation(operation, () => -1, 1);

		assert.strictEqual(value, 'OK');
	});

	it('reject operation after 3 retries', async () => {
		let retries = 0;
		let handler = 0;
		const operation = async () => {
			throw new Error('failed');
		};
		const retryDelay = () => {
			retries += 1;
			return 0;
		};
		const retryHandler = () => {
			handler += 1;
		};

		await expect(() =>
			retryAsyncOperation(operation, retryDelay, 3, retryHandler)
		).rejects.toThrowError(new Error('failed'));

		assert.strictEqual(retries, 3);
		assert.strictEqual(handler, 3);
	});

	it('reject operation if retry delay is negative', async () => {
		let retryDelayCalled = 0;
		let handler = 0;
		const operation = async () => {
			throw new Error('failed');
		};
		const retryDelay = () => {
			retryDelayCalled += 1;
			return -1;
		};
		const retryHandler = () => {
			handler += 1;
		};

		await expect(() =>
			retryAsyncOperation(operation, retryDelay, 2, retryHandler)
		).rejects.toThrowError(new Error('failed'));

		assert.strictEqual(retryDelayCalled, 1);
		assert.strictEqual(handler, 0);
	});

	it('not retry if retryCount is negative', async () => {
		let retryDelayCalled = 0;
		let handler = 0;
		const operation = async () => {
			throw new Error('failed');
		};
		const retryDelay = () => {
			retryDelayCalled += 1;
			return -1;
		};
		const retryHandler = () => {
			handler += 1;
		};

		await expect(() =>
			retryAsyncOperation(operation, retryDelay, -1, retryHandler)
		).rejects.toThrowError(new Error('failed'));

		assert.strictEqual(retryDelayCalled, 0);
		assert.strictEqual(handler, 0);
	});

	it('not retry if retryCount is zero', async () => {
		let retryDelayCalled = 0;
		let handler = 0;
		const operation = async () => {
			throw new Error('failed');
		};
		const retryDelay = () => {
			retryDelayCalled += 1;
			return -1;
		};
		const retryHandler = () => {
			handler += 1;
		};

		await expect(() =>
			retryAsyncOperation(operation, retryDelay, 0, retryHandler)
		).rejects.toThrowError(new Error('failed'));

		assert.strictEqual(retryDelayCalled, 0);
		assert.strictEqual(handler, 0);
	});
});
