/**
 * Retry timer with exponential backoff and jitter.
 *
 * @see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter
 */
export class JitterExponentialBackoffTimer {
	public readonly base: number;
	public readonly limit: number;

	public constructor(base: number, limit: number) {
		this.base = base;
		this.limit = limit;
	}

	public delay = (attempt: number): number => {
		return Math.min(this.limit, 2 ** attempt * this.base) * Math.random();
	};
}
