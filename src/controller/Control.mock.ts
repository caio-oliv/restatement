import { vi, type Mock } from 'vitest';
import type {
	QueryDataHandler,
	QueryErrorHandler,
	MutationHandler,
	MutationDataHandler,
	MutationErrorHandler,
	MutationStateHandler,
	QueryHandler,
	QueryStateHandler,
} from '@/core/Type';
import { waitUntil } from '@/core/RetryPolicy';

/**
 * Make a empty promise
 */
async function emptypromise(): Promise<void> {
	/* no-op */
}

export interface MockQueryHandler<T, E> extends QueryHandler<T, E> {
	stateFn: Mock<QueryStateHandler<T, E>>;
	dataFn: Mock<QueryDataHandler<T>>;
	errorFn: Mock<QueryErrorHandler<E>>;
}

/**
 * @description Mock the {@link QueryHandler} functions
 * @returns mock of `QueryHandler`
 */
export function mockQueryHandler<T, E = unknown>(): MockQueryHandler<T, E> {
	return {
		dataFn: vi.fn(emptypromise),
		errorFn: vi.fn(emptypromise),
		stateFn: vi.fn(emptypromise),
	};
}

export interface MockMutationHandler<T, E> extends MutationHandler<T, E> {
	stateFn: Mock<MutationStateHandler<T, E>>;
	dataFn: Mock<MutationDataHandler<T>>;
	errorFn: Mock<MutationErrorHandler<E>>;
}

/**
 * @description Mock the {@link MutationHandler} functions
 * @returns mock of `MutationHandler`
 */
export function mockMutationHandler<T, E = unknown>(): MockMutationHandler<T, E> {
	return {
		dataFn: vi.fn(emptypromise),
		errorFn: vi.fn(emptypromise),
		stateFn: vi.fn(emptypromise),
	};
}

/**
 * @description Immediate retry delay function
 * @returns immediate delay as zero
 */
export function immediateRetryDelay(): number {
	return 0;
}

export type TestTransformerFn = (keys: [string, ...Array<string>]) => Promise<string>;

/**
 * @description Function for tests that returns data if a hash (pound, sharp) symbol ('#') is found.
 * @param keys - key string
 * @returns promise with data result
 */
export async function testTransformer(keys: [string, ...Array<string>]): Promise<string> {
	const key = keys[0];
	if (!key.startsWith('key#')) {
		throw new Error('invalid_key');
	}

	let value = 'data#' + key.slice(4);
	if (keys.length > 1) {
		value += ':' + keys.slice(1).join(':');
	}

	return value;
}

/**
 * @description Make a delayed test transformer function
 * @param delay - wait time in milliseconds
 * @returns Delayed {@link testTransformer}
 */
export function delayedTestTransformer(delay: number): TestTransformerFn {
	return async (keys: [string, ...Array<string>]): Promise<string> => {
		await waitUntil(delay);
		return await testTransformer(keys);
	};
}
