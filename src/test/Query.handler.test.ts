import { describe, expect, it, vi } from 'vitest';
import {
	type QueryStateMetadata,
	DEFAULT_TTL_DURATION,
	defaultKeyHashFn,
	NoRetryPolicy,
	Query,
	waitUntil,
} from '@/lib';
import { makeCache } from '@/integration/LRUCache.mock';
import { testTransformer, mockQueryHandler } from '@/test/TestHelper.mock';

describe('Query handler execution / no-cache query', () => {
	it('idle to loading to success', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(0);

		await queryApi.execute(['key#1'], { cache: 'no-cache' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);
	});

	it('idle to loading to error', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(0);

		await queryApi.execute(['invalid_k'], { cache: 'no-cache' });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			1,
			new Error('invalid_key'),
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);
	});

	it('success to loading to success', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		await queryApi.execute(['key#1'], { cache: 'no-cache' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await queryApi.execute(['key#1'], { cache: 'no-cache' });

		expect(handler.dataFn).toHaveBeenCalledTimes(3);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			2,
			'data#1',
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: 'data#1',
				error: null,
				status: 'loading',
			},
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});

	it('success to loading to error', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		await queryApi.execute(['key#1'], { cache: 'no-cache' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await queryApi.execute(['invalid_1'], { cache: 'no-cache' });

		expect(handler.dataFn).toHaveBeenCalledTimes(2);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			1,
			new Error('invalid_key'),
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: 'data#1',
				error: null,
				status: 'loading',
			},
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});

	it('error to loading to success', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		await queryApi.execute(['invalid_1'], { cache: 'no-cache' });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			1,
			new Error('invalid_key'),
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await queryApi.execute(['key#1'], { cache: 'no-cache' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});

	it('error to loading to error', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		await queryApi.execute(['invalid_1'], { cache: 'no-cache' });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			1,
			new Error('invalid_key'),
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await queryApi.execute(['invalid_2'], { cache: 'no-cache' });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(2);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			2,
			new Error('invalid_key'),
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});
});

describe('Query handler execution / fresh query', () => {
	it('idle to loading to success from query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(0);

		await queryApi.execute(['key#1'], { cache: 'fresh' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);
	});

	it('idle to success from cache', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(0);

		await store.set(defaultKeyHashFn(['key#1']), 'data#1', DEFAULT_TTL_DURATION);

		await queryApi.execute(['key#1'], { cache: 'fresh' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(1);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'fresh',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(0);
	});

	it('idle to loading to error', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(0);

		await queryApi.execute(['invalid_1'], { cache: 'fresh' });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			1,
			new Error('invalid_key'),
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);
	});

	it('success to loading to success from query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		await queryApi.execute(['key#1'], { cache: 'fresh' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await store.delete(defaultKeyHashFn(['key#1']));

		await queryApi.execute(['key#1'], { cache: 'fresh' });

		expect(handler.dataFn).toHaveBeenCalledTimes(3);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			2,
			'data#1',
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: 'data#1',
				error: null,
				status: 'loading',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});

	it('success to success from cache', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		await queryApi.execute(['key#1'], { cache: 'fresh' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await queryApi.execute(['key#1'], { cache: 'fresh' });

		expect(handler.dataFn).toHaveBeenCalledTimes(2);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(3);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			2,
			'data#1',
			{
				cache: 'fresh',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);
	});

	it('success to loading to error', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		await queryApi.execute(['key#1'], { cache: 'fresh' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await queryApi.execute(['invalid_1'], { cache: 'fresh' });

		expect(handler.dataFn).toHaveBeenCalledTimes(2);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			1,
			new Error('invalid_key'),
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: 'data#1',
				error: null,
				status: 'loading',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});

	it('error to loading to success from query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		await queryApi.execute(['invalid_1'], { cache: 'fresh' });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			1,
			new Error('invalid_key'),
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await queryApi.execute(['key#1'], { cache: 'fresh' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});

	it('error to success from cache', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		await queryApi.execute(['invalid_1'], { cache: 'fresh' });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			1,
			new Error('invalid_key'),
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await store.set(defaultKeyHashFn(['key#1']), 'data#1', DEFAULT_TTL_DURATION);

		await queryApi.execute(['key#1'], { cache: 'fresh' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(3);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'fresh',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);
	});

	it('error to loading to error', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		await queryApi.execute(['invalid_1'], { cache: 'fresh' });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			1,
			new Error('invalid_key'),
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await queryApi.execute(['invalid_2'], { cache: 'fresh' });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(2);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			1,
			new Error('invalid_key'),
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});
});

describe('Query handler execution / stale query', () => {
	it('idle to loading to success from query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(0);

		await queryApi.execute(['key#1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);
	});

	it('idle to success from cache', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(0);

		await store.set(defaultKeyHashFn(['key#1']), 'data#1', DEFAULT_TTL_DURATION);

		await queryApi.execute(['key#1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(1);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(0);
	});

	it('stale to success from background query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler, fresh: 50 });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(0);

		await queryApi.execute(['key#1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await store.set(defaultKeyHashFn(['key#1']), 'stale_data#1', DEFAULT_TTL_DURATION);
		await waitUntil(70);

		queryFn.mockImplementationOnce(async (...keys) => {
			await waitUntil(10);
			return await testTransformer(...keys);
		});

		const queryPromise = queryApi.execute(['key#1'], { cache: 'stale' });
		const result = await queryPromise;

		expect(handler.dataFn).toHaveBeenCalledTimes(2);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(3);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			2,
			'stale_data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: 'stale_data#1',
				error: null,
				status: 'stale',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		await result.next();

		expect(handler.dataFn).toHaveBeenCalledTimes(3);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			3,
			'data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'background-query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'background-query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});

	it('stale to error from background query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler, fresh: 50 });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(0);

		await queryApi.execute(['key#1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await store.set(defaultKeyHashFn(['invalid_1']), 'stale_data#1', DEFAULT_TTL_DURATION);
		await waitUntil(70);

		queryFn.mockImplementationOnce(async (...keys) => {
			await waitUntil(10);
			return await testTransformer(...keys);
		});

		const result = await queryApi.execute(['invalid_1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(2);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(3);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			2,
			'stale_data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: 'stale_data#1',
				error: null,
				status: 'stale',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		await result.next();

		expect(handler.dataFn).toHaveBeenCalledTimes(2);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			1,
			new Error('invalid_key'),
			{
				cache: 'stale',
				origin: 'self',
				source: 'background-query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'background-query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});

	it('idle to loading to error', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(0);

		await queryApi.execute(['invalid_1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			1,
			new Error('invalid_key'),
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);
	});

	it('success to loading to success from query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		await queryApi.execute(['key#1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await store.delete(defaultKeyHashFn(['key#1']));

		await queryApi.execute(['key#1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(3);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			2,
			'data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: 'data#1',
				error: null,
				status: 'loading',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});

	it('success to success from cache', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		await queryApi.execute(['key#1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await queryApi.execute(['key#1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(2);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(3);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			2,
			'data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);
	});

	it('success to stale to success from background query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler, fresh: 50 });

		await queryApi.execute(['key#1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await store.set(defaultKeyHashFn(['key#1']), 'stale_data#1', DEFAULT_TTL_DURATION);
		await waitUntil(70);

		queryFn.mockImplementationOnce(async (...keys) => {
			await waitUntil(10);
			return await testTransformer(...keys);
		});

		await queryApi.execute(['key#1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(2);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(3);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			2,
			'stale_data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: 'stale_data#1',
				error: null,
				status: 'stale',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		await waitUntil(100);
		// await result.next();

		expect(handler.dataFn).toHaveBeenCalledTimes(3);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			3,
			'data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'background-query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'background-query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});

	it('success to stale to error from background query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler, fresh: 50 });

		await queryApi.execute(['key#1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await store.set(defaultKeyHashFn(['invalid_1']), 'stale_data#1', DEFAULT_TTL_DURATION);
		await waitUntil(70);

		queryFn.mockImplementationOnce(async (...keys) => {
			await waitUntil(10);
			return await testTransformer(...keys);
		});

		await queryApi.execute(['invalid_1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(2);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(3);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			2,
			'stale_data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: 'stale_data#1',
				error: null,
				status: 'stale',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		await waitUntil(100);
		// await result.next();

		expect(handler.dataFn).toHaveBeenCalledTimes(2);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			1,
			new Error('invalid_key'),
			{
				cache: 'stale',
				origin: 'self',
				source: 'background-query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'background-query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});

	it('success to loading to error', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		await queryApi.execute(['key#1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await queryApi.execute(['invalid_1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(2);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			1,
			new Error('invalid_key'),
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: 'data#1',
				error: null,
				status: 'loading',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});

	it('error to loading to success from query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		await queryApi.execute(['invalid_1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			1,
			new Error('invalid_key'),
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await queryApi.execute(['key#1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});

	it('error to success from cache', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		await queryApi.execute(['invalid_1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			1,
			new Error('invalid_key'),
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await store.set(defaultKeyHashFn(['key#1']), 'data#1', DEFAULT_TTL_DURATION);

		await queryApi.execute(['key#1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(3);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);
	});

	it('error to stale to success from background query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler, fresh: 50 });

		await queryApi.execute(['invalid_1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			1,
			new Error('invalid_key'),
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await store.set(defaultKeyHashFn(['key#1']), 'stale_data#1', DEFAULT_TTL_DURATION);
		await waitUntil(70);

		queryFn.mockImplementationOnce(async (...keys) => {
			await waitUntil(10);
			return await testTransformer(...keys);
		});

		await queryApi.execute(['key#1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(3);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'stale_data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: 'stale_data#1',
				error: null,
				status: 'stale',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		await waitUntil(100);
		// await result.next();

		expect(handler.dataFn).toHaveBeenCalledTimes(2);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			2,
			'data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'background-query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'background-query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});

	it('error to stale to error from background query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler, fresh: 50 });

		await queryApi.execute(['invalid_1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			1,
			new Error('invalid_key'),
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await store.set(defaultKeyHashFn(['invalid_1']), 'stale_data#1', DEFAULT_TTL_DURATION);
		await waitUntil(70);

		queryFn.mockImplementationOnce(async (...keys) => {
			await waitUntil(10);
			return await testTransformer(...keys);
		});

		await queryApi.execute(['invalid_1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(3);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'stale_data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: 'stale_data#1',
				error: null,
				status: 'stale',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		await waitUntil(100);
		// await result.next();

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(2);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			2,
			new Error('invalid_key'),
			{
				cache: 'stale',
				origin: 'self',
				source: 'background-query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'background-query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});

	it('error to loading to error', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler, fresh: 50 });

		await queryApi.execute(['invalid_1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			1,
			new Error('invalid_key'),
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await queryApi.execute(['invalid_1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(2);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			2,
			new Error('invalid_key'),
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});
});

describe('Query handler exception handling', () => {
	it('handler exception for no-cache query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		handler.dataFn.mockRejectedValue(new Error('broken_data_handler'));
		handler.errorFn.mockRejectedValue(new Error('broken_error_handler'));
		handler.stateFn.mockRejectedValue(new Error('broken_state_handler'));

		await queryApi.execute(['key#1'], { cache: 'no-cache' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await queryApi.execute(['invalid'], { cache: 'no-cache' });

		expect(handler.dataFn).toHaveBeenCalledTimes(2);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			1,
			new Error('invalid_key'),
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: 'data#1',
				error: null,
				status: 'loading',
			},
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'no-cache',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});

	it('handler exception for fresh query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		handler.dataFn.mockRejectedValue(new Error('broken_data_handler'));
		handler.errorFn.mockRejectedValue(new Error('broken_error_handler'));
		handler.stateFn.mockRejectedValue(new Error('broken_state_handler'));

		await queryApi.execute(['key#1'], { cache: 'fresh' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await queryApi.execute(['invalid'], { cache: 'fresh' });

		expect(handler.dataFn).toHaveBeenCalledTimes(2);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			1,
			new Error('invalid_key'),
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: 'data#1',
				error: null,
				status: 'loading',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);

		await queryApi.execute(['key#1'], { cache: 'fresh' });

		expect(handler.dataFn).toHaveBeenCalledTimes(3);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(5);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			2,
			'data#1',
			{
				cache: 'fresh',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.dataFn).toHaveBeenNthCalledWith(
			3,
			'data#1',
			{
				cache: 'fresh',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			5,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'fresh',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});

	it('handler exception for stale query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryApi = Query.create({ store, queryFn, retryPolicy, ...handler });

		handler.dataFn.mockRejectedValue(new Error('broken_data_handler'));
		handler.errorFn.mockRejectedValue(new Error('broken_error_handler'));
		handler.stateFn.mockRejectedValue(new Error('broken_state_handler'));

		await queryApi.execute(['key#1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				data: null,
				error: null,
				status: 'loading',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		await queryApi.execute(['invalid'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(2);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			1,
			new Error('invalid_key'),
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{
				data: 'data#1',
				error: null,
				status: 'loading',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);

		await queryApi.execute(['key#1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(3);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(5);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			2,
			'data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'query',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);
		expect(handler.dataFn).toHaveBeenNthCalledWith(
			3,
			'data#1',
			{
				cache: 'stale',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			5,
			{
				data: 'data#1',
				error: null,
				status: 'success',
			},
			{
				cache: 'stale',
				origin: 'self',
				source: 'cache',
			} satisfies QueryStateMetadata,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});
});
