import { assert, describe, it } from 'vitest';
import { waitUntil, MutationControl, JitterExponentialBackoffTimer } from '@/lib';
import { fakeMutationControlHandler } from '@/controller/Control.mock';

describe('RemoteStateMutation', () => {
	const sleepTime = 100;
	const retryTimer = new JitterExponentialBackoffTimer(10, 75);

	it('run mutation function in background', async () => {
		let error = false;
		const mutationCall: Array<{ id: string }> = [];
		const { handler, counter } = fakeMutationControlHandler();
		const mutationApi = new MutationControl<{ id: string }, string, Error>({
			mutationFn: async input => {
				if (error) {
					throw new Error('mutation failed');
				}
				await waitUntil(Math.ceil(sleepTime * 0.5));
				mutationCall.push(input);
				return input.id;
			},
			handler,
			retry: 0,
		});

		assert.deepStrictEqual(counter, { dataCalled: 0, errorCalled: 0, stateCalled: 0 });
		assert.deepStrictEqual(mutationCall, []);
		assert.deepStrictEqual(mutationApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		mutationApi.execute({ id: '12' });

		assert.deepStrictEqual(counter, { dataCalled: 0, errorCalled: 0, stateCalled: 1 });
		assert.deepStrictEqual(mutationCall, []);
		assert.deepStrictEqual(mutationApi.getState(), {
			data: null,
			error: null,
			status: 'loading',
		});

		await waitUntil(sleepTime);

		assert.deepStrictEqual(counter, { dataCalled: 1, errorCalled: 0, stateCalled: 2 });
		assert.deepStrictEqual(mutationCall, [{ id: '12' }]);
		assert.deepStrictEqual(mutationApi.getState(), {
			data: '12',
			error: null,
			status: 'success',
		});

		error = true;
		mutationApi.execute({ id: '34' });

		assert.deepStrictEqual(counter, { dataCalled: 1, errorCalled: 0, stateCalled: 3 });
		assert.deepStrictEqual(mutationCall, [{ id: '12' }]);
		assert.deepStrictEqual(mutationApi.getState(), {
			data: '12',
			error: null,
			status: 'loading',
		});

		await waitUntil(sleepTime);

		assert.deepStrictEqual(counter, { dataCalled: 1, errorCalled: 1, stateCalled: 4 });
		assert.deepStrictEqual(mutationCall, [{ id: '12' }]);
		assert.deepStrictEqual(mutationApi.getState(), {
			data: null,
			error: new Error('mutation failed'),
			status: 'error',
		});
	});

	it('run mutation async function', async () => {
		let error = false;
		const mutationCall: Array<{ id: string }> = [];
		const { handler, counter } = fakeMutationControlHandler();
		const mutationApi = new MutationControl<{ id: string }, string, Error>({
			mutationFn: async input => {
				if (error) {
					throw new Error('mutation failed');
				}
				await waitUntil(Math.ceil(sleepTime * 0.5));
				mutationCall.push(input);
				return input.id;
			},
			handler,
			retry: 0,
		});

		assert.deepStrictEqual(counter, { dataCalled: 0, errorCalled: 0, stateCalled: 0 });
		assert.deepStrictEqual(mutationCall, []);
		assert.deepStrictEqual(mutationApi.getState(), {
			data: null,
			error: null,
			status: 'idle',
		});

		const result = await mutationApi.executeAsync({ id: '12' });

		assert.deepStrictEqual(result, '12');
		assert.deepStrictEqual(counter, { dataCalled: 1, errorCalled: 0, stateCalled: 2 });
		assert.deepStrictEqual(mutationCall, [{ id: '12' }]);
		assert.deepStrictEqual(mutationApi.getState(), {
			data: '12',
			error: null,
			status: 'success',
		});

		error = true;
		await mutationApi.executeAsync({ id: '12' });

		assert.deepStrictEqual(counter, { dataCalled: 1, errorCalled: 1, stateCalled: 4 });
		assert.deepStrictEqual(mutationCall, [{ id: '12' }]);
		assert.deepStrictEqual(mutationApi.getState(), {
			data: null,
			error: new Error('mutation failed'),
			status: 'error',
		});
	});

	it('retry mutation on error', async () => {
		let mutationCalled = 0;
		const { handler, counter } = fakeMutationControlHandler();
		const mutationApi = new MutationControl<string, string, Error>({
			mutationFn: async input => {
				mutationCalled += 1;
				if (mutationCalled % 3 !== 0) {
					throw new Error('only the third call');
				}
				return input + '#' + mutationCalled;
			},
			handler,
			retry: 2,
			retryDelay: retryTimer.delay,
		});

		mutationApi.execute('first');
		await waitUntil(sleepTime * 3);

		assert.deepStrictEqual(counter, { dataCalled: 1, errorCalled: 0, stateCalled: 2 });
		assert.deepStrictEqual(mutationCalled, 3);
		assert.deepStrictEqual(mutationApi.getState(), {
			data: 'first#3',
			error: null,
			status: 'success',
		});
	});

	it('retry async mutation on error', async () => {
		let mutationCalled = 0;
		const { handler, counter } = fakeMutationControlHandler();
		const mutationApi = new MutationControl<string, string, Error>({
			mutationFn: async input => {
				mutationCalled += 1;
				if (mutationCalled % 3 !== 0) {
					throw new Error('only the third call');
				}
				return input + '#' + mutationCalled;
			},
			handler,
			retry: 2,
			retryDelay: retryTimer.delay,
		});

		await mutationApi.executeAsync('first');

		assert.deepStrictEqual(counter, { dataCalled: 1, errorCalled: 0, stateCalled: 2 });
		assert.deepStrictEqual(mutationCalled, 3);
		assert.deepStrictEqual(mutationApi.getState(), {
			data: 'first#3',
			error: null,
			status: 'success',
		});
	});
});
