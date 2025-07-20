import { it, describe, assert } from 'vitest';
import { type CacheEntry, cacheEntryDuration, isCacheEntryFresh } from '@/lib';

describe('CacheHelper', () => {
	it('get cache entry duration', () => {
		const entry: CacheEntry<string> = {
			data: 'value',
			ttl: 100,
			remain_ttl: 23,
		};

		assert.strictEqual(cacheEntryDuration(entry), 77);
	});

	it('assert that cache entry is fresh', () => {
		const entry: CacheEntry<string> = {
			data: 'value',
			ttl: 100,
			remain_ttl: 23,
		};

		assert.strictEqual(isCacheEntryFresh(entry, 80), true);
	});

	it('assert that cache entry is not fresh', () => {
		const entry: CacheEntry<string> = {
			data: 'value',
			ttl: 100,
			remain_ttl: 79,
		};

		assert.strictEqual(isCacheEntryFresh(entry, 20), false);
	});
});
