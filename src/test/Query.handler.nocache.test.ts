import { describe, expect, it, vi } from 'vitest';
import { type QueryStateHandlerEvent, NO_RETRY_POLICY, Query } from '@/lib';
import { makeCache } from '@/integration/LRUCache.mock';
import { testTransformer, mockQueryHandler } from '@/test/TestHelper.mock';

describe('Query handler / no-cache query', () => {
	it('idle to loading to success', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY, ...handler });

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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{ data: null, error: null, status: 'loading' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: null, error: null, status: 'loading' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{ data: 'data#1', error: null, status: 'success' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);
	});

	it('idle to loading to error', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY, ...handler });

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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: null, error: new Error('invalid_key'), status: 'error' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{ data: null, error: null, status: 'loading' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: null, error: null, status: 'loading' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{ data: null, error: new Error('invalid_key'), status: 'error' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: null, error: new Error('invalid_key'), status: 'error' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);
	});

	it('success to loading to success', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY, ...handler });

		await queryApi.execute(['key#1'], { cache: 'no-cache' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{ data: null, error: null, status: 'loading' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: null, error: null, status: 'loading' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: 'data#1', error: null, status: 'loading' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{ data: 'data#1', error: null, status: 'loading' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: 'data#1', error: null, status: 'loading' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});

	it('success to loading to error', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY, ...handler });

		await queryApi.execute(['key#1'], { cache: 'no-cache' });

		expect(handler.dataFn).toHaveBeenCalledTimes(1);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			1,
			'data#1',
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{ data: null, error: null, status: 'loading' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: null, error: null, status: 'loading' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{ data: 'data#1', error: null, status: 'success' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: null, error: new Error('invalid_key'), status: 'error' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{ data: 'data#1', error: null, status: 'loading' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: 'data#1', error: null, status: 'loading' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{ data: null, error: new Error('invalid_key'), status: 'error' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: null, error: new Error('invalid_key'), status: 'error' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});

	it('error to loading to success', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY, ...handler });

		await queryApi.execute(['invalid_1'], { cache: 'no-cache' });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			1,
			new Error('invalid_key'),
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: null, error: new Error('invalid_key'), status: 'error' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{ data: null, error: null, status: 'loading' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: null, error: null, status: 'loading' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: null, error: new Error('invalid_key'), status: 'error' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{ data: null, error: null, status: 'loading' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: null, error: null, status: 'loading' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{ data: 'data#1', error: null, status: 'success' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});

	it('error to loading to error', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY, ...handler });

		await queryApi.execute(['invalid_1'], { cache: 'no-cache' });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

		expect(handler.errorFn).toHaveBeenNthCalledWith(
			1,
			new Error('invalid_key'),
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: null, error: new Error('invalid_key'), status: 'error' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{ data: null, error: null, status: 'loading' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: null, error: null, status: 'loading' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);
		expect(handler.stateFn).toHaveBeenNthCalledWith(
			2,
			{ data: null, error: new Error('invalid_key'), status: 'error' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: null, error: new Error('invalid_key'), status: 'error' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: null, error: new Error('invalid_key'), status: 'error' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{ data: null, error: null, status: 'loading' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: null, error: null, status: 'loading' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'no-cache', origin: 'self', source: 'query' },
				state: { data: null, error: new Error('invalid_key'), status: 'error' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);
	});
});
