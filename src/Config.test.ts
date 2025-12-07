import { assert, describe, it, vi } from 'vitest';
import { CacheManager, makeMutationInput, makeQueryInput, PubSub, restatementConfig } from '@/lib';
import { makeCache } from '@/integration/LRUCache.mock';

describe('Config / query input', () => {
	it('initialize the config with a null provider', () => {
		const cache = makeCache();
		const config = restatementConfig<unknown, unknown>(cache, {
			provider: null,
		});

		assert.strictEqual(config.provider, null);
	});

	it('initialize the config with the default provider', () => {
		const cache = makeCache();
		const config = restatementConfig<unknown, unknown>(cache);

		assert.instanceOf(config.provider, PubSub);
	});

	it('initialize the query input', () => {
		const cache = makeCache();
		const config = restatementConfig<unknown, unknown>(cache);
		const queryFn = vi.fn();

		const input = makeQueryInput(config, { queryFn });

		assert.strictEqual(input.placeholder, null);
		assert.strictEqual(input.store, config.cache.store);
		assert.strictEqual(input.queryFn, queryFn);
		assert.strictEqual(input.keyHashFn, config.keyHashFn);
		assert.strictEqual(input.retryPolicy, config.query.retry.policy);
		assert.strictEqual(input.retryHandleFn, config.query.retry.handleFn);
		assert.strictEqual(input.keepCacheOnErrorFn, config.keepCacheOnErrorFn);
		assert.strictEqual(input.extractTTLFn, config.query.extractTTLFn);
		assert.strictEqual(input.ttl, config.cache.ttl);
		assert.strictEqual(input.fresh, config.cache.fresh);
		assert.strictEqual(input.stateFn, null);
		assert.strictEqual(input.dataFn, null);
		assert.strictEqual(input.errorFn, null);
		assert.strictEqual(input.filterFn, config.query.filterFn);
		assert.strictEqual(input.provider, config.provider);
	});
});

describe('Config / mutation input', () => {
	it('initialize the mutation input', () => {
		const cache = makeCache();
		const config = restatementConfig<unknown, unknown>(cache);
		const mutationFn = vi.fn();

		const input = makeMutationInput(config, { mutationFn });

		assert.strictEqual(input.placeholder, null);
		assert.instanceOf(input.cache, CacheManager);
		assert.strictEqual(input.mutationFn, mutationFn);
		assert.strictEqual(input.retryPolicy, config.mutation.retry.policy);
		assert.strictEqual(input.retryHandleFn, config.mutation.retry.handleFn);
		assert.strictEqual(input.stateFn, null);
		assert.strictEqual(input.dataFn, null);
		assert.strictEqual(input.errorFn, null);
		assert.strictEqual(input.filterFn, config.mutation.filterFn);
	});
});
