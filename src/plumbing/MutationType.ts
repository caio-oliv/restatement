import type {
	CacheManager,
	RetryPolicy,
	MutationFn,
	RetryHandlerFn,
	MutationFilterFn,
	MutationStateHandler,
	MutationDataHandler,
	MutationErrorHandler,
	MutationState,
} from '@/lib';

/**
 * @summary Mutation context
 */
export interface MutationContext<I, T, E = unknown> {
	/**
	 * @summary Idle state placeholder
	 */
	readonly placeholder: T | null;
	/**
	 * @summary Cache manager
	 * @description Public cache interface for interacting with cached data.
	 */
	readonly cache: CacheManager;
	/**
	 * @summary Retry policy
	 */
	readonly retryPolicy: RetryPolicy<E>;
	/**
	 * @summary Mutation function
	 */
	mutationFn: MutationFn<I, T>;
	/**
	 * @summary Retry handler
	 * @description Callback executed **before** every retry
	 */
	retryHandleFn: RetryHandlerFn<E> | null;
	/**
	 * @summary Mutation state handler
	 */
	stateFn: MutationStateHandler<T, E> | null;
	/**
	 * @summary Mutation data handler
	 */
	dataFn: MutationDataHandler<T> | null;
	/**
	 * @summary Mutation error handler
	 */
	errorFn: MutationErrorHandler<E> | null;
	/**
	 * @summary Mutation state filter
	 */
	filterFn: MutationFilterFn<T, E>;
	/**
	 * @summary Mutation state
	 */
	state: MutationState<T, E>;
}

/**
 * @summary Mutation input
 * @description Mutation input options that make up the mutation context.
 */
export interface MutationInput<I, T, E = unknown> {
	/**
	 * @summary Idle state placeholder
	 */
	placeholder?: T | null;
	/**
	 * @summary Cache manager
	 * @description Public cache interface for interacting with cached data.
	 */
	cache: CacheManager;
	/**
	 * @summary Mutation function
	 */
	mutationFn: MutationFn<I, T>;
	/**
	 * @summary Retry policy
	 */
	retryPolicy?: RetryPolicy<E>;
	/**
	 * @summary Retry handler
	 * @description Callback executed **before** every retry
	 */
	retryHandleFn?: RetryHandlerFn<E> | null;
	/**
	 * @summary Mutation state handler
	 */
	stateFn?: MutationStateHandler<T, E> | null;
	/**
	 * @summary Mutation data handler
	 */
	dataFn?: MutationDataHandler<T> | null;
	/**
	 * @summary Mutation error handler
	 */
	errorFn?: MutationErrorHandler<E> | null;
	/**
	 * @summary Mutation state filter
	 */
	filterFn?: MutationFilterFn<T, E>;
}

/**
 * @summary Local mutation input
 * @description Local input options for a mutation context
 */
export type LocalMutationInput<I, T, E = unknown> = Pick<
	MutationInput<I, T, E>,
	| 'placeholder'
	| 'mutationFn'
	| 'retryPolicy'
	| 'retryHandleFn'
	| 'stateFn'
	| 'dataFn'
	| 'errorFn'
	| 'filterFn'
>;
