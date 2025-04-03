import { waitUntil } from '@/AsyncModule';
import type { MutationControlHandler, QueryControlHandler } from '@/Type';

export interface FakeControlHandlerCounter {
	stateCalled: number;
	errorCalled: number;
	dataCalled: number;
}

export interface FakeQueryControlHandlerReturn<T, E> {
	handler: QueryControlHandler<T, E>;
	counter: FakeControlHandlerCounter;
}

/**
 * @description Query control handler mocks
 * @returns handlers and execution counters
 */
export function fakeQueryControlHandler<T, E>(): FakeQueryControlHandlerReturn<T, E> {
	const counter: FakeControlHandlerCounter = {
		stateCalled: 0,
		errorCalled: 0,
		dataCalled: 0,
	};

	const handler: QueryControlHandler<T, E> = {
		stateFn: async () => {
			counter.stateCalled += 1;
		},
		errorFn: async () => {
			counter.errorCalled += 1;
		},
		dataFn: async () => {
			counter.dataCalled += 1;
		},
	};

	return { handler, counter };
}

export interface FakeMutationControlHandlerReturn<T, E> {
	handler: MutationControlHandler<T, E>;
	counter: FakeControlHandlerCounter;
}

/**
 * @description Mutation control handler mocks
 * @returns handlers and execution counters
 */
export function fakeMutationControlHandler<T, E>(): FakeMutationControlHandlerReturn<T, E> {
	const counter: FakeControlHandlerCounter = {
		stateCalled: 0,
		errorCalled: 0,
		dataCalled: 0,
	};

	const handler: MutationControlHandler<T, E> = {
		stateFn: async () => {
			counter.stateCalled += 1;
		},
		errorFn: async () => {
			counter.errorCalled += 1;
		},
		dataFn: async () => {
			counter.dataCalled += 1;
		},
	};

	return { handler, counter };
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
 * @description Query function that resturns data if a hash (pound, sharp) symbol ('#') is found.
 * @param key - key string
 * @returns promise with data result
 */
export async function querySharpFn(key: string): Promise<string> {
	const index = key.indexOf('#');
	if (index === -1) throw new Error('invalid_key');

	return 'data#' + key.slice(index + 1);
}

/**
 * @description Make a delayed query function
 * @param delay - wait time in milliseconds
 * @returns Delayed `querySharpFn`
 */
export function makeDelayedQuerySharpFn(delay: number): QuerySharpFn {
	return async (key: string): Promise<string> => {
		await waitUntil(delay);
		return await querySharpFn(key);
	};
}
