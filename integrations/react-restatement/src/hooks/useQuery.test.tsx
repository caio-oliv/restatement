import { describe, it, vi, assert, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { waitUntil } from 'restatement';
import { useQuery } from '@/lib';
import { testQueryFn, type TestKeys, testRestatementConfig } from '@/test/Helper.mock';
import { makeRestatementProviderWrapper } from '@/test/Component.mock';

interface TestCompProps {
	key: TestKeys | null;
	out: string;
}

describe('useQuery', () => {
	it('make query within a component', async () => {
		const config = testRestatementConfig();
		const queryFn = vi.fn(testQueryFn);
		const stateFn = vi.fn();

		const { rerender, result, unmount } = renderHook(
			(id: number) => {
				const renderRef = useRef(0);
				const [state, testQuery] = useQuery<TestKeys, string>({ queryFn, stateFn });

				useEffect(() => {
					testQuery.execute(['ok', 'user', id ?? 1]);
				}, [testQuery, id]);

				renderRef.current += 1;

				return { state, render: renderRef.current };
			},
			{ wrapper: makeRestatementProviderWrapper(config) }
		);

		assert.deepStrictEqual(result.current, {
			render: 1,
			state: { status: 'idle', data: null, error: null },
		});

		await waitUntil(10);

		assert.strictEqual(Array.from(config.provider!.topics()).length, 1);

		assert.deepStrictEqual(result.current, {
			render: 3,
			state: { status: 'success', data: 'result:user:1', error: null },
		});

		expect(queryFn).toHaveBeenNthCalledWith(1, ['ok', 'user', 1], new AbortController().signal);

		expect(stateFn).toBeCalledTimes(2);

		rerender(99);
		await waitUntil(10);

		assert.strictEqual(Array.from(config.provider!.topics()).length, 1);

		assert.deepStrictEqual(result.current, {
			render: 6,
			state: { status: 'success', data: 'result:user:99', error: null },
		});

		expect(queryFn).toHaveBeenNthCalledWith(2, ['ok', 'user', 99], new AbortController().signal);

		expect(stateFn).toBeCalledTimes(4);

		unmount();

		assert.strictEqual(Array.from(config.provider!.topics()).length, 0);
	});

	it('re-render in the middle of a query', async () => {
		const config = testRestatementConfig();
		const queryFn = vi.fn(testQueryFn);
		const stateFn = vi.fn();

		const { rerender, result, unmount } = renderHook(
			({ key, out }: TestCompProps = { key: null, out: '' }) => {
				const renderRef = useRef(0);
				const [state, testQuery] = useQuery<TestKeys, string>({ queryFn, stateFn });

				useEffect(() => {
					if (key) {
						testQuery.execute(key);
					}
				}, [testQuery, key]);

				renderRef.current += 1;

				return { state, render: renderRef.current, out };
			},
			{ wrapper: makeRestatementProviderWrapper(config) }
		);

		assert.deepStrictEqual(result.current, {
			out: '',
			render: 1,
			state: { status: 'idle', data: null, error: null },
		});

		await waitUntil(20);

		assert.strictEqual(Array.from(config.provider!.topics()).length, 0);
		expect(stateFn).toBeCalledTimes(0);

		assert.deepStrictEqual(result.current, {
			out: '',
			render: 1,
			state: { status: 'idle', data: null, error: null },
		});

		// Render the component whilst making a query with 100 ms of delay.
		rerender({ key: ['ok:100', 'user', 10], out: 'render2' });

		assert.deepStrictEqual(result.current, {
			out: 'render2',
			render: 2,
			state: { status: 'idle', data: null, error: null },
		});

		await waitUntil(10);

		expect(queryFn).toHaveBeenNthCalledWith(
			1,
			['ok:100', 'user', 10],
			new AbortController().signal
		);
		expect(stateFn).toBeCalledTimes(1);

		assert.strictEqual(Array.from(config.provider!.topics()).length, 1);

		assert.deepStrictEqual(result.current, {
			out: 'render2',
			render: 3,
			state: { status: 'loading', data: null, error: null },
		});

		// Re-render the component making a new query, whilst the previous one is not resolved.
		rerender({ key: ['ok:100', 'user', 10], out: 'render3' });

		assert.deepStrictEqual(result.current, {
			out: 'render3',
			render: 4,
			state: { status: 'loading', data: null, error: null },
		});

		await waitUntil(100);

		assert.deepStrictEqual(result.current, {
			out: 'render3',
			render: 6,
			state: { status: 'success', data: 'result:user:10', error: null },
		});

		// Query function is executed only once, since the query result was cache and reused.
		expect(queryFn).toBeCalledTimes(1);
		expect(stateFn).toBeCalledTimes(4);

		unmount();

		assert.strictEqual(Array.from(config.provider!.topics()).length, 0);
	});
});
