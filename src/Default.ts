import type { Millisecond } from '@/core/Type';
import { type BackoffTimer, JitterExponentialBackoffTimer } from '@/core/BackoffTimer';
import { BasicRetryPolicy, type RetryPolicy } from '@/core/RetryPolicy';
import { jsonStringifyObjectSorter } from '@/Internal';

/**
 * @summary Default retry limit
 * @default 3
 */
export const DEFAULT_RETRY_LIMIT = 3;

/**
 * @summary Default fresh duration (30 minutes)
 * @description Default fresh duration of a cache entry
 * @default 30_000
 */
export const DEFAULT_FRESH_DURATION: Millisecond = 30 * 1000;

/**
 * @summary Default TTL duration (3 minutes)
 * @description Default TTL duration of a cache entry
 * @default 180_000
 */
export const DEFAULT_TTL_DURATION: Millisecond = 3 * 60 * 1000;

export const DEFAULT_TIMER: BackoffTimer = new JitterExponentialBackoffTimer(1000, 30 * 1000);

export const DEFAULT_RETRY_POLICY: RetryPolicy = new BasicRetryPolicy(
	DEFAULT_RETRY_LIMIT,
	DEFAULT_TIMER
);

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
export function defaultFilterFn(): boolean {
	return true;
}

/**
 * @description Default function to verify if the cache of a previous successful result
 * is gonna be kept when the operation results in an error.
 * @param _ operation error
 * @returns true if the cache is gonna be kept
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function defaultKeepCacheOnErrorFn<T = unknown>(_: T): boolean {
	return false;
}

/**
 * @summary Default extract TTL function
 * @description Returns the fallback TTL.
 * @param _ data
 * @param fallbackTTL fallback TTL
 * @returns TTL
 */
export function defaultExtractTTLFn<T>(_: T, fallbackTTL: Millisecond): Millisecond {
	return fallbackTTL;
}
