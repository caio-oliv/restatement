import { it, describe, assert } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { PubSub } from 'restatement';
import { useQueryProvider } from '@/lib';
import { testRestatementConfig } from '@/test/Helper.mock';
import { makeRestatementProviderWrapper } from '@/test/Component.mock';

describe('useQueryProvider', () => {
	it('get an instance of the query provider', () => {
		const config = testRestatementConfig();

		const { rerender, result, unmount } = renderHook(
			() => {
				const provider = useQueryProvider()!;

				useEffect(() => {
					provider.publish('topic#1', {
						metadata: { source: 'mutation', origin: 'provider', cache: 'none' },
						state: { status: 'idle', data: null, error: null },
					});
				}, [provider]);

				return { provider };
			},
			{ wrapper: makeRestatementProviderWrapper(config) }
		);

		assert.instanceOf(result.current.provider, PubSub);

		rerender();

		assert.instanceOf(result.current.provider, PubSub);

		unmount();
	});

	it('use the same instance from the config context', () => {
		const config = testRestatementConfig();

		const { rerender, result, unmount } = renderHook(
			() => {
				const renderRef = useRef(0);
				const provider = useQueryProvider()!;

				useEffect(() => {
					provider.publish('topic#2', {
						metadata: { source: 'mutation', origin: 'provider', cache: 'none' },
						state: { status: 'idle', data: null, error: null },
					});
				}, [provider]);

				renderRef.current += 1;

				return { provider, render: renderRef.current };
			},
			{ wrapper: makeRestatementProviderWrapper(config) }
		);

		assert.strictEqual(result.current.provider, config.provider);
		assert.strictEqual(result.current.render, 1);

		rerender();

		assert.strictEqual(result.current.provider, config.provider);
		assert.strictEqual(result.current.render, 2);

		unmount();
	});
});
