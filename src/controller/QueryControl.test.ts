import { assert, describe, it } from 'vitest';
import { type QueryState, QueryControl, waitUntil, PubSub, defaultKeyHashFn } from '@/lib';
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
});
