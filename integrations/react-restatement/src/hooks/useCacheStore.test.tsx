import { it, describe, assert } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEffect } from 'react';
import { LRUCacheAdapter } from 'restatement';
import { useCacheStore } from '@/lib';
import { testRestatementConfig } from '@/test/Helper.mock';
import { makeRestatementProviderWrapper } from '@/test/Component.mock';

describe('useCacheStore', () => {
	it('get an instance of the cache store', () => {
		const config = testRestatementConfig();

		const { rerender, result, unmount } = renderHook(
			() => {
				const store = useCacheStore();

				useEffect(() => {
					store.get('thekey');
				}, [store]);

				return { store };
			},
			{ wrapper: makeRestatementProviderWrapper(config) }
		);

		assert.instanceOf(result.current.store, LRUCacheAdapter);
		assert.strictEqual(result.current.store, config.cache.store);

		rerender();

		assert.strictEqual(result.current.store, config.cache.store);

		unmount();
	});
});
