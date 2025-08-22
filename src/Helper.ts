import type { MutationState, QueryState } from '@/core/Type';

/**
 * Returns `true` if the state is `idle`, `false` otherwise.
 * @param state State
 * @returns Boolean
 */
export function isIdle<T, E>(state: QueryState<T, E> | MutationState<T, E>): boolean {
	return state.status === 'idle';
}

/**
 * Returns `true` if the state is `success`, `false` otherwise.
 * @param state State
 * @returns Boolean
 */
export function isSuccess<T, E>(state: QueryState<T, E> | MutationState<T, E>): boolean {
	return state.status === 'success';
}

/**
 * Returns `true` if the state is `error`, `false` otherwise.
 * @param state State
 * @returns Boolean
 */
export function isError<T, E>(state: QueryState<T, E> | MutationState<T, E>): boolean {
	return state.status === 'error';
}

/**
 * Returns `true` if the state is `loading`, `false` otherwise.
 * @param state State
 * @returns Boolean
 */
export function isLoading<T, E>(state: QueryState<T, E> | MutationState<T, E>): boolean {
	return state.status === 'loading';
}

/**
 * Returns `true` if the state is `stale`, `false` otherwise.
 * @param state State
 * @returns Boolean
 */
export function isStale<T, E>(state: QueryState<T, E>): boolean {
	return state.status === 'stale';
}
