import { describe, it, assert } from 'vitest';
import {
	isError,
	isIdle,
	isLoading,
	isStale,
	isSuccess,
	type MutationState,
	type QueryState,
} from '@/lib';

describe('Helpers / state functions', () => {
	const states: Array<QueryState<unknown, unknown> | MutationState<unknown, unknown>> = [
		{ status: 'idle', data: null, error: null },
		{ status: 'idle', data: 'placeholder', error: null },
		{ status: 'loading', data: null, error: null },
		{ status: 'loading', data: 'prev', error: null },
		{ status: 'success', data: 999, error: null },
		{ status: 'error', data: null, error: 'invalid' },
		{ status: 'stale', data: 'old', error: null },
	];

	it('idle state', () => {
		for (const state of states) {
			assert.strictEqual(isIdle(state), state.status === 'idle');
		}
	});

	it('loading state', () => {
		for (const state of states) {
			assert.strictEqual(isLoading(state), state.status === 'loading');
		}
	});

	it('success state', () => {
		for (const state of states) {
			assert.strictEqual(isSuccess(state), state.status === 'success');
		}
	});

	it('error state', () => {
		for (const state of states) {
			assert.strictEqual(isError(state), state.status === 'error');
		}
	});

	it('stale state', () => {
		for (const state of states) {
			assert.strictEqual(isStale(state), state.status === 'stale');
		}
	});
});
