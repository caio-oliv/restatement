import type { Millisecond } from '@/core/Type';

/**
 * Backoff timer
 */
export interface BackoffTimer {
	/**
	 * @description Returns the delay for the next attempt as a positive integer in {@link Millisecond milliseconds}.
	 * @param attempt Current retry attempt
	 * @returns Delay in milliseconds
	 */
	delay(attempt: number): Millisecond;
}

/**
 * Backoff timer with exponential backoff and jitter
 * @see {@link https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter AWS blog about exponential backoff and jitter}
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

/**
 * Exponential backoff timer
 */
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

/**
 * Linear backoff timer
 */
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

/**
 * Fixed backoff timer
 */
export class FixedBackoffTimer implements BackoffTimer {
	public readonly time: number;

	public constructor(delay: number) {
		this.time = delay;
	}

	public delay(): Millisecond {
		return this.time;
	}
}
