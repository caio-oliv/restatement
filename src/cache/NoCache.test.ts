import { assert, describe, it } from 'vitest';
import { DEFAULT_TTL_DURATION, type CacheStore, NO_CACHE } from '@/lib';

describe('NoCache', () => {
	it('not set an entry in cache', async () => {
		const cache = NO_CACHE as CacheStore<string, number>;

		await cache.set('test', 100, DEFAULT_TTL_DURATION);
		await cache.set('aaa', 1, DEFAULT_TTL_DURATION);

		assert.strictEqual(await cache.get('test'), undefined);
		assert.strictEqual(await cache.getEntry('test'), undefined);

		await cache.delete('test');
		await cache.delete('aaa');

		assert.strictEqual(await cache.get('aaa'), undefined);
		assert.strictEqual(await cache.getEntry('aaa'), undefined);
	});

	it('does nothing when delete an entry in cache', async () => {
		const cache = NO_CACHE as CacheStore<string, number>;

		await cache.set('test', 100, DEFAULT_TTL_DURATION);

		assert.strictEqual(await cache.get('test'), undefined);

		await cache.delete('test');
		await cache.deletePrefix('te');

		assert.strictEqual(await cache.get('test'), undefined);
	});

	it('does nothing when clearing the cache', async () => {
		const cache = NO_CACHE as CacheStore<string, number>;

		await cache.set('test', 10, DEFAULT_TTL_DURATION);

		assert.strictEqual(await cache.get('test'), undefined);

		await cache.clear();

		assert.strictEqual(await cache.get('test'), undefined);
	});
});
