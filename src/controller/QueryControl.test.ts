import { assert, describe, it } from 'vitest';
import {
	type QueryState,
	QueryControl,
	waitUntil,
	JitterExponentialBackoffTimer,
	PubSub,
	defaultKeyHashFn,
} from '@/lib';
import { makeCache } from '@/integration/LRUCache.mock';

describe('RemoteState default keyHashFn', () => {
	it('produce different keys for different input', () => {
		const input: Array<unknown> = ['string', { object: true }, [4, 'list'], 3.1415];

		const keys = input.map(defaultKeyHashFn);

		for (const [index, key] of keys.entries()) {
			for (let i = index + 1; i < input.length; i++) {
				assert.notStrictEqual(key, keys[i]);
			}
		}
	});
});

describe('RemoteStateQuery', () => {
	const sleepTime = 150; // 150 milliseconds
	const retryTimer = new JitterExponentialBackoffTimer(10, 75);

	describe('no-cache', () => {
		it('create cache entry', async () => {
			const cache = makeCache();
			const queryApi = new QueryControl({
				cacheStore: cache,
				queryFn: async key => {
					return '##' + key + '##';
				},
				retry: 0,
				retryDelay: retryTimer.delay,
			});

			assert.deepStrictEqual(queryApi.getState(), {
				data: null,
				error: null,
				status: 'idle',
			});

			queryApi.execute('unique-key', 'no-cache');

			assert.deepStrictEqual(queryApi.getState(), {
				data: null,
				error: null,
				status: 'loading',
			});

			await waitUntil(sleepTime);

			assert.deepStrictEqual(queryApi.getState(), {
				data: '##unique-key##',
				error: null,
				status: 'success',
			});

			assert.strictEqual(await cache.get(defaultKeyHashFn('unique-key')), '##unique-key##');
		});

		it('replace cache entry on subsequent calls', async () => {
			let queryFnCalled = 0;
			const cache = makeCache();
			const queryApi = new QueryControl({
				cacheStore: cache,
				queryFn: async key => {
					queryFnCalled += 1;
					return '##' + key + '##' + queryFnCalled;
				},
				retry: 0,
				retryDelay: retryTimer.delay,
			});

			assert.deepStrictEqual(queryApi.getState(), {
				data: null,
				error: null,
				status: 'idle',
			});

			queryApi.execute('unique-key', 'no-cache');

			assert.deepStrictEqual(queryApi.getState(), {
				data: null,
				error: null,
				status: 'loading',
			});

			await waitUntil(sleepTime);

			assert.deepStrictEqual(queryApi.getState(), {
				data: '##unique-key##1',
				error: null,
				status: 'success',
			});

			assert.strictEqual(await cache.get(defaultKeyHashFn('unique-key')), '##unique-key##1');

			queryApi.execute('unique-key', 'no-cache');

			assert.deepStrictEqual(queryApi.getState(), {
				data: '##unique-key##1',
				error: null,
				status: 'loading',
			});

			await waitUntil(sleepTime);

			assert.deepStrictEqual(queryApi.getState(), {
				data: '##unique-key##2',
				error: null,
				status: 'success',
			});

			assert.strictEqual(await cache.get(defaultKeyHashFn('unique-key')), '##unique-key##2');

			queryApi.execute('unique-key', 'no-cache');

			assert.deepStrictEqual(queryApi.getState(), {
				data: '##unique-key##2',
				error: null,
				status: 'loading',
			});

			await waitUntil(sleepTime);

			assert.deepStrictEqual(queryApi.getState(), {
				data: '##unique-key##3',
				error: null,
				status: 'success',
			});

			assert.strictEqual(await cache.get(defaultKeyHashFn('unique-key')), '##unique-key##3');
		});
	});

	describe('state provider', () => {
		it('subscribe for state changes', async () => {
			const cache = makeCache<string>();
			const provider = new PubSub<QueryState<string, Error>>();

			const queryApi1 = new QueryControl<string, string, Error>({
				cacheStore: cache,
				queryFn: async key => key,
				stateProvider: provider,
			});

			const queryApi2 = new QueryControl<string, string, Error>({
				cacheStore: cache,
				queryFn: async key => key,
				stateProvider: provider,
			});

			queryApi1.execute('?name=Pantera');
			assert.strictEqual(provider.subscriberCount(queryApi1.keyHashFn('?name=Pantera')), 1);

			queryApi2.execute('?name=Pantera');
			assert.strictEqual(provider.subscriberCount(queryApi1.keyHashFn('?name=Pantera')), 2);
		});

		it('update the state when provided', async () => {
			const cache = makeCache<string>();
			const stateList: Array<QueryState<string, Error>> = [];
			const provider = new PubSub<QueryState<string, Error>>();
			provider.subscribe('"?name=Pantera"', (_, data) => {
				stateList.push({ ...data });
			});

			const queryApi1 = new QueryControl<string, string, Error>({
				cacheStore: cache,
				queryFn: async key => key + '#1',
				stateProvider: provider,
			});

			const queryApi2 = new QueryControl<string, string, Error>({
				cacheStore: cache,
				queryFn: async key => key + '#2',
				stateProvider: provider,
			});

			queryApi1.execute('?name=Pantera');
			await waitUntil(sleepTime);

			queryApi2.execute('?name=Pantera', 'no-cache');
			await waitUntil(sleepTime);

			// queryApi1 received the state
			assert.deepStrictEqual(queryApi1.getState(), {
				data: '?name=Pantera#2',
				error: null,
				status: 'success',
			});

			queryApi1.execute('?name=Pantera', 'no-cache');
			await waitUntil(sleepTime);

			// queryApi2 received the state
			assert.deepStrictEqual(queryApi2.getState(), {
				data: '?name=Pantera#1',
				error: null,
				status: 'success',
			});

			assert.deepStrictEqual(stateList, [
				{ data: '?name=Pantera#1', error: null, status: 'success' },
				{ data: '?name=Pantera#2', error: null, status: 'success' },
				{ data: '?name=Pantera#1', error: null, status: 'success' },
			]);
		});
	});

	it('keep previus cache on error', async () => {
		let error = false,
			keepCache = false;
		const cache = makeCache<string>();
		const queryApi = new QueryControl<string, string, Error>({
			cacheStore: cache,
			queryFn: async key => {
				if (error) {
					throw new Error('should keep = ' + keepCache);
				} else {
					return '#' + key + '#';
				}
			},
			retry: 0,
			keepCacheOnError: err => err.message === 'should keep = true',
		});

		queryApi.execute('unique');
		await waitUntil(sleepTime);

		assert.strictEqual(await cache.get(queryApi.keyHashFn('unique')), '#unique#');
		assert.deepStrictEqual(queryApi.getState(), {
			data: '#unique#',
			error: null,
			status: 'success',
		});

		error = true;
		keepCache = true;
		queryApi.execute('unique', 'no-cache');
		await waitUntil(sleepTime);

		assert.strictEqual(await cache.get(queryApi.keyHashFn('unique')), '#unique#');
		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: new Error('should keep = true'),
			status: 'error',
		});

		error = true;
		keepCache = false;
		queryApi.execute('unique', 'no-cache');
		await waitUntil(sleepTime);

		assert.strictEqual(await cache.get(queryApi.keyHashFn('unique')), undefined);
		assert.deepStrictEqual(queryApi.getState(), {
			data: null,
			error: new Error('should keep = false'),
			status: 'error',
		});

		error = false;
		queryApi.execute('unique', 'no-cache');
		await waitUntil(sleepTime);

		assert.strictEqual(await cache.get(queryApi.keyHashFn('unique')), '#unique#');
		assert.deepStrictEqual(queryApi.getState(), {
			data: '#unique#',
			error: null,
			status: 'success',
		});
	});
});
