import { assert, describe, expect, it, vi } from 'vitest';
import { defaultKeyHashFn, QueryControl, waitUntil } from '@/lib';
import { makeCache } from '@/integration/LRUCache.mock';
import { immediateRetryDelay, makeDelayedTestQuery, testQuery } from '@/controller/Control.mock';

describe('QueryControl state transition / no-cache query', () => {
	// success
	it('start the query state as "idle" and change to "success" after successful execution', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const result = await queryApi.execute('key#1', 'no-cache');

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(result.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result.next(), null);

		expect(queryFn).toBeCalledTimes(1);
	});

	// error
	it('start the query state as "idle" and change to "error" after failed execution', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const result = await queryApi.execute('nokey', 'no-cache');

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(result.state, {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(await result.next(), null);

		expect(queryFn).toBeCalledTimes(1);
	});

	// loading
	it('start the query state as "idle" and change to "loading" after start of execution', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const resultPromise = queryApi.execute('key#1', 'no-cache');

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'loading',
		});

		await waitUntil(100);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		const result = await resultPromise;

		assert.deepStrictEqual(result.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result.next(), null);

		expect(queryFn).toBeCalledTimes(1);
	});

	// success to loading to success
	it('start the query state as "success" and change to "loading" and to "success" after successful execution', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const resutl1 = await queryApi.execute('key#1', 'no-cache');

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(resutl1.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await resutl1.next(), null);

		expect(queryFn).toBeCalledTimes(1);

		queryFn.mockImplementationOnce(makeDelayedTestQuery(100));

		const result2Promise = queryApi.execute('key#2', 'no-cache');

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'loading',
		});

		await waitUntil(120);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#2',
			error: null,
			status: 'success',
		});

		const result2 = await result2Promise;

		assert.deepStrictEqual(result2.state, {
			data: 'data#2',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result2.next(), null);
	});

	// success to loading to error
	it('start the query state as "success" and change to "loading" and to "error" after failed execution', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const result1 = await queryApi.execute('key#1', 'no-cache');

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(result1.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result1.next(), null);

		expect(queryFn).toBeCalledTimes(1);

		queryFn.mockImplementationOnce(makeDelayedTestQuery(100));

		const result2Promise = queryApi.execute('invalid', 'no-cache');

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'loading',
		});

		await waitUntil(120);

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		const result2 = await result2Promise;

		assert.deepStrictEqual(result2.state, {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(await result2.next(), null);
	});

	// error to loading to success
	it('start the query state as "error" and change to "loading" and to "success" after successful execution', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const result1 = await queryApi.execute('invalid', 'no-cache');

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(result1.state, {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(await result1.next(), null);

		expect(queryFn).toBeCalledTimes(1);

		queryFn.mockImplementationOnce(makeDelayedTestQuery(100));

		const result2Promise = queryApi.execute('key#2', 'no-cache');

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'loading',
		});

		await waitUntil(120);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#2',
			error: null,
			status: 'success',
		});

		const result2 = await result2Promise;

		assert.deepStrictEqual(result2.state, {
			data: 'data#2',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result2.next(), null);
	});

	// error to loading to error
	it('start the query state as "error" and change to "loading" and to "error" after failed execution', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const result1 = await queryApi.execute('invalid_1', 'no-cache');

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(result1.state, {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(await result1.next(), null);

		expect(queryFn).toBeCalledTimes(1);

		queryFn.mockImplementationOnce(makeDelayedTestQuery(100));

		const result2Promise = queryApi.execute('invalid_2', 'no-cache');

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'loading',
		});

		await waitUntil(120);

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		const result2 = await result2Promise;

		assert.deepStrictEqual(result2.state, {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(await result2.next(), null);

		expect(queryFn).toBeCalledTimes(2);
	});
});

describe('QueryControl state transition / fresh query', () => {
	// success from query
	it('start the query state as "idle" and change to "success" after successful execution', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const result = await queryApi.execute('key#1', 'fresh');

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(result.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result.next(), null);

		expect(queryFn).toBeCalledTimes(1);
	});

	// success from cache
	it('start the query state as "idle" and change to "success" after result from cache', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		await cacheStore.set(defaultKeyHashFn('key#1'), 'data#1', 30_000);

		const result = await queryApi.execute('key#1', 'fresh');

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(result.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result.next(), null);

		expect(queryFn).toBeCalledTimes(0);
	});

	// error
	it('start the query state as "idle" and change to "error" after failed execution', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const result = await queryApi.execute('nokey', 'fresh');

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(result.state, {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(await result.next(), null);

		expect(queryFn).toBeCalledTimes(1);
	});

	// loading
	it('start the query state as "idle" and change to "loading" after start of execution', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		queryFn.mockImplementationOnce(makeDelayedTestQuery(100));

		const resultPromise = queryApi.execute('key#1', 'fresh');

		await waitUntil(50);

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'loading',
		});

		await waitUntil(100);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		const result = await resultPromise;

		assert.deepStrictEqual(result.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result.next(), null);

		expect(queryFn).toBeCalledTimes(1);
	});

	// success to loading to success from query
	it('start the query state as "success" and change to "loading" and to "success" after successful execution', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
			fresh: 50,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const result1 = await queryApi.execute('key#1', 'fresh');

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(result1.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result1.next(), null);

		expect(queryFn).toBeCalledTimes(1);

		queryFn.mockImplementationOnce(makeDelayedTestQuery(100));

		await waitUntil(70);

		const result2Promise = queryApi.execute('key#1', 'fresh');

		await waitUntil(50);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'loading',
		});

		await waitUntil(70);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		const result2 = await result2Promise;

		assert.deepStrictEqual(result2.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result2.next(), null);

		expect(queryFn).toBeCalledTimes(2);
	});

	// success to success from cache
	it('start the query state as "success" and change to "success" after result from cache', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const result1 = await queryApi.execute('key#1', 'fresh');

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(result1.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result1.next(), null);

		expect(queryFn).toBeCalledTimes(1);

		const result2Promise = queryApi.execute('key#1', 'fresh');

		await waitUntil(50);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		const result2 = await result2Promise;

		assert.deepStrictEqual(result2.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result2.next(), null);

		expect(queryFn).toBeCalledTimes(1);
	});

	// success to loading to error
	it('start the query state as "success" and change to "loading" and to "error" after failed execution', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const result1 = await queryApi.execute('key#1', 'fresh');

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(result1.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result1.next(), null);

		expect(queryFn).toBeCalledTimes(1);

		queryFn.mockImplementationOnce(makeDelayedTestQuery(100));

		const result2Promise = queryApi.execute('invalid_key', 'fresh');

		await waitUntil(50);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'loading',
		});

		await waitUntil(70);

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		const result2 = await result2Promise;

		assert.deepStrictEqual(result2.state, {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(await result2.next(), null);

		expect(queryFn).toBeCalledTimes(2);
	});

	// error to loading to success from query
	it('start the query state as "error" and change to "loading" and to "success" after successful execution', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const result1 = await queryApi.execute('invalid', 'fresh');

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(result1.state, {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(await result1.next(), null);

		expect(queryFn).toBeCalledTimes(1);

		queryFn.mockImplementationOnce(makeDelayedTestQuery(100));

		const result2Promise = queryApi.execute('key#2', 'fresh');

		await waitUntil(50);

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'loading',
		});

		await waitUntil(70);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#2',
			error: null,
			status: 'success',
		});

		const result2 = await result2Promise;

		assert.deepStrictEqual(result2.state, {
			data: 'data#2',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result2.next(), null);

		expect(queryFn).toBeCalledTimes(2);
	});

	// error to success from cache
	it('start the query state as "error" and change to "success" after result from cache', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const result1 = await queryApi.execute('invalid', 'fresh');

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(result1.state, {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(await result1.next(), null);

		expect(queryFn).toBeCalledTimes(1);

		queryFn.mockImplementationOnce(makeDelayedTestQuery(100));

		await cacheStore.set(defaultKeyHashFn('key#2'), 'data#2', 30_000);

		const result2Promise = queryApi.execute('key#2', 'fresh');

		await waitUntil(50);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#2',
			error: null,
			status: 'success',
		});

		const result2 = await result2Promise;

		assert.deepStrictEqual(result2.state, {
			data: 'data#2',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result2.next(), null);

		expect(queryFn).toBeCalledTimes(1);
	});

	// error to loading to error
	it('start the query state as "error" and change to "loading" and to "error" after failed execution', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const resutl1 = await queryApi.execute('invalid_1', 'fresh');

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(resutl1.state, {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(await resutl1.next(), null);

		expect(queryFn).toBeCalledTimes(1);

		queryFn.mockImplementationOnce(makeDelayedTestQuery(100));

		const result2Promise = queryApi.execute('invalid_2', 'fresh');

		await waitUntil(50);

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'loading',
		});

		await waitUntil(70);

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		const result2 = await result2Promise;

		assert.deepStrictEqual(result2.state, {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(await result2.next(), null);

		expect(queryFn).toBeCalledTimes(2);
	});
});

describe('QueryControl state transition / stale query', () => {
	// success from query
	it('start the query state as "idle" and change to "success" after successful execution', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const result = await queryApi.execute('key#1', 'stale');

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(result.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result.next(), null);

		expect(queryFn).toBeCalledTimes(1);
	});

	// success from cache
	it('start the query state as "idle" and change to "success" after result from cache', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		cacheStore.set(defaultKeyHashFn('key#1'), 'data#1', 30_000);

		const result = await queryApi.execute('key#1', 'stale');

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(result.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result.next(), null);

		expect(queryFn).toBeCalledTimes(0);
	});

	// stale to success from background query
	it('start the query state as "idle" and change to "stale" and to "success" after background query', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
			fresh: 50,
			ttl: 200,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		await cacheStore.set(defaultKeyHashFn('key#1'), 'stale_data#1', 200);

		queryFn.mockImplementationOnce(makeDelayedTestQuery(50));

		await waitUntil(60);

		const resultPromise = queryApi.execute('key#1', 'stale');

		await waitUntil(10);

		expect(queryFn).toBeCalledTimes(1);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'stale_data#1',
			error: null,
			status: 'stale',
		});

		const result = await resultPromise;

		assert.deepStrictEqual(result.state, {
			data: 'stale_data#1',
			error: null,
			status: 'stale',
		});

		await waitUntil(70);

		expect(queryFn).toBeCalledTimes(1);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result.next(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});
	});

	// stale to error from background query
	it('start the query state as "idle" and change to "stale" and to "error" after background query', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
			fresh: 50,
			ttl: 200,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		await cacheStore.set(defaultKeyHashFn('invalid_1'), 'stale_data#1', 200);

		queryFn.mockImplementationOnce(makeDelayedTestQuery(50));

		await waitUntil(60);

		const resultPromise = queryApi.execute('invalid_1', 'stale');

		await waitUntil(10);

		expect(queryFn).toBeCalledTimes(1);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'stale_data#1',
			error: null,
			status: 'stale',
		});

		const result = await resultPromise;

		assert.deepStrictEqual(result.state, {
			data: 'stale_data#1',
			error: null,
			status: 'stale',
		});

		await waitUntil(70);

		expect(queryFn).toBeCalledTimes(1);

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(await result.next(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});
	});

	// error
	it('start the query state as "idle" and change to "error" after failed execution', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const result = await queryApi.execute('nokey', 'stale');

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(result.state, {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(await result.next(), null);

		expect(queryFn).toBeCalledTimes(1);
	});

	// loading
	it('start the query state as "idle" and change to "loading" after start of execution', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		queryFn.mockImplementationOnce(makeDelayedTestQuery(100));

		const resultPromise = queryApi.execute('key#1', 'stale');

		await waitUntil(50);

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'loading',
		});

		await waitUntil(100);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		const result = await resultPromise;

		assert.deepStrictEqual(result.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result.next(), null);

		expect(queryFn).toBeCalledTimes(1);
	});

	// success to loading to success from query
	it('start the query state as "success" and change to "loading" and to "success" after successful execution', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const result1 = await queryApi.execute('key#1', 'stale');

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(result1.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result1.next(), null);

		expect(queryFn).toBeCalledTimes(1);

		queryFn.mockImplementationOnce(makeDelayedTestQuery(100));

		await cacheStore.delete(defaultKeyHashFn('key#1'));

		const result2Promise = queryApi.execute('key#1', 'stale');

		await waitUntil(50);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'loading',
		});

		await waitUntil(70);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		const result2 = await result2Promise;

		assert.deepStrictEqual(result2.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result2.next(), null);

		expect(queryFn).toBeCalledTimes(2);
	});

	// success to success from cache
	it('start the query state as "success" and change to "success" after result from cache', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const result1 = await queryApi.execute('key#1', 'stale');

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(result1.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result1.next(), null);

		expect(queryFn).toBeCalledTimes(1);

		const result2Promise = queryApi.execute('key#1', 'stale');

		await waitUntil(50);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		const result2 = await result2Promise;

		assert.deepStrictEqual(result2.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result2.next(), null);

		expect(queryFn).toBeCalledTimes(1);
	});

	// success to stale to success from background query
	it('start the query state as "idle" and change to "stale" and to "success" after background query', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
			fresh: 50,
			ttl: 200,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const result1 = await queryApi.execute('key#1', 'stale');

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(result1.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result1.next(), null);

		expect(queryFn).toBeCalledTimes(1);

		await cacheStore.set(defaultKeyHashFn('key#1'), 'stale_data#1', 200);

		queryFn.mockImplementationOnce(makeDelayedTestQuery(50));

		await waitUntil(60);

		const result2Promise = queryApi.execute('key#1', 'stale');

		await waitUntil(10);

		expect(queryFn).toBeCalledTimes(2);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'stale_data#1',
			error: null,
			status: 'stale',
		});

		const result2 = await result2Promise;

		assert.deepStrictEqual(result2.state, {
			data: 'stale_data#1',
			error: null,
			status: 'stale',
		});

		await waitUntil(70);

		expect(queryFn).toBeCalledTimes(2);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result2.next(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});
	});

	// success to stale to error from background query
	it('start the query state as "idle" and change to "stale" and to "error" after background query', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
			fresh: 50,
			ttl: 200,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const result1 = await queryApi.execute('key#1', 'stale');

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(result1.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result1.next(), null);

		expect(queryFn).toBeCalledTimes(1);

		await cacheStore.set(defaultKeyHashFn('invalid_1'), 'stale_data#1', 200);

		queryFn.mockImplementationOnce(makeDelayedTestQuery(50));

		await waitUntil(60);

		const result2Promise = queryApi.execute('invalid_1', 'stale');

		await waitUntil(10);

		expect(queryFn).toBeCalledTimes(2);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'stale_data#1',
			error: null,
			status: 'stale',
		});

		const result2 = await result2Promise;

		assert.deepStrictEqual(result2.state, {
			data: 'stale_data#1',
			error: null,
			status: 'stale',
		});

		await waitUntil(70);

		expect(queryFn).toBeCalledTimes(2);

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(await result2.next(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});
	});

	// success to loading to error
	it('start the query state as "success" and change to "loading" and to "error" after failed execution', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const result1 = await queryApi.execute('key#1', 'stale');

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(result1.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result1.next(), null);

		expect(queryFn).toBeCalledTimes(1);

		queryFn.mockImplementationOnce(makeDelayedTestQuery(100));

		await cacheStore.delete(defaultKeyHashFn('key#1'));

		const result2Promise = queryApi.execute('invalid_key', 'stale');

		await waitUntil(50);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'loading',
		});

		await waitUntil(70);

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		const result2 = await result2Promise;

		assert.deepStrictEqual(result2.state, {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(await result2.next(), null);

		expect(queryFn).toBeCalledTimes(2);
	});

	// error to loading to success from query
	it('start the query state as "error" and change to "loading" and to "success" after successful execution', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const result1 = await queryApi.execute('invalid_1', 'stale');

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(result1.state, {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(await result1.next(), null);

		expect(queryFn).toBeCalledTimes(1);

		queryFn.mockImplementationOnce(makeDelayedTestQuery(100));

		const result2Promise = queryApi.execute('key#1', 'stale');

		await waitUntil(50);

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'loading',
		});

		await waitUntil(70);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		const result2 = await result2Promise;

		assert.deepStrictEqual(result2.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result2.next(), null);

		expect(queryFn).toBeCalledTimes(2);
	});

	// error to success from cache
	it('start the query state as "error" and change to "loading" and to "success" after result from cache', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const result1 = await queryApi.execute('invalid_1', 'stale');

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(result1.state, {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(await result1.next(), null);

		expect(queryFn).toBeCalledTimes(1);

		queryFn.mockImplementationOnce(makeDelayedTestQuery(100));

		await cacheStore.set(defaultKeyHashFn('key#1'), 'data#1', 10_000);

		const result2Promise = queryApi.execute('key#1', 'stale');

		await waitUntil(70);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		const result2 = await result2Promise;

		assert.deepStrictEqual(result2.state, {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result2.next(), null);

		expect(queryFn).toBeCalledTimes(1);
	});

	// error to stale to success from background query
	it('start the query state as "error" and change to "stale" and to "success" after background query', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
			fresh: 50,
			ttl: 200,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		queryFn.mockRejectedValueOnce(new Error('invalid_key'));

		const result1 = await queryApi.execute('key#1', 'stale');

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(result1.state, {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(await result1.next(), null);

		expect(queryFn).toBeCalledTimes(1);

		await cacheStore.set(defaultKeyHashFn('key#1'), 'stale_data#1', 200);

		queryFn.mockImplementationOnce(makeDelayedTestQuery(50));

		await waitUntil(60);

		const result2Promise = queryApi.execute('key#1', 'stale');

		await waitUntil(10);

		expect(queryFn).toBeCalledTimes(2);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'stale_data#1',
			error: null,
			status: 'stale',
		});

		const result2 = await result2Promise;

		assert.deepStrictEqual(result2.state, {
			data: 'stale_data#1',
			error: null,
			status: 'stale',
		});

		await waitUntil(70);

		expect(queryFn).toBeCalledTimes(2);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(await result2.next(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});
	});

	// error to stale to error from background query
	it('start the query state as "error" and change to "stale" and to "error" after background query', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
			fresh: 50,
			ttl: 200,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const result1 = await queryApi.execute('invalid_1', 'stale');

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(result1.state, {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(await result1.next(), null);

		expect(queryFn).toBeCalledTimes(1);

		await cacheStore.set(defaultKeyHashFn('invalid_1'), 'stale_data#1', 200);

		queryFn.mockImplementationOnce(makeDelayedTestQuery(50));

		await waitUntil(60);

		const result2Promise = queryApi.execute('invalid_1', 'stale');

		await waitUntil(10);

		expect(queryFn).toBeCalledTimes(2);

		assert.deepStrictEqual(queryApi.getState(), {
			data: 'stale_data#1',
			error: null,
			status: 'stale',
		});

		const result2 = await result2Promise;

		assert.deepStrictEqual(result2.state, {
			data: 'stale_data#1',
			error: null,
			status: 'stale',
		});

		await waitUntil(70);

		expect(queryFn).toBeCalledTimes(2);

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(await result2.next(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});
	});

	// error to loading to error
	it('start the query state as "success" and change to "loading" and to "error" after failed execution', async () => {
		const cacheStore = makeCache<string>();
		const queryFn = vi.fn(testQuery);
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore,
			queryFn,
			retry: 0,
			retryDelay: immediateRetryDelay,
		});

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const result1 = await queryApi.execute('invalid_1', 'stale');

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(result1.state, {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(await result1.next(), null);

		expect(queryFn).toBeCalledTimes(1);

		queryFn.mockImplementationOnce(makeDelayedTestQuery(100));

		const result2Promise = queryApi.execute('invalid_1', 'stale');

		await waitUntil(50);

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: null,
			status: 'loading',
		});

		await waitUntil(70);

		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		const result2 = await result2Promise;

		assert.deepStrictEqual(result2.state, {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		assert.deepStrictEqual(await result2.next(), null);

		expect(queryFn).toBeCalledTimes(2);
	});
});
