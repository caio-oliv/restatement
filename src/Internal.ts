import type { ObservablePromise, PromiseStatus } from '@/core/Type';

/**
 * Empty function
 */
export function blackhole(): void {
	// empty function
}

/**
 * Function that returns a resolved promise with `null`.
 * @returns Null promise
 */
export function nullpromise(): Promise<null> {
	return Promise.resolve(null);
}

/**
 * @param o Potentially an object
 * @returns `true` if argument is an object
 */
function isObject(o: unknown): boolean {
	return Object.prototype.toString.call(o) === '[object Object]';
}

/**
 * Verify if argument is a plain object `{}`.
 * @description Copied form library {@link https://github.com/jonschlinkert/is-plain-object is-plain-object}.
 * @param o Potentially an object
 * @returns `true` if argument is a plain object
 * @see {@link https://github.com/jonschlinkert/is-plain-object is-plain-object}
 */
export function isPlainObject(o: unknown): boolean {
	/* eslint-disable @typescript-eslint/no-unsafe-assignment */
	/* eslint-disable @typescript-eslint/no-unsafe-member-access */
	/* eslint-disable @typescript-eslint/no-unsafe-call */
	/* eslint-disable no-prototype-builtins */
	if (isObject(o) === false) return false;

	// If has modified constructor
	const ctor = (o as FunctionConstructor).constructor;
	if (ctor === undefined) return true;

	// If has modified prototype

	const prot = ctor.prototype;
	if (isObject(prot) === false) return false;

	// If constructor does not have an Object-specific method
	if (prot.hasOwnProperty('isPrototypeOf') === false) {
		return false;
	}

	// Most likely a plain Object
	return true;
}

/**
 * Create a new sorted object by keys
 * @param obj Object
 * @returns New sorted object
 */
export function sortObjectByKeys(obj: object): object {
	const sortedKeys = Object.keys(obj).sort();

	const sortedObject: Record<string, unknown> = {};
	for (const key of sortedKeys) {
		sortedObject[key] = (obj as Record<string, unknown>)[key];
	}

	return sortedObject;
}

/**
 * @description Json stringify replacer to sort plain objects by keys for **reproducible serialization**
 * @param _key Object key
 * @param value Potentially an object
 * @returns Object with sorted keys
 */
export function jsonStringifyObjectSorter(_key: string, value: unknown): unknown {
	if (!isPlainObject(value)) {
		return value;
	}

	return sortObjectByKeys(value as object);
}

/**
 * Augments a promise object to provide the current promise status as a property.
 * @param query Promise object
 * @returns Observable promise
 */
export function observablePromise<T>(query: Promise<T>): ObservablePromise<T> {
	(query as { status: PromiseStatus } & Promise<T>).status = 'pending';
	query.then(
		() => {
			(query as { status: PromiseStatus } & Promise<T>).status = 'fulfilled';
		},
		() => {
			(query as { status: PromiseStatus } & Promise<T>).status = 'rejected';
		}
	);

	return query as ObservablePromise<T>;
}

/**
 * Execute a promise in background and immediately returns
 * @param func Async function
 */
export function syncPromiseResolver<Fn extends () => void | Promise<void>>(func: Fn): void {
	try {
		func()?.catch(blackhole);
	} catch {
		/* no-op */
	}
}

/**
 * Create a `AbortSignal`
 * @returns Abort signal
 */
export function makeAbortSignal(): AbortSignal {
	return new AbortController().signal;
}
