import { it, describe, assert } from 'vitest';
import { type CacheEntry, cacheEntryDuration, cacheEntryRemainTTL, isCacheEntryFresh } from '@/lib';

describe('Cache helper', () => {
	it('get cache entry duration', () => {
		const entry: CacheEntry<string> = {
			data: 'value',
			ttl: 100,
			time: Date.now() - 23,
		};

		assert.isAtMost(cacheEntryDuration(entry), 77);
	});

	it('assert that cache entry is fresh', () => {
		const entry: CacheEntry<string> = {
			data: 'value',
			ttl: 100,
			time: Date.now() - 23,
		};
		const fresh = 80;

		assert.strictEqual(isCacheEntryFresh(entry, fresh), true);
	});

	it('assert that cache entry is not fresh', () => {
		const entry: CacheEntry<string> = {
			data: 'value',
			ttl: 100,
			time: Date.now() - 81,
		};
		const fresh = 20;

		assert.strictEqual(isCacheEntryFresh(entry, fresh), false);
	});

	it('assert the cache entry remain TTL', () => {
		const entry: CacheEntry<string> = {
			data: 'value',
			ttl: 150,
			time: Date.now() + 10,
		};

		assert.isAtLeast(cacheEntryRemainTTL(entry), 140);
	});

	it('assert the cache entry remain TTL clamped at 0', () => {
		const entry: CacheEntry<string> = {
			data: 'value',
			ttl: 50,
			time: Date.now() + 55,
		};

		assert.isAtLeast(cacheEntryRemainTTL(entry), 0);
	});
});
