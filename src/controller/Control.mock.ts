import { vi, type Mock } from 'vitest';
import { waitUntil } from '@/AsyncModule';
import type {
	DataHandler,
	ErrorHandler,
	MutationControlHandler,
	MutationStateHandler,
	QueryControlHandler,
	QueryStateHandler,
} from '@/Type';

/**
 * Make a empty promise
 */
async function emptypromise(): Promise<void> {
	/* no-op */
}

export interface MockQueryControlHandler<T, E> extends QueryControlHandler<T, E> {
	stateFn: Mock<QueryStateHandler<T, E>>;
	dataFn: Mock<DataHandler<T>>;
	errorFn: Mock<ErrorHandler<E>>;
}

/**
 * @description Mock the {@link QueryControlHandler} functions
 * @returns mock of `QueryControlHandler`
 */
export function mockQueryControlHandler<T, E = unknown>(): MockQueryControlHandler<T, E> {
	return {
		dataFn: vi.fn(emptypromise),
		errorFn: vi.fn(emptypromise),
		stateFn: vi.fn(emptypromise),
	};
}

export interface MockMutationControlHandler<T, E> extends MutationControlHandler<T, E> {
	stateFn: Mock<MutationStateHandler<T, E>>;
	dataFn: Mock<DataHandler<T>>;
	errorFn: Mock<ErrorHandler<E>>;
}

/**
 * @description Mock the {@link MutationControlHandler} functions
 * @returns mock of `MutationControlHandler`
 */
export function mockMutationControlHandler<T, E = unknown>(): MockMutationControlHandler<T, E> {
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

export type QuerySharpFn = (key: string) => Promise<string>;

/**
 * @description Query function for tests that resturns data if a hash (pound, sharp) symbol ('#') is found.
 * @param key - key string
 * @returns promise with data result
 */
export async function testQuery(key: string): Promise<string> {
	const index = key.indexOf('#');
	if (index === -1) throw new Error('invalid_key');

	return 'data#' + key.slice(index + 1);
}

/**
 * @description Make a delayed test query function
 * @param delay - wait time in milliseconds
 * @returns Delayed `querySharpFn`
 */
export function makeDelayedTestQuery(delay: number): QuerySharpFn {
	return async (key: string): Promise<string> => {
		await waitUntil(delay);
		return await testQuery(key);
	};
}
