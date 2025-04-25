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

export interface IdleQueryState {
	// TODO: add data placeholder into idle state
	readonly data: null;
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
	| IdleQueryState
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

export interface QueryProviderStateMetadata extends QueryStateMetadata {
	readonly origin: 'provider';
}

export interface QueryProviderState<T, E> {
	readonly state: QueryState<T, E>;
	readonly metadata: QueryProviderStateMetadata;
}

export type QueryStateHandler<T, E> = (
	state: QueryState<T, E>,
	metadata: QueryStateMetadata
) => Promise<void>;

export type DataHandler<T> = (data: T, metadata: QueryStateMetadata) => Promise<void>;

export type ErrorHandler<E> = (error: E, metadata: QueryStateMetadata) => Promise<void>;

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

export interface MutationState<T, E> {
	readonly data: T | null;
	readonly error: E | null;
	readonly status: MutationStatus;
}

export type MutationFn<I, T> = (input: I, signal: AbortSignal) => Promise<T>;

export type MutationStateHandler<T, E> = (state: MutationState<T, E>) => Promise<void>;

export type MutationDataHandler<T> = (data: T) => Promise<void>;

export type MutationErrorHandler<E> = (error: E) => Promise<void>;

export interface MutationControlHandler<T, E> {
	stateFn?: MutationStateHandler<T, E>;
	dataFn?: MutationDataHandler<T>;
	errorFn?: MutationErrorHandler<E>;
}
