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
 * Mutation context
 * @description A mutation context describes the state and behavior of a particular mutation.
 *
 * It is an aggregate of every component that makes a mutation.
 * @typeParam I Mutation input
 * @typeParam T Return value of a successful mutation
 * @typeParam E Error from a failed {@link MutationFn mutation} execution
 */
export interface MutationContext<I, T, E = unknown> {
	/**
	 * Idle state placeholder
	 */
	readonly placeholder: T | null;
	/**
	 * Cache manager
	 * @description Public cache interface for interacting with cached data.
	 */
	readonly cache: CacheManager;
	/**
	 * Retry policy
	 */
	readonly retryPolicy: RetryPolicy<E>;
	/**
	 * Mutation function
	 */
	mutationFn: MutationFn<I, T>;
	/**
	 * Retry handler
	 * @description Callback executed **before** every retry
	 */
	retryHandleFn: RetryHandlerFn<E> | null;
	/**
	 * Mutation state handler
	 */
	stateFn: MutationStateHandler<T, E> | null;
	/**
	 * Mutation data handler
	 */
	dataFn: MutationDataHandler<T> | null;
	/**
	 * Mutation error handler
	 */
	errorFn: MutationErrorHandler<E> | null;
	/**
	 * Mutation state filter
	 */
	filterFn: MutationFilterFn<T, E>;
	/**
	 * Mutation state
	 */
	state: MutationState<T, E>;
}

/**
 * Mutation context mutable attributes
 */
export type MutationContextMut<I, T, E = unknown> = Pick<
	MutationContext<I, T, E>,
	'mutationFn' | 'retryHandleFn' | 'stateFn' | 'dataFn' | 'errorFn' | 'filterFn' | 'state'
>;

/**
 * Mutation context mutable functions
 */
export type MutationContextMutFns<I, T, E = unknown> = Pick<
	MutationContext<I, T, E>,
	'mutationFn' | 'retryHandleFn' | 'stateFn' | 'dataFn' | 'errorFn' | 'filterFn'
>;

/**
 * Mutation input
 * @description Mutation input options that make up the mutation context.
 * @typeParam I Mutation input
 * @typeParam T Return value of a successful mutation
 * @typeParam E Error from a failed {@link MutationFn mutation} execution
 */
export interface MutationInput<I, T, E = unknown> {
	/**
	 * Idle state placeholder
	 */
	placeholder?: T | null;
	/**
	 * Cache manager
	 * @description Public cache interface for interacting with cached data.
	 */
	cache: CacheManager;
	/**
	 * Mutation function
	 */
	mutationFn: MutationFn<I, T>;
	/**
	 * Retry policy
	 */
	retryPolicy?: RetryPolicy<E>;
	/**
	 * Retry handler
	 * @description Callback executed **before** every retry
	 */
	retryHandleFn?: RetryHandlerFn<E> | null;
	/**
	 * Mutation state handler
	 */
	stateFn?: MutationStateHandler<T, E> | null;
	/**
	 * Mutation data handler
	 */
	dataFn?: MutationDataHandler<T> | null;
	/**
	 * Mutation error handler
	 */
	errorFn?: MutationErrorHandler<E> | null;
	/**
	 * Mutation state filter
	 */
	filterFn?: MutationFilterFn<T, E>;
}

/**
 * Local mutation input
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
