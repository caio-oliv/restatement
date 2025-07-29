import { assert, describe, expect, it, vi } from 'vitest';
import {
	BasicRetryPolicy,
	DEFAULT_TTL_DURATION,
	defaultFilterFn,
	FixedBackoffTimer,
	NoRetryPolicy,
	Query,
	updateQueryContextFn,
	waitUntil,
	type QueryState,
	type StateMetadata,
	type QueryContextMutFns,
} from '@/lib';
import { makeCache } from '@/integration/LRUCache.mock';
import { mockQueryHandler, testTransformer } from '@/controller/Control.mock';

describe('QueryControl function swap', () => {
	it('swap all context functions', () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const queryCtl = Query.create<[string], string, Error>({ store, queryFn });

		const functions: QueryContextMutFns<[string], string, Error> = {
			queryFn: vi.fn(),
			retryHandleFn: vi.fn(),
			keepCacheOnErrorFn: vi.fn(),
			extractTTLFn: vi.fn(),
			stateFn: vi.fn(),
			dataFn: vi.fn(),
			errorFn: vi.fn(),
			filterFn: vi.fn(),
		};

		updateQueryContextFn(queryCtl.ctx, functions);

		assert.strictEqual(queryCtl.ctx.queryFn, functions.queryFn);
		assert.strictEqual(queryCtl.ctx.retryHandleFn, functions.retryHandleFn);
		assert.strictEqual(queryCtl.ctx.keepCacheOnErrorFn, functions.keepCacheOnErrorFn);
		assert.strictEqual(queryCtl.ctx.extractTTLFn, functions.extractTTLFn);
		assert.strictEqual(queryCtl.ctx.stateFn, functions.stateFn);
		assert.strictEqual(queryCtl.ctx.dataFn, functions.dataFn);
		assert.strictEqual(queryCtl.ctx.errorFn, functions.errorFn);
		assert.strictEqual(queryCtl.ctx.filterFn, functions.filterFn);
	});
});

describe('QueryControl function swap / queryFn', () => {
	it('use same queryFn on retries while swaped mid-air', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const secondQueryFn = vi.fn(testTransformer);
		const retryPolicy = new BasicRetryPolicy(3, new FixedBackoffTimer(50));
		const queryCtl = Query.create<[string], string, Error>({ store, queryFn, retryPolicy });

		const queryPromise = queryCtl.execute(['error'], { cache: 'no-cache' });

		queryCtl.ctx.queryFn = secondQueryFn;

		const result = await queryPromise;

		assert.deepStrictEqual(result.state, {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});
		assert.deepStrictEqual(queryCtl.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		expect(queryFn).toHaveBeenCalledTimes(4);
		expect(secondQueryFn).toHaveBeenCalledTimes(0);
	});

	it('use new queryFn after the previous query execution is finished', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const secondQueryFn = vi.fn(testTransformer);
		const retryPolicy = new BasicRetryPolicy(2, new FixedBackoffTimer(50));
		const queryCtl = Query.create<[string], string, Error>({ store, queryFn, retryPolicy });

		const queryPromise = queryCtl.execute(['error'], { cache: 'no-cache' });

		queryCtl.ctx.queryFn = secondQueryFn;

		const result = await queryPromise;

		assert.deepStrictEqual(result.state, {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});
		assert.deepStrictEqual(queryCtl.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		expect(queryFn).toHaveBeenCalledTimes(3);
		expect(secondQueryFn).toHaveBeenCalledTimes(0);

		const secondQueryResult = await queryCtl.execute(['key#101'], { cache: 'no-cache' });

		assert.deepStrictEqual(secondQueryResult.state, {
			data: 'data#101',
			error: null,
			status: 'success',
		});
		assert.deepStrictEqual(queryCtl.getState(), {
			data: 'data#101',
			error: null,
			status: 'success',
		});

		expect(queryFn).toHaveBeenCalledTimes(3);
		expect(secondQueryFn).toHaveBeenCalledTimes(1);

		await queryCtl.execute(['key#101'], { cache: 'no-cache' });

		expect(queryFn).toHaveBeenCalledTimes(3);
		expect(secondQueryFn).toHaveBeenCalledTimes(2);
	});

	it('use new queryFn on background query on stale query execution', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const secondQueryFn = vi.fn(testTransformer);
		const retryPolicy = new BasicRetryPolicy(2, new FixedBackoffTimer(50));
		const queryCtl = Query.create<[string], string, Error>({
			store,
			queryFn,
			retryPolicy,
			fresh: 50,
			ttl: 100,
		});

		await store.set(queryCtl.ctx.keyHashFn(['key#updated_result']), 'stale_data', 100);
		await waitUntil(70);

		secondQueryFn.mockImplementationOnce(async (...params) => {
			await waitUntil(10);
			return await testTransformer(...params);
		});

		const queryPromise = queryCtl.execute(['key#updated_result'], { cache: 'stale' });
		queryCtl.ctx.queryFn = secondQueryFn;

		expect(queryFn).toHaveBeenCalledTimes(0);
		expect(secondQueryFn).toHaveBeenCalledTimes(0);

		const queryResult = await queryPromise;

		assert.deepStrictEqual(queryResult.state, {
			data: 'stale_data',
			error: null,
			status: 'stale',
		});
		assert.deepStrictEqual(queryCtl.getState(), {
			data: 'stale_data',
			error: null,
			status: 'stale',
		});

		expect(queryFn).toHaveBeenCalledTimes(0);
		expect(secondQueryFn).toHaveBeenCalledTimes(1);

		const backgroundState = await queryResult.next();

		assert.deepStrictEqual(backgroundState, {
			data: 'data#updated_result',
			error: null,
			status: 'success',
		});
		assert.deepStrictEqual(queryCtl.getState(), {
			data: 'data#updated_result',
			error: null,
			status: 'success',
		});

		expect(queryFn).toHaveBeenCalledTimes(0);
		expect(secondQueryFn).toHaveBeenCalledTimes(1);
	});

	it('use any of both new and previous queryFn execution with different keys', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const secondQueryFn = vi.fn(testTransformer);
		const retryPolicy = new BasicRetryPolicy(3, new FixedBackoffTimer(50));
		const queryCtl = Query.create<[string], string, Error>({ store, queryFn, retryPolicy });

		queryFn.mockRejectedValueOnce(new Error('manual_error_main_1'));
		queryFn.mockRejectedValueOnce(new Error('manual_error_main_2'));
		queryFn.mockRejectedValueOnce(new Error('manual_error_main_3'));

		secondQueryFn.mockRejectedValueOnce(new Error('manual_error_second_1'));
		secondQueryFn.mockRejectedValueOnce(new Error('manual_error_second_2'));

		const mainQueryPromise = queryCtl.execute(['key#main_value'], { cache: 'no-cache' });

		queryCtl.ctx.queryFn = secondQueryFn;
		const secondQueryPromise = queryCtl.execute(['key#second_value'], { cache: 'no-cache' });

		const [mainResult, secondResult] = await Promise.all([mainQueryPromise, secondQueryPromise]);

		assert.deepStrictEqual(mainResult.state, {
			data: 'data#main_value',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(secondResult.state, {
			data: 'data#second_value',
			error: null,
			status: 'success',
		});

		// The last used key was "key#second_value" and since, the final state will be from the second query execution.
		assert.deepStrictEqual(queryCtl.getState(), {
			data: 'data#second_value',
			error: null,
			status: 'success',
		});

		expect(queryFn).toHaveBeenCalledTimes(4);
		expect(secondQueryFn).toHaveBeenCalledTimes(3);
	});

	it('use any of both new and previous queryFn execution in a race condition', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const secondQueryFn = vi.fn(testTransformer);
		const retryPolicy = new BasicRetryPolicy(3, new FixedBackoffTimer(50));
		const queryCtl = Query.create<[string], string, Error>({ store, queryFn, retryPolicy });

		queryFn.mockRejectedValueOnce(new Error('manual_error_main_1'));
		queryFn.mockRejectedValueOnce(new Error('manual_error_main_2'));
		queryFn.mockRejectedValueOnce(new Error('manual_error_main_3'));
		queryFn.mockResolvedValueOnce('main');

		secondQueryFn.mockRejectedValueOnce(new Error('manual_error_second_1'));
		secondQueryFn.mockRejectedValueOnce(new Error('manual_error_second_2'));
		secondQueryFn.mockRejectedValueOnce(new Error('manual_error_second_3'));
		secondQueryFn.mockResolvedValueOnce('second');

		const mainQueryPromise = queryCtl.execute(['key#race'], { cache: 'no-cache' });

		queryCtl.ctx.queryFn = secondQueryFn;
		const secondQueryPromise = queryCtl.execute(['key#race'], { cache: 'no-cache' });

		const [mainResult, secondResult] = await Promise.all([mainQueryPromise, secondQueryPromise]);

		assert.deepStrictEqual(mainResult.state, {
			data: 'main',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(secondResult.state, {
			data: 'second',
			error: null,
			status: 'success',
		});

		// There is a race condition between main and second query, so the resulting state is undefined
		assert.includeMembers(['main', 'second'], [queryCtl.getState().data]);

		expect(queryFn).toHaveBeenCalledTimes(4);
		expect(secondQueryFn).toHaveBeenCalledTimes(4);
	});
});

describe('QueryControl function swap / filterFn', () => {
	it('swap filterFn mid-air / loading query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryCtl = Query.create<[string], string, Error>({
			store,
			queryFn,
			retryPolicy,
			...handler,
		});

		{
			queryCtl.ctx.filterFn = ({ next }) => next.status !== 'loading';

			const result = await queryCtl.execute(['key#true'], { cache: 'no-cache' });

			assert.deepStrictEqual(result.state, { status: 'success', data: 'data#true', error: null });

			expect(handler.stateFn).toHaveBeenCalledTimes(1);
			expect(handler.dataFn).toHaveBeenCalledTimes(1);
			expect(handler.errorFn).toHaveBeenCalledTimes(0);

			expect(queryFn).toHaveBeenCalledTimes(1);
		}

		queryCtl.reset();

		{
			queryCtl.ctx.filterFn = defaultFilterFn;

			const result = await queryCtl.execute(['key#false'], { cache: 'no-cache' });

			assert.deepStrictEqual(result.state, { status: 'success', data: 'data#false', error: null });

			expect(handler.stateFn).toHaveBeenCalledTimes(3);
			expect(handler.dataFn).toHaveBeenCalledTimes(2);
			expect(handler.errorFn).toHaveBeenCalledTimes(0);

			expect(queryFn).toHaveBeenCalledTimes(2);
		}
	});

	it('swap filterFn mid-air / error state', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryCtl = Query.create<[string], string, Error>({
			store,
			queryFn,
			retryPolicy,
			...handler,
		});

		queryFn.mockRejectedValueOnce(new Error('manual_error_1'));
		queryFn.mockRejectedValueOnce(new Error('manual_error_2'));

		{
			const result = await queryCtl.execute(['key#true'], { cache: 'no-cache' });

			expect(handler.stateFn).toHaveBeenNthCalledWith(
				2,
				{
					status: 'error',
					data: null,
					error: new Error('manual_error_1'),
				} satisfies QueryState<string, Error>,
				{
					cache: 'no-cache',
					origin: 'self',
					source: 'query',
				} satisfies StateMetadata,
				queryCtl.cache
			);

			assert.deepStrictEqual(result.state, {
				status: 'error',
				data: null,
				error: new Error('manual_error_1'),
			});
		}
		{
			queryCtl.ctx.filterFn = ({ next }) => next.status !== 'error';

			const result = await queryCtl.execute(['key#true'], { cache: 'no-cache' });

			// error state supressed.
			expect(handler.stateFn).toHaveBeenNthCalledWith(
				3,
				{
					status: 'loading',
					data: null,
					error: null,
				} satisfies QueryState<string, Error>,
				{
					cache: 'no-cache',
					origin: 'self',
					source: 'query',
				} satisfies StateMetadata,
				queryCtl.cache
			);

			assert.deepStrictEqual(result.state, {
				status: 'error',
				data: null,
				error: new Error('manual_error_2'),
			});
		}
	});

	it('swap filterFn mid-air / background query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryCtl = Query.create<[string], string, Error>({
			store,
			queryFn,
			retryPolicy,
			fresh: 50,
			ttl: 100,
			...handler,
		});

		await store.set(queryCtl.ctx.keyHashFn(['key#true']), 'stale_data', DEFAULT_TTL_DURATION);
		await waitUntil(70);

		const queryPromise = queryCtl.execute(['key#true'], { cache: 'stale' });

		queryCtl.ctx.filterFn = ({ metadata }) => metadata.source !== 'background-query';

		const queryResult = await queryPromise;

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				status: 'stale',
				data: 'stale_data',
				error: null,
			} satisfies QueryState<string, Error>,
			{
				cache: 'stale',
				origin: 'self',
				source: 'cache',
			} satisfies StateMetadata,
			queryCtl.cache
		);

		assert.deepStrictEqual(queryResult.state, {
			status: 'stale',
			data: 'stale_data',
			error: null,
		});

		const backgroundResult = await queryResult.next();

		expect(handler.stateFn).toHaveBeenNthCalledWith(
			1,
			{
				status: 'stale',
				data: 'stale_data',
				error: null,
			} satisfies QueryState<string, Error>,
			{
				cache: 'stale',
				origin: 'self',
				source: 'cache',
			} satisfies StateMetadata,
			queryCtl.cache
		);

		assert.deepStrictEqual(backgroundResult, {
			status: 'success',
			data: 'data#true',
			error: null,
		});
	});
});

describe('QueryControl function swap / keepCacheOnErrorFn', () => {
	it('swap keepCacheOnErrorFn before the error and after the query', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryCtl = Query.create<[string], string, Error>({
			store,
			queryFn,
			retryPolicy,
			fresh: 50,
			ttl: 100,
			...handler,
		});

		await store.set(queryCtl.ctx.keyHashFn(['key#0101']), 'cached_value', DEFAULT_TTL_DURATION);
		await waitUntil(110);

		{
			queryFn.mockRejectedValueOnce(new Error('manual_error_1'));

			const queryPromise = queryCtl.execute(['key#0101'], { cache: 'no-cache' });

			queryCtl.ctx.keepCacheOnErrorFn = () => true;

			const queryResult = await queryPromise;

			assert.deepStrictEqual(queryResult.state, {
				status: 'error',
				data: null,
				error: new Error('manual_error_1'),
			});

			assert.deepStrictEqual(await store.get(queryCtl.ctx.keyHashFn(['key#0101'])), 'cached_value');
		}
		{
			queryFn.mockRejectedValueOnce(new Error('manual_error_2'));

			const queryPromise = queryCtl.execute(['key#0101'], { cache: 'no-cache' });

			queryCtl.ctx.keepCacheOnErrorFn = () => false;

			const queryResult = await queryPromise;

			assert.deepStrictEqual(queryResult.state, {
				status: 'error',
				data: null,
				error: new Error('manual_error_2'),
			});

			assert.deepStrictEqual(await store.get(queryCtl.ctx.keyHashFn(['key#0101'])), undefined);
		}
	});

	it('swap keepCacheOnErrorFn after the error', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new NoRetryPolicy();
		const queryCtl = Query.create<[string], string, Error>({
			store,
			queryFn,
			retryPolicy,
			fresh: 50,
			ttl: 100,
			...handler,
		});

		{
			await store.set(queryCtl.ctx.keyHashFn(['key#0101']), 'cached_value', DEFAULT_TTL_DURATION);
			await waitUntil(110);

			queryFn.mockRejectedValueOnce(new Error('manual_error_1'));

			const queryResult = await queryCtl.execute(['key#0101'], { cache: 'no-cache' });

			queryCtl.ctx.keepCacheOnErrorFn = () => true;

			assert.deepStrictEqual(queryResult.state, {
				status: 'error',
				data: null,
				error: new Error('manual_error_1'),
			});

			assert.deepStrictEqual(await store.get(queryCtl.ctx.keyHashFn(['key#0101'])), undefined);
		}
		{
			await store.set(queryCtl.ctx.keyHashFn(['key#0101']), 'cached_value', DEFAULT_TTL_DURATION);
			await waitUntil(110);

			queryFn.mockRejectedValueOnce(new Error('manual_error_2'));

			const queryResult = await queryCtl.execute(['key#0101'], { cache: 'no-cache' });

			assert.deepStrictEqual(queryResult.state, {
				status: 'error',
				data: null,
				error: new Error('manual_error_2'),
			});

			assert.deepStrictEqual(await store.get(queryCtl.ctx.keyHashFn(['key#0101'])), 'cached_value');
		}
	});
});

describe('QueryControl function swap / retryHandleFn', () => {
	it('swap retryHandleFn after retrying the query operation', async () => {
		const store = makeCache<string>();
		const queryFn = vi.fn(testTransformer);
		const handler = mockQueryHandler<string>();
		const retryPolicy = new BasicRetryPolicy(3, new FixedBackoffTimer(50));
		const retryHandleFn = vi.fn();
		const queryCtl = Query.create<[string], string, Error>({
			store,
			queryFn,
			...handler,
			fresh: 50,
			ttl: 100,
			retryPolicy,
			retryHandleFn,
		});

		const secondRetryHandleFn = vi.fn();

		{
			queryFn.mockRejectedValueOnce(new Error('manual_error_1'));
			queryFn.mockRejectedValueOnce(new Error('manual_error_2'));
			queryFn.mockRejectedValueOnce(new Error('manual_error_3'));

			const queryPromise = queryCtl.execute(['key#ok?'], { cache: 'no-cache' });

			await waitUntil(100);

			expect(retryHandleFn).toBeCalledTimes(1);
			expect(secondRetryHandleFn).toBeCalledTimes(0);

			queryCtl.ctx.retryHandleFn = secondRetryHandleFn;

			await waitUntil(50);

			expect(retryHandleFn).toBeCalledTimes(2);
			expect(secondRetryHandleFn).toBeCalledTimes(0);

			const queryResult = await queryPromise;

			expect(retryHandleFn).toBeCalledTimes(3);
			expect(secondRetryHandleFn).toBeCalledTimes(0);

			assert.deepStrictEqual(queryResult.state, {
				data: 'data#ok?',
				error: null,
				status: 'success',
			});
		}
		retryHandleFn.mockRestore();
		{
			queryFn.mockRejectedValueOnce(new Error('manual_error_1'));
			queryFn.mockRejectedValueOnce(new Error('manual_error_2'));

			const queryPromise = queryCtl.execute(['key#yes'], { cache: 'no-cache' });

			await waitUntil(100);

			expect(retryHandleFn).toBeCalledTimes(0);
			expect(secondRetryHandleFn).toBeCalledTimes(1);

			await waitUntil(50);

			expect(retryHandleFn).toBeCalledTimes(0);
			expect(secondRetryHandleFn).toBeCalledTimes(2);

			const queryResult = await queryPromise;

			expect(retryHandleFn).toBeCalledTimes(0);
			expect(secondRetryHandleFn).toBeCalledTimes(2);

			assert.deepStrictEqual(queryResult.state, {
				data: 'data#yes',
				error: null,
				status: 'success',
			});
		}
	});
});
