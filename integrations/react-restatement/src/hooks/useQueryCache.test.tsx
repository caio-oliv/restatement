import { it, describe, assert } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { useQueryCache, CacheManager } from '@/lib';
import { testRestatementConfig } from '@/test/Helper.mock';
import { makeRestatementProviderWrapper } from '@/test/Component.mock';

describe('useQueryCache', () => {
	it('get an instance of the query cache', () => {
		const config = testRestatementConfig();

		const { rerender, result, unmount } = renderHook(
			() => {
				const cache = useQueryCache();

				useEffect(() => {
					cache.get(['ok', 'yes']);
				}, [cache]);

				return { cache };
			},
			{ wrapper: makeRestatementProviderWrapper(config) }
		);

		assert.instanceOf(result.current.cache, CacheManager);

		rerender();

		assert.instanceOf(result.current.cache, CacheManager);

		unmount();
	});

	it('use the same instance of the CacheManager', () => {
		const config = testRestatementConfig();

		const { rerender, result, unmount } = renderHook(
			() => {
				const renderRef = useRef(0);
				const cache = useQueryCache();

				useEffect(() => {
					cache.get(['ok', 'yes']);
				}, [cache]);

				renderRef.current += 1;

				return { cache, render: renderRef.current };
			},
			{ wrapper: makeRestatementProviderWrapper(config) }
		);

		assert.instanceOf(result.current.cache, CacheManager);
		assert.strictEqual(result.current.render, 1);

		const firstInstance = result.current.cache;

		rerender();

		assert.strictEqual(result.current.cache, firstInstance);
		assert.strictEqual(result.current.render, 2);

		unmount();
	});
});
