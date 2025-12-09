import { assert, describe, expect, it, vi } from 'vitest';
import { PersistentCache, type CacheStore, TrackingCache } from '@/lib';

function makeCacheMock<K, V>(): CacheStore<K, V> {
	return {
		get: vi.fn(),
		getEntry: vi.fn(),
		set: vi.fn(),
		delete: vi.fn(),
		deletePrefix: vi.fn(),
		clear: vi.fn(),
	};
}

describe('TrackingCache', () => {
	it('get and set values in the cache', async () => {
		const inner = new PersistentCache<string, number>();
		const cache = new TrackingCache<string, number>(inner);

		await cache.set('car', 10, 50);
		await cache.set('bike', 20, 100);

		assert.strictEqual(await cache.get('car'), 10);
		assert.strictEqual((await cache.getEntry('car'))!.data, 10);

		assert.strictEqual(await cache.get('bike'), 20);
		assert.strictEqual((await cache.getEntry('bike'))!.data, 20);
	});

	it('track all values that are set into the cache', async () => {
		const inner = new PersistentCache<string, number>();
		const cache = new TrackingCache<string, number>(inner);

		await cache.set('/boot', 10, 50);
		await cache.set('/home', 20, 100);
		await cache.set('/var', 80, 100);

		assert.strictEqual(cache.storage.get('/boot')!.data, 10);
		assert.strictEqual(cache.storage.get('/home')!.data, 20);
		assert.strictEqual(cache.storage.get('/var')!.data, 80);
	});

	it('call inner delete, deletePrefix and clear mothods cache method', async () => {
		const inner = makeCacheMock<string, number>();
		const cache = new TrackingCache<string, number>(inner);

		{
			// delete
			await cache.delete('aaa');
			await cache.delete('bbb');

			expect(inner.delete).toHaveBeenCalledTimes(2);
		}
		{
			// deletePrefix
			await cache.deletePrefix('/home');

			expect(inner.deletePrefix).toHaveBeenCalledTimes(1);
		}
		{
			// clear
			await cache.clear();

			expect(inner.clear).toHaveBeenCalledTimes(1);
		}
	});
});
