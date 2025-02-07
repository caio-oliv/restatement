import { assert, describe, it } from 'vitest';
import { QueryControl } from '@/QueryControl';
import { makeCache } from '@/integration/LRUCache.mock';
import { waitUntil } from '@/AsyncModule';
import { JitterExponentialBackoffTimer } from '@/TimerModule';
import { PubSub } from '@/PubSub';
import { QueryState, QueryControlHandler } from '@/Type';
import { defaultKeyHashFn } from '@/Default';

describe('RemoteState default keyHashFn', () => {
	it('produce different keys for different input', () => {
		const input: unknown[] = ['string', { object: true }, [4, 'list'], 3.1415];

		const keys = input.map(defaultKeyHashFn);

		for (const [index, key] of keys.entries()) {
			for (let i = index + 1; i < input.length; i++) {
				assert.notStrictEqual(key, keys[i]);
			}
		}
	});
});

function makeCountHandlers<T, E>() {
	const counter = {
		stateCalled: 0,
		errorCalled: 0,
		dataCalled: 0,
	};

	const handler: QueryControlHandler<T, E> = {
		stateFn: () => {
			counter.stateCalled += 1;
		},
		errorFn: () => {
			counter.errorCalled += 1;
		},
		dataFn: () => {
			counter.dataCalled += 1;
		},
	};

	return { handler, counter };
}

describe('RemoteStateQuery', () => {
	const sleepTime = 150; // 150 milliseconds
	const retryTimer = new JitterExponentialBackoffTimer(10, 75);

	describe('no-cache', () => {
		it('execute query function', async () => {
			let queryFnCalled = 0;
			const cache = makeCache();
			const queryApi = new QueryControl({
				cacheStore: cache,
				queryFn: async key => {
					queryFnCalled += 1;
					return key;
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
				data: 'unique-key',
				error: null,
				status: 'success',
			});

			assert.strictEqual(queryFnCalled, 1);
		});

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

		it('call handlers on each state transition', async () => {
			let queryFnCalled = 0;
			const { counter, handler } = makeCountHandlers<string, Error>();

			const cache = makeCache<string>();
			const queryApi = new QueryControl({
				cacheStore: cache,
				queryFn: async key => {
					queryFnCalled += 1;
					if (queryFnCalled % 2 === 0) {
						throw new Error('called on even');
					}
					return '##' + key + '##' + queryFnCalled;
				},
				retry: 0,
				retryDelay: retryTimer.delay,
				handler,
			});

			assert.deepStrictEqual(queryApi.getState(), {
				data: null,
				error: null,
				status: 'idle',
			});

			assert.deepStrictEqual(counter, { dataCalled: 0, errorCalled: 0, stateCalled: 0 });

			queryApi.execute('unique-key', 'no-cache');

			assert.deepStrictEqual(queryApi.getState(), {
				data: null,
				error: null,
				status: 'loading',
			});

			assert.deepStrictEqual(counter, { dataCalled: 0, errorCalled: 0, stateCalled: 1 });

			await waitUntil(sleepTime);

			assert.deepStrictEqual(queryApi.getState(), {
				data: '##unique-key##1',
				error: null,
				status: 'success',
			});

			assert.deepStrictEqual(counter, { dataCalled: 1, errorCalled: 0, stateCalled: 2 });

			queryApi.execute('unique-key', 'no-cache');

			assert.deepStrictEqual(queryApi.getState(), {
				data: '##unique-key##1',
				error: null,
				status: 'loading',
			});

			assert.deepStrictEqual(counter, { dataCalled: 1, errorCalled: 0, stateCalled: 3 });

			await waitUntil(sleepTime);

			assert.deepStrictEqual(queryApi.getState(), {
				data: null,
				error: new Error('called on even'),
				status: 'error',
			});

			assert.deepStrictEqual(counter, { dataCalled: 1, errorCalled: 1, stateCalled: 4 });
		});

		it('retry query on error', async () => {
			let queryFnCalled = 0;
			const { counter, handler } = makeCountHandlers<string, Error>();

			const cache = makeCache<string>();
			const queryApi = new QueryControl({
				cacheStore: cache,
				queryFn: async key => {
					queryFnCalled += 1;
					if (queryFnCalled % 3 !== 0) {
						throw new Error('only the third call');
					}
					return key + '#' + queryFnCalled;
				},
				retry: 2,
				retryDelay: retryTimer.delay,
				handler,
			});

			queryApi.execute('unique-key', 'no-cache');
			await waitUntil(sleepTime * 3);

			assert.deepStrictEqual(queryApi.getState(), {
				data: 'unique-key#3',
				error: null,
				status: 'success',
			});

			assert.deepStrictEqual(counter, { dataCalled: 1, errorCalled: 0, stateCalled: 2 });
			assert.deepStrictEqual(queryFnCalled, 3);

			queryApi.execute('unique-key', 'no-cache');
			await waitUntil(sleepTime);

			assert.deepStrictEqual(queryApi.getState(), {
				data: 'unique-key#6',
				error: null,
				status: 'success',
			});

			assert.deepStrictEqual(counter, { dataCalled: 2, errorCalled: 0, stateCalled: 4 });
			assert.deepStrictEqual(queryFnCalled, 6);
		});
	});

	describe('fresh', () => {
		it('execute query function when no cache entry is found', async () => {
			let queryFnCalled = 0;
			const cache = makeCache();
			const queryApi = new QueryControl({
				cacheStore: cache,
				queryFn: async key => {
					queryFnCalled += 1;
					return key + '#' + queryFnCalled;
				},
				retry: 0,
				retryDelay: retryTimer.delay,
			});

			assert.deepStrictEqual(queryApi.getState(), {
				data: null,
				error: null,
				status: 'idle',
			});

			queryApi.execute('unique-key', 'fresh');

			await waitUntil(100);

			assert.deepStrictEqual(queryApi.getState(), {
				data: 'unique-key#1',
				error: null,
				status: 'success',
			});

			assert.strictEqual(queryFnCalled, 1);
		});

		it('return from cache when the cache entry is fresh', async () => {
			let queryFnCalled = 0;
			const cache = makeCache();
			const queryApi = new QueryControl({
				cacheStore: cache,
				queryFn: async key => {
					queryFnCalled += 1;
					return key + '#' + queryFnCalled;
				},
				retry: 0,
				retryDelay: retryTimer.delay,
			});

			assert.deepStrictEqual(queryApi.getState(), {
				data: null,
				error: null,
				status: 'idle',
			});

			assert.strictEqual(await cache.get(defaultKeyHashFn('unique-key')), undefined);
			queryApi.execute('unique-key', 'fresh');

			await waitUntil(sleepTime);

			assert.deepStrictEqual(queryApi.getState(), {
				data: 'unique-key#1',
				error: null,
				status: 'success',
			});

			assert.strictEqual(queryFnCalled, 1);

			assert.strictEqual(await cache.get(defaultKeyHashFn('unique-key')), 'unique-key#1');
			queryApi.execute('unique-key', 'fresh');

			assert.deepStrictEqual(queryApi.getState(), {
				data: 'unique-key#1',
				error: null,
				status: 'success',
			});

			await waitUntil(sleepTime);

			assert.deepStrictEqual(queryApi.getState(), {
				data: 'unique-key#1',
				error: null,
				status: 'success',
			});

			assert.strictEqual(queryFnCalled, 1);
		});

		it('execute query function when a cache entry is found, but is not fresh', async () => {
			let queryFnCalled = 0;
			const cache = makeCache();
			const queryApi = new QueryControl({
				cacheStore: cache,
				queryFn: async key => {
					queryFnCalled += 1;
					return key + '#' + queryFnCalled;
				},
				retry: 0,
				retryDelay: retryTimer.delay,
				freshDuration: sleepTime,
				staleDuration: sleepTime * 3,
			});

			assert.strictEqual(await cache.get(defaultKeyHashFn('unique-key')), undefined);

			await queryApi.execute('unique-key', 'fresh');
			await waitUntil(sleepTime);

			assert.deepStrictEqual(queryApi.getState(), {
				data: 'unique-key#1',
				error: null,
				status: 'success',
			});

			assert.strictEqual(queryFnCalled, 1);

			assert.strictEqual(await cache.get(defaultKeyHashFn('unique-key')), 'unique-key#1');

			await waitUntil(sleepTime * 5);

			assert.strictEqual(await cache.get(defaultKeyHashFn('unique-key')), undefined);

			await queryApi.execute('unique-key', 'fresh');
			await waitUntil(sleepTime);

			assert.deepStrictEqual(queryApi.getState(), {
				data: 'unique-key#2',
				error: null,
				status: 'success',
			});

			assert.strictEqual(queryFnCalled, 2);

			assert.strictEqual(await cache.get(defaultKeyHashFn('unique-key')), 'unique-key#2');
		});

		it('retry query on error', async () => {
			let queryFnCalled = 0;
			const { counter, handler } = makeCountHandlers<string, Error>();
			const cache = makeCache<string>();
			const queryApi = new QueryControl({
				cacheStore: cache,
				queryFn: async key => {
					queryFnCalled += 1;
					if (queryFnCalled % 3 !== 0) {
						throw new Error('only the third call');
					}
					return key + '#' + queryFnCalled;
				},
				retry: 2,
				retryDelay: retryTimer.delay,
				freshDuration: sleepTime,
				staleDuration: sleepTime * 3,
				handler,
			});

			queryApi.execute('unique-key', 'fresh');
			await waitUntil(sleepTime * 3);

			assert.deepStrictEqual(queryApi.getState(), {
				data: 'unique-key#3',
				error: null,
				status: 'success',
			});

			assert.deepStrictEqual(counter, { dataCalled: 1, errorCalled: 0, stateCalled: 2 });
			assert.deepStrictEqual(queryFnCalled, 3);

			await waitUntil(sleepTime * 3);
			queryApi.execute('unique-key', 'fresh');

			await waitUntil(sleepTime * 3);

			assert.deepStrictEqual(queryApi.getState(), {
				data: 'unique-key#6',
				error: null,
				status: 'success',
			});

			assert.deepStrictEqual(counter, { dataCalled: 2, errorCalled: 0, stateCalled: 4 });
			assert.deepStrictEqual(queryFnCalled, 6);
		});
	});

	describe('stale', () => {
		it('execute query function when no cache entry is found', async () => {
			let queryFnCalled = 0;
			const cache = makeCache();
			const queryApi = new QueryControl({
				cacheStore: cache,
				queryFn: async key => {
					queryFnCalled += 1;
					return key + '#' + queryFnCalled;
				},
				retry: 0,
				retryDelay: retryTimer.delay,
			});

			assert.deepStrictEqual(queryApi.getState(), {
				data: null,
				error: null,
				status: 'idle',
			});

			assert.strictEqual(await cache.get(defaultKeyHashFn('unique-key')), undefined);
			queryApi.execute('unique-key', 'stale');

			await waitUntil(sleepTime);

			assert.deepStrictEqual(queryApi.getState(), {
				data: 'unique-key#1',
				error: null,
				status: 'success',
			});

			assert.strictEqual(queryFnCalled, 1);

			assert.strictEqual(await cache.get(defaultKeyHashFn('unique-key')), 'unique-key#1');
		});

		it('return from cache when the cache entry is fresh without running background query', async () => {
			let queryFnCalled = 0;
			const cache = makeCache();
			const queryApi = new QueryControl({
				cacheStore: cache,
				queryFn: async key => {
					queryFnCalled += 1;
					return key + '#' + queryFnCalled;
				},
				retry: 0,
				retryDelay: retryTimer.delay,
			});

			assert.deepStrictEqual(queryApi.getState(), {
				data: null,
				error: null,
				status: 'idle',
			});

			assert.strictEqual(await cache.get(defaultKeyHashFn('unique-key')), undefined);
			queryApi.execute('unique-key', 'stale');

			await waitUntil(sleepTime);

			assert.deepStrictEqual(queryApi.getState(), {
				data: 'unique-key#1',
				error: null,
				status: 'success',
			});

			assert.strictEqual(queryFnCalled, 1);

			assert.strictEqual(await cache.get(defaultKeyHashFn('unique-key')), 'unique-key#1');
			queryApi.execute('unique-key', 'stale');

			assert.deepStrictEqual(queryApi.getState(), {
				data: 'unique-key#1',
				error: null,
				status: 'success',
			});

			await waitUntil(sleepTime);

			assert.deepStrictEqual(queryApi.getState(), {
				data: 'unique-key#1',
				error: null,
				status: 'success',
			});

			await waitUntil(sleepTime);

			assert.strictEqual(queryFnCalled, 1);
		});

		it('return from cache when the cache entry is stale running background query', async () => {
			const sleep = 100;
			const fresh = 50;

			let queryFnCalled = 0;
			const { counter, handler } = makeCountHandlers<string, Error>();
			const cache = makeCache<string>();
			const queryApi = new QueryControl({
				cacheStore: cache,
				queryFn: async key => {
					await waitUntil(fresh);
					queryFnCalled += 1;
					return key + '#' + queryFnCalled;
				},
				retry: 0,
				retryDelay: retryTimer.delay,
				freshDuration: fresh,
				staleDuration: sleep * 3,
				handler,
			});

			assert.deepStrictEqual(queryApi.getState(), {
				data: null,
				error: null,
				status: 'idle',
			});

			assert.strictEqual(await cache.get(defaultKeyHashFn('unique-key')), undefined);

			queryApi.execute('unique-key', 'stale');

			await waitUntil(sleep * 2);

			assert.deepStrictEqual(queryApi.getState(), {
				data: 'unique-key#1',
				error: null,
				status: 'success',
			});

			assert.strictEqual(queryFnCalled, 1);
			assert.deepStrictEqual(counter, { dataCalled: 1, errorCalled: 0, stateCalled: 2 });

			assert.strictEqual(await cache.get(defaultKeyHashFn('unique-key')), 'unique-key#1');

			queryApi.execute('unique-key', 'stale');

			await waitUntil(fresh);

			assert.strictEqual(queryFnCalled, 1);
			assert.deepStrictEqual(counter, { dataCalled: 2, errorCalled: 0, stateCalled: 3 });

			// returned the stale data
			assert.deepStrictEqual(queryApi.getState(), {
				data: 'unique-key#1',
				error: null,
				status: 'stale',
			});

			await waitUntil(200);

			assert.strictEqual(queryFnCalled, 2);
			assert.deepStrictEqual(counter, { dataCalled: 3, errorCalled: 0, stateCalled: 4 });

			// returned the new data from the query function that executed in the background
			assert.deepStrictEqual(queryApi.getState(), {
				data: 'unique-key#2',
				error: null,
				status: 'success',
			});

			assert.strictEqual(await cache.get(defaultKeyHashFn('unique-key')), 'unique-key#2');
		});

		it('retry query on error', async () => {
			let queryFnCalled = 0;
			const { counter, handler } = makeCountHandlers<string, Error>();
			const cache = makeCache<string>();
			const queryApi = new QueryControl({
				cacheStore: cache,
				queryFn: async key => {
					queryFnCalled += 1;
					if (queryFnCalled % 3 !== 0) {
						throw new Error('only the third call');
					}
					return key + '#' + queryFnCalled;
				},
				retry: 2,
				retryDelay: retryTimer.delay,
				freshDuration: sleepTime,
				staleDuration: sleepTime * 3,
				handler,
			});

			await queryApi.execute('unique-key', 'stale');
			await waitUntil(sleepTime * 5);

			assert.deepStrictEqual(queryApi.getState(), {
				data: 'unique-key#3',
				error: null,
				status: 'success',
			});

			assert.deepStrictEqual(counter, { dataCalled: 1, errorCalled: 0, stateCalled: 2 });
			assert.deepStrictEqual(queryFnCalled, 3);

			await queryApi.execute('unique-key', 'stale');
			await waitUntil(sleepTime * 3);

			assert.deepStrictEqual(queryApi.getState(), {
				data: 'unique-key#6',
				error: null,
				status: 'success',
			});

			assert.deepStrictEqual(counter, { dataCalled: 2, errorCalled: 0, stateCalled: 4 });
			assert.deepStrictEqual(queryFnCalled, 6);
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
			const stateList: QueryState<string, Error>[] = [];
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
