import { assert, describe, it } from 'vitest';
import { JitterExponentialBackoffTimer } from '@/lib';

const base = 1_000; // 1 seconds
const limit = 30_000; // 30 seconds

describe('JitterExponentialBackoffTimer', () => {
	it('not emit delay greater or equal than limit and lesser or equal than zero', () => {
		const retryTimer = new JitterExponentialBackoffTimer(base, limit);

		// test multiple times, since the timer is jittered
		for (let i = 0; i < 1_000; i++) {
			const attempt = Math.ceil(Math.random() * 10_000);
			assert.isTrue(retryTimer.delay(attempt) <= limit);
			assert.isTrue(retryTimer.delay(attempt) >= 0);
		}
	});
});
