import type { CacheStore } from '@/cache/CacheStore';
import { type RetryHandlerFn, retryAsyncOperation } from '@/AsyncModule';
import { DummySubscriber, type PubSub, type Subscriber, SubscriberHandle } from '@/PubSub';
import type {
	QueryFn,
	KeyHashFn,
	QueryState,
	QueryCache,
	KeepCacheOnErrorFn,
	Millisecond,
	QueryExecutorResult,
	QueryProviderState,
	QueryStateMetadata,
	QueryStatePromise,
	QueryFilterFn,
	ErrorHandler,
	DataHandler,
	QueryStateHandler,
	KeyPair,
	QueryStateNoCacheSource,
	QueryResetTarget,
} from '@/Type';
import {
	defaultKeyHashFn,
	defaultKeepCacheOnErrorFn,
	DEFAULT_FRESH_DURATION,
	DEFAULT_TTL_DURATION,
	defaultFilterFn,
	DEFAULT_RETRY_POLICY,
} from '@/Default';
import { blackhole, makeObservablePromise, nullpromise } from '@/Internal';
import { CacheManager } from '@/cache/CacheManager';
import { isCacheEntryFresh } from '@/cache/CacheHelper';
import type { RetryPolicy } from '@/RetryPolicy';

export interface QueryControlInput<K extends ReadonlyArray<unknown>, T, E = unknown> {
	/**
	 * Idle state placeholder
	 */
	placeholder?: T | null;
	/**
	 * Cache store
	 */
	store: CacheStore<string, T>;
	/**
	 * Query function
	 *
	 * The function that will be called to query the data `T`.
	 */
	queryFn: QueryFn<K, T>;
	/**
	 * Key hasher
	 */
	keyHashFn?: KeyHashFn<K>;
	/**
	 * Retry policy
	 */
	retryPolicy?: RetryPolicy<E>;
	/**
	 * Retry handler function
	 */
	retryHandleFn?: RetryHandlerFn<E> | null;
	/**
	 * Use the previus cached data on error of the `queryFn`
	 */
	keepCacheOnErrorFn?: KeepCacheOnErrorFn<E>;
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
	 * @summary Query state handler
	 */
	stateFn?: QueryStateHandler<T, E> | null;
	/**
	 * @summary Query data handler
	 */
	dataFn?: DataHandler<T> | null;
	/**
	 * @summary Query error handler
	 */
	errorFn?: ErrorHandler<E> | null;
	/**
	 * Query state filter function
	 */
	filterFn?: QueryFilterFn<T, E>;
	/**
	 * State provider.
	 */
	provider?: QueryControlProvider<T, E> | null;
}

export type QueryControlProvider<T, E> = PubSub<QueryProviderState<T, E>, QueryStatePromise<T, E>>;

export class QueryControl<K extends ReadonlyArray<unknown>, T, E = unknown> {
	/**
	 * @summary Key hash function.
	 * @description Hash function that produces a unique key string based on the query input.
	 */
	public readonly keyHashFn: KeyHashFn<K>;
	/**
	 * @summary Query function.
	 * @description Query function that takes as arguments the input and produces a result asynchronously
	 */
	public queryFn: QueryFn<K, T>;
	/**
	 * @summary Query state filter function.
	 */
	public filterFn: QueryFilterFn<T, E>;
	/**
	 * @summary Keep cache on error function.
	 */
	public keepCacheOnErrorFn: KeepCacheOnErrorFn<E>;
	/**
	 * @summary Retry handler function.
	 */
	public retryHandleFn: RetryHandlerFn<E> | null;

	/**
	 * @summary State handler function.
	 */
	public stateFn: QueryStateHandler<T, E> | null;
	/**
	 * @summary Data handler function.
	 */
	public dataFn: DataHandler<T> | null;
	/**
	 * @summary Error handler function.
	 */
	public errorFn: ErrorHandler<E> | null;
	/**
	 * @summary Retry policy.
	 */
	public readonly retryPolicy: RetryPolicy<E>;

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
	/**
	 * @description Interface to manage cache entries based on query keys
	 */
	public readonly cache: CacheManager;

	public constructor({
		placeholder = null,
		store,
		queryFn,
		keyHashFn = defaultKeyHashFn,
		retryPolicy = DEFAULT_RETRY_POLICY,
		retryHandleFn = null,
		keepCacheOnErrorFn = defaultKeepCacheOnErrorFn,
		fresh = DEFAULT_FRESH_DURATION,
		ttl = DEFAULT_TTL_DURATION,
		filterFn = defaultFilterFn,
		stateFn = null,
		dataFn = null,
		errorFn = null,
		provider = null,
	}: QueryControlInput<K, T, E>) {
		this.#placeholder = placeholder;
		this.#internalCache = store;
		this.keyHashFn = keyHashFn;
		this.queryFn = queryFn;
		this.retryPolicy = retryPolicy;
		this.retryHandleFn = retryHandleFn;
		this.keepCacheOnErrorFn = keepCacheOnErrorFn;
		this.fresh = fresh;
		this.ttl = ttl;
		this.cache = new CacheManager({
			store,
			keyHashFn: keyHashFn as KeyHashFn<ReadonlyArray<unknown>>,
			provider: provider as QueryControlProvider<unknown, unknown>,
			ttl,
		});
		this.#state = { data: this.#placeholder, error: null, status: 'idle' };
		this.stateFn = stateFn;
		this.dataFn = dataFn;
		this.errorFn = errorFn;
		this.filterFn = filterFn;
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

		if ((cache === 'fresh' || cache === 'stale') && isCacheEntryFresh(entry, this.fresh)) {
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

	public use(key: K, target: QueryResetTarget = 'state'): void {
		const hash = this.keyHashFn(key);
		this.#subscriber.useTopic(hash);
		this.#state = { data: this.#placeholder, error: null, status: 'idle' };

		if (target === 'handler') {
			this.stateFn?.(
				this.#state,
				{ cache: 'none', origin: 'control', source: 'initialization' },
				this.cache
			)?.catch(blackhole);
		}
	}

	public reset(target: QueryResetTarget = 'state'): void {
		this.#subscriber.unsubscribe();
		this.#state = { data: this.#placeholder, error: null, status: 'idle' };

		if (target === 'handler') {
			this.stateFn?.(
				this.#state,
				{ cache: 'none', origin: 'control', source: 'initialization' },
				this.cache
			)?.catch(blackhole);
		}
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
			const localQueryFn = this.queryFn;
			const ok = await retryAsyncOperation(
				() => localQueryFn(key, ctl.signal),
				this.retryPolicy,
				this.retryHandleFn
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
		if (!this.keepCacheOnErrorFn(err as E)) {
			await this.#internalCache.delete(hash).catch(blackhole);
		}
		this.#updateState(hash, { state, metadata: { origin: 'control', source, cache } });
		return state;
	}

	#updateState(hash: string, { state, metadata }: QueryProviderState<T, E>): void {
		if (this.#subscriber.currentTopic() !== hash) {
			return;
		}

		if (!this.filterFn({ current: this.#state, next: state, metadata })) {
			return;
		}

		this.#state = state;

		if (this.#state.data !== null) {
			this.dataFn?.(this.#state.data, metadata, this.cache)?.catch(blackhole);
		}
		if (this.#state.error !== null) {
			this.errorFn?.(this.#state.error, metadata, this.cache)?.catch(blackhole);
		}
		this.stateFn?.(this.#state, metadata, this.cache)?.catch(blackhole);

		if (metadata.origin === 'control') {
			this.#subscriber.publishTopic(hash, {
				state: this.#state,
				metadata: {
					origin: 'provider',
					source: metadata.source,
					cache: metadata.cache,
				} as QueryStateMetadata,
			});
		}
	}

	#state: QueryState<T, E>;
	readonly #placeholder: T | null;
	readonly #internalCache: CacheStore<string, T>;
	readonly #subscriber: Subscriber<QueryProviderState<T, E>, QueryStatePromise<T, E>>;
}
