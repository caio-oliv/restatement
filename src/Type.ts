/**
 * Duration in Millisecond precision
 */
export type Millisecond = number;

/**
 * Fetch status
 *
 * TODO: explain each
 */
export type FetchStatus = 'idle' | 'loading' | 'stale' | 'success' | 'error';

/**
 * Query cache control
 *
 * TODO: explain each
 */
export type QueryCache = 'no-cache' | 'stale' | 'fresh';

export type QueryFn<K extends ReadonlyArray<unknown>, T> = (
	key: K,
	signal: AbortSignal
) => Promise<T>;

export type KeyHashFn<K extends ReadonlyArray<unknown>> = (key: K) => string;

export type KeepCacheOnError<E> = (err: E) => boolean;

export interface CacheHandler {
	set<K extends ReadonlyArray<unknown>, T>(key: K, data: T, ttl?: Millisecond): Promise<void>;
	get<K extends ReadonlyArray<unknown>, T>(key: K): Promise<T | undefined>;
	invalidate<K extends ReadonlyArray<unknown>>(key: K): Promise<void>;
	delete<K extends ReadonlyArray<unknown>>(key: K): Promise<void>;
}

export interface IdleQueryState<T> {
	readonly data: T | null;
	readonly error: null;
	readonly status: 'idle';
}

export interface LoadingQueryState<T> {
	readonly data: T | null;
	readonly error: null;
	readonly status: 'loading';
}

export interface StaleQueryState<T> {
	readonly data: T;
	readonly error: null;
	readonly status: 'stale';
}

export interface SuccessQueryState<T> {
	readonly data: T;
	readonly error: null;
	readonly status: 'success';
}

export interface ErrorQueryState<E> {
	readonly data: null;
	readonly error: E;
	readonly status: 'error';
}

export type QueryState<T, E> =
	| IdleQueryState<T>
	| LoadingQueryState<T>
	| StaleQueryState<T>
	| SuccessQueryState<T>
	| ErrorQueryState<E>;

export type QueryStateSource = 'query' | 'cache' | 'background-query';

export type QueryStateOrigin = 'control' | 'provider';

export interface QueryStateMetadata {
	readonly origin: QueryStateOrigin;
	readonly source: QueryStateSource;
	readonly cache: QueryCache;
}

export interface MutationStateMetadata {
	readonly origin: 'provider';
	readonly source: 'mutation';
	readonly cache: 'none';
}

export type StateMetadata = QueryStateMetadata | MutationStateMetadata;

export interface QueryProviderState<T, E> {
	readonly state: QueryState<T, E>;
	readonly metadata: StateMetadata;
}

export type PromiseStatus = 'pending' | 'fulfilled' | 'rejected';

export interface ObservablePromise<T> extends Promise<T> {
	readonly status: PromiseStatus;
}

export type QueryStatePromise<T, E> = ObservablePromise<QueryState<T, E>>;

export interface QueryStateFilterInfo<T, E> {
	readonly current: QueryState<T, E>;
	readonly next: QueryState<T, E>;
	readonly metadata: StateMetadata;
}

export type QueryStateFilterFn<T, E> = (info: QueryStateFilterInfo<T, E>) => boolean;

export type QueryStateHandler<T, E> = (
	state: QueryState<T, E>,
	metadata: StateMetadata,
	cache: CacheHandler
) => Promise<void>;

export type DataHandler<T> = (
	data: T,
	metadata: StateMetadata,
	cache: CacheHandler
) => Promise<void>;

export type ErrorHandler<E> = (
	error: E,
	metadata: StateMetadata,
	cache: CacheHandler
) => Promise<void>;

export interface QueryControlHandler<T, E> {
	stateFn?: QueryStateHandler<T, E>;
	dataFn?: DataHandler<T>;
	errorFn?: ErrorHandler<E>;
}

export type NextQueryState<T, E> = QueryState<T, E> | null;

export interface QueryExecutorResult<T, E> {
	state: QueryState<T, E>;
	next(): Promise<NextQueryState<T, E>>;
}

export type MutationStatus = 'idle' | 'loading' | 'success' | 'error';

export interface IdleMutationState<T> {
	readonly data: T | null;
	readonly error: null;
	readonly status: 'idle';
}

export interface LoadingMutationState {
	readonly data: null;
	readonly error: null;
	readonly status: 'loading';
}

export interface SuccessMutationState<T> {
	readonly data: T;
	readonly error: null;
	readonly status: 'success';
}

export interface ErrorMutationState<E> {
	readonly data: null;
	readonly error: E | null;
	readonly status: 'error';
}

export type MutationState<T, E> =
	| IdleMutationState<T>
	| LoadingMutationState
	| SuccessMutationState<T>
	| ErrorMutationState<E>;

export type MutationFn<I, T> = (input: I, signal: AbortSignal) => Promise<T>;

export interface MutationStateFilterInfo<T, E> {
	readonly current: MutationState<T, E>;
	readonly next: MutationState<T, E>;
}

export type MutationStateFilterFn<T, E> = (info: MutationStateFilterInfo<T, E>) => boolean;

export type MutationStateHandler<T, E> = (
	state: MutationState<T, E>,
	cache: CacheHandler
) => Promise<void>;

export type MutationDataHandler<T> = (data: T, cache: CacheHandler) => Promise<void>;

export type MutationErrorHandler<E> = (error: E, cache: CacheHandler) => Promise<void>;

export interface MutationControlHandler<T, E> {
	stateFn?: MutationStateHandler<T, E>;
	dataFn?: MutationDataHandler<T>;
	errorFn?: MutationErrorHandler<E>;
}
