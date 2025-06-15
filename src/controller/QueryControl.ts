import type { CacheStore } from '@/cache/CacheStore';
import { type RetryDelay, type RetryHandlerFn, retryAsyncOperation } from '@/AsyncModule';
import { DummySubscriber, type PubSub, type Subscriber, SubscriberHandle } from '@/PubSub';
import type {
	QueryFn,
	KeyHashFn,
	QueryControlHandler,
	QueryState,
	QueryCache,
	KeepCacheOnError,
	Millisecond,
	QueryExecutorResult,
	QueryProviderState,
	QueryStateMetadata,
	QueryStatePromise,
	QueryStateFilterFn,
} from '@/Type';
import {
	defaultKeyHashFn,
	DEFAULT_RETRY_DELAY,
	DEFAULT_RETRY,
	defaultKeepCacheOnError,
	DEFAULT_FRESH_DURATION,
	DEFAULT_TTL_DURATION,
	defaultStateFilterFn,
} from '@/Default';
import { blackhole, makeObservablePromise, nullpromise } from '@/Internal';
import { CacheManager } from '@/cache/CacheManager';

export interface QueryControlInput<K extends ReadonlyArray<unknown>, T, E = unknown> {
	/**
	 * Idle state placeholder.
	 */
	placeholder?: T | null;
	/**
	 * Cache store.
	 */
	store: CacheStore<string, T>;
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
	retryHandleFn?: RetryHandlerFn<E> | null;
	/**
	 * Use the previus cached data on error of the `queryFn`
	 */
	keepCacheOnError?: KeepCacheOnError<E>;
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
	 * Query state filter function
	 */
	stateFilterFn?: QueryStateFilterFn<T, E>;
	/**
	 * State provider.
	 */
	provider?: QueryControlProvider<T, E> | null;
}

export type QueryControlProvider<T, E> = PubSub<QueryProviderState<T, E>, QueryStatePromise<T, E>>;

type QueryStateNoCacheSource = 'query' | 'background-query';

interface KeyPair<K extends ReadonlyArray<unknown>> {
	readonly key: K;
	readonly hash: string;
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
	public readonly cache: CacheManager;

	public constructor({
		placeholder = null,
		store,
		queryFn,
		keyHashFn = defaultKeyHashFn,
		retryDelay = DEFAULT_RETRY_DELAY.delay,
		retry = DEFAULT_RETRY,
		retryHandleFn = null,
		keepCacheOnError = defaultKeepCacheOnError,
		fresh = DEFAULT_FRESH_DURATION,
		ttl = DEFAULT_TTL_DURATION,
		handler = { dataFn: undefined, errorFn: undefined, stateFn: undefined },
		stateFilterFn = defaultStateFilterFn,
		provider = null,
	}: QueryControlInput<K, T, E>) {
		this.#placeholder = placeholder;
		this.#internalCache = store;
		this.keyHashFn = keyHashFn;
		this.#queryFn = queryFn;
		this.retryDelay = retryDelay;
		this.#keepCacheOnError = keepCacheOnError;
		this.#retryHandleFn = retryHandleFn;
		this.retry = retry;
		this.fresh = fresh;
		this.ttl = ttl;
		this.cache = new CacheManager({
			store,
			keyHashFn: keyHashFn as KeyHashFn<ReadonlyArray<unknown>>,
			provider: provider as QueryControlProvider<unknown, unknown>,
			ttl,
		});
		this.#state = { data: this.#placeholder, error: null, status: 'idle' };
		this.#handler = handler;
		this.#stateFilterFn = stateFilterFn;
		this.#subscriber = provider
			? new SubscriberHandle(this.#updateState.bind(this), provider)
			: new DummySubscriber();
	}

	public async execute(
		key: K,
		cache: QueryCache = 'stale',
		ctl: AbortController = new AbortController()
	): Promise<QueryExecutorResult<T, E>> {
		const hash = this.keyHashFn(key);
		this.#subscriber.useTopic(hash);

		if (cache === 'no-cache') {
			// eslint-disable-next-line @typescript-eslint/return-await
			return this.#tryCurrentPromiseOrRunQuery({ key, hash }, cache, ctl);
		}

		const entry = await this.#internalCache.getEntry(hash).catch(blackhole);
		if (entry === undefined) {
			// eslint-disable-next-line @typescript-eslint/return-await
			return this.#tryCurrentPromiseOrRunQuery({ key, hash }, cache, ctl);
		}

		if ((cache === 'fresh' || cache === 'stale') && entry.ttl - entry.remain_ttl < this.fresh) {
			// Fresh from cache (less time than fresh duration).
			const state: QueryState<T, E> = { status: 'success', error: null, data: entry.data };
			this.#updateState(hash, { state, metadata: { origin: 'control', source: 'cache', cache } });
			return { state, next: nullpromise };
		}

		if (cache === 'stale') {
			// Stale from cache (greater time than fresh duration).
			const state: QueryState<T, E> = { status: 'stale', error: null, data: entry.data };
			this.#updateState(hash, { state, metadata: { origin: 'control', source: 'cache', cache } });

			// eslint-disable-next-line @typescript-eslint/return-await
			return this.#tryCurrentPromiseOrRunBackgroundQuery(state, { key, hash }, cache, ctl);
		}

		// eslint-disable-next-line @typescript-eslint/return-await
		return this.#tryCurrentPromiseOrRunQuery({ key, hash }, cache, ctl);
	}

	public use(key: K): void {
		const hash = this.keyHashFn(key);
		this.#subscriber.useTopic(hash);
		this.#state = { data: this.#placeholder, error: null, status: 'idle' };
	}

	public reset(): void {
		this.#subscriber.unsubscribe();
		this.#state = { data: this.#placeholder, error: null, status: 'idle' };
	}

	/**
	 * @description Get the current query state.
	 * @returns current query state
	 */
	public getState(): QueryState<T, E> {
		return this.#state;
	}

	public dispose(): void {
		this.#subscriber.unsubscribe();
	}

	public [Symbol.dispose](): void {
		this.dispose();
	}

	async #tryCurrentPromiseOrRunQuery(
		{ key, hash }: KeyPair<K>,
		cache: QueryCache,
		ctl: AbortController
	): Promise<QueryExecutorResult<T, E>> {
		const state: QueryState<T, E> = { status: 'loading', data: this.#state.data, error: null };
		const metadata: QueryStateMetadata = { origin: 'control', source: 'query', cache };

		this.#updateState(hash, { state, metadata });

		const currPromise = this.#subscriber.getCurrentState();
		if (currPromise?.status === 'pending') {
			currPromise.then((state: QueryState<T, E>) => {
				this.#updateState(hash, { state, metadata: { origin: 'control', source: 'query', cache } });
			});

			return { state: await currPromise, next: nullpromise };
		}

		const promise = this.#runQuery({ key, hash }, cache, 'query', ctl);
		this.#subscriber.setCurrentState(makeObservablePromise(promise));
		return { state: await promise, next: nullpromise };
	}

	async #tryCurrentPromiseOrRunBackgroundQuery(
		state: QueryState<T, E>,
		{ key, hash }: KeyPair<K>,
		cache: QueryCache,
		ctl: AbortController
	): Promise<QueryExecutorResult<T, E>> {
		const currPromise = this.#subscriber.getCurrentState();
		if (currPromise?.status === 'pending') {
			currPromise.then((state: QueryState<T, E>) => {
				this.#updateState(hash, {
					state,
					metadata: { origin: 'control', source: 'background-query', cache },
				});
			});

			return { state, next: () => currPromise };
		}

		/**
		 * `runQuery` should run in the background, so it's promise
		 * **must not** be awaited.
		 */
		const queryPromise = this.#runQuery({ key, hash }, cache, 'background-query', ctl);
		this.#subscriber.setCurrentState(makeObservablePromise(queryPromise));
		return { state, next: () => queryPromise };
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
	 * @param key key pair (key value, hash)
	 * @param key.key query function input
	 * @param key.hash key hash string
	 * @param cache query cache directive
	 * @param source query source
	 * @param ctl abort controller
	 * @returns query state
	 */
	async #runQuery(
		{ key, hash }: KeyPair<K>,
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
			return (
				(await this.#fetchResolve(ok, hash, cache, source).catch(blackhole)) ?? this.getState()
			);
		} catch (err: unknown) {
			return (
				(await this.#fetchReject(err, hash, cache, source).catch(blackhole)) ?? this.getState()
			);
		}
	}

	async #fetchResolve(
		data: T,
		hash: string,
		cache: QueryCache,
		source: QueryStateNoCacheSource
	): Promise<QueryState<T, E>> {
		const state: QueryState<T, E> = { status: 'success', error: null, data };
		await this.#internalCache.set(hash, data, this.ttl).catch(blackhole);
		this.#updateState(hash, { state, metadata: { origin: 'control', source, cache } });
		return state;
	}

	async #fetchReject(
		err: unknown,
		hash: string,
		cache: QueryCache,
		source: QueryStateNoCacheSource
	): Promise<QueryState<T, E>> {
		const state: QueryState<T, E> = { status: 'error', error: err as E, data: null };
		if (!this.#keepCacheOnError(err as E)) {
			await this.#internalCache.delete(hash).catch(blackhole);
		}
		this.#updateState(hash, { state, metadata: { origin: 'control', source, cache } });
		return state;
	}

	#updateState(hash: string, { state, metadata }: QueryProviderState<T, E>): void {
		if (this.#subscriber.currentTopic() !== hash) {
			return;
		}

		if (!this.#stateFilterFn({ current: this.#state, next: state, metadata })) {
			return;
		}

		this.#state = state;

		if (this.#state.data !== null) {
			this.#handler.dataFn?.(this.#state.data, metadata, this.cache)?.catch(blackhole);
		}
		if (this.#state.error !== null) {
			this.#handler.errorFn?.(this.#state.error, metadata, this.cache)?.catch(blackhole);
		}
		this.#handler.stateFn?.(this.#state, metadata, this.cache)?.catch(blackhole);

		if (metadata.origin === 'control') {
			this.#subscriber.publishTopic(hash, {
				state: this.#state,
				metadata: { origin: 'provider', source: metadata.source, cache: metadata.cache },
			});
		}
	}

	#state: QueryState<T, E>;
	readonly #placeholder: T | null;
	readonly #internalCache: CacheStore<string, T>;
	readonly #subscriber: Subscriber<QueryProviderState<T, E>, QueryStatePromise<T, E>>;
	readonly #handler: QueryControlHandler<T, E>;
	readonly #queryFn: QueryFn<K, T>;
	readonly #stateFilterFn: QueryStateFilterFn<T, E>;
	readonly #keepCacheOnError: KeepCacheOnError<E>;
	readonly #retryHandleFn: RetryHandlerFn<E> | null;
}
