import { assert, describe, expect, it, vi } from 'vitest';
import { type QueryStateHandlerEvent, NO_RETRY_POLICY, Query } from '@/lib';
import { makeCache } from '@/integration/LRUCache.mock';
import { testTransformer, mockQueryHandler } from '@/test/TestHelper.mock';

describe('Query handler / exception handling', () => {
	it('handler exception for no-cache query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY, ...handler });

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

		await queryApi.execute(['invalid'], { cache: 'no-cache' });

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

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 0,
			cache_miss: 0,
			cache_delete_on_error: 1,
			last_cache_directive: 'no-cache',
			events_filtered: 0,
			events_processed: 4,
			handler_executions: 7,
		});
	});

	it('handler exception for fresh query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY, ...handler });

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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'fresh', origin: 'self', source: 'query' },
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
				metadata: { cache: 'fresh', origin: 'self', source: 'query' },
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
				metadata: { cache: 'fresh', origin: 'self', source: 'query' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'fresh', origin: 'self', source: 'query' },
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
				metadata: { cache: 'fresh', origin: 'self', source: 'query' },
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
				metadata: { cache: 'fresh', origin: 'self', source: 'query' },
				state: { data: null, error: new Error('invalid_key'), status: 'error' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'fresh', origin: 'self', source: 'query' },
				state: { data: 'data#1', error: null, status: 'loading' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);
		expect(handler.dataFn).toHaveBeenNthCalledWith(
			3,
			'data#1',
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'fresh', origin: 'self', source: 'cache' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			5,
			{ data: 'data#1', error: null, status: 'success' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'fresh', origin: 'self', source: 'cache' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 1,
			cache_miss: 2,
			cache_delete_on_error: 1,
			last_cache_directive: 'fresh',
			events_filtered: 0,
			events_processed: 5,
			handler_executions: 9,
		});
	});

	it('handler exception for stale query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY, ...handler });

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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'query' },
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
				metadata: { cache: 'stale', origin: 'self', source: 'query' },
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
				metadata: { cache: 'stale', origin: 'self', source: 'query' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'query' },
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
				metadata: { cache: 'stale', origin: 'self', source: 'query' },
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
				metadata: { cache: 'stale', origin: 'self', source: 'query' },
				state: { data: null, error: new Error('invalid_key'), status: 'error' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'query' },
				state: { data: 'data#1', error: null, status: 'loading' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);
		expect(handler.dataFn).toHaveBeenNthCalledWith(
			3,
			'data#1',
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'cache' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			5,
			{ data: 'data#1', error: null, status: 'success' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'cache' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 1,
			cache_miss: 2,
			cache_delete_on_error: 1,
			last_cache_directive: 'stale',
			events_filtered: 0,
			events_processed: 5,
			handler_executions: 9,
		});
	});
});
