import type { QueryState, QueryExecutorResult } from '@/core/Type';
import type { QueryContext, QueryInput } from '@/plumbing/QueryType';
import {
	disposeQuery,
	executeQuery,
	makeQueryContext,
	resetQuery,
	useQueryKey,
	type ExecuteQueryOptions,
	type ResetQueryOptions,
} from '@/plumbing/Query';
import type { CacheManager } from '@/cache/CacheManager';

export class QueryControl<K extends ReadonlyArray<unknown>, T, E = unknown> {
	/**
	 * @summary Query context
	 */
	public readonly ctx: QueryContext<K, T, E>;
	/**
	 * @summary Cache
	 */
	public readonly cache: CacheManager;

	public constructor(input: QueryInput<K, T, E>) {
		this.ctx = makeQueryContext(input);
		this.cache = this.ctx.cache;
	}

	/**
	 * @summary Execute a query
	 * @description Execute a query based on the provided cache directive.
	 * @param key key value
	 * @param options execute query options
	 * @returns query execution result
	 */
	public async execute(key: K, options?: ExecuteQueryOptions): Promise<QueryExecutorResult<T, E>> {
		// eslint-disable-next-line @typescript-eslint/return-await
		return executeQuery(this.ctx, key, options);
	}

	/**
	 * @summary Use provided query key
	 * @description Reset query state and subscribe to the provided key.
	 * @param key key value
	 * @param options reset query options
	 */
	public use(key: K, options?: ResetQueryOptions): void {
		useQueryKey(this.ctx, key, options);
	}

	/**
	 * @summary Reset query state and context
	 * @param options reset query options
	 */
	public reset(options?: ResetQueryOptions): void {
		resetQuery(this.ctx, options);
	}

	/**
	 * @summary Get query state
	 * @description Get the current query state.
	 * @returns query state
	 */
	public getState(): QueryState<T, E> {
		return this.ctx.state;
	}

	/**
	 * @summary Dispose query
	 */
	public dispose(): void {
		disposeQuery(this.ctx);
	}

	public [Symbol.dispose](): void {
		this.dispose();
	}
}
