import { vi, type Mock } from 'vitest';
import { waitUntil } from '@/AsyncModule';
import type {
	DataHandler,
	ErrorHandler,
	MutationControlHandler,
	MutationDataHandler,
	MutationErrorHandler,
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
	dataFn: Mock<MutationDataHandler<T>>;
	errorFn: Mock<MutationErrorHandler<E>>;
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
