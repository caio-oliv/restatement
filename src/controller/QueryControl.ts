import type { QueryState, QueryCache, QueryExecutorResult, QueryResetTarget } from '@/core/Type';
import type { QueryContext, QueryInput } from '@/plumbing/QueryType';
import {
	disposeQuery,
	executeQuery,
	makeQueryContext,
	resetQuery,
	useQueryKey,
} from '@/plumbing/Query';
import type { CacheManager } from '@/cache/CacheManager';

export class QueryControl<K extends ReadonlyArray<unknown>, T, E = unknown> {
	/**
	 * @summary Query context
	 */
	public readonly context: QueryContext<K, T, E>;
	/**
	 * @summary Cache
	 */
	public readonly cache: CacheManager;

	public constructor(input: QueryInput<K, T, E>) {
		this.context = makeQueryContext(input);
		this.cache = this.context.cache;
	}

	public async execute(
		key: K,
		cache: QueryCache = 'stale',
		ctl: AbortController = new AbortController()
	): Promise<QueryExecutorResult<T, E>> {
		// eslint-disable-next-line @typescript-eslint/return-await
		return executeQuery(this.context, key, cache, ctl);
	}

	public use(key: K, target: QueryResetTarget = 'state'): void {
		useQueryKey(this.context, key, target);
	}

	public reset(target: QueryResetTarget = 'state'): void {
		resetQuery(this.context, target);
	}

	/**
	 * @description Get the current query state.
	 * @returns current query state
	 */
	public getState(): QueryState<T, E> {
		return this.context.state;
	}

	public dispose(): void {
		disposeQuery(this.context);
	}

	public [Symbol.dispose](): void {
		this.dispose();
	}
}
