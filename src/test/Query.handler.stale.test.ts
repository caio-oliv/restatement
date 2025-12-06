import { assert, describe, expect, it, vi } from 'vitest';
import {
	type QueryStateHandlerEvent,
	DEFAULT_TTL_DURATION,
	defaultKeyHashFn,
	NO_RETRY_POLICY,
	Query,
	waitUntil,
} from '@/lib';
import { makeCache } from '@/integration/LRUCache.mock';
import { testTransformer, mockQueryHandler } from '@/test/TestHelper.mock';

describe('Query handler / stale query', () => {
	it('idle to loading to success from query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY, ...handler });

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

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 0,
			cache_miss: 1,
			cache_delete_on_error: 0,
			last_cache_directive: 'stale',
			events_filtered: 0,
			events_processed: 2,
			handler_executions: 3,
		});
	});

	it('idle to success from cache', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY, ...handler });

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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'cache' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{ data: 'data#1', error: null, status: 'success' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'cache' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(0);

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 1,
			cache_miss: 0,
			cache_delete_on_error: 0,
			last_cache_directive: 'stale',
			events_filtered: 0,
			events_processed: 1,
			handler_executions: 2,
		});
	});

	it('stale to success from background query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const queryApi = Query.create({
			store,
			queryFn,
			retryPolicy: NO_RETRY_POLICY,
			...handler,
			fresh: 50,
		});

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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'cache' },
				state: { data: 'stale_data#1', error: null, status: 'stale' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{ data: 'stale_data#1', error: null, status: 'stale' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'cache' },
				state: { data: 'stale_data#1', error: null, status: 'stale' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'background-query' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{ data: 'data#1', error: null, status: 'success' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'background-query' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 1,
			cache_miss: 1,
			cache_delete_on_error: 0,
			last_cache_directive: 'stale',
			events_filtered: 0,
			events_processed: 4,
			handler_executions: 7,
		});
	});

	it('stale to error from background query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const queryApi = Query.create({
			store,
			queryFn,
			retryPolicy: NO_RETRY_POLICY,
			...handler,
			fresh: 50,
		});

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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'cache' },
				state: { data: 'stale_data#1', error: null, status: 'stale' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{ data: 'stale_data#1', error: null, status: 'stale' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'cache' },
				state: { data: 'stale_data#1', error: null, status: 'stale' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'background-query' },
				state: { data: null, error: new Error('invalid_key'), status: 'error' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{ data: null, error: new Error('invalid_key'), status: 'error' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'background-query' },
				state: { data: null, error: new Error('invalid_key'), status: 'error' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 1,
			cache_miss: 1,
			cache_delete_on_error: 1,
			last_cache_directive: 'stale',
			events_filtered: 0,
			events_processed: 4,
			handler_executions: 7,
		});
	});

	it('idle to loading to error', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY, ...handler });

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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'query' },
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
				metadata: { cache: 'stale', origin: 'self', source: 'query' },
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
				metadata: { cache: 'stale', origin: 'self', source: 'query' },
				state: { data: null, error: new Error('invalid_key'), status: 'error' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 0,
			cache_miss: 1,
			cache_delete_on_error: 1,
			last_cache_directive: 'stale',
			events_filtered: 0,
			events_processed: 2,
			handler_executions: 3,
		});
	});

	it('success to loading to success from query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY, ...handler });

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

		await store.delete(defaultKeyHashFn(['key#1']));

		await queryApi.execute(['key#1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(3);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(4);

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
			{ data: 'data#1', error: null, status: 'success' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'query' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 0,
			cache_miss: 2,
			cache_delete_on_error: 0,
			last_cache_directive: 'stale',
			events_filtered: 0,
			events_processed: 4,
			handler_executions: 7,
		});
	});

	it('success to success from cache', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY, ...handler });

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

		await queryApi.execute(['key#1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(2);
		expect(handler.errorFn).toHaveBeenCalledTimes(0);
		expect(handler.stateFn).toHaveBeenCalledTimes(3);

		expect(handler.dataFn).toHaveBeenNthCalledWith(
			2,
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
			3,
			{ data: 'data#1', error: null, status: 'success' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'cache' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 1,
			cache_miss: 1,
			cache_delete_on_error: 0,
			last_cache_directive: 'stale',
			events_filtered: 0,
			events_processed: 3,
			handler_executions: 5,
		});
	});

	it('success to stale to success from background query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const queryApi = Query.create({
			store,
			queryFn,
			retryPolicy: NO_RETRY_POLICY,
			...handler,
			fresh: 50,
		});

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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'cache' },
				state: { data: 'stale_data#1', error: null, status: 'stale' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{ data: 'stale_data#1', error: null, status: 'stale' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'cache' },
				state: { data: 'stale_data#1', error: null, status: 'stale' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'background-query' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{ data: 'data#1', error: null, status: 'success' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'background-query' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 1,
			cache_miss: 1,
			cache_delete_on_error: 0,
			last_cache_directive: 'stale',
			events_filtered: 0,
			events_processed: 4,
			handler_executions: 7,
		});
	});

	it('success to stale to error from background query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const queryApi = Query.create({
			store,
			queryFn,
			retryPolicy: NO_RETRY_POLICY,
			...handler,
			fresh: 50,
		});

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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'cache' },
				state: { data: 'stale_data#1', error: null, status: 'stale' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{ data: 'stale_data#1', error: null, status: 'stale' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'cache' },
				state: { data: 'stale_data#1', error: null, status: 'stale' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'background-query' },
				state: { data: null, error: new Error('invalid_key'), status: 'error' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{ data: null, error: new Error('invalid_key'), status: 'error' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'background-query' },
				state: { data: null, error: new Error('invalid_key'), status: 'error' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 1,
			cache_miss: 1,
			cache_delete_on_error: 1,
			last_cache_directive: 'stale',
			events_filtered: 0,
			events_processed: 4,
			handler_executions: 7,
		});
	});

	it('success to loading to error', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY, ...handler });

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

		await queryApi.execute(['invalid_1'], { cache: 'stale' });

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

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 0,
			cache_miss: 2,
			cache_delete_on_error: 1,
			last_cache_directive: 'stale',
			events_filtered: 0,
			events_processed: 4,
			handler_executions: 7,
		});
	});

	it('error to loading to success from query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY, ...handler });

		await queryApi.execute(['invalid_1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

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
			{ data: null, error: new Error('invalid_key'), status: 'error' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'query' },
				state: { data: null, error: new Error('invalid_key'), status: 'error' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'query' },
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
				metadata: { cache: 'stale', origin: 'self', source: 'query' },
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
				metadata: { cache: 'stale', origin: 'self', source: 'query' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 0,
			cache_miss: 2,
			cache_delete_on_error: 1,
			last_cache_directive: 'stale',
			events_filtered: 0,
			events_processed: 4,
			handler_executions: 6,
		});
	});

	it('error to success from cache', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY, ...handler });

		await queryApi.execute(['invalid_1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

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
			{ data: null, error: new Error('invalid_key'), status: 'error' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'query' },
				state: { data: null, error: new Error('invalid_key'), status: 'error' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'cache' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{ data: 'data#1', error: null, status: 'success' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'cache' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(1);

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 1,
			cache_miss: 1,
			cache_delete_on_error: 1,
			last_cache_directive: 'stale',
			events_filtered: 0,
			events_processed: 3,
			handler_executions: 5,
		});
	});

	it('error to stale to success from background query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const queryApi = Query.create({
			store,
			queryFn,
			retryPolicy: NO_RETRY_POLICY,
			...handler,
			fresh: 50,
		});

		await queryApi.execute(['invalid_1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

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
			{ data: null, error: new Error('invalid_key'), status: 'error' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'query' },
				state: { data: null, error: new Error('invalid_key'), status: 'error' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'cache' },
				state: { data: 'stale_data#1', error: null, status: 'stale' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{ data: 'stale_data#1', error: null, status: 'stale' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'cache' },
				state: { data: 'stale_data#1', error: null, status: 'stale' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'background-query' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{ data: 'data#1', error: null, status: 'success' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'background-query' },
				state: { data: 'data#1', error: null, status: 'success' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 1,
			cache_miss: 1,
			cache_delete_on_error: 1,
			last_cache_directive: 'stale',
			events_filtered: 0,
			events_processed: 4,
			handler_executions: 7,
		});
	});

	it('error to stale to error from background query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const queryApi = Query.create({
			store,
			queryFn,
			retryPolicy: NO_RETRY_POLICY,
			...handler,
			fresh: 50,
		});

		await queryApi.execute(['invalid_1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

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
			{ data: null, error: new Error('invalid_key'), status: 'error' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'query' },
				state: { data: null, error: new Error('invalid_key'), status: 'error' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'cache' },
				state: { data: 'stale_data#1', error: null, status: 'stale' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			3,
			{ data: 'stale_data#1', error: null, status: 'stale' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'cache' },
				state: { data: 'stale_data#1', error: null, status: 'stale' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'background-query' },
				state: { data: null, error: new Error('invalid_key'), status: 'error' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			4,
			{ data: null, error: new Error('invalid_key'), status: 'error' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'background-query' },
				state: { data: null, error: new Error('invalid_key'), status: 'error' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
			queryApi.cache
		);

		expect(queryFn).toBeCalledTimes(2);

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 1,
			cache_miss: 1,
			cache_delete_on_error: 2,
			last_cache_directive: 'stale',
			events_filtered: 0,
			events_processed: 4,
			handler_executions: 7,
		});
	});

	it('error to loading to error', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const queryApi = Query.create({
			store,
			queryFn,
			retryPolicy: NO_RETRY_POLICY,
			...handler,
			fresh: 50,
		});

		await queryApi.execute(['invalid_1'], { cache: 'stale' });

		expect(handler.dataFn).toHaveBeenCalledTimes(0);
		expect(handler.errorFn).toHaveBeenCalledTimes(1);
		expect(handler.stateFn).toHaveBeenCalledTimes(2);

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
			{ data: null, error: new Error('invalid_key'), status: 'error' },
			{
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'query' },
				state: { data: null, error: new Error('invalid_key'), status: 'error' },
			} satisfies QueryStateHandlerEvent<string, unknown>,
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
				type: 'transition',
				origin: 'self',
				metadata: { cache: 'stale', origin: 'self', source: 'query' },
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
				metadata: { cache: 'stale', origin: 'self', source: 'query' },
				state: { data: null, error: null, status: 'loading' },
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

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 0,
			cache_miss: 2,
			cache_delete_on_error: 2,
			last_cache_directive: 'stale',
			events_filtered: 0,
			events_processed: 4,
			handler_executions: 6,
		});
	});
});
