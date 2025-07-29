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
	 * @summary Query context
	 */
	public readonly ctx: QueryContext<K, T, E>;
	/**
	 * @summary Cache
	 */
	public readonly cache: CacheManager;

	public constructor(ctx: QueryContext<K, T, E>) {
		this.ctx = ctx;
		this.cache = this.ctx.cache;
	}

	public static create<K extends ReadonlyArray<unknown>, T, E = unknown>(
		input: QueryInput<K, T, E>
	): Query<K, T, E> {
		return new Query(makeQueryContext(input));
	}

	/**
	 * @summary Execute a query
	 * @description Execute a query based on the provided cache directive.
	 * @param key key value
	 * @param options execute query options
	 * @returns query execution result
	 */
	public execute(key: K, options?: ExecuteQueryOptions): Promise<QueryExecutionResult<T, E>> {
		return executeQuery(this.ctx, key, options);
	}

	/**
	 * @summary Use provided query key
	 * @description Reset query state and subscribe to the provided key.
	 * @param key key value
	 * @param options reset query options
	 */
	public use(key: K, options?: ResetOptions): void {
		useQueryKey(this.ctx, key, options);
	}

	/**
	 * @summary Reset query state and context
	 * @param options reset query options
	 */
	public reset(options?: ResetOptions): void {
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
