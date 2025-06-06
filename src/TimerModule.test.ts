import { assert, describe, it } from 'vitest';
import { ExponentialBackoffTimer, JitterExponentialBackoffTimer, LinearBackoffTimer } from '@/lib';

describe('JitterExponentialBackoffTimer', () => {
	it('emit delay less or equal than limit and greater or equal than zero', () => {
		const base = 1_000; // 1 seconds
		const limit = 30_000; // 30 seconds
		const retryTimer = new JitterExponentialBackoffTimer(base, limit);

		for (let i = 0; i < 1_000; i++) {
			const attempt = Math.ceil(Math.random() * 10);
			assert.isAtMost(retryTimer.delay(attempt), limit);
			assert.isAtLeast(retryTimer.delay(attempt), 0);
		}

		for (let i = 0; i < 20; i++) {
			assert.isAtMost(retryTimer.delay(i), limit);
			assert.isAtLeast(retryTimer.delay(i), 0);
		}
	});
});

describe('ExponentialBackoffTimer', () => {
	it('emit delay less or equal than limit and greater or equal than base', () => {
		const base = 1_000; // 1 seconds
		const limit = 30_000; // 30 seconds
		const retryTimer = new ExponentialBackoffTimer(base, limit);

		for (let i = 0; i < 1_000; i++) {
			const attempt = Math.ceil(Math.random() * 10);
			assert.isAtMost(retryTimer.delay(attempt), limit);
			assert.isAtLeast(retryTimer.delay(attempt), base);
		}

		for (let i = 0; i < 20; i++) {
			assert.isAtMost(retryTimer.delay(i), limit);
			assert.isAtLeast(retryTimer.delay(i), base);
		}
	});

	it('assert possible exponential results', () => {
		const base = 1_000; // 1 seconds
		const limit = 128_000; // 128 seconds
		const retryTimer = new ExponentialBackoffTimer(base, limit);

		const results = [1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 64_000, 128_000, 128_000, 128_000];

		for (const [attempt, result] of results.entries()) {
			assert.strictEqual(retryTimer.delay(attempt), result);
		}
	});
});

describe('LinearBackoffTimer', () => {
	it('emit delay less or equal than limit and greater or equal than base', () => {
		const base = 1_000; // 1 seconds
		const limit = 30_000; // 30 seconds
		const retryTimer = new LinearBackoffTimer(base, limit);

		for (let i = 0; i < 1_000; i++) {
			const attempt = Math.ceil(Math.random() * 10);
			assert.isAtMost(retryTimer.delay(attempt), limit);
			assert.isAtLeast(retryTimer.delay(attempt), base);
		}

		for (let i = 0; i < 20; i++) {
			assert.isAtMost(retryTimer.delay(i), limit);
			assert.isAtLeast(retryTimer.delay(i), base);
		}
	});

	it('assert possible linear results', () => {
		const base = 1_000; // 1 seconds
		const limit = 10_000; // 10 seconds
		const retryTimer = new LinearBackoffTimer(base, limit);

		const results = [
			1_000, 2_000, 3_000, 4_000, 5_000, 6_000, 7_000, 8_000, 9_000, 10_000, 10_000, 10_000,
		];

		for (const [attempt, result] of results.entries()) {
			assert.strictEqual(retryTimer.delay(attempt), result);
		}
	});
});
