import { assert, describe, expect, it, vi } from 'vitest';
import {
	BasicRetryPolicy,
	CacheManager,
	defaultFilterFn,
	FixedBackoffTimer,
	Mutation,
	NO_RETRY_POLICY,
	updateMutationContextFn,
	waitUntil,
	type MutationContextMutFns,
	type MutationState,
} from '@/lib';
import { mockMutationHandler, testTransformer, type TestKeys } from '@/test/TestHelper.mock';
import { makeCache } from '@/integration/LRUCache.mock';

describe('Mutation function swap', () => {
	it('swap all context functions', () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const mutation = Mutation.create({ cache, mutationFn, retryPolicy: NO_RETRY_POLICY });

		const functions: MutationContextMutFns<TestKeys, string, unknown> = {
			mutationFn: vi.fn(),
			retryHandleFn: vi.fn(),
			stateFn: vi.fn(),
			dataFn: vi.fn(),
			errorFn: vi.fn(),
			filterFn: vi.fn(),
		};

		updateMutationContextFn(mutation.ctx, functions);

		assert.strictEqual(mutation.ctx.mutationFn, functions.mutationFn);
		assert.strictEqual(mutation.ctx.retryHandleFn, functions.retryHandleFn);
		assert.strictEqual(mutation.ctx.stateFn, functions.stateFn);
		assert.strictEqual(mutation.ctx.dataFn, functions.dataFn);
		assert.strictEqual(mutation.ctx.errorFn, functions.errorFn);
		assert.strictEqual(mutation.ctx.filterFn, functions.filterFn);
	});
});

describe('Mutation function swap / mutationFn', () => {
	it('use same mutationFn on retries while swaped mid-air', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const secondMutationFn = vi.fn(testTransformer);
		const retryPolicy = new BasicRetryPolicy(3, new FixedBackoffTimer(50));
		const mutation = Mutation.create({ cache, mutationFn, retryPolicy });

		const mutationPromise = mutation.execute(['error']);

		mutation.ctx.mutationFn = secondMutationFn;

		const result = await mutationPromise;

		assert.deepStrictEqual(result, {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});
		assert.deepStrictEqual(mutation.getState(), {
			data: null,
			error: new Error('invalid_key'),
			status: 'error',
		});

		expect(mutationFn).toHaveBeenCalledTimes(4);
		expect(secondMutationFn).toHaveBeenCalledTimes(0);
	});

	it('use new mutationFn after the previous mutation execution is finished', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const secondMutationFn = vi.fn(testTransformer);
		const retryPolicy = new BasicRetryPolicy(3, new FixedBackoffTimer(80));
		const mutation = Mutation.create({ cache, mutationFn, retryPolicy });

		const mutationPromise = mutation.execute(['error_input']);

		mutation.ctx.mutationFn = secondMutationFn;

		{
			const result = await mutationPromise;

			assert.deepStrictEqual(result, {
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			});
			assert.deepStrictEqual(mutation.getState(), {
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			});

			expect(mutationFn).toHaveBeenCalledTimes(4);
			expect(secondMutationFn).toHaveBeenCalledTimes(0);
		}

		{
			const result = await mutation.execute(['invalid_again']);

			assert.deepStrictEqual(result, {
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			});
			assert.deepStrictEqual(mutation.getState(), {
				data: null,
				error: new Error('invalid_key'),
				status: 'error',
			});

			expect(mutationFn).toHaveBeenCalledTimes(4);
			expect(secondMutationFn).toHaveBeenCalledTimes(4);
		}
	});

	it('use multiple mutationFn while executing mutations with different keys', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const secondMutationFn = vi.fn(testTransformer);
		const retryPolicy = new BasicRetryPolicy(3, new FixedBackoffTimer(50));
		const mutation = Mutation.create({ cache, mutationFn, retryPolicy });

		mutationFn.mockRejectedValueOnce(new Error('manual_error_main_1'));
		mutationFn.mockRejectedValueOnce(new Error('manual_error_main_2'));
		mutationFn.mockRejectedValueOnce(new Error('manual_error_main_3'));

		secondMutationFn.mockRejectedValueOnce(new Error('manual_error_second_1'));
		secondMutationFn.mockRejectedValueOnce(new Error('manual_error_second_2'));

		const mainMutationPromise = mutation.execute(['key#main_value']);

		mutation.ctx.mutationFn = secondMutationFn;
		const secondMutationPromise = mutation.execute(['key#second_value']);

		const [mainResult, secondResult] = await Promise.all([
			mainMutationPromise,
			secondMutationPromise,
		]);

		assert.deepStrictEqual(mainResult, {
			data: 'data#main_value',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(secondResult, {
			data: 'data#second_value',
			error: null,
			status: 'success',
		});

		assert.deepStrictEqual(mutation.getState(), {
			data: 'data#main_value',
			error: null,
			status: 'success',
		});

		expect(mutationFn).toHaveBeenCalledTimes(4);
		expect(secondMutationFn).toHaveBeenCalledTimes(3);
	});

	it('use multiple mutationFn while executing mutations in a race condition', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mainMutationFn = vi.fn(testTransformer);
		const secondMutationFn = vi.fn(testTransformer);
		const retryPolicy = new BasicRetryPolicy(3, new FixedBackoffTimer(50));
		const mutation = Mutation.create({ cache, mutationFn: mainMutationFn, retryPolicy });

		mainMutationFn.mockRejectedValueOnce(new Error('manual_error_main_1'));
		mainMutationFn.mockRejectedValueOnce(new Error('manual_error_main_2'));
		mainMutationFn.mockRejectedValueOnce(new Error('manual_error_main_3'));
		mainMutationFn.mockResolvedValueOnce('main');

		secondMutationFn.mockRejectedValueOnce(new Error('manual_error_second_1'));
		secondMutationFn.mockRejectedValueOnce(new Error('manual_error_second_2'));
		secondMutationFn.mockRejectedValueOnce(new Error('manual_error_second_3'));
		secondMutationFn.mockResolvedValueOnce('second');

		const mainPromise = mutation.execute(['key#race']);

		mutation.ctx.mutationFn = secondMutationFn;
		const secondPromise = mutation.execute(['key#race']);

		const [mainResult, secondResult] = await Promise.all([mainPromise, secondPromise]);

		assert.deepStrictEqual(mainResult, {
			data: 'main',
			error: null,
			status: 'success',
		});
		assert.deepStrictEqual(secondResult, {
			data: 'second',
			error: null,
			status: 'success',
		});

		// There is a race condition between main and second mutation, so the resulting state is undefined
		assert.includeMembers(['main', 'second'], [mutation.getState().data]);

		expect(mainMutationFn).toHaveBeenCalledTimes(4);
		expect(secondMutationFn).toHaveBeenCalledTimes(4);
	});
});

describe('Mutation function swap / filterFn', () => {
	it('swap filterFn mid-air / filter loading mutation', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const handler = mockMutationHandler<string>();
		const mutation = Mutation.create({
			cache,
			mutationFn,
			retryPolicy: NO_RETRY_POLICY,
			...handler,
		});

		{
			mutation.ctx.filterFn = ({ next }) => next.status !== 'loading';

			const result = await mutation.execute(['key#true']);

			assert.deepStrictEqual(result, { status: 'success', data: 'data#true', error: null });

			expect(handler.stateFn).toHaveBeenCalledTimes(1);
			expect(handler.dataFn).toHaveBeenCalledTimes(1);
			expect(handler.errorFn).toHaveBeenCalledTimes(0);

			expect(mutationFn).toHaveBeenCalledTimes(1);
		}

		mutation.reset();

		{
			mutation.ctx.filterFn = defaultFilterFn;

			const result = await mutation.execute(['key#false']);

			assert.deepStrictEqual(result, { status: 'success', data: 'data#false', error: null });

			expect(handler.stateFn).toHaveBeenCalledTimes(3);
			expect(handler.dataFn).toHaveBeenCalledTimes(2);
			expect(handler.errorFn).toHaveBeenCalledTimes(0);

			expect(mutationFn).toHaveBeenCalledTimes(2);
		}
	});

	it('swap filterFn mid-air / filter error mutation', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const handler = mockMutationHandler<string>();
		const mutation = Mutation.create({
			cache,
			mutationFn,
			retryPolicy: NO_RETRY_POLICY,
			...handler,
		});

		mutationFn.mockRejectedValueOnce(new Error('manual_error_1'));
		mutationFn.mockRejectedValueOnce(new Error('manual_error_2'));

		{
			const result = await mutation.execute(['key#true']);

			expect(handler.stateFn).toHaveBeenNthCalledWith(
				2,
				{
					status: 'error',
					data: null,
					error: new Error('manual_error_1'),
				} satisfies MutationState<string, Error>,
				mutation.cache
			);

			assert.deepStrictEqual(result, {
				status: 'error',
				data: null,
				error: new Error('manual_error_1'),
			});
		}
		{
			mutation.ctx.filterFn = ({ next }) => next.status !== 'error';

			const result = await mutation.execute(['key#true']);

			// error state supressed.
			expect(handler.stateFn).toHaveBeenNthCalledWith(
				3,
				{
					status: 'loading',
					data: null,
					error: null,
				} satisfies MutationState<string, Error>,
				mutation.cache
			);

			assert.deepStrictEqual(result, {
				status: 'error',
				data: null,
				error: new Error('manual_error_2'),
			});
		}
	});
});

describe('Mutation function swap / retryHandleFn', () => {
	it('swap retryHandleFn after retrying the mutation', async () => {
		const store = makeCache<string>();
		const cache = new CacheManager({ store });
		const mutationFn = vi.fn(testTransformer);
		const handler = mockMutationHandler<string>();
		const retryPolicy = new BasicRetryPolicy(3, new FixedBackoffTimer(50));
		const retryHandleFn = vi.fn();
		const mutation = Mutation.create({
			cache,
			mutationFn,
			retryPolicy,
			retryHandleFn,
			...handler,
		});

		const otherRetryHandleFn = vi.fn();

		{
			mutationFn.mockRejectedValueOnce(new Error('manual_error_1'));
			mutationFn.mockRejectedValueOnce(new Error('manual_error_2'));
			mutationFn.mockRejectedValueOnce(new Error('manual_error_3'));

			const mutationPromise = mutation.execute(['key#ok?']);

			await waitUntil(100);

			expect(retryHandleFn).toBeCalledTimes(1);
			expect(otherRetryHandleFn).toBeCalledTimes(0);

			mutation.ctx.retryHandleFn = otherRetryHandleFn;

			await waitUntil(50);

			expect(retryHandleFn).toBeCalledTimes(2);
			expect(otherRetryHandleFn).toBeCalledTimes(0);

			const result = await mutationPromise;

			expect(retryHandleFn).toBeCalledTimes(3);
			expect(otherRetryHandleFn).toBeCalledTimes(0);

			assert.deepStrictEqual(result, {
				data: 'data#ok?',
				error: null,
				status: 'success',
			});
		}

		retryHandleFn.mockRestore();

		{
			mutationFn.mockRejectedValueOnce(new Error('manual_error_1'));
			mutationFn.mockRejectedValueOnce(new Error('manual_error_2'));

			const mutationPromise = mutation.execute(['key#yes']);

			await waitUntil(100);

			expect(retryHandleFn).toBeCalledTimes(0);
			expect(otherRetryHandleFn).toBeCalledTimes(1);

			await waitUntil(50);

			expect(retryHandleFn).toBeCalledTimes(0);
			expect(otherRetryHandleFn).toBeCalledTimes(2);

			const result = await mutationPromise;

			expect(retryHandleFn).toBeCalledTimes(0);
			expect(otherRetryHandleFn).toBeCalledTimes(2);

			assert.deepStrictEqual(result, {
				data: 'data#yes',
				error: null,
				status: 'success',
			});
		}
	});
});
