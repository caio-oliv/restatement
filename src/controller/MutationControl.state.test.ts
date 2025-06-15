import { assert, describe, it, vi } from 'vitest';
import { CacheManager, type MutationStateFilterInfo, MutationControl } from '@/lib';
import { makeCache } from '@/integration/LRUCache.mock';
import { testTransformer } from '@/controller/Control.mock';

describe('MutationControl state transition', () => {
	it('"idle" to "loading" to "success"', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const mutationCtl = new MutationControl({ cache, mutationFn, retry: 0 });

		assert.deepStrictEqual(mutationCtl.getState(), { status: 'idle', data: null, error: null });

		const mutationPromise = mutationCtl.execute(['key#test']);

		assert.deepStrictEqual(mutationCtl.getState(), { status: 'loading', data: null, error: null });

		await mutationPromise;

		assert.deepStrictEqual(mutationCtl.getState(), {
			status: 'success',
			data: 'data#test',
			error: null,
		});
	});

	it('"idle" to "loading" to "error"', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const mutationCtl = new MutationControl({ cache, mutationFn, retry: 0 });

		assert.deepStrictEqual(mutationCtl.getState(), { status: 'idle', data: null, error: null });

		const mutationPromise = mutationCtl.execute(['invalid_call']);

		assert.deepStrictEqual(mutationCtl.getState(), { status: 'loading', data: null, error: null });

		await mutationPromise;

		assert.deepStrictEqual(mutationCtl.getState(), {
			status: 'error',
			data: null,
			error: new Error('invalid_key'),
		});
	});

	it('"success" to "loading" to "success"', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const mutationCtl = new MutationControl({ cache, mutationFn, retry: 0 });

		const state = await mutationCtl.execute(['key#test']);

		assert.deepStrictEqual(state, {
			status: 'success',
			data: 'data#test',
			error: null,
		});
		assert.deepStrictEqual(mutationCtl.getState(), {
			status: 'success',
			data: 'data#test',
			error: null,
		});

		const mutationPromise = mutationCtl.execute(['key#test1']);

		assert.deepStrictEqual(mutationCtl.getState(), { status: 'loading', data: null, error: null });

		await mutationPromise;

		assert.deepStrictEqual(mutationCtl.getState(), {
			status: 'success',
			data: 'data#test1',
			error: null,
		});
	});

	it('"success" to "loading" to "error"', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const mutationCtl = new MutationControl({ cache, mutationFn, retry: 0 });

		const state = await mutationCtl.execute(['key#test']);

		assert.deepStrictEqual(state, {
			status: 'success',
			data: 'data#test',
			error: null,
		});
		assert.deepStrictEqual(mutationCtl.getState(), {
			status: 'success',
			data: 'data#test',
			error: null,
		});

		const mutationPromise = mutationCtl.execute(['empty']);

		assert.deepStrictEqual(mutationCtl.getState(), { status: 'loading', data: null, error: null });

		await mutationPromise;

		assert.deepStrictEqual(mutationCtl.getState(), {
			status: 'error',
			data: null,
			error: new Error('invalid_key'),
		});
	});

	it('"error" to "loading" to "success"', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const mutationCtl = new MutationControl({ cache, mutationFn, retry: 0 });

		const state = await mutationCtl.execute(['invalid']);

		assert.deepStrictEqual(state, {
			status: 'error',
			data: null,
			error: new Error('invalid_key'),
		});
		assert.deepStrictEqual(mutationCtl.getState(), {
			status: 'error',
			data: null,
			error: new Error('invalid_key'),
		});

		const mutationPromise = mutationCtl.execute(['key#test1']);

		assert.deepStrictEqual(mutationCtl.getState(), { status: 'loading', data: null, error: null });

		await mutationPromise;

		assert.deepStrictEqual(mutationCtl.getState(), {
			status: 'success',
			data: 'data#test1',
			error: null,
		});
	});

	it('"error" to "loading" to "error"', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const mutationCtl = new MutationControl({ cache, mutationFn, retry: 0 });

		const state = await mutationCtl.execute(['invalid']);

		assert.deepStrictEqual(state, {
			status: 'error',
			data: null,
			error: new Error('invalid_key'),
		});
		assert.deepStrictEqual(mutationCtl.getState(), {
			status: 'error',
			data: null,
			error: new Error('invalid_key'),
		});

		const mutationPromise = mutationCtl.execute(['empty']);

		assert.deepStrictEqual(mutationCtl.getState(), { status: 'loading', data: null, error: null });

		await mutationPromise;

		assert.deepStrictEqual(mutationCtl.getState(), {
			status: 'error',
			data: null,
			error: new Error('invalid_key'),
		});
	});
});

describe('MutationControl state transition / reset query', () => {
	it('reset state to idle', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const mutationCtl = new MutationControl({ cache, mutationFn, retry: 0 });

		assert.deepStrictEqual(mutationCtl.getState(), { status: 'idle', data: null, error: null });

		await mutationCtl.execute(['key#test']);

		assert.deepStrictEqual(mutationCtl.getState(), {
			status: 'success',
			data: 'data#test',
			error: null,
		});

		mutationCtl.reset();

		assert.deepStrictEqual(mutationCtl.getState(), { status: 'idle', data: null, error: null });
	});

	it('reset state to idle with placeholder', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const mutationCtl = new MutationControl({ placeholder: 'one', cache, mutationFn, retry: 0 });

		assert.deepStrictEqual(mutationCtl.getState(), { status: 'idle', data: 'one', error: null });

		await mutationCtl.execute(['key#test']);

		assert.deepStrictEqual(mutationCtl.getState(), {
			status: 'success',
			data: 'data#test',
			error: null,
		});

		mutationCtl.reset();

		assert.deepStrictEqual(mutationCtl.getState(), { status: 'idle', data: 'one', error: null });
	});

	it('reset state in mid mutation', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const mutationCtl = new MutationControl({ placeholder: 'one', cache, mutationFn, retry: 0 });

		assert.deepStrictEqual(mutationCtl.getState(), { status: 'idle', data: 'one', error: null });

		const mutationPromise = mutationCtl.execute(['key#test']);

		assert.deepStrictEqual(mutationCtl.getState(), {
			status: 'loading',
			data: null,
			error: null,
		});

		mutationCtl.reset();

		assert.deepStrictEqual(mutationCtl.getState(), { status: 'idle', data: 'one', error: null });

		await mutationPromise;

		assert.deepStrictEqual(mutationCtl.getState(), {
			status: 'success',
			data: 'data#test',
			error: null,
		});
	});
});

describe('MutationControl state transition / filter', () => {
	it('filter out "loading" state', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		function stateFilterFn<T, E>({ next }: MutationStateFilterInfo<T, E>): boolean {
			return next.status !== 'loading';
		}
		const mutationCtl = new MutationControl({ cache, mutationFn, retry: 0, stateFilterFn });

		const mutationPromise1 = mutationCtl.execute(['key#test']);

		assert.deepStrictEqual(mutationCtl.getState(), { status: 'idle', data: null, error: null });

		await mutationPromise1;

		assert.deepStrictEqual(mutationCtl.getState(), {
			status: 'success',
			data: 'data#test',
			error: null,
		});

		const mutationPromise2 = mutationCtl.execute(['err']);

		assert.deepStrictEqual(mutationCtl.getState(), {
			status: 'success',
			data: 'data#test',
			error: null,
		});

		await mutationPromise2;

		assert.deepStrictEqual(mutationCtl.getState(), {
			status: 'error',
			data: null,
			error: new Error('invalid_key'),
		});
	});

	it('filter out "error" state', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		function stateFilterFn<T, E>({ next }: MutationStateFilterInfo<T, E>): boolean {
			return next.status !== 'error';
		}
		const mutationCtl = new MutationControl({ cache, mutationFn, retry: 0, stateFilterFn });

		const mutationPromise1 = mutationCtl.execute(['key#test']);

		assert.deepStrictEqual(mutationCtl.getState(), { status: 'loading', data: null, error: null });

		await mutationPromise1;

		assert.deepStrictEqual(mutationCtl.getState(), {
			status: 'success',
			data: 'data#test',
			error: null,
		});

		const mutationPromise2 = mutationCtl.execute(['err']);

		assert.deepStrictEqual(mutationCtl.getState(), { status: 'loading', data: null, error: null });

		await mutationPromise2;

		assert.deepStrictEqual(mutationCtl.getState(), {
			status: 'loading',
			data: null,
			error: null,
		});
	});
});
