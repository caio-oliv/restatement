import { JitterExponentialBackoffTimer } from '@/TimerModule';
import type {
	MutationState,
	QueryState,
	MutationControlHandler,
	QueryControlHandler,
} from '@/Type';

export const DEFAULT_RETRY = 3;
export const DEFAULT_FRESH_TIME = 30 * 1000; // 30 seconds
export const DEFAULT_STALE_TIME = 3 * 60 * 1000; // 3 minutes
export const DEFAULT_RETRY_DELAY = new JitterExponentialBackoffTimer(1000, 30 * 1000);

/**
 * @description Default key hash function
 * @param key key data
 * @returns key string hash
 */
export function defaultKeyHashFn<T>(key: T): string {
	return JSON.stringify(key);
}

/**
 * @description Default function to verify if the cache of a previous successful result
 * is gonna be kept when the operation results in an error.
 * @param _ operation error
 * @returns true if the cache is gonna be kept
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function defaultKeepCacheOnError<T = unknown>(_: T): boolean {
	return false;
}

/**
 * @description Function that produces the default query state.
 * @returns default query state
 */
export function defaultQueryState<T, E>(): QueryState<T, E> {
	return {
		data: null,
		error: null,
		status: 'idle',
	};
}

/**
 * @description Function that produces the default query handlers.
 * @returns default query handlers
 */
export function defaultQueryHandler<T, E>(): QueryControlHandler<T, E> {
	return {
		dataFn: undefined,
		errorFn: undefined,
		stateFn: undefined,
	};
}

/**
 * @description Function that produces the default mutation state.
 * @returns default mutation state
 */
export function defaultMutationState<T, E>(): MutationState<T, E> {
	return {
		data: null,
		error: null,
		status: 'idle',
	};
}

/**
 * @description Function that produces the default mutation handlers.
 * @returns default mutation handlers
 */
export function defaultMutationHandler<T, E>(): MutationControlHandler<T, E> {
	return {
		stateFn: undefined,
		dataFn: undefined,
		errorFn: undefined,
	};
}
