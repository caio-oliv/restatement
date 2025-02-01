import { CacheStore } from '@/Cache';
import { RetryDelay, RetryHandlerFn, retryAsyncOperation } from '@/AsyncModule';
import { JitterExponentialBackoffTimer } from '@/TimerModule';
import { PubSub, SubscriberHandle } from '@/PubSub';
import type {
	QueryFn,
	KeyHashFn,
	RemoteStateQueryHandler,
	QueryState,
	QueryCache,
	KeepCacheOnError,
	DataHandler,
	ErrorHandler,
	Millisecond,
} from '@/Type';

export interface RemoteStateQueryInput<K, T, E> {
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
	handler?: RemoteStateQueryHandler<T, E>;
	/**
	 * State provider.
	 */
	stateProvider?: PubSub<QueryState<T, E>> | null;
}

export const DEFAULT_RETRY = 3;
export const DEFAULT_FRESH_TIME = 30 * 1000; // 30 seconds
export const DEFAULT_STALE_TIME = 3 * 60 * 1000; // 3 minutes
export const DEFAULT_RETRY_DELAY = new JitterExponentialBackoffTimer(1000, 30 * 1000);

export function defaultKeyHashFn<T>(key: T): string {
	return JSON.stringify(key);
}

export function defaultKeepCacheOnError() {
	return false;
}

export function defaultQueryState<T, E>(): QueryState<T, E> {
	return {
		data: null,
		error: null,
		status: 'idle',
	};
}

export function defaultQueryHandler<T, E>(): RemoteStateQueryHandler<T, E> {
	return {
		dataFn: undefined,
		errorFn: undefined,
		stateFn: undefined,
	};
}

export class RemoteStateQuery<K, T, E> {
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
	}: RemoteStateQueryInput<K, T, E>) {
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
			? new SubscriberHandle(this.updateState, this.stateProvider)
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

		// TODO: fix async cacheStore
		const entry = await this.cacheStore.getEntry(keyHash);
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

	private fetchResolve = (data: T, key: K) => {
		const keyHash = this.keyHashFn(key);
		const state: QueryState<T, E> = {
			status: 'success',
			error: null,
			data,
		};
		// TODO: fix async cacheStore
		this.cacheStore.set(keyHash, data, this.staleDuration + Date.now());
		this.updateState(keyHash, state);
		this.stateProvider?.publish(keyHash, state);
	};

	private fetchReject = (err: unknown, key: K) => {
		const keyHash = this.keyHashFn(key);
		this.updateState(keyHash, {
			status: 'error',
			error: err as E,
			data: null,
		});
		if (!this.keepCacheOnError(err as E)) {
			// TODO: fix async cacheStore
			this.cacheStore.delete(keyHash);
		}
	};

	private updateState = (_: string, state: QueryState<T, E>) => {
		this.state = state;
		if (this.state.data !== null) {
			this.handler.dataFn?.(this.state.data);
		}
		if (this.state.error !== null) {
			this.handler.errorFn?.(this.state.error);
		}
		this.handler.stateFn?.(this.state);
	};

	private readonly cacheStore: CacheStore<string, T>;
	private readonly handler: RemoteStateQueryHandler<T, E>;
	private readonly stateProvider: PubSub<QueryState<T, E>> | null;
	private readonly subscriberHandle: SubscriberHandle<QueryState<T, E>> | null;
	private readonly queryFn: QueryFn<K, T>;
	private readonly keepCacheOnError: KeepCacheOnError<E>;
	private readonly retryHandleFn: RetryHandlerFn | null;
	private state: QueryState<T, E>;
}

export type MutationStatus = 'idle' | 'loading' | 'success' | 'error';

export interface MutationState<T, E> {
	data: T | null;
	error: E | null;
	status: MutationStatus;
}

export type MutationFn<I, T> = (input: I, signal: AbortSignal) => Promise<T>;

export type UpdateMutationStateHandler<T, E> = (state: MutationState<T, E>) => void;

export interface RemoteStateMutationHandler<T, E> {
	stateFn?: UpdateMutationStateHandler<T, E>;
	dataFn?: DataHandler<T>;
	errorFn?: ErrorHandler<E>;
}

export interface RemoteStateMutationInput<I, T, E> {
	mutationFn: MutationFn<I, T>;
	retry?: number;
	retryDelay?: RetryDelay<E>;
	handler?: RemoteStateMutationHandler<T, E>;
}

export function defaultMutationState<T, E>(): MutationState<T, E> {
	return {
		data: null,
		error: null,
		status: 'idle',
	};
}

export function defaultMutationHandler<T, E>(): RemoteStateMutationHandler<T, E> {
	return {
		stateFn: undefined,
		dataFn: undefined,
		errorFn: undefined,
	};
}

export class RemoteStateMutation<I, T, E> {
	public readonly retry: number;
	public readonly retryDelay: RetryDelay<E>;

	public constructor({
		mutationFn,
		retry = 3,
		retryDelay = DEFAULT_RETRY_DELAY.delay,
		handler = defaultMutationHandler(),
	}: RemoteStateMutationInput<I, T, E>) {
		this.mutationFn = mutationFn;
		this.retry = retry;
		this.retryDelay = retryDelay;
		this.handler = handler;
		this.state = defaultMutationState();
	}

	public execute = (input: I, ctl: AbortController = new AbortController()): void => {
		this.state.status = 'loading';
		this.handler.stateFn?.({ ...this.state });
		retryAsyncOperation(() => this.mutationFn(input, ctl.signal), this.retryDelay, this.retry)
			.then(this.mutationResolve)
			.catch(this.mutationReject);
	};

	public executeAsync = async (
		input: I,
		ctl: AbortController = new AbortController()
	): Promise<T | E> => {
		try {
			this.state.status = 'loading';
			this.handler.stateFn?.({ ...this.state });
			const data = await retryAsyncOperation(
				() => this.mutationFn(input, ctl.signal),
				this.retryDelay,
				this.retry
			);
			this.mutationResolve(data);
			return data;
		} catch (err: unknown) {
			this.mutationReject(err as E);
			return err as E;
		}
	};

	public getState = (): MutationState<T, E> => {
		return this.state;
	};

	private mutationResolve = (data: T) => {
		this.state.error = null;
		this.state.data = data;
		this.state.status = 'success';
		this.handler.dataFn?.(data);
		this.handler.stateFn?.({ ...this.state });
	};

	private mutationReject = (err: E) => {
		this.state.error = err;
		this.state.data = null;
		this.state.status = 'error';
		this.handler.errorFn?.(err);
		this.handler.stateFn?.({ ...this.state });
	};

	private readonly handler: RemoteStateMutationHandler<T, E>;
	private readonly mutationFn: MutationFn<I, T>;
	private state: MutationState<T, E>;
}

export interface RemoteStateCacheControlInput {
	keyHashFn?: KeyHashFn<unknown>;
	/**
	 * Cache duration.
	 */
	duration?: Millisecond;
	/**
	 * Cache store.
	 */
	cacheStore: CacheStore<string, unknown>;
	/**
	 * State provider.
	 */
	stateProvider?: PubSub<QueryState<unknown, unknown>> | null;
}

export class RemoteStateCacheControl {
	public readonly keyHashFn: KeyHashFn<unknown>;
	public readonly duration: Millisecond;

	public constructor({
		keyHashFn = defaultKeyHashFn,
		duration = DEFAULT_STALE_TIME,
		cacheStore,
		stateProvider,
	}: RemoteStateCacheControlInput) {
		this.keyHashFn = keyHashFn;
		this.duration = duration;
		this.cacheStore = cacheStore;
		this.stateProvider = stateProvider;
	}

	public setValue = async <K, T>(key: K, data: T, duration?: Millisecond): Promise<void> => {
		const keyHash = this.keyHashFn(key);
		// TODO: fix async cacheStore
		await this.cacheStore.set(keyHash, data, (duration ?? this.duration) + Date.now());
		this.stateProvider?.publish(keyHash, {
			data,
			error: null,
			status: 'success',
		});
	};

	public getValue = async <K, T>(key: K): Promise<T | undefined> => {
		const keyHash = this.keyHashFn(key);
		// TODO: fix async cacheStore
		return await (this.cacheStore as CacheStore<string, T>).get(keyHash);
	};

	private readonly cacheStore: CacheStore<string, unknown>;
	private readonly stateProvider?: PubSub<QueryState<unknown, unknown>> | null;
}
