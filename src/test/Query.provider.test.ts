import { describe, it, vi, expect, assert } from 'vitest';
import {
	type QueryState,
	type QueryStateMetadata,
	type QueryStateTransition,
	type QueryProvider,
	Query,
	PubSub,
	defaultKeyHashFn,
	waitUntil,
} from '@/lib';
import { makeCache } from '@/integration/LRUCache.mock';
import { delayedTestTransformer, mockQueryHandler, testTransformer } from '@/test/TestHelper.mock';

function filterControlState({ metadata }: QueryStateTransition<string, Error>): boolean {
	return metadata.origin === 'self';
}

describe('Query state provider / query watcher', () => {
	it('subscribe to query changes', async () => {
		const store = makeCache<string>();
		const provider: QueryProvider<string, Error> = new PubSub();

		const queryFn1 = vi.fn(testTransformer);
		const handler1 = mockQueryHandler();
		const queryApi1 = Query.create<[string], string, Error>({
			store,
			provider,
			queryFn: queryFn1,
			...handler1,
		});

		const queryFn2 = vi.fn(testTransformer);
		const handler2 = mockQueryHandler();
		const queryApi2 = Query.create<[string], string, Error>({
			store,
			provider,
			queryFn: queryFn2,
			...handler2,
		});

		queryApi2.use(['key#1']);

		await queryApi1.execute(['key#1'], { cache: 'no-cache' });

		{
			expect(handler1.dataFn).toHaveBeenCalledTimes(1);
			expect(handler1.errorFn).toHaveBeenCalledTimes(0);
			expect(handler1.stateFn).toHaveBeenCalledTimes(2);

			expect(handler1.dataFn).toHaveBeenNthCalledWith(
				1,
				'data#1',
				{
					cache: 'no-cache',
					origin: 'self',
					source: 'query',
				} satisfies QueryStateMetadata,
				queryApi1.cache
			);

			expect(handler1.stateFn).toHaveBeenNthCalledWith(
				1,
				{
					data: null,
					error: null,
					status: 'loading',
				} satisfies QueryState<string, Error>,
				{
					cache: 'no-cache',
					origin: 'self',
					source: 'query',
				} satisfies QueryStateMetadata,
				queryApi1.cache
			);
			expect(handler1.stateFn).toHaveBeenNthCalledWith(
				2,
				{
					data: 'data#1',
					error: null,
					status: 'success',
				} satisfies QueryState<string, Error>,
				{
					cache: 'no-cache',
					origin: 'self',
					source: 'query',
				} satisfies QueryStateMetadata,
				queryApi1.cache
			);

			expect(queryFn1).toHaveBeenCalledTimes(1);
		}

		{
			expect(handler2.dataFn).toHaveBeenCalledTimes(1);
			expect(handler2.errorFn).toHaveBeenCalledTimes(0);
			expect(handler2.stateFn).toHaveBeenCalledTimes(2);

			expect(handler2.dataFn).toHaveBeenNthCalledWith(
				1,
				'data#1',
				{
					cache: 'no-cache',
					origin: 'provider',
					source: 'query',
				} satisfies QueryStateMetadata,
				queryApi2.cache
			);

			expect(handler2.stateFn).toHaveBeenNthCalledWith(
				1,
				{
					data: null,
					error: null,
					status: 'loading',
				} satisfies QueryState<string, Error>,
				{
					cache: 'no-cache',
					origin: 'provider',
					source: 'query',
				} satisfies QueryStateMetadata,
				queryApi2.cache
			);
			expect(handler2.stateFn).toHaveBeenNthCalledWith(
				2,
				{
					data: 'data#1',
					error: null,
					status: 'success',
				} satisfies QueryState<string, Error>,
				{
					cache: 'no-cache',
					origin: 'provider',
					source: 'query',
				} satisfies QueryStateMetadata,
				queryApi2.cache
			);

			expect(queryFn2).toHaveBeenCalledTimes(0);
		}
	});

	it('unsubscribe to query changes when disposed', async () => {
		const store = makeCache<string>();
		const provider: QueryProvider<string, Error> = new PubSub();

		const topic = defaultKeyHashFn(['key#1']);
		{
			const queryFn = vi.fn(testTransformer);
			const handler = mockQueryHandler();
			using queryApi = Query.create<[string], string, Error>({
				store,
				provider,
				queryFn,
				...handler,
			});

			queryApi.use(['key#1']);

			assert.deepStrictEqual(Array.from(provider.topics()), [topic]);

			await queryApi.execute(['key#1'], { cache: 'no-cache' });
		}

		assert.deepStrictEqual(Array.from(provider.topics()), []);
	});

	it('unsubscribe to query changes when reset', async () => {
		const store = makeCache<string>();
		const provider: QueryProvider<string, Error> = new PubSub();

		const queryFn1 = vi.fn(testTransformer);
		const handler1 = mockQueryHandler();
		const queryApi1 = Query.create<[string], string, Error>({
			store,
			provider,
			queryFn: queryFn1,
			...handler1,
		});

		const queryFn2 = vi.fn(testTransformer);
		const handler2 = mockQueryHandler();
		const queryApi2 = Query.create<[string], string, Error>({
			store,
			provider,
			queryFn: queryFn2,
			...handler2,
		});

		queryApi2.use(['key#1']);

		await queryApi1.execute(['key#1'], { cache: 'no-cache' });

		assert.deepStrictEqual(queryApi2.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		queryApi2.reset();

		assert.deepStrictEqual(queryApi2.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		await queryApi1.execute(['key#1'], { cache: 'no-cache' });

		assert.deepStrictEqual(queryApi1.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(queryApi2.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});
	});

	it('unsubscribe to query changes when other key is used', async () => {
		const store = makeCache<string>();
		const provider: QueryProvider<string, Error> = new PubSub();

		const queryFn1 = vi.fn(testTransformer);
		const handler1 = mockQueryHandler();
		const queryApi1 = Query.create<[string], string, Error>({
			store,
			provider,
			queryFn: queryFn1,
			...handler1,
		});

		const queryFn2 = vi.fn(testTransformer);
		const handler2 = mockQueryHandler();
		const queryApi2 = Query.create<[string], string, Error>({
			placeholder: 'placeholder',
			store,
			provider,
			queryFn: queryFn2,
			...handler2,
		});

		queryApi2.use(['key#1']);

		await queryApi1.execute(['key#1'], { cache: 'no-cache' });

		assert.deepStrictEqual(queryApi2.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		queryApi2.use(['key#2']);

		assert.deepStrictEqual(queryApi2.getState(), {
			data: 'placeholder',
			error: null,
			status: 'idle',
		});

		await queryApi1.execute(['key#1'], { cache: 'no-cache' });

		assert.deepStrictEqual(queryApi1.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(queryApi2.getState(), {
			data: 'placeholder',
			error: null,
			status: 'idle',
		});
	});
});

describe('Query state provider', () => {
	it('share query function execution', async () => {
		const store = makeCache<string>();
		const provider: QueryProvider<string, Error> = new PubSub();

		const queryFn1 = vi.fn(testTransformer);
		const handler1 = mockQueryHandler();
		const queryApi1 = Query.create<[string], string, Error>({
			store,
			provider,
			queryFn: queryFn1,
			...handler1,
			fresh: 50,
			ttl: 100,
		});

		const queryFn2 = vi.fn(testTransformer);
		const handler2 = mockQueryHandler();
		const queryApi2 = Query.create<[string], string, Error>({
			store,
			provider,
			queryFn: queryFn2,
			...handler2,
			fresh: 50,
			ttl: 100,
		});

		const resultPromise1 = queryApi1.execute(['key#1'], { cache: 'no-cache' });
		const resultPromise2 = queryApi2.execute(['key#1'], { cache: 'no-cache' });

		expect(queryFn1).toHaveBeenCalledTimes(1);
		expect(queryFn2).toHaveBeenCalledTimes(0);

		expect(handler1.stateFn).toHaveBeenCalledTimes(2); // loading from query1, loading from query2
		expect(handler2.stateFn).toHaveBeenCalledTimes(1); // loading from query2

		const result1 = await resultPromise1;
		const result2 = await resultPromise2;

		expect(queryFn1).toHaveBeenCalledTimes(1);
		expect(queryFn2).toHaveBeenCalledTimes(0);

		expect(handler1.stateFn).toHaveBeenCalledTimes(4); // loading from query1, loading from query2, success (query) from query1, success (query) from query2
		expect(handler2.stateFn).toHaveBeenCalledTimes(3); // loading from query2, success (query) from query1, success (query) from query2

		assert.deepStrictEqual(result1.state, { data: 'data#1', error: null, status: 'success' });
		assert.deepStrictEqual(result2.state, { data: 'data#1', error: null, status: 'success' });
	});

	it('execute only one query function and share the same promise with all queries', async () => {
		const store = makeCache<string>();
		const provider: QueryProvider<string, Error> = new PubSub();

		const queryFn1 = vi.fn(testTransformer);
		const handler1 = mockQueryHandler();
		const queryApi1 = Query.create<[string], string, Error>({
			store,
			provider,
			queryFn: queryFn1,
			...handler1,
			fresh: 50,
			ttl: 100,
			filterFn: filterControlState,
		});

		const queryFn2 = vi.fn(testTransformer);
		const handler2 = mockQueryHandler();
		const queryApi2 = Query.create<[string], string, Error>({
			store,
			provider,
			queryFn: queryFn2,
			...handler2,
			fresh: 50,
			ttl: 100,
			filterFn: filterControlState,
		});

		const queryFn3 = vi.fn(testTransformer);
		const handler3 = mockQueryHandler();
		const queryApi3 = Query.create<[string], string, Error>({
			store,
			provider,
			queryFn: queryFn3,
			...handler3,
			fresh: 50,
			ttl: 100,
			filterFn: filterControlState,
		});

		await store.set(defaultKeyHashFn(['key#1']), 'data_stale#1', 100);

		await waitUntil(60);

		const resultPromise1 = queryApi1.execute(['key#1'], { cache: 'fresh' });
		const resultPromise2 = queryApi2.execute(['key#1'], { cache: 'no-cache' });
		const resultPromise3 = queryApi3.execute(['key#1'], { cache: 'stale' });

		// query1 takes the cache entry | (context switch)
		// query2 execute query function | (context switch)
		// query3 takes the cache entry | (context switch)
		// query1 verify that cache entry (stale) cannot be used
		// query1 takes the current execution of query2
		// query3 verify that cache entry (stale) can be used
		// query3 takes the current execution of query2 (background)
		// query execution started by query2 finishes

		expect(queryFn1).toHaveBeenCalledTimes(0);
		expect(queryFn2).toHaveBeenCalledTimes(1);
		expect(queryFn3).toHaveBeenCalledTimes(0);

		expect(handler1.stateFn).toHaveBeenCalledTimes(0);
		expect(handler2.stateFn).toHaveBeenCalledTimes(1);
		expect(handler3.stateFn).toHaveBeenCalledTimes(0);

		const result1 = await resultPromise1;
		const result2 = await resultPromise2;
		const result3 = await resultPromise3;

		expect(queryFn1).toHaveBeenCalledTimes(0);
		expect(queryFn2).toHaveBeenCalledTimes(1);
		expect(queryFn3).toHaveBeenCalledTimes(0);

		{
			expect(handler1.stateFn).toHaveBeenCalledTimes(2);

			expect(handler1.stateFn).toHaveBeenNthCalledWith(
				1,
				{
					data: null,
					error: null,
					status: 'loading',
				} satisfies QueryState<string, Error>,
				{
					cache: 'fresh',
					origin: 'self',
					source: 'query',
				} satisfies QueryStateMetadata,
				queryApi1.cache
			);
			expect(handler1.stateFn).toHaveBeenNthCalledWith(
				2,
				{
					data: 'data#1',
					error: null,
					status: 'success',
				} satisfies QueryState<string, Error>,
				{
					cache: 'fresh',
					origin: 'self',
					source: 'query',
				} satisfies QueryStateMetadata,
				queryApi1.cache
			);
		}

		{
			expect(handler2.stateFn).toHaveBeenCalledTimes(2);

			expect(handler2.stateFn).toHaveBeenNthCalledWith(
				1,
				{
					data: null,
					error: null,
					status: 'loading',
				} satisfies QueryState<string, Error>,
				{
					cache: 'no-cache',
					origin: 'self',
					source: 'query',
				} satisfies QueryStateMetadata,
				queryApi2.cache
			);
			expect(handler2.stateFn).toHaveBeenNthCalledWith(
				2,
				{
					data: 'data#1',
					error: null,
					status: 'success',
				} satisfies QueryState<string, Error>,
				{
					cache: 'no-cache',
					origin: 'self',
					source: 'query',
				} satisfies QueryStateMetadata,
				queryApi2.cache
			);
		}

		{
			expect(handler3.stateFn).toHaveBeenCalledTimes(2);

			expect(handler3.stateFn).toHaveBeenNthCalledWith(
				1,
				{
					data: 'data_stale#1',
					error: null,
					status: 'stale',
				} satisfies QueryState<string, Error>,
				{
					cache: 'stale',
					origin: 'self',
					source: 'cache',
				} satisfies QueryStateMetadata,
				queryApi3.cache
			);
			expect(handler3.stateFn).toHaveBeenNthCalledWith(
				2,
				{
					data: 'data#1',
					error: null,
					status: 'success',
				} satisfies QueryState<string, Error>,
				{
					cache: 'stale',
					origin: 'self',
					source: 'background-query',
				} satisfies QueryStateMetadata,
				queryApi3.cache
			);
		}

		const state1 = await result1.next();
		const state2 = await result2.next();
		const state3 = await result3.next();

		expect(queryFn1).toHaveBeenCalledTimes(0);
		expect(queryFn2).toHaveBeenCalledTimes(1);
		expect(queryFn3).toHaveBeenCalledTimes(0);

		expect(handler1.stateFn).toHaveBeenCalledTimes(2);
		expect(handler2.stateFn).toHaveBeenCalledTimes(2);
		expect(handler3.stateFn).toHaveBeenCalledTimes(2);

		const promise = provider.getState(defaultKeyHashFn(['key#1']));
		assert.isNotNull(promise);
		assert.strictEqual(promise?.status, 'fulfilled');
		assert.deepStrictEqual(await promise, { data: 'data#1', error: null, status: 'success' });

		assert.deepStrictEqual(state1, null);
		assert.deepStrictEqual(state2, null);
		assert.deepStrictEqual(state3, { data: 'data#1', error: null, status: 'success' });
	});
});

describe('Query state provider / in-flight migration', () => {
	it('change subscribed key withing query execution', async () => {
		const store = makeCache<string>();
		const provider: QueryProvider<string, Error> = new PubSub();

		const queryFn1 = vi.fn(delayedTestTransformer(100));
		const handler1 = mockQueryHandler();
		const queryApi1 = Query.create<[string], string, Error>({
			store,
			provider,
			queryFn: queryFn1,
			...handler1,
			filterFn: filterControlState,
		});

		const queryFn2 = vi.fn(delayedTestTransformer(100));
		const handler2 = mockQueryHandler();
		const queryApi2 = Query.create<[string], string, Error>({
			store,
			provider,
			queryFn: queryFn2,
			...handler2,
			filterFn: filterControlState,
		});

		const resultPromise1 = queryApi1.execute(['key#1'], { cache: 'no-cache' });
		const resultPromise2 = queryApi2.execute(['key#1'], { cache: 'no-cache' });

		expect(queryFn1).toHaveBeenCalledTimes(1);
		expect(queryFn2).toHaveBeenCalledTimes(0);

		expect(handler1.stateFn).toHaveBeenCalledTimes(1);
		expect(handler2.stateFn).toHaveBeenCalledTimes(1);

		queryApi1.use(['key#2']);

		const result1 = await resultPromise1;
		const result2 = await resultPromise2;

		expect(queryFn1).toHaveBeenCalledTimes(1);
		expect(queryFn2).toHaveBeenCalledTimes(0);

		expect(handler1.stateFn).toHaveBeenCalledTimes(1);
		expect(handler2.stateFn).toHaveBeenCalledTimes(2);

		assert.deepStrictEqual(result1.state, { data: 'data#1', error: null, status: 'success' });
		assert.deepStrictEqual(result2.state, { data: 'data#1', error: null, status: 'success' });

		assert.deepStrictEqual(queryApi1.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});
		assert.deepStrictEqual(queryApi2.getState(), {
			data: 'data#1',
			error: null,
			status: 'success',
		});
	});
});
