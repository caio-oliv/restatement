import { assert, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { waitUntil } from 'restatement';
import { renderHook } from '@testing-library/react';
import { useMutation } from '@/lib';
import { testQueryFn, testRestatementConfig, type TestKeys } from '@/test/Helper.mock';
import { makeRestatementProviderWrapper } from '@/test/Component.mock';

describe('useMutation', () => {
	it('execute mutation within a component', async () => {
		const config = testRestatementConfig();
		const mutationFn = vi.fn(testQueryFn);
		const stateFn = vi.fn();

		const { rerender, result, unmount } = renderHook(
			() => {
				const renderRef = useRef(0);
				const mutation = useMutation({ mutationFn, stateFn });

				async function handleMutation(input: TestKeys) {
					const result = await mutation.execute(input);
					return result;
				}

				renderRef.current += 1;

				return { render: renderRef.current, execMutation: handleMutation };
			},
			{ wrapper: makeRestatementProviderWrapper(config) }
		);

		assert.deepStrictEqual(result.current.render, 1);

		await waitUntil(10);

		expect(stateFn).toBeCalledTimes(0);
		assert.deepStrictEqual(result.current.render, 1);

		{
			const statePromise = result.current.execMutation(['ok:100', 'user', 'update_command']);

			expect(stateFn).toHaveBeenCalledTimes(1);
			expect(mutationFn).toHaveBeenCalledTimes(1);

			assert.deepStrictEqual(result.current.render, 1);

			await waitUntil(100);

			expect(stateFn).toHaveBeenCalledTimes(2);
			expect(mutationFn).toHaveBeenCalledTimes(1);

			assert.deepStrictEqual(result.current.render, 1);

			const state = await statePromise;
			assert.deepStrictEqual(state, {
				data: 'result:user:update_command',
				error: null,
				status: 'success',
			});
		}

		{
			const statePromise = result.current.execMutation(['ok:100', 'user', 'delete_command']);

			expect(stateFn).toHaveBeenCalledTimes(3);
			expect(mutationFn).toHaveBeenCalledTimes(2);

			assert.deepStrictEqual(result.current.render, 1);

			rerender();

			await waitUntil(30);

			expect(stateFn).toHaveBeenCalledTimes(3);
			expect(mutationFn).toHaveBeenCalledTimes(2);

			assert.deepStrictEqual(result.current.render, 2);

			await waitUntil(100);

			expect(stateFn).toHaveBeenCalledTimes(4);
			expect(mutationFn).toHaveBeenCalledTimes(2);

			assert.deepStrictEqual(result.current.render, 2);

			const state = await statePromise;
			assert.deepStrictEqual(state, {
				data: 'result:user:delete_command',
				error: null,
				status: 'success',
			});
		}

		unmount();
	});
});
