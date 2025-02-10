import type { QueryControlHandler } from '@/Type';

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
		stateFn: () => {
			counter.stateCalled += 1;
		},
		errorFn: () => {
			counter.errorCalled += 1;
		},
		dataFn: () => {
			counter.dataCalled += 1;
		},
	};

	return { handler, counter };
}
