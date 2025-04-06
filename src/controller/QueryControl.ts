import type { CacheStore } from '@/Cache';
import { type RetryDelay, type RetryHandlerFn, retryAsyncOperation } from '@/AsyncModule';
import { type PubSub, SubscriberHandle } from '@/PubSub';
import type {
	QueryFn,
	KeyHashFn,
	QueryControlHandler,
	QueryState,
	QueryCache,
	KeepCacheOnError,
	Millisecond,
	QueryExecutorResult,
	NextQueryState,
} from '@/Type';
import {
	defaultKeyHashFn,
	DEFAULT_RETRY_DELAY,
	DEFAULT_RETRY,
	defaultKeepCacheOnError,
	DEFAULT_FRESH_DURATION,
	DEFAULT_TTL_DURATION,
	defaultQueryHandler,
	defaultQueryState,
} from '@/Default';
import { blackhole, nullpromise } from '@/Internal';

export interface QueryControlInput<K, T, E = unknown> {
	/**
	 * Cache store.
	 */
	cacheStore: CacheStore<string, T>;
	/**
	 * Query function.
	 *
	 * The function that will be called to query the data `T`.
	 */
	queryFn: QueryFn<K, T>;
	/**
	 * Key hasher.
	 */
	keyHashFn?: KeyHashFn<K>;
	/**
	 * This function receives a retryAttempt integer and the actual Error and returns the delay to apply before the next attempt in milliseconds.
	 * A function like attempt => Math.min(attempt > 1 ? 2 ** attempt * 1000 : 1000, 30 * 1000) applies exponential backoff.
	 * A function like attempt => attempt * 1000 applies linear backoff.
	 */
	retryDelay?: RetryDelay<E>;
	/**
	 * Maximum retry attempt
	 * @default 3
	 */
	retry?: number;
	/**
	 * Retry handler function
	 */
	retryHandleFn?: RetryHandlerFn | null;
	/**
	 * Use the previus cached data on error of the `queryFn`
	 */
	keepCacheOnError?(err: E): boolean;
	/**
	 * @description Duration in which cache entries will be fresh.
	 *
	 * ## Pro tip
	 *
	 * If all of the cache results **must be stale**, set the fresh
	 * option to zero.
	 *
	 * If all of the cache results **must be fresh**, set the fresh
	 * option equal to the cache {@link ttl}.
	 *
	 * ## Invariant
	 *
	 * Must be less than or equal the cache {@link ttl}.
	 * @default 30 * 1000; // 30 seconds
	 */
	fresh?: Millisecond;
	/**
	 * @description Time To Live (duration) of cache entries.
	 *
	 * ## Invariant
	 *
	 * Must be greater than or equal {@link fresh} cache duration.
	 * @default 3 * 60 * 1000 // 3 minutes
	 */
	ttl?: Millisecond;
	/**
	 * Update handlers.
	 */
	handler?: QueryControlHandler<T, E>;
	/**
	 * State provider.
	 */
	stateProvider?: PubSub<QueryState<T, E>> | null;
}

type NextQueryResultFn<T, E> = () => Promise<NextQueryState<T, E>>;

/**
 * @description Wraps the next query function of the query executor result
 * @param query next query promise
 * @returns next query result function
 */
function boxNextQueryFn<T, E>(
	query: Promise<QueryState<T, E>> | null = null
): NextQueryResultFn<T, E> {
	if (query === null) {
		return nullpromise;
	}
	return () => query;
}

export class QueryControl<K, T, E = unknown> {
	public readonly keyHashFn: KeyHashFn<K>;
	public readonly retry: number;
	public readonly retryDelay: RetryDelay<E>;
	/**
	 * @description Duration in which cache entries will be fresh.
	 *
	 * Must be less than the cache {@link ttl}.
	 */
	public readonly fresh: Millisecond;
	/**
	 * @description Time To Live (duration) of cache entries created by this query.
	 *
	 * Must be greater than {@link fresh} cache duration.
	 */
	public readonly ttl: Millisecond;

	public constructor({
		cacheStore,
		queryFn,
		keyHashFn = defaultKeyHashFn,
		retryDelay = DEFAULT_RETRY_DELAY.delay,
		retry = DEFAULT_RETRY,
		retryHandleFn = null,
		keepCacheOnError = defaultKeepCacheOnError,
		fresh = DEFAULT_FRESH_DURATION,
		ttl = DEFAULT_TTL_DURATION,
		handler = defaultQueryHandler(),
		stateProvider = null,
	}: QueryControlInput<K, T, E>) {
		this.cacheStore = cacheStore;
		this.keyHashFn = keyHashFn;
		this.queryFn = queryFn;
		this.retryDelay = retryDelay;
		this.keepCacheOnError = keepCacheOnError;
		this.retryHandleFn = retryHandleFn;
		this.retry = retry;
		this.fresh = fresh;
		this.ttl = ttl;
		this.state = defaultQueryState();
		this.handler = handler;
		this.stateProvider = stateProvider;
		this.subscriberHandle = this.stateProvider
			? new SubscriberHandle(this.updateState.bind(this), this.stateProvider)
			: null;
	}

	public async execute(
		key: K,
		cache: QueryCache = 'stale',
		ctl: AbortController = new AbortController()
	): Promise<QueryExecutorResult<T, E>> {
		const keyHash = this.keyHashFn(key);
		this.subscriberHandle?.useTopic(keyHash);

		if (cache === 'no-cache') {
			const state = await this.makeQueryNoCache(key, ctl);
			return { state, next: boxNextQueryFn() };
		}

		const entry = await this.cacheStore.getEntry(keyHash).catch(blackhole);
		if (entry === undefined) {
			const state = await this.makeQueryNoCache(key, ctl);
			return { state, next: boxNextQueryFn() };
		}

		if ((cache === 'fresh' || cache === 'stale') && entry.ttl - entry.remain_ttl < this.fresh) {
			// Fresh from cache (less time than fresh duration).
			const state: QueryState<T, E> = {
				status: 'success',
				error: null,
				data: entry.data,
			};
			this.updateState(keyHash, state);
			this.stateProvider?.publish(keyHash, state);
			return { state, next: boxNextQueryFn() };
		}

		if (cache === 'stale') {
			// Stale from cache (greater time than fresh duration).
			const state: QueryState<T, E> = {
				status: 'stale',
				error: null,
				data: entry.data,
			};
			this.updateState(keyHash, state);
			this.stateProvider?.publish(keyHash, state);
			/**
			 * `runQuery` should run in the background, so it's promise
			 * **must not** be awaited.
			 */
			const queryPromise = this.runQuery(key, ctl);
			return { state, next: boxNextQueryFn(queryPromise) };
		}

		const state = await this.makeQueryNoCache(key, ctl);
		return { state, next: boxNextQueryFn() };
	}

	/**
	 * @description Get the current query state.
	 * @returns current query state
	 */
	public getState(): QueryState<T, E> {
		return this.state;
	}

	public dispose(): void {
		this.subscriberHandle?.unsubscribe();
	}

	private async makeQueryNoCache(key: K, ctl: AbortController): Promise<QueryState<T, E>> {
		// Fetching status should not be published.
		const state: QueryState<T, E> = {
			status: 'loading',
			data: this.state.data,
			error: null,
		};
		this.state = state;
		this.handler.stateFn?.(this.state)?.catch(blackhole);
		return await this.runQuery(key, ctl);
	}

	/**
	 * @description Runs the query function with the configured retry behaviour
	 * and returns the new query state within a promise.
	 *
	 * ## Invariants
	 *
	 * This function **must not** throw any errors. Doing so will break its callers,
	 * since they rely on the contract that the promise returned by this function
	 * is safe to **not** be awaited.
	 * @example
	 * ```
	 * const queryCtl = new QueryControl({ ... });
	 *
	 * // move `queryPromise` to somewhere else
	 * const queryPromise = queryCtl.runQuery(key, ctl);
	 * takeNextQuery(queryPromise);
	 *
	 * // or
	 *
	 * // not be `await`'ed
	 * queryCtl.runQuery(key, ctl);
	 * ```
	 * @param key query function input
	 * @param ctl abort controller
	 * @returns query state
	 */
	private async runQuery(key: K, ctl: AbortController): Promise<QueryState<T, E>> {
		try {
			const ok = await retryAsyncOperation(
				() => this.queryFn(key, ctl.signal),
				this.retryDelay,
				this.retry,
				this.retryHandleFn
			);
			return (await this.fetchResolve(ok, key).catch(blackhole)) ?? this.getState();
		} catch (err: unknown) {
			return (await this.fetchReject(err, key).catch(blackhole)) ?? this.getState();
		}
	}

	private async fetchResolve(data: T, key: K): Promise<QueryState<T, E>> {
		const keyHash = this.keyHashFn(key);
		const state: QueryState<T, E> = {
			status: 'success',
			error: null,
			data,
		};
		await this.cacheStore.set(keyHash, data, this.ttl).catch(blackhole);
		this.updateState(keyHash, state);
		this.stateProvider?.publish(keyHash, state);
		return state;
	}

	private async fetchReject(err: unknown, key: K): Promise<QueryState<T, E>> {
		const keyHash = this.keyHashFn(key);
		const state: QueryState<T, E> = {
			status: 'error',
			error: err as E,
			data: null,
		};
		if (!this.keepCacheOnError(err as E)) {
			await this.cacheStore.delete(keyHash).catch(blackhole);
		}
		this.updateState(keyHash, state);
		return state;
	}

	private updateState(_: string, state: QueryState<T, E>): void {
		this.state = state;
		if (this.state.data !== null) {
			this.handler.dataFn?.(this.state.data)?.catch(blackhole);
		}
		if (this.state.error !== null) {
			this.handler.errorFn?.(this.state.error)?.catch(blackhole);
		}
		this.handler.stateFn?.(this.state)?.catch(blackhole);
	}

	private readonly cacheStore: CacheStore<string, T>;
	private readonly handler: QueryControlHandler<T, E>;
	private readonly stateProvider: PubSub<QueryState<T, E>> | null;
	private readonly subscriberHandle: SubscriberHandle<QueryState<T, E>> | null;
	private readonly queryFn: QueryFn<K, T>;
	private readonly keepCacheOnError: KeepCacheOnError<E>;
	private readonly retryHandleFn: RetryHandlerFn | null;
	private state: QueryState<T, E>;
}
