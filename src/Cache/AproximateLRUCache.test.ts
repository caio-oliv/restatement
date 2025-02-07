import { describe, it, assert } from 'vitest';
import { AproximateLRUCache, LRUCacheEntry } from './AproximateLRUCache';
import { CacheStore } from '@/Cache';

function makeCache<T>(
	capacity: number = 100,
	tru_duration_threshold: number = 5 * 1000
): [Map<string, LRUCacheEntry<T>>, CacheStore<string, T>] {
	const storage = new Map<string, LRUCacheEntry<T>>();
	const cache = new AproximateLRUCache<T>(storage, capacity, tru_duration_threshold);
	return [storage, cache];
}

describe('AproximateLRUCache basic', () => {
	const expires = 10 * 1000; // 10 seconds

	it('set entry in the store', async () => {
		const [store, cache] = makeCache();
		await cache.set('a', 10, Date.now() + expires);

		assert.strictEqual(await store.get('a')?.data, 10);
	});

	it('set and get entry from the store', async () => {
		const [store, cache] = makeCache();

		await cache.set('a', 10, Date.now() + expires);

		assert.strictEqual(await cache.get('a'), 10);
		assert.strictEqual(store.get('a')?.data, 10);
	});

	it('get missing entry from the store', async () => {
		const [store, cache] = makeCache();

		assert.strictEqual(await cache.get('a'), undefined);
		assert.strictEqual(store.get('a'), undefined);
	});

	it('delete entry from the store', async () => {
		const [store, cache] = makeCache();

		await cache.delete('a');

		assert.strictEqual(await cache.get('a'), undefined);
		assert.strictEqual(store.get('a'), undefined);
	});

	it('set, get and delete entry from the store', async () => {
		const [store, cache] = makeCache();

		await cache.set('a', 10, Date.now() + expires);

		assert.strictEqual(await cache.get('a'), 10);
		assert.strictEqual(store.get('a')?.data, 10);

		await cache.delete('a');

		assert.strictEqual(await cache.get('a'), undefined);
		assert.strictEqual(store.get('a'), undefined);
	});
});
