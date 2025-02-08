/**
 * @description Empty function that takes one parameter.
 * Ideal for `promise.catch()` cases where the promise beign waited **must not** throw.
 * @param _ any parameter
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function blackhole<T>(_: T): void {
	// empty function
}
