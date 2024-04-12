import { describe, it, assert } from 'vitest';
import { makeCache } from '@/Cache.helper';

describe('AproximateLRUCache basic', () => {
	const expires = 10 * 1000; // 10 seconds

	it('set entry in the store', () => {
		const [store, cache] = makeCache();
		cache.set('a', 10, Date.now() + expires);

		assert.strictEqual(store.get('a')?.data, 10);
	});

	it('set and get entry from the store', () => {
		const [store, cache] = makeCache();

		cache.set('a', 10, Date.now() + expires);

		assert.strictEqual(cache.get('a'), 10);
		assert.strictEqual(store.get('a')?.data, 10);
	});

	it('get missing entry from the store', () => {
		const [store, cache] = makeCache();

		assert.strictEqual(cache.get('a'), undefined);
		assert.strictEqual(store.get('a'), undefined);
	});

	it('delete entry from the store', () => {
		const [store, cache] = makeCache();

		cache.delete('a');

		assert.strictEqual(cache.get('a'), undefined);
		assert.strictEqual(store.get('a'), undefined);
	});

	it('set, get and delete entry from the store', () => {
		const [store, cache] = makeCache();

		cache.set('a', 10, Date.now() + expires);

		assert.strictEqual(cache.get('a'), 10);
		assert.strictEqual(store.get('a')?.data, 10);

		cache.delete('a');

		assert.strictEqual(cache.get('a'), undefined);
		assert.strictEqual(store.get('a'), undefined);
	});
});
