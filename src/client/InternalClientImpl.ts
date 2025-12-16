import type {
	GenericQueryKey,
	KeyPair,
	Millisecond,
	MutationState,
	QueryExecutionResult,
	QueryState,
} from '@/core/Type';
import type {
	ClientActiveData,
	ClientExecuteMutationOptions,
	ClientExecuteQueryOptions,
	ClientRunQueryOptions,
	Patch,
	PatchRank,
} from '@/core/Client';
import { executeMutation, makeMutationContext } from '@/mutation/MutationModule';
import {
	disposeQuery,
	executeQuery,
	makeQueryContext,
	runActiveQuery,
	runQuery,
} from '@/query/QueryModule';
import { makeQueryInput, makeMutationInput, type RestatementConfig } from '@/Config';
import type { TrackingCache } from '@/cache/TrackingCache';

/**
 * See {@link Client#executeQuery}
 * @param config Restatement Config
 * @param options Options
 * @returns Query execution
 */
export function clientExecuteQuery<K extends GenericQueryKey, T, E>(
	config: RestatementConfig<T, E>,
	options: ClientExecuteQueryOptions<K, T, E>
): Promise<QueryExecutionResult<T, E>> {
	const input = makeQueryInput(config, options);
	const ctx = makeQueryContext(input);
	const promise = executeQuery(ctx, options.key, options);
	promise.finally(() => disposeQuery(ctx));
	return promise;
}

/**
 * See {@link Client#runActiveQuery}
 * @param config Restatement Config
 * @param options Options
 * @returns Query state
 */
export async function clientRunActiveQuery<K extends GenericQueryKey, T, E>(
	config: RestatementConfig<T, E>,
	options: ClientRunQueryOptions<K, T, E>
): Promise<QueryState<T, E>> {
	const input = makeQueryInput(config, options);
	const ctx = makeQueryContext(input);
	const result = await runActiveQuery(
		ctx,
		{ key: options.key, hash: ctx.keyHashFn(options.key) },
		{ cache: 'no-cache', ttl: options.ttl, signal: options.signal }
	);
	disposeQuery(ctx);
	return result.state;
}

/**
 * See {@link Client#runQuery}
 * @param config Restatement Config
 * @param options Options
 * @returns Query state
 */
export function clientRunQuery<K extends GenericQueryKey, T, E>(
	config: RestatementConfig<T, E>,
	options: ClientRunQueryOptions<K, T, E>
): Promise<QueryState<T, E>> {
	const input = makeQueryInput(config, options);
	const ctx = makeQueryContext(input);
	const promise = runQuery(
		ctx,
		{ key: options.key, hash: ctx.keyHashFn(options.key) },
		{ cache: 'no-cache', ttl: options.ttl, signal: options.signal }
	);
	promise.finally(() => disposeQuery(ctx));
	return promise;
}

/**
 * See {@link Client#executeMutation}
 * @param config Restatement Config
 * @param options Options
 * @returns Mutation state
 */
export function clientExecuteMutation<I, T, E>(
	config: RestatementConfig<T, E>,
	options: ClientExecuteMutationOptions<I, T, E>
): Promise<MutationState<T, E>> {
	const input = makeMutationInput(config, options);
	const ctx = makeMutationContext(input);
	return executeMutation(ctx, options.input, { signal: options.signal });
}

/**
 * See {@link Client#getActiveKeys}
 * @param config Restatement Config
 * @returns Query state
 */
export function clientGetActiveKeys<K extends GenericQueryKey, T, E>(
	config: RestatementConfig<T, E>
): Array<KeyPair<K>> {
	const ret: Array<KeyPair<K>> = [];
	for (const [hash, state] of config.provider?.entries() ?? []) {
		ret.push({ key: state.key as K, hash });
	}
	return ret;
}

/**
 * See {@link Client#getActiveData}
 * @param config Restatement Config
 * @returns Client active data list
 */
export function clientGetActiveData<T, E>(
	config: RestatementConfig<T, E>
): Promise<Array<ClientActiveData<T>>> {
	return Promise.all(
		// TODO: check if an exception in store.get will be handled.
		Array.from(config.provider?.topics() ?? []).map(async hash => {
			const data = (await config.cache.store.get(hash)) as T | undefined;
			return { hash, data };
		})
	);
}

/**
 * See {@link Client#get}
 * @param config Restatement Config
 * @param key Query key
 * @returns Data
 */
export function clientGet<K extends GenericQueryKey, T, E>(
	config: RestatementConfig<T, E>,
	key: K
): Promise<T | undefined> {
	return config.cache.handler.get(key);
}

/**
 * See {@link Client#set}
 * @param config Restatement Config
 * @param key Query key
 * @param data Data
 * @param ttl TTL
 * @returns Promise
 */
export function clientSet<K extends GenericQueryKey, T, E>(
	config: RestatementConfig<T, E>,
	key: K,
	data: T,
	ttl?: Millisecond
): Promise<void> {
	return config.cache.handler.set(key, data, ttl);
}

/**
 * See {@link Client#invalidate}
 * @param config Restatement Config
 * @param key Query key
 * @returns Promise
 */
export function clientInvalidate<K extends GenericQueryKey, T, E>(
	config: RestatementConfig<T, E>,
	key: K
): Promise<void> {
	return config.cache.handler.invalidate(key);
}

/**
 * See {@link Client#delete}
 * @param config Restatement Config
 * @param key Query key
 * @returns Promise
 */
export function clientDelete<K extends GenericQueryKey, T, E>(
	config: RestatementConfig<T, E>,
	key: K
): Promise<void> {
	return config.cache.handler.delete(key);
}

/**
 * See {@link Client#clear}
 * @param config Restatement Config
 * @returns Promise
 */
export function clientClear<T, E>(config: RestatementConfig<T, E>): Promise<void> {
	return config.cache.store.clear();
}

/**
 * See {@link Client#loading}
 * @param config Restatement Config
 * @returns Loading count
 */
export function clientLoading<T, E>(config: RestatementConfig<T, E>): number {
	let count = 0;
	for (const state of config.provider?.states() ?? []) {
		if (state.promise?.status === 'pending') {
			count += 1;
		}
	}
	return count;
}

/**
 * See {@link Client#waitAll}
 * @param config Restatement Config
 * @returns Waited count
 */
export async function clientWaitAll<T, E>(config: RestatementConfig<T, E>): Promise<number> {
	const res = await Promise.all(
		Array.from(config.provider?.states() ?? [])
			.filter(state => state.promise?.status === 'pending')
			.map(pending => pending.promise)
	);
	return res.length;
}

/**
 * See {@link DetachedClient#commit}
 * @param config Restatement Config
 * @param store Tracking cache store
 * @returns Patch
 */
export async function clientCommit<T, E>(
	config: RestatementConfig<T, E>,
	store: TrackingCache<string, T>
): Promise<Patch> {
	await clientWaitAll(config);

	const patch: Array<PatchRank> = [];
	for (const [hash, entry] of store.storage.entries()) {
		patch.push({ hash, data: entry.data, time: entry.time, ttl: entry.ttl });
	}
	return patch;
}
