import { assert, describe, it } from 'vitest';
import { waitUntil, PersistentCache } from '@/lib';

describe('PersistentCache', () => {
	it('get and set values in the cache', async () => {
		const cache = new PersistentCache<string, number>();

		await cache.set('car', 10, 50);
		await cache.set('bike', 20, 100);

		assert.strictEqual(await cache.get('car'), 10);
		assert.strictEqual(await cache.get('bike'), 20);
	});

	it('not delete cache entries after TTL expiration', async () => {
		const cache = new PersistentCache<string, number>();

		await cache.set('car', 10, 50);
		await cache.set('bike', 20, 70);

		{
			const entry = (await cache.getEntry('car'))!;
			assert.typeOf(entry, 'object');
			assert.strictEqual(entry.data, 10);
			assert.strictEqual(entry.ttl, 50);
			assert.isAtMost(entry.time, Date.now());
		}
		{
			const entry = (await cache.getEntry('bike'))!;
			assert.typeOf(entry, 'object');
			assert.strictEqual(entry.data, 20);
			assert.strictEqual(entry.ttl, 70);
			assert.isAtMost(entry.time, Date.now());
		}

		await waitUntil(100);

		assert.strictEqual(await cache.get('car'), 10);
		assert.strictEqual(await cache.get('bike'), 20);
	});

	it('delete entries in the cache', async () => {
		const cache = new PersistentCache<string, number>();

		await cache.set('car', 10, 50);
		await cache.set('bike', 20, 100);

		await cache.delete('car');

		assert.strictEqual(await cache.get('car'), undefined);
		assert.strictEqual(await cache.get('bike'), 20);
	});

	it('delete entries matching a key prefix', async () => {
		const TTL = 10_000;
		const cache = new PersistentCache<string, number>();

		await cache.set('/boot', 100, TTL);
		await cache.set('/etc', 100, TTL);
		await cache.set('/etc/sudoers', 100, TTL);
		await cache.set('/etc/passwd', 100, TTL);
		await cache.set('/etc/group', 100, TTL);
		await cache.set('/etc/hostname', 100, TTL);
		await cache.set('/etc/systemd', 100, TTL);
		await cache.set('/etc/systemd/journald.conf', 100, TTL);
		await cache.set('/etc/systemd/networkd.conf', 100, TTL);
		await cache.set('/etc/systemd/resolved.conf', 100, TTL);
		await cache.set('/etc/systemd/user.conf', 100, TTL);
		await cache.set('/home', 100, TTL);
		await cache.set('/home/bob', 100, TTL);
		await cache.set('/home/alice', 100, TTL);

		await cache.deletePrefix('/etc/systemd/resolved.conf');

		assert.strictEqual(await cache.get('/etc/systemd'), 100);
		assert.strictEqual(await cache.get('/etc/systemd/journald.conf'), 100);
		assert.strictEqual(await cache.get('/etc/systemd/networkd.conf'), 100);
		assert.strictEqual(await cache.get('/etc/systemd/resolved.conf'), undefined);
		assert.strictEqual(await cache.get('/etc/systemd/user.conf'), 100);

		await cache.deletePrefix('/etc/systemd');

		assert.strictEqual(await cache.get('/etc/systemd'), undefined);
		assert.strictEqual(await cache.get('/etc/systemd/journald.conf'), undefined);
		assert.strictEqual(await cache.get('/etc/systemd/networkd.conf'), undefined);
		assert.strictEqual(await cache.get('/etc/systemd/resolved.conf'), undefined);
		assert.strictEqual(await cache.get('/etc/systemd/user.conf'), undefined);

		assert.strictEqual(await cache.get('/etc/sudoers'), 100);
		assert.strictEqual(await cache.get('/etc/passwd'), 100);
		assert.strictEqual(await cache.get('/etc/group'), 100);
		assert.strictEqual(await cache.get('/etc/hostname'), 100);

		await cache.deletePrefix('/etc');

		assert.strictEqual(await cache.get('/etc'), undefined);
		assert.strictEqual(await cache.get('/etc/sudoers'), undefined);
		assert.strictEqual(await cache.get('/etc/passwd'), undefined);
		assert.strictEqual(await cache.get('/etc/group'), undefined);
		assert.strictEqual(await cache.get('/etc/hostname'), undefined);

		assert.strictEqual(await cache.get('/boot'), 100);
		assert.strictEqual(await cache.get('/home'), 100);
		assert.strictEqual(await cache.get('/home/bob'), 100);
		assert.strictEqual(await cache.get('/home/alice'), 100);
	});

	it('clear all cache entries', async () => {
		const cache = new PersistentCache<string, number>();

		await cache.set('/home', 100, 10_000);
		await cache.set('/etc', 50, 10_000);
		await cache.set('/boot', 30, 10_000);

		await cache.clear();

		assert.strictEqual(await cache.get('/home'), undefined);
		assert.strictEqual(await cache.get('/etc'), undefined);
		assert.strictEqual(await cache.get('/boot'), undefined);
	});
});
