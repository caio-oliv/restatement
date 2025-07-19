import type { QueryState } from '@/Type';

/**
 * @description Returns `true` if the query state is `idle`, `false` otherwise.
 * @param state query state
 * @returns boolean
 */
export function isIdle<T, E>(state: QueryState<T, E>): boolean {
	return state.status === 'idle';
}

/**
 * @description Returns `true` if the query state is `success`, `false` otherwise.
 * @param state query state
 * @returns boolean
 */
export function isSuccess<T, E>(state: QueryState<T, E>): boolean {
	return state.status === 'success';
}

/**
 * @description Returns `true` if the query state is `error`, `false` otherwise.
 * @param state query state
 * @returns boolean
 */
export function isError<T, E>(state: QueryState<T, E>): boolean {
	return state.status === 'error';
}

/**
 * @description Returns `true` if the query state is `loading`, `false` otherwise.
 * @param state query state
 * @returns boolean
 */
export function isLoading<T, E>(state: QueryState<T, E>): boolean {
	return state.status === 'loading';
}

/**
 * @description Returns `true` if the query state is `stale`, `false` otherwise.
 * @param state query state
 * @returns boolean
 */
export function isStale<T, E>(state: QueryState<T, E>): boolean {
	return state.status === 'stale';
}
