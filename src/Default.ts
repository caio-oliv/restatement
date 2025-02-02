import { JitterExponentialBackoffTimer } from '@/TimerModule';
import type {
	MutationState,
	QueryState,
	MutationControlHandler,
	QueryControlHandler,
} from '@/Type';

export const DEFAULT_RETRY = 3;
export const DEFAULT_FRESH_TIME = 30 * 1000; // 30 seconds
export const DEFAULT_STALE_TIME = 3 * 60 * 1000; // 3 minutes
export const DEFAULT_RETRY_DELAY = new JitterExponentialBackoffTimer(1000, 30 * 1000);

export function defaultKeyHashFn<T>(key: T): string {
	return JSON.stringify(key);
}

export function defaultKeepCacheOnError() {
	return false;
}

export function defaultQueryState<T, E>(): QueryState<T, E> {
	return {
		data: null,
		error: null,
		status: 'idle',
	};
}

export function defaultQueryHandler<T, E>(): QueryControlHandler<T, E> {
	return {
		dataFn: undefined,
		errorFn: undefined,
		stateFn: undefined,
	};
}

export function defaultMutationState<T, E>(): MutationState<T, E> {
	return {
		data: null,
		error: null,
		status: 'idle',
	};
}

export function defaultMutationHandler<T, E>(): MutationControlHandler<T, E> {
	return {
		stateFn: undefined,
		dataFn: undefined,
		errorFn: undefined,
	};
}
