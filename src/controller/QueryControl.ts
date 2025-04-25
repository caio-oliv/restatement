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
	QueryProviderState,
	QueryStateMetadata,
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

export interface QueryControlInput<K extends ReadonlyArray<unknown>, T, E = unknown> {
	/**
	 * Cache store.
	 */
	cache: CacheStore<string, T>;
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
	provider?: PubSub<QueryProviderState<T, E>> | null;
}

type NextQueryResultFn<T, E> = () => Promise<NextQueryState<T, E>>;

interface QueryProviderInternalState<T, E> {
	readonly state: QueryState<T, E>;
	readonly metadata: QueryStateMetadata;
}

type QueryStateNoCacheSource = 'query' | 'background-query';

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

export class QueryControl<K extends ReadonlyArray<unknown>, T, E = unknown> {
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
		cache,
		queryFn,
		keyHashFn = defaultKeyHashFn,
		retryDelay = DEFAULT_RETRY_DELAY.delay,
		retry = DEFAULT_RETRY,
		retryHandleFn = null,
		keepCacheOnError = defaultKeepCacheOnError,
		fresh = DEFAULT_FRESH_DURATION,
		ttl = DEFAULT_TTL_DURATION,
		handler = defaultQueryHandler(),
		provider = null,
	}: QueryControlInput<K, T, E>) {
		this.#cache = cache;
		this.keyHashFn = keyHashFn;
		this.#queryFn = queryFn;
		this.retryDelay = retryDelay;
		this.#keepCacheOnError = keepCacheOnError;
		this.#retryHandleFn = retryHandleFn;
		this.retry = retry;
		this.fresh = fresh;
		this.ttl = ttl;
		this.#state = defaultQueryState();
		this.#handler = handler;
		this.#subscriber = provider
			? new SubscriberHandle(this.#updateState.bind(this), provider)
			: null;
	}

	public async execute(
		key: K,
		cache: QueryCache = 'stale',
		ctl: AbortController = new AbortController()
	): Promise<QueryExecutorResult<T, E>> {
		const keyHash = this.keyHashFn(key);
		this.#subscriber?.useTopic(keyHash);

		if (cache === 'no-cache') {
			const state = await this.#makeQueryNoCache(key, cache, ctl);
			return { state, next: boxNextQueryFn() };
		}

		const entry = await this.#cache.getEntry(keyHash).catch(blackhole);
		if (entry === undefined) {
			const state = await this.#makeQueryNoCache(key, cache, ctl);
			return { state, next: boxNextQueryFn() };
		}

		if ((cache === 'fresh' || cache === 'stale') && entry.ttl - entry.remain_ttl < this.fresh) {
			// Fresh from cache (less time than fresh duration).
			const state: QueryState<T, E> = {
				status: 'success',
				error: null,
				data: entry.data,
			};
			this.#updateState(keyHash, {
				state,
				metadata: {
					origin: 'control',
					source: 'cache',
					cache,
				},
			});
			this.#subscriber?.publish(keyHash, {
				state,
				metadata: {
					origin: 'provider',
					source: 'cache',
					cache,
				},
			});
			return { state, next: boxNextQueryFn() };
		}

		if (cache === 'stale') {
			// Stale from cache (greater time than fresh duration).
			const state: QueryState<T, E> = {
				status: 'stale',
				error: null,
				data: entry.data,
			};
			this.#updateState(keyHash, {
				state,
				metadata: { origin: 'control', source: 'cache', cache },
			});
			this.#subscriber?.publish(keyHash, {
				state,
				metadata: { origin: 'provider', source: 'cache', cache },
			});
			/**
			 * `runQuery` should run in the background, so it's promise
			 * **must not** be awaited.
			 */
			const queryPromise = this.#runQuery(key, cache, 'background-query', ctl);
			return { state, next: boxNextQueryFn(queryPromise) };
		}

		const state = await this.#makeQueryNoCache(key, cache, ctl);
		return { state, next: boxNextQueryFn() };
	}

	public use(key: K): void {
		const keyHash = this.keyHashFn(key);
		this.#subscriber?.useTopic(keyHash);
	}

	/**
	 * @description Get the current query state.
	 * @returns current query state
	 */
	public getState(): QueryState<T, E> {
		return this.#state;
	}

	public dispose(): void {
		this.#subscriber?.unsubscribe();
	}

	public [Symbol.dispose](): void {
		this.dispose();
	}

	async #makeQueryNoCache(
		key: K,
		cache: QueryCache,
		ctl: AbortController
	): Promise<QueryState<T, E>> {
		const state: QueryState<T, E> = {
			status: 'loading',
			data: this.#state.data,
			error: null,
		};
		this.#state = state;
		this.#handler
			.stateFn?.(this.#state, {
				origin: 'control',
				source: 'query',
				cache,
			})
			?.catch(blackhole);
		this.#subscriber?.publish(this.keyHashFn(key), {
			state,
			metadata: { origin: 'provider', source: 'query', cache },
		});
		return await this.#runQuery(key, cache, 'query', ctl);
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
	 * @param cache query cache directive
	 * @param source query source
	 * @param ctl abort controller
	 * @returns query state
	 */
	async #runQuery(
		key: K,
		cache: QueryCache,
		source: QueryStateNoCacheSource,
		ctl: AbortController
	): Promise<QueryState<T, E>> {
		try {
			const ok = await retryAsyncOperation(
				() => this.#queryFn(key, ctl.signal),
				this.retryDelay,
				this.retry,
				this.#retryHandleFn
			);
			return (await this.#fetchResolve(ok, key, cache, source).catch(blackhole)) ?? this.getState();
		} catch (err: unknown) {
			return (await this.#fetchReject(err, key, cache, source).catch(blackhole)) ?? this.getState();
		}
	}

	async #fetchResolve(
		data: T,
		key: K,
		cache: QueryCache,
		source: QueryStateNoCacheSource
	): Promise<QueryState<T, E>> {
		const keyHash = this.keyHashFn(key);
		const state: QueryState<T, E> = {
			status: 'success',
			error: null,
			data,
		};
		await this.#cache.set(keyHash, data, this.ttl).catch(blackhole);
		this.#updateState(keyHash, { state, metadata: { origin: 'control', source, cache } });
		this.#subscriber?.publish(keyHash, { state, metadata: { origin: 'provider', source, cache } });
		return state;
	}

	async #fetchReject(
		err: unknown,
		key: K,
		cache: QueryCache,
		source: QueryStateNoCacheSource
	): Promise<QueryState<T, E>> {
		const keyHash = this.keyHashFn(key);
		const state: QueryState<T, E> = {
			status: 'error',
			error: err as E,
			data: null,
		};
		if (!this.#keepCacheOnError(err as E)) {
			await this.#cache.delete(keyHash).catch(blackhole);
		}
		this.#updateState(keyHash, { state, metadata: { origin: 'control', source, cache } });
		this.#subscriber?.publish(keyHash, { state, metadata: { origin: 'provider', source, cache } });
		return state;
	}

	#updateState(_: string, { state, metadata }: QueryProviderInternalState<T, E>): void {
		this.#state = state;
		// TODO: filter the provided state
		// if (!this.filterStateFn(state, metadata)) {
		// 	return;
		// }

		if (this.#state.data !== null) {
			this.#handler.dataFn?.(this.#state.data, metadata)?.catch(blackhole);
		}
		if (this.#state.error !== null) {
			this.#handler.errorFn?.(this.#state.error, metadata)?.catch(blackhole);
		}
		this.#handler.stateFn?.(this.#state, metadata)?.catch(blackhole);
	}

	#state: QueryState<T, E>;
	readonly #cache: CacheStore<string, T>;
	readonly #handler: QueryControlHandler<T, E>;
	readonly #subscriber: SubscriberHandle<QueryProviderState<T, E>> | null;
	readonly #queryFn: QueryFn<K, T>;
	readonly #keepCacheOnError: KeepCacheOnError<E>;
	readonly #retryHandleFn: RetryHandlerFn | null;
}
