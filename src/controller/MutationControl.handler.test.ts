import { assert, describe, expect, it, vi } from 'vitest';
import { BasicRetryPolicy, CacheManager, MutationControl } from '@/lib';
import { makeCache } from '@/integration/LRUCache.mock';
import { mockMutationHandler, testTransformer } from '@/controller/Control.mock';
import { mockBackoffTimer } from '@/core/BackoffTimer.mock';

describe('MutationControl handler execution', () => {
	it('"idle" to "loading" to "success"', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const handler = mockMutationHandler();
		const retryPolicy = new BasicRetryPolicy(0, mockBackoffTimer());
		const mutationCtl = new MutationControl({ cache, mutationFn, retryPolicy, ...handler });

		assert.deepStrictEqual(mutationCtl.getState(), { status: 'idle', data: null, error: null });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(0);

		await mutationCtl.execute(['key#1']);

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{ data: null, error: null, status: 'loading' },
			mutationCtl.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{ data: 'data#1', error: null, status: 'success' },
			mutationCtl.cache
		);

		expect(mutationFn).toBeCalledTimes(1);
	});

	it('"idle" to "loading" to "error"', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const handler = mockMutationHandler();
		const retryPolicy = new BasicRetryPolicy(0, mockBackoffTimer());
		const mutationCtl = new MutationControl({ cache, mutationFn, retryPolicy, ...handler });

		assert.deepStrictEqual(mutationCtl.getState(), { status: 'idle', data: null, error: null });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(0);

		await mutationCtl.execute(['null']);

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{ data: null, error: null, status: 'loading' },
			mutationCtl.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{ data: null, error: new Error('invalid_key'), status: 'error' },
			mutationCtl.cache
		);

		expect(mutationFn).toBeCalledTimes(1);
	});

	it('"success" to "loading" to "success"', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const handler = mockMutationHandler();
		const retryPolicy = new BasicRetryPolicy(0, mockBackoffTimer());
		const mutationCtl = new MutationControl({ cache, mutationFn, retryPolicy, ...handler });

		await mutationCtl.execute(['key#valid']);

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		await mutationCtl.execute(['key#1']);

		expect(handler.dataFn).toHaveBeenCalledTimes(2);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{ data: null, error: null, status: 'loading' },
			mutationCtl.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{ data: 'data#1', error: null, status: 'success' },
			mutationCtl.cache
		);

		expect(mutationFn).toBeCalledTimes(2);
	});

	it('"success" to "loading" to "error"', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const handler = mockMutationHandler();
		const retryPolicy = new BasicRetryPolicy(0, mockBackoffTimer());
		const mutationCtl = new MutationControl({ cache, mutationFn, retryPolicy, ...handler });

		await mutationCtl.execute(['key#valid']);

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		await mutationCtl.execute(['err']);

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{ data: null, error: null, status: 'loading' },
			mutationCtl.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{ data: null, error: new Error('invalid_key'), status: 'error' },
			mutationCtl.cache
		);

		expect(mutationFn).toBeCalledTimes(2);
	});

	it('"error" to "loading" to "success"', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const handler = mockMutationHandler();
		const retryPolicy = new BasicRetryPolicy(0, mockBackoffTimer());
		const mutationCtl = new MutationControl({ cache, mutationFn, retryPolicy, ...handler });

		await mutationCtl.execute(['invalid']);

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		await mutationCtl.execute(['key#ok']);

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{ data: null, error: null, status: 'loading' },
			mutationCtl.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{ data: 'data#ok', error: null, status: 'success' },
			mutationCtl.cache
		);

		expect(mutationFn).toBeCalledTimes(2);
	});

	it('"error" to "loading" to "error"', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const handler = mockMutationHandler();
		const retryPolicy = new BasicRetryPolicy(0, mockBackoffTimer());
		const mutationCtl = new MutationControl({ cache, mutationFn, retryPolicy, ...handler });

		await mutationCtl.execute(['invalid']);

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		await mutationCtl.execute(['err']);

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(2);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{ data: null, error: null, status: 'loading' },
			mutationCtl.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{ data: null, error: new Error('invalid_key'), status: 'error' },
			mutationCtl.cache
		);

		expect(mutationFn).toBeCalledTimes(2);
	});

	it('"success" to "idle"', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const handler = mockMutationHandler();
		const retryPolicy = new BasicRetryPolicy(0, mockBackoffTimer());
		const mutationCtl = new MutationControl({ cache, mutationFn, retryPolicy, ...handler });

		await mutationCtl.execute(['key#valid']);

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		mutationCtl.reset();

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(mutationFn).toBeCalledTimes(1);
	});

	it('"success" to "idle" calling the handler state', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const handler = mockMutationHandler();
		const retryPolicy = new BasicRetryPolicy(0, mockBackoffTimer());
		const mutationCtl = new MutationControl({ cache, mutationFn, retryPolicy, ...handler });

		await mutationCtl.execute(['key#valid']);

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		mutationCtl.reset('handler');

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(3);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{ data: null, error: null, status: 'idle' },
			mutationCtl.cache
		);

		expect(mutationFn).toBeCalledTimes(1);
	});

	it('"idle" to "loading" to "idle" to "error"', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const handler = mockMutationHandler();
		const retryPolicy = new BasicRetryPolicy(0, mockBackoffTimer());
		const mutationCtl = new MutationControl({ cache, mutationFn, retryPolicy, ...handler });

		assert.deepStrictEqual(mutationCtl.getState(), { status: 'idle', data: null, error: null });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(0);

		const execution = mutationCtl.execute(['null']);
		mutationCtl.reset('handler');

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{ data: null, error: null, status: 'loading' },
			mutationCtl.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{ data: null, error: null, status: 'idle' },
			mutationCtl.cache
		);

		await execution;

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(3);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{ data: null, error: new Error('invalid_key'), status: 'error' },
			mutationCtl.cache
		);

		expect(mutationFn).toBeCalledTimes(1);
	});
});

describe('MutationControl handler exception handling', () => {
	it('"idle" to "loading" to "success"', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const handler = mockMutationHandler();
		const retryPolicy = new BasicRetryPolicy(0, mockBackoffTimer());
		const mutationCtl = new MutationControl({ cache, mutationFn, retryPolicy, ...handler });

		handler.dataFn.mockRejectedValue(new Error('broken_data_handler'));
		handler.errorFn.mockRejectedValue(new Error('broken_error_handler'));
		handler.stateFn.mockRejectedValue(new Error('broken_state_handler'));

		assert.deepStrictEqual(mutationCtl.getState(), { status: 'idle', data: null, error: null });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(0);

		await mutationCtl.execute(['key#1']);

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{ data: null, error: null, status: 'loading' },
			mutationCtl.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{ data: 'data#1', error: null, status: 'success' },
			mutationCtl.cache
		);

		expect(mutationFn).toBeCalledTimes(1);
	});

	it('"success" to "loading" to "error"', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const handler = mockMutationHandler();
		const retryPolicy = new BasicRetryPolicy(0, mockBackoffTimer());
		const mutationCtl = new MutationControl({ cache, mutationFn, retryPolicy, ...handler });

		handler.dataFn.mockRejectedValue(new Error('broken_data_handler'));
		handler.errorFn.mockRejectedValue(new Error('broken_error_handler'));
		handler.stateFn.mockRejectedValue(new Error('broken_state_handler'));

		assert.deepStrictEqual(mutationCtl.getState(), { status: 'idle', data: null, error: null });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(0);

		await mutationCtl.execute(['invalid']);

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{ data: null, error: null, status: 'loading' },
			mutationCtl.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{ data: null, error: new Error('invalid_key'), status: 'error' },
			mutationCtl.cache
		);

		expect(mutationFn).toBeCalledTimes(1);
	});
});
