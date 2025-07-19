import { vi, type Mock } from 'vitest';
import type { Millisecond } from '@/Type';
import type { BackoffTimer } from '@/TimerModule';

export interface BackoffTimerMock extends BackoffTimer {
	delay: Mock<(attempt: number) => Millisecond>;
}

/**
 * Mock `BackoffTimer` interface
 * @param delay delay function
 * @returns `BackoffTimer` mock
 */
export function mockBackoffTimer(delay?: (attempt: number) => Millisecond): BackoffTimerMock {
	return {
		delay: vi.fn<(attempt: number) => Millisecond>(delay),
	};
}
