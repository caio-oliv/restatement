import type { CacheStore } from '@/Cache';
import { type RetryDelay, type RetryHandlerFn, retryAsyncOperation } from '@/AsyncModule';
import { PubSub, SubscriberHandle } from '@/PubSub';
import type {
	QueryFn,
	KeyHashFn,
	QueryControlHandler,
	QueryState,
	QueryCache,
	KeepCacheOnError,
	Millisecond,
} from '@/Type';
import {
	defaultKeyHashFn,
	DEFAULT_RETRY_DELAY,
	DEFAULT_RETRY,
	defaultKeepCacheOnError,
	DEFAULT_FRESH_TIME,
	DEFAULT_STALE_TIME,
	defaultQueryHandler,
	defaultQueryState,
} from '@/Default';
import { blackhole } from '@/Internal';

export interface QueryControlInput<K, T, E> {
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
	 *
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
	keepCacheOnError?: (err: E) => boolean;
	/**
	 * Time in milliseconds that the data is considered fresh.
	 *
	 * # Invariant
	 *
	 * `freshDuration` must be less than `staleDuration`
	 *
	 * @default 30 * 1000; // 30 seconds
	 */
	freshDuration?: Millisecond;
	/**
	 * Time in milliseconds that the data is considered stale.
	 *
	 * # Invariant
	 *
	 * `staleDuration` must be greater than `freshDuration`
	 *
	 * @default 3 * 60 * 1000 // 3 minutes
	 */
	staleDuration?: Millisecond;
	/**
	 * Update handlers.
	 */
	handler?: QueryControlHandler<T, E>;
	/**
	 * State provider.
	 */
	stateProvider?: PubSub<QueryState<T, E>> | null;
}

export class QueryControl<K, T, E> {
	public readonly keyHashFn: KeyHashFn<K>;
	public readonly retry: number;
	public readonly retryDelay: RetryDelay<E>;
	public readonly freshDuration: Millisecond;
	public readonly staleDuration: Millisecond;

	public constructor({
		cacheStore,
		queryFn,
		keyHashFn = defaultKeyHashFn,
		retryDelay = DEFAULT_RETRY_DELAY.delay,
		retry = DEFAULT_RETRY,
		retryHandleFn = null,
		keepCacheOnError = defaultKeepCacheOnError,
		freshDuration = DEFAULT_FRESH_TIME,
		staleDuration = DEFAULT_STALE_TIME,
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
		this.freshDuration = freshDuration;
		this.staleDuration = staleDuration;
		this.state = defaultQueryState();
		this.handler = handler;
		this.stateProvider = stateProvider;
		this.subscriberHandle = this.stateProvider
			? new SubscriberHandle(this.updateState.bind(this), this.stateProvider)
			: null;
	}

	// TODO: return `QueryState<T, E>`
	public execute = async (
		key: K,
		cache: QueryCache = 'stale',
		ctl: AbortController = new AbortController()
	): Promise<void> => {
		const keyHash = this.keyHashFn(key);
		this.subscriberHandle?.useTopic(keyHash);

		if (cache === 'no-cache') {
			this.makeQueryNoCache(key, ctl);
			return;
		}

		const entry = await this.cacheStore.getEntry(keyHash).catch(blackhole);
		if (entry === undefined) {
			this.makeQueryNoCache(key, ctl);
			return;
		}

		if (
			(cache === 'fresh' || cache === 'stale') &&
			entry.ttl - entry.remain_ttl < this.freshDuration
		) {
			// Fresh from cache (less time than fresh duration).
			const state: QueryState<T, E> = {
				status: 'success',
				error: null,
				data: entry.data,
			};
			this.updateState(keyHash, state);
			this.stateProvider?.publish(keyHash, state);
			return;
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
			// make query in background.
			this.runQuery(key, ctl);
			return;
		}

		this.makeQueryNoCache(key, ctl);
	};

	/**
	 * Get the current query state.
	 *
	 * @returns {QueryState<T, E>} current query state.
	 */
	public getState = (): QueryState<T, E> => {
		return this.state;
	};

	public dispose = () => {
		this.subscriberHandle?.unsubscribe();
	};

	private makeQueryNoCache = (key: K, ctl: AbortController) => {
		// Fetching status should not be published.
		const state: QueryState<T, E> = {
			status: 'loading',
			data: this.state.data,
			error: null,
		};
		this.state = state;
		this.handler.stateFn?.(this.state);
		this.runQuery(key, ctl);
	};

	private runQuery = (key: K, ctl: AbortController) => {
		retryAsyncOperation(
			() => this.queryFn(key, ctl.signal),
			this.retryDelay,
			this.retry,
			this.retryHandleFn
		)
			.then(ok => this.fetchResolve(ok, key))
			.catch(err => this.fetchReject(err, key));
	};

	private async fetchResolve(data: T, key: K) {
		const keyHash = this.keyHashFn(key);
		const state: QueryState<T, E> = {
			status: 'success',
			error: null,
			data,
		};
		await this.cacheStore.set(keyHash, data, this.staleDuration).catch(blackhole);
		this.updateState(keyHash, state);
		this.stateProvider?.publish(keyHash, state);
	}

	private async fetchReject(err: unknown, key: K) {
		const keyHash = this.keyHashFn(key);
		this.updateState(keyHash, {
			status: 'error',
			error: err as E,
			data: null,
		});
		if (!this.keepCacheOnError(err as E)) {
			await this.cacheStore.delete(keyHash).catch(blackhole);
		}
	}

	private updateState(_: string, state: QueryState<T, E>): void {
		this.state = state;
		if (this.state.data !== null) {
			this.handler.dataFn?.(this.state.data);
		}
		if (this.state.error !== null) {
			this.handler.errorFn?.(this.state.error);
		}
		this.handler.stateFn?.(this.state);
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
