import { assert, describe, expect, it, vi } from 'vitest';
import { CacheManager, type QueryProviderState, PubSub, type CacheManagerProvider } from '@/lib';
import { makeCache } from '@/integration/LRUCache.mock';

interface UserMock {
	id: number;
	name: string;
	email: string;
}

function generateUserMock(id: number): UserMock {
	return {
		id,
		email: `unknown.${id}@email.com`,
		name: `unknown.${id}`,
	};
}

describe('CacheManager', () => {
	it('set value into the cache store', async () => {
		const store = makeCache();
		const cache = new CacheManager({ store });

		const data = generateUserMock(1);

		await cache.set(['user', 'id:1'], data);

		assert.deepStrictEqual(await cache.get(['user', 'id:1']), data);

		assert.deepStrictEqual(await store.get(cache.keyHashFn(['user', 'id:1'])), data);
	});

	it('set value and publish through the provider', async () => {
		const store = makeCache();
		const provider: CacheManagerProvider<string, Error> = new PubSub();
		const listener = vi.fn();
		const cache = new CacheManager({ store, provider });

		const key = ['user', 'id:1'];
		const hash = cache.keyHashFn(key);

		provider.subscribe(hash, listener);

		const data = generateUserMock(1);

		await cache.set(key, data);

		assert.deepStrictEqual(await cache.get(key), data);

		expect(listener).toHaveBeenNthCalledWith(1, hash, {
			state: { status: 'success', data, error: null },
			metadata: { cache: 'none', origin: 'provider', source: 'mutation' },
		} satisfies QueryProviderState<typeof data, Error>);
	});

	it('set value with custom ttl', async () => {
		const store = makeCache();
		const cache = new CacheManager({ store });

		const data = generateUserMock(1);

		await cache.set(['user', 'id:1'], data, 5_000);

		const entry = (await store.getEntry(cache.keyHashFn(['user', 'id:1'])))!;

		assert.deepStrictEqual(entry.ttl, 5_000);
	});

	it('not get a value that is not in the store', async () => {
		const store = makeCache();
		const cache = new CacheManager({ store });

		assert.deepStrictEqual(await cache.get(['user', 'id:1']), undefined);

		assert.deepStrictEqual(await store.get(cache.keyHashFn(['user', 'id:1'])), undefined);
	});

	it('delete value in the cache store', async () => {
		const store = makeCache();
		const cache = new CacheManager({ store });

		const data = generateUserMock(1);

		await cache.set(['user', 'id:1'], data);

		assert.deepStrictEqual(await cache.get(['user', 'id:1']), data);

		await cache.delete(['user', 'id:1']);

		assert.deepStrictEqual(await cache.get(['user', 'id:1']), undefined);
	});

	it('invalidate a set of keys in the cache store', async () => {
		const store = makeCache();
		const cache = new CacheManager({ store });

		// unrelated keys
		await cache.set(['account', 'id:1'], 'account+1');
		await cache.set(['other', 'key'], 'my-value');

		// user keys
		for (let i = 0; i < 10; i++) {
			await cache.set(['user', 'id:' + i], generateUserMock(i));
		}

		for (let i = 0; i < 10; i++) {
			assert.deepStrictEqual(await cache.get(['user', 'id:' + i]), generateUserMock(i));
		}

		// invalidate single user key
		await cache.invalidate(['user', 'id:1']);

		assert.deepStrictEqual(await cache.get(['user', 'id:1']), undefined);

		// invalidate all user keys
		await cache.invalidate(['user']);

		for (let i = 0; i < 10; i++) {
			assert.deepStrictEqual(await cache.get(['user', 'id:' + i]), undefined);
		}

		assert.deepStrictEqual(await cache.get(['account', 'id:1']), 'account+1');
		assert.deepStrictEqual(await cache.get(['other', 'key']), 'my-value');
	});
});
