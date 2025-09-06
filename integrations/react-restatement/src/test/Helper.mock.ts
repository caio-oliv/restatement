import { LRUCache } from 'lru-cache';
import {
	LRUCacheAdapter,
	NoRetryPolicy,
	REQUIRED_LRU_CACHE_OPTIONS,
	restatementConfig,
	waitUntil,
	type RestatementConfig,
} from 'restatement';

/**
 * Test restatement config
 * @returns Restatement config
 */
export function testRestatementConfig(): RestatementConfig {
	const cache = new LRUCache<string, object, unknown>({
		max: 1000,
		...REQUIRED_LRU_CACHE_OPTIONS,
	});
	const adapter = new LRUCacheAdapter(cache);
	const policy = new NoRetryPolicy();
	return restatementConfig<unknown>(adapter, {
		cache: { fresh: 50, ttl: 100 },
		query: { retry: { policy } },
		mutation: { retry: { policy } },
	});
}

export type TestKeys = [string, ...Array<string | number>];

/**
 * Test query function
 * @param key Test keys
 * @param key."0" Control argument
 * @param key."1" Test key arguments
 * @returns Query result promise
 */
export async function testQueyFn([control, ...args]: TestKeys): Promise<string> {
	const [result, delay] = control.split(':');
	if (result !== 'ok') {
		throw new Error('invalid');
	}

	const time = delay ? Number.parseInt(delay) : 0;
	if (time > 0) {
		await waitUntil(time);
	}

	let value = 'result';
	for (const arg of args) {
		value += ':' + arg;
	}

	return value;
}
