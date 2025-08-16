import type { QueryState, QueryExecutionResult, ResetOptions } from '@/core/Type';
import type { QueryContext, QueryInput } from '@/plumbing/QueryType';
import {
	disposeQuery,
	executeQuery,
	makeQueryContext,
	resetQuery,
	useQueryKey,
	type ExecuteQueryOptions,
} from '@/plumbing/Query';
import type { CacheManager } from '@/cache/CacheManager';

export class Query<K extends ReadonlyArray<unknown>, T, E = unknown> {
	/**
	 * Query context
	 */
	public readonly ctx: QueryContext<K, T, E>;
	/**
	 * Cache
	 */
	public readonly cache: CacheManager;

	public constructor(ctx: QueryContext<K, T, E>) {
		this.ctx = ctx;
		this.cache = this.ctx.cache;
	}

	/**
	 * Create a new query context
	 * @typeParam K Tuple with the query function inputs
	 * @typeParam T Return value of a successful query
	 * @typeParam E Error from a failed {@link QueryFn query} execution
	 * @param input Query input
	 * @returns Query context
	 */
	public static create<K extends ReadonlyArray<unknown>, T, E = unknown>(
		input: QueryInput<K, T, E>
	): Query<K, T, E> {
		return new Query(makeQueryContext(input));
	}

	/**
	 * Execute a query
	 * @description Refer to the {@link executeQuery} documentation for more details.
	 * @param key Key value
	 * @param options Execute query options
	 * @returns Query execution result
	 */
	public execute(key: K, options?: ExecuteQueryOptions): Promise<QueryExecutionResult<T, E>> {
		return executeQuery(this.ctx, key, options);
	}

	/**
	 * Use provided query key
	 * @description Refer to the {@link useQueryKey} documentation for more details.
	 * @param key Key value
	 * @param options Reset options
	 */
	public use(key: K, options?: ResetOptions): void {
		useQueryKey(this.ctx, key, options);
	}

	/**
	 * Reset query context
	 * @description Refer to the {@link resetQuery} documentation for more details.
	 * @param options Reset options
	 */
	public reset(options?: ResetOptions): void {
		resetQuery(this.ctx, options);
	}

	/**
	 * Get the {@link QueryState query state}
	 * @returns Query state
	 */
	public getState(): QueryState<T, E> {
		return this.ctx.state;
	}

	/**
	 * Dispose query
	 * @description Refer to the {@link disposeQuery} documentation for more details.
	 */
	public dispose(): void {
		disposeQuery(this.ctx);
	}

	public [Symbol.dispose](): void {
		this.dispose();
	}
}
