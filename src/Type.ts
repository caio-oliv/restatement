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

export type QueryFn<K, T> = (key: K, signal: AbortSignal) => Promise<T>;

export type KeyHashFn<K> = (key: K) => string;

export type KeepCacheOnError<E> = (err: E) => boolean;

export interface QueryState<T, E> {
	readonly data: T | null;
	readonly error: E | null;
	readonly status: FetchStatus;
}

export type QueryStateHandler<T, E> = (state: QueryState<T, E>) => void;

export type DataHandler<T> = (data: T) => void;

export type ErrorHandler<E> = (error: E) => void;

// TODO: support async handler functions
export interface QueryControlHandler<T, E> {
	stateFn?: QueryStateHandler<T, E>;
	dataFn?: DataHandler<T>;
	errorFn?: ErrorHandler<E>;
}

export type MutationStatus = 'idle' | 'loading' | 'success' | 'error';

export interface MutationState<T, E> {
	readonly data: T | null;
	readonly error: E | null;
	readonly status: MutationStatus;
}

export type MutationFn<I, T> = (input: I, signal: AbortSignal) => Promise<T>;

export type MutationStateHandler<T, E> = (state: MutationState<T, E>) => void;

// TODO: support async handler functions
export interface MutationControlHandler<T, E> {
	stateFn?: MutationStateHandler<T, E>;
	dataFn?: DataHandler<T>;
	errorFn?: ErrorHandler<E>;
}
