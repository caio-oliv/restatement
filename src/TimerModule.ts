export interface BackoffTimer {
	readonly base: number;
	readonly limit: number;

	delay(attempt: number): number;
}

/**
 * @description Retry timer with exponential backoff and jitter.
 * @see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter
 */
export class JitterExponentialBackoffTimer implements BackoffTimer {
	public readonly base: number;
	public readonly limit: number;

	public constructor(base: number, limit: number) {
		this.base = base;
		this.limit = limit;
	}

	public delay(attempt: number): number {
		return Math.min(this.limit, this.base * 2 ** attempt) * Math.random();
	}
}

export class ExponentialBackoffTimer implements BackoffTimer {
	public readonly base: number;
	public readonly limit: number;

	public constructor(base: number, limit: number) {
		this.base = base;
		this.limit = limit;
	}

	public delay(attempt: number): number {
		return Math.min(this.limit, this.base * 2 ** attempt);
	}
}

export class LinearBackoffTimer implements BackoffTimer {
	public readonly base: number;
	public readonly limit: number;

	public constructor(base: number, limit: number) {
		this.base = base;
		this.limit = limit;
	}

	public delay(attempt: number): number {
		return Math.min(this.limit, this.base * (attempt + 1));
	}
}
