import { assert, describe, it } from 'vitest';
import { LRUCache } from 'lru-cache';
import { LRUCacheAdapter, REQUIRED_LRU_CACHE_OPTIONS, waitUntil } from '@/lib';

describe('lru-cache package integration', () => {
	it('set and get values from the cache', async () => {
		const options: LRUCache.Options<string, number, unknown> = {
			max: 500,
			...REQUIRED_LRU_CACHE_OPTIONS,
		};

		const cache = new LRUCache<string, number>(options);
		const adapter = new LRUCacheAdapter(cache);

		await adapter.set('car', 10, 50);
		await adapter.set('bike', 20, 100);

		assert.strictEqual(await adapter.get('car'), 10);
		assert.strictEqual(await adapter.get('bike'), 20);

		await waitUntil(70);

		assert.strictEqual(await adapter.get('car'), undefined);
		assert.strictEqual(await adapter.get('bike'), 20);
	});

	it('set and get cache entries', async () => {
		const ERR = 1;
		const options: LRUCache.Options<string, number, unknown> = {
			max: 500,
			...REQUIRED_LRU_CACHE_OPTIONS,
		};

		const cache = new LRUCache<string, number>(options);
		const adapter = new LRUCacheAdapter(cache);

		await adapter.set('car', 10, 50);
		await adapter.set('bike', 20, 100);

		{
			const entry = (await adapter.getEntry('car'))!;
			assert.isTrue(typeof entry === 'object');
			assert.strictEqual(entry.data, 10);
			assert.strictEqual(entry.ttl, 50);
			assert.isAtMost(entry.remain_ttl, 50 + ERR);
		}
		{
			const entry = (await adapter.getEntry('bike'))!;
			assert.isTrue(typeof entry === 'object');
			assert.strictEqual(entry.data, 20);
			assert.strictEqual(entry.ttl, 100);
			assert.isAtMost(entry.remain_ttl, 100 + ERR);
		}

		await adapter.set('truck', 70, 200);

		await waitUntil(70);

		{
			const entry = await adapter.getEntry('car');
			assert.isTrue(typeof entry === 'undefined');
		}
		{
			const entry = (await adapter.getEntry('bike'))!;
			assert.isTrue(typeof entry === 'object');
			assert.strictEqual(entry.data, 20);
			assert.strictEqual(entry.ttl, 100);
			assert.isAtMost(entry.remain_ttl, 100 + ERR - 70);
		}
		{
			const entry = (await adapter.getEntry('truck'))!;
			assert.isTrue(typeof entry === 'object');
			assert.strictEqual(entry.data, 70);
			assert.strictEqual(entry.ttl, 200);
			assert.isAtMost(entry.remain_ttl, 200 + ERR - 70);
		}

		await waitUntil(50);

		{
			const entry = await adapter.getEntry('car');
			assert.isTrue(typeof entry === 'undefined');
		}
		{
			const entry = (await adapter.getEntry('bike'))!;
			assert.isTrue(typeof entry === 'undefined');
		}
		{
			const entry = (await adapter.getEntry('truck'))!;
			assert.isTrue(typeof entry === 'object');
			assert.strictEqual(entry.data, 70);
			assert.strictEqual(entry.ttl, 200);
			assert.isAtMost(entry.remain_ttl, 200 + ERR - (70 + 50));
		}
	});

	it('not get values not present inside the cache', async () => {
		const options: LRUCache.Options<string, number, unknown> = {
			max: 500,
			...REQUIRED_LRU_CACHE_OPTIONS,
		};

		const cache = new LRUCache<string, number>(options);
		const adapter = new LRUCacheAdapter(cache);

		await adapter.set('/home', 100, 10_000);
		await adapter.set('/etc', 50, 10_000);
		await adapter.set('/boot', 30, 10_000);

		assert.strictEqual(await adapter.get('car'), undefined);
		assert.strictEqual(await adapter.get('bike'), undefined);
		assert.strictEqual(await adapter.get('truck'), undefined);
	});

	it('delete values inside the cache', async () => {
		const options: LRUCache.Options<string, number, unknown> = {
			max: 500,
			...REQUIRED_LRU_CACHE_OPTIONS,
		};

		const cache = new LRUCache<string, number>(options);
		const adapter = new LRUCacheAdapter(cache);

		await adapter.set('/home', 100, 10_000);
		await adapter.set('/etc', 50, 10_000);
		await adapter.set('/boot', 30, 10_000);

		assert.strictEqual(await adapter.get('/home'), 100);
		assert.strictEqual(await adapter.get('/etc'), 50);
		assert.strictEqual(await adapter.get('/boot'), 30);

		await adapter.delete('/home');
		await adapter.delete('/etc');
		await adapter.delete('/boot');

		assert.strictEqual(await adapter.get('/home'), undefined);
		assert.strictEqual(await adapter.get('/etc'), undefined);
		assert.strictEqual(await adapter.get('/boot'), undefined);
	});

	it('delete values not in the cache', async () => {
		const options: LRUCache.Options<string, number, unknown> = {
			max: 500,
			...REQUIRED_LRU_CACHE_OPTIONS,
		};

		const cache = new LRUCache<string, number>(options);
		const adapter = new LRUCacheAdapter(cache);

		await adapter.set('/home', 100, 10_000);
		await adapter.set('/etc', 50, 10_000);
		await adapter.set('/boot', 30, 10_000);

		assert.strictEqual(await adapter.get('/home'), 100);
		assert.strictEqual(await adapter.get('/etc'), 50);
		assert.strictEqual(await adapter.get('/boot'), 30);

		assert.strictEqual(await adapter.get('car'), undefined);
		assert.strictEqual(await adapter.get('bike'), undefined);
		assert.strictEqual(await adapter.get('truck'), undefined);

		await adapter.delete('car');
		await adapter.delete('bike');
		await adapter.delete('truck');

		assert.strictEqual(await adapter.get('car'), undefined);
		assert.strictEqual(await adapter.get('bike'), undefined);
		assert.strictEqual(await adapter.get('truck'), undefined);
	});
});
