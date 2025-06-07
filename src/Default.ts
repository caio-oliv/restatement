import { JitterExponentialBackoffTimer } from '@/TimerModule';
import { jsonStringifyObjectSorter } from '@/Internal';

export const DEFAULT_RETRY = 5;
export const DEFAULT_FRESH_DURATION = 30 * 1000; // 30 seconds
export const DEFAULT_TTL_DURATION = 3 * 60 * 1000; // 3 minutes
export const DEFAULT_RETRY_DELAY = new JitterExponentialBackoffTimer(1000, 30 * 1000);

/**
 * @description Default key hash function
 * @param key key data
 * @returns key string hash
 */
export function defaultKeyHashFn<T extends ReadonlyArray<unknown>>(key: T): string {
	let hash = '';
	for (const item of key) {
		hash += JSON.stringify(item, jsonStringifyObjectSorter);
	}
	return hash;
}

/**
 * Default implementation of the query and mutation state filter function.
 * Allows any provided state.
 * @returns `true`
 */
export function defaultStateFilterFn(): boolean {
	return true;
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
