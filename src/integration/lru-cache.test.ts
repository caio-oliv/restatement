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
});
