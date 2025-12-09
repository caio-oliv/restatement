import { assert, describe, it } from 'vitest';
import { LRUCache } from 'lru-cache';
import { LRUCacheAdapter, REQUIRED_LRU_CACHE_OPTIONS, waitUntil } from '@/lib';

const ERR = -1;

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
			assert.isAtMost(entry.time, Date.now());
		}
		{
			const entry = (await adapter.getEntry('bike'))!;
			assert.isTrue(typeof entry === 'object');
			assert.strictEqual(entry.data, 20);
			assert.strictEqual(entry.ttl, 100);
			assert.isAtMost(entry.time, Date.now());
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
			assert.isAtMost(entry.time, Date.now() - (70 + ERR));
		}
		{
			const entry = (await adapter.getEntry('truck'))!;
			assert.isTrue(typeof entry === 'object');
			assert.strictEqual(entry.data, 70);
			assert.strictEqual(entry.ttl, 200);
			assert.isAtMost(entry.time, Date.now() - (70 + ERR));
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
			assert.isAtMost(entry.time, Date.now() - (50 + 70 + ERR));
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

	it('delete entries matching a key prefix', async () => {
		const options: LRUCache.Options<string, number, unknown> = {
			max: 500,
			...REQUIRED_LRU_CACHE_OPTIONS,
		};

		const cache = new LRUCache<string, number>(options);
		const adapter = new LRUCacheAdapter(cache);

		await adapter.set('/boot', 100, 10_000);
		await adapter.set('/etc', 100, 10_000);
		await adapter.set('/etc/sudoers', 100, 10_000);
		await adapter.set('/etc/passwd', 100, 10_000);
		await adapter.set('/etc/group', 100, 10_000);
		await adapter.set('/etc/hostname', 100, 10_000);
		await adapter.set('/etc/systemd', 100, 10_000);
		await adapter.set('/etc/systemd/journald.conf', 100, 10_000);
		await adapter.set('/etc/systemd/networkd.conf', 100, 10_000);
		await adapter.set('/etc/systemd/resolved.conf', 100, 10_000);
		await adapter.set('/etc/systemd/user.conf', 100, 10_000);
		await adapter.set('/home', 100, 10_000);
		await adapter.set('/home/bob', 100, 10_000);
		await adapter.set('/home/alice', 100, 10_000);

		await adapter.deletePrefix('/etc/systemd/resolved.conf');

		assert.strictEqual(await adapter.get('/etc/systemd'), 100);
		assert.strictEqual(await adapter.get('/etc/systemd/journald.conf'), 100);
		assert.strictEqual(await adapter.get('/etc/systemd/networkd.conf'), 100);
		assert.strictEqual(await adapter.get('/etc/systemd/resolved.conf'), undefined);
		assert.strictEqual(await adapter.get('/etc/systemd/user.conf'), 100);

		await adapter.deletePrefix('/etc/systemd');

		assert.strictEqual(await adapter.get('/etc/systemd'), undefined);
		assert.strictEqual(await adapter.get('/etc/systemd/journald.conf'), undefined);
		assert.strictEqual(await adapter.get('/etc/systemd/networkd.conf'), undefined);
		assert.strictEqual(await adapter.get('/etc/systemd/resolved.conf'), undefined);
		assert.strictEqual(await adapter.get('/etc/systemd/user.conf'), undefined);

		assert.strictEqual(await adapter.get('/etc/sudoers'), 100);
		assert.strictEqual(await adapter.get('/etc/passwd'), 100);
		assert.strictEqual(await adapter.get('/etc/group'), 100);
		assert.strictEqual(await adapter.get('/etc/hostname'), 100);

		await adapter.deletePrefix('/etc');

		assert.strictEqual(await adapter.get('/etc'), undefined);
		assert.strictEqual(await adapter.get('/etc/sudoers'), undefined);
		assert.strictEqual(await adapter.get('/etc/passwd'), undefined);
		assert.strictEqual(await adapter.get('/etc/group'), undefined);
		assert.strictEqual(await adapter.get('/etc/hostname'), undefined);

		assert.strictEqual(await adapter.get('/boot'), 100);
		assert.strictEqual(await adapter.get('/home'), 100);
		assert.strictEqual(await adapter.get('/home/bob'), 100);
		assert.strictEqual(await adapter.get('/home/alice'), 100);
	});

	it('clear all cache entries', async () => {
		const options: LRUCache.Options<string, number, unknown> = {
			max: 500,
			...REQUIRED_LRU_CACHE_OPTIONS,
		};

		const cache = new LRUCache<string, number>(options);
		const adapter = new LRUCacheAdapter(cache);

		await adapter.set('/home', 100, 10_000);
		await adapter.set('/etc', 50, 10_000);
		await adapter.set('/boot', 30, 10_000);

		await adapter.clear();

		assert.strictEqual(await adapter.get('/home'), undefined);
		assert.strictEqual(await adapter.get('/etc'), undefined);
		assert.strictEqual(await adapter.get('/boot'), undefined);
	});
});
