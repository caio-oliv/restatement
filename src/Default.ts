import type { GenericQueryKey, Millisecond } from '@/core/Type';
import { type BackoffTimer, JitterExponentialBackoffTimer } from '@/core/BackoffTimer';
import { BasicRetryPolicy, type RetryPolicy } from '@/core/RetryPolicy';
import { jsonStringifyObjectSorter } from '@/Internal';

/**
 * Default retry limit
 * @default 3
 */
export const DEFAULT_RETRY_LIMIT = 3;

/**
 * Default fresh duration (30 minutes)
 * @description Default fresh duration of a cache entry
 * @default 30_000
 */
export const DEFAULT_FRESH_DURATION: Millisecond = 30 * 1000;

/**
 * Default TTL duration (3 minutes)
 * @description Default TTL duration of a cache entry
 * @default 180_000
 */
export const DEFAULT_TTL_DURATION: Millisecond = 3 * 60 * 1000;

/**
 * Default backoff timer
 * @description Backoff timer with exponential backoff and jitter.
 *
 * Base time of 1 second and limit of 30 seconds.
 */
export const DEFAULT_TIMER: BackoffTimer = new JitterExponentialBackoffTimer(1000, 30 * 1000);

/**
 * Default retry policy
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = new BasicRetryPolicy(
	DEFAULT_RETRY_LIMIT,
	DEFAULT_TIMER
);

/**
 * Default key hash function
 * @param key Key data
 * @returns Key string hash
 */
export function defaultKeyHashFn<T extends GenericQueryKey>(key: T): string {
	let hash = '';
	for (const item of key) {
		hash += JSON.stringify(item, jsonStringifyObjectSorter);
	}
	return hash;
}

/**
 * Default implementation of state filter function
 * @description Allows any provided state.
 * @returns `true`
 */
export function defaultFilterFn(): boolean {
	return true;
}

/**
 * Default implementation of keep cache on error function
 * @description Remove any cache on error.
 * @returns `false`
 */
export function defaultKeepCacheOnErrorFn(): boolean {
	return false;
}

/**
 * Default extract TTL function
 * @description Returns the fallback TTL.
 * @param _ Data
 * @param fallbackTTL Fallback TTL
 * @returns TTL
 */
export function defaultExtractTTLFn<T>(_: T, fallbackTTL: Millisecond): Millisecond {
	return fallbackTTL;
}
