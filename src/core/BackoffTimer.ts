import type { Millisecond } from '@/core/Type';

export interface BackoffTimer {
	/**
	 * @description Returns the delay for the next attempt as a positive integer in milliseconds.
	 * @param attempt current retry attempt
	 * @returns millisecond as a positive integer
	 */
	delay(attempt: number): Millisecond;
}

/**
 * @description Retry timer with exponential backoff and jitter.
 * @see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter
 */
export class JitterExponentialBackoffTimer implements BackoffTimer {
	public readonly base: Millisecond;
	public readonly limit: Millisecond;

	public constructor(base: Millisecond, limit: Millisecond) {
		this.base = base;
		this.limit = limit;
	}

	public delay(attempt: number): Millisecond {
		return Math.min(this.limit, this.base * 2 ** attempt) * Math.random();
	}
}

export class ExponentialBackoffTimer implements BackoffTimer {
	public readonly base: Millisecond;
	public readonly limit: Millisecond;

	public constructor(base: Millisecond, limit: Millisecond) {
		this.base = base;
		this.limit = limit;
	}

	public delay(attempt: number): Millisecond {
		return Math.min(this.limit, this.base * 2 ** attempt);
	}
}

export class LinearBackoffTimer implements BackoffTimer {
	public readonly base: Millisecond;
	public readonly limit: Millisecond;

	public constructor(base: Millisecond, limit: Millisecond) {
		this.base = base;
		this.limit = limit;
	}

	public delay(attempt: number): Millisecond {
		return Math.min(this.limit, this.base * (attempt + 1));
	}
}

export class FixedBackoffTimer implements BackoffTimer {
	public readonly time: number;

	public constructor(delay: number) {
		this.time = delay;
	}

	public delay(): Millisecond {
		return this.time;
	}
}
