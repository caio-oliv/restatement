import { assert, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TTL_DURATION, defaultKeyHashFn, NO_RETRY_POLICY, Query, waitUntil } from '@/lib';
import { makeCache } from '@/integration/LRUCache.mock';
import { testTransformer } from '@/test/TestHelper.mock';

describe('Query cache usage / no-cache query', () => {
	it('fill the cache when making a query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY });

		await queryApi.execute(['key#1'], { cache: 'no-cache' });

		const value = await store.get(defaultKeyHashFn(['key#1']));

		assert.deepStrictEqual(value, 'data#1');

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 0,
			cache_miss: 0,
			cache_delete_on_error: 0,
			last_cache_directive: 'no-cache',
			events_filtered: 0,
			events_processed: 2,
			handler_executions: 0,
		});
	});

	it('update the cache remaking the same query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const queryApi = Query.create({
			store,
			queryFn,
			retryPolicy: NO_RETRY_POLICY,
			fresh: 100,
			ttl: 1_000,
		});

		await queryApi.execute(['key#1'], { cache: 'no-cache' });

		{
			const entry = (await store.getEntry(defaultKeyHashFn(['key#1'])))!;

			assert.deepStrictEqual(entry.ttl, 1_000);
			assert.isTrue(entry.remain_ttl <= 1_000);
			assert.isTrue(entry.remain_ttl > 980);

			assert.deepStrictEqual(entry.data, 'data#1');
		}

		await waitUntil(50);

		{
			const entry = (await store.getEntry(defaultKeyHashFn(['key#1'])))!;

			assert.deepStrictEqual(entry.ttl, 1_000);
			assert.isTrue(entry.remain_ttl <= 960);

			assert.deepStrictEqual(entry.data, 'data#1');
		}

		await queryApi.execute(['key#1'], { cache: 'no-cache' });

		{
			const entry = (await store.getEntry(defaultKeyHashFn(['key#1'])))!;

			assert.deepStrictEqual(entry.ttl, 1_000);
			assert.isTrue(entry.remain_ttl <= 1_000);
			assert.isTrue(entry.remain_ttl > 980);

			assert.deepStrictEqual(entry.data, 'data#1');
		}

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 0,
			cache_miss: 0,
			cache_delete_on_error: 0,
			last_cache_directive: 'no-cache',
			events_filtered: 0,
			events_processed: 4,
			handler_executions: 0,
		});
	});

	it('remove the cache with a failed query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const queryApi = Query.create({
			store,
			queryFn,
			retryPolicy: NO_RETRY_POLICY,
			fresh: 100,
			ttl: 1_000,
		});

		queryFn.mockResolvedValueOnce('valid_result');

		await queryApi.execute(['invalid_1'], { cache: 'no-cache' });

		{
			const value = await store.get(defaultKeyHashFn(['invalid_1']));
			assert.deepStrictEqual(value, 'valid_result');
		}

		await queryApi.execute(['invalid_1'], { cache: 'no-cache' });

		{
			const value = await store.get(defaultKeyHashFn(['invalid_1']));
			assert.deepStrictEqual(value, undefined);
		}

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 0,
			cache_miss: 0,
			cache_delete_on_error: 1,
			last_cache_directive: 'no-cache',
			events_filtered: 0,
			events_processed: 4,
			handler_executions: 0,
		});
	});

	it('not remove the cache with a failed query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const queryApi = Query.create({
			store,
			queryFn,
			retryPolicy: NO_RETRY_POLICY,
			fresh: 100,
			ttl: 1_000,
			keepCacheOnErrorFn: () => true,
		});

		queryFn.mockResolvedValueOnce('valid_result');

		await queryApi.execute(['invalid_1'], { cache: 'no-cache' });

		{
			const value = await store.get(defaultKeyHashFn(['invalid_1']));
			assert.deepStrictEqual(value, 'valid_result');
		}

		await queryApi.execute(['invalid_1'], { cache: 'no-cache' });

		{
			const value = await store.get(defaultKeyHashFn(['invalid_1']));
			assert.deepStrictEqual(value, 'valid_result');
		}

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 0,
			cache_miss: 0,
			cache_delete_on_error: 0,
			last_cache_directive: 'no-cache',
			events_filtered: 0,
			events_processed: 4,
			handler_executions: 0,
		});
	});
});

describe('Query cache usage / fresh query', () => {
	it('fill the cache when making a query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY });

		await queryApi.execute(['key#1'], { cache: 'fresh' });

		const value = await store.get(defaultKeyHashFn(['key#1']));

		assert.deepStrictEqual(value, 'data#1');

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 0,
			cache_miss: 1,
			cache_delete_on_error: 0,
			last_cache_directive: 'fresh',
			events_filtered: 0,
			events_processed: 2,
			handler_executions: 0,
		});
	});

	it('update the cache remaking the same query when the cache is not fresh', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const queryApi = Query.create({
			store,
			queryFn,
			retryPolicy: NO_RETRY_POLICY,
			fresh: 20,
			ttl: 1_000,
		});

		await queryApi.execute(['key#1'], { cache: 'fresh' });

		{
			const entry = (await store.getEntry(defaultKeyHashFn(['key#1'])))!;

			assert.deepStrictEqual(entry.ttl, 1_000);
			assert.isTrue(entry.remain_ttl <= 1_000);
			assert.isTrue(entry.remain_ttl > 980);

			assert.deepStrictEqual(entry.data, 'data#1');
		}

		await waitUntil(50);

		{
			const entry = (await store.getEntry(defaultKeyHashFn(['key#1'])))!;

			assert.deepStrictEqual(entry.ttl, 1_000);
			assert.isTrue(entry.remain_ttl <= 955);

			assert.deepStrictEqual(entry.data, 'data#1');
		}

		await queryApi.execute(['key#1'], { cache: 'fresh' });

		{
			const entry = (await store.getEntry(defaultKeyHashFn(['key#1'])))!;

			assert.deepStrictEqual(entry.ttl, 1_000);
			assert.isTrue(entry.remain_ttl <= 1_000);
			assert.isTrue(entry.remain_ttl > 980);

			assert.deepStrictEqual(entry.data, 'data#1');
		}

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 0,
			cache_miss: 2,
			cache_delete_on_error: 0,
			last_cache_directive: 'fresh',
			events_filtered: 0,
			events_processed: 4,
			handler_executions: 0,
		});
	});

	it('remove the cache with a failed query when the cache is not fresh', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const queryApi = Query.create({
			store,
			queryFn,
			retryPolicy: NO_RETRY_POLICY,
			fresh: 20,
			ttl: 1_000,
		});

		queryFn.mockResolvedValueOnce('valid_result');

		await queryApi.execute(['invalid'], { cache: 'fresh' });

		{
			const value = await store.get(defaultKeyHashFn(['invalid']));
			assert.deepStrictEqual(value, 'valid_result');
		}

		await waitUntil(50);

		await queryApi.execute(['invalid'], { cache: 'fresh' });

		{
			const value = await store.get(defaultKeyHashFn(['invalid']));
			assert.deepStrictEqual(value, undefined);
		}

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 0,
			cache_miss: 2,
			cache_delete_on_error: 1,
			last_cache_directive: 'fresh',
			events_filtered: 0,
			events_processed: 4,
			handler_executions: 0,
		});
	});

	it('remove the cache with a failed query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY, fresh: 0 });

		await store.set(defaultKeyHashFn(['invalid']), 'valid_result', DEFAULT_TTL_DURATION);

		{
			const value = await store.get(defaultKeyHashFn(['invalid']));
			assert.deepStrictEqual(value, 'valid_result');
		}

		await queryApi.execute(['invalid'], { cache: 'fresh' });

		{
			const value = await store.get(defaultKeyHashFn(['invalid']));
			assert.deepStrictEqual(value, undefined);
		}

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 0,
			cache_miss: 1,
			cache_delete_on_error: 1,
			last_cache_directive: 'fresh',
			events_filtered: 0,
			events_processed: 2,
			handler_executions: 0,
		});
	});

	it('not remove the cache with a failed query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const queryApi = Query.create({
			store,
			queryFn,
			retryPolicy: NO_RETRY_POLICY,
			fresh: 0,
			keepCacheOnErrorFn: () => true,
		});

		await store.set(defaultKeyHashFn(['invalid']), 'valid_result', DEFAULT_TTL_DURATION);

		{
			const value = await store.get(defaultKeyHashFn(['invalid']));
			assert.deepStrictEqual(value, 'valid_result');
		}

		await queryApi.execute(['invalid'], { cache: 'fresh' });

		{
			const value = await store.get(defaultKeyHashFn(['invalid']));
			assert.deepStrictEqual(value, 'valid_result');
		}

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 0,
			cache_miss: 1,
			cache_delete_on_error: 0,
			last_cache_directive: 'fresh',
			events_filtered: 0,
			events_processed: 2,
			handler_executions: 0,
		});
	});
});

describe('Query cache usage / stale query', () => {
	it('fill the cache when making a query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY });

		await queryApi.execute(['key#1'], { cache: 'stale' });

		const value = await store.get(defaultKeyHashFn(['key#1']));

		assert.deepStrictEqual(value, 'data#1');

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 0,
			cache_miss: 1,
			cache_delete_on_error: 0,
			last_cache_directive: 'stale',
			events_filtered: 0,
			events_processed: 2,
			handler_executions: 0,
		});
	});

	it('update the cache remaking the same query when the cache is stale', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const queryApi = Query.create({
			store,
			queryFn,
			retryPolicy: NO_RETRY_POLICY,
			fresh: 0,
			ttl: 1_000,
		});

		await queryApi.execute(['key#1'], { cache: 'stale' });

		{
			const entry = (await store.getEntry(defaultKeyHashFn(['key#1'])))!;

			assert.deepStrictEqual(entry.ttl, 1_000);
			assert.isTrue(entry.remain_ttl <= 1_000);
			assert.isTrue(entry.remain_ttl > 980);

			assert.deepStrictEqual(entry.data, 'data#1');
		}

		await waitUntil(50);

		{
			const entry = (await store.getEntry(defaultKeyHashFn(['key#1'])))!;

			assert.deepStrictEqual(entry.ttl, 1_000);
			assert.isTrue(entry.remain_ttl <= 955);

			assert.deepStrictEqual(entry.data, 'data#1');
		}

		const result = await queryApi.execute(['key#1'], { cache: 'stale' });
		await result.next();

		{
			const entry = (await store.getEntry(defaultKeyHashFn(['key#1'])))!;

			assert.deepStrictEqual(entry.ttl, 1_000);
			assert.isTrue(entry.remain_ttl <= 1_000);
			assert.isTrue(entry.remain_ttl > 980);

			assert.deepStrictEqual(entry.data, 'data#1');
		}

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 1,
			cache_miss: 1,
			cache_delete_on_error: 0,
			last_cache_directive: 'stale',
			events_filtered: 0,
			events_processed: 4,
			handler_executions: 0,
		});
	});

	it('remove the cache with a failed query when the cache is stale', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const queryApi = Query.create({
			store,
			queryFn,
			retryPolicy: NO_RETRY_POLICY,
			fresh: 0,
			ttl: 1_000,
		});

		queryFn.mockResolvedValueOnce('valid_result');

		await queryApi.execute(['invalid'], { cache: 'stale' });

		{
			const value = await store.get(defaultKeyHashFn(['invalid']));
			assert.deepStrictEqual(value, 'valid_result');
		}

		const result = await queryApi.execute(['invalid'], { cache: 'stale' });
		await result.next();

		{
			const value = await store.get(defaultKeyHashFn(['invalid']));
			assert.deepStrictEqual(value, undefined);
		}

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 1,
			cache_miss: 1,
			cache_delete_on_error: 1,
			last_cache_directive: 'stale',
			events_filtered: 0,
			events_processed: 4,
			handler_executions: 0,
		});
	});

	it('remove the cache with a failed query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY, fresh: 0 });

		await store.set(defaultKeyHashFn(['invalid']), 'valid_result', DEFAULT_TTL_DURATION);

		{
			const value = await store.get(defaultKeyHashFn(['invalid']));
			assert.deepStrictEqual(value, 'valid_result');
		}

		const result = await queryApi.execute(['invalid'], { cache: 'stale' });
		await result.next();

		{
			const value = await store.get(defaultKeyHashFn(['invalid']));
			assert.deepStrictEqual(value, undefined);
		}

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 1,
			cache_miss: 0,
			cache_delete_on_error: 1,
			last_cache_directive: 'stale',
			events_filtered: 0,
			events_processed: 2,
			handler_executions: 0,
		});
	});

	it('not remove the cache with a failed query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const queryApi = Query.create({
			store,
			queryFn,
			retryPolicy: NO_RETRY_POLICY,
			fresh: 0,
			keepCacheOnErrorFn: () => true,
		});

		await store.set(defaultKeyHashFn(['invalid']), 'valid_result', DEFAULT_TTL_DURATION);

		{
			const value = await store.get(defaultKeyHashFn(['invalid']));
			assert.deepStrictEqual(value, 'valid_result');
		}

		const result = await queryApi.execute(['invalid'], { cache: 'stale' });
		await result.next();

		{
			const value = await store.get(defaultKeyHashFn(['invalid']));
			assert.deepStrictEqual(value, 'valid_result');
		}

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 1,
			cache_miss: 0,
			cache_delete_on_error: 0,
			last_cache_directive: 'stale',
			events_filtered: 0,
			events_processed: 2,
			handler_executions: 0,
		});
	});
});

describe('Query cache exception handling', () => {
	it('handle exception when getting a cache entry', async () => {
		const store = makeCache<string>();
		const storeSpy = vi.spyOn(store, 'getEntry');
		const queryFn = vi.fn(testTransformer);
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY });

		await queryApi.execute(['key#1'], { cache: 'stale' });

		{
			const value = await store.get(defaultKeyHashFn(['key#1']));
			assert.deepStrictEqual(value, 'data#1');
		}

		expect(queryFn).toHaveBeenCalledTimes(1);

		storeSpy.mockRejectedValueOnce(new Error('service_unavailable'));

		const result = await queryApi.execute(['key#1'], { cache: 'stale' });

		assert.deepStrictEqual(result.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		{
			const value = await store.get(defaultKeyHashFn(['key#1']));
			assert.deepStrictEqual(value, 'data#1');
		}

		expect(queryFn).toHaveBeenCalledTimes(2);

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 0,
			cache_miss: 2,
			cache_delete_on_error: 0,
			last_cache_directive: 'stale',
			events_filtered: 0,
			events_processed: 4,
			handler_executions: 0,
		});
	});

	it('handle exception when setting a cache entry', async () => {
		const store = makeCache<string>();
		const storeSpy = vi.spyOn(store, 'set');
		const queryFn = vi.fn(testTransformer);
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY });

		storeSpy.mockRejectedValueOnce(new Error('service_unavailable'));

		await queryApi.execute(['key#1'], { cache: 'stale' });

		{
			const value = await store.get(defaultKeyHashFn(['key#1']));
			assert.deepStrictEqual(value, undefined);
		}

		expect(queryFn).toHaveBeenCalledTimes(1);

		const result = await queryApi.execute(['key#1'], { cache: 'stale' });

		assert.deepStrictEqual(result.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		{
			const value = await store.get(defaultKeyHashFn(['key#1']));
			assert.deepStrictEqual(value, 'data#1');
		}

		expect(queryFn).toHaveBeenCalledTimes(2);

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 0,
			cache_miss: 2,
			cache_delete_on_error: 0,
			last_cache_directive: 'stale',
			events_filtered: 0,
			events_processed: 4,
			handler_executions: 0,
		});
	});

	it('handle exception when deleting a cache entry', async () => {
		const store = makeCache<string>();
		const storeSpy = vi.spyOn(store, 'delete');
		const queryFn = vi.fn(testTransformer);
		const queryApi = Query.create({ store, queryFn, retryPolicy: NO_RETRY_POLICY, fresh: 0 });

		storeSpy.mockRejectedValueOnce(new Error('service_unavailable'));
		queryFn.mockResolvedValueOnce('valid_result');

		await queryApi.execute(['invalid_1'], { cache: 'stale' });

		{
			const value = await store.get(defaultKeyHashFn(['invalid_1']));
			assert.deepStrictEqual(value, 'valid_result');
		}

		expect(queryFn).toHaveBeenCalledTimes(1);

		const result = await queryApi.execute(['invalid_1'], { cache: 'fresh' });

		assert.deepStrictEqual(result.state, {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		{
			const value = await store.get(defaultKeyHashFn(['invalid_1']));
			assert.deepStrictEqual(value, 'valid_result');
		}

		expect(queryFn).toHaveBeenCalledTimes(2);

		assert.deepStrictEqual(queryApi.ctx.stat, {
			cache_hit: 0,
			cache_miss: 2,
			cache_delete_on_error: 1,
			last_cache_directive: 'fresh',
			events_filtered: 0,
			events_processed: 4,
			handler_executions: 0,
		});
	});
});
