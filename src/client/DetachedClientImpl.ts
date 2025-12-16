import type {
	GenericQueryKey,
	QueryExecutionResult,
	QueryState,
	MutationState,
	KeyPair,
	Millisecond,
} from '@/core/Type';
import type {
	ClientActiveData,
	ClientExecuteMutationOptions,
	ClientExecuteQueryOptions,
	ClientRunQueryOptions,
	DetachedClient,
	Patch,
} from '@/core/Client';
import type { CacheEntry } from '@/core/Cache';
import {
	clientClear,
	clientCommit,
	clientDelete,
	clientExecuteMutation,
	clientExecuteQuery,
	clientGet,
	clientGetActiveData,
	clientGetActiveKeys,
	clientInvalidate,
	clientLoading,
	clientRunActiveQuery,
	clientRunQuery,
	clientSet,
	clientWaitAll,
} from '@/client/InternalClientImpl';
import { TrackingCache } from '@/cache/TrackingCache';
import { restatementConfig, type RestatementConfig } from '@/Config';
import { SharedState } from '@/pubsub/PubSubInternal';

export class DetachedClientImpl implements DetachedClient {
	public constructor(
		config: RestatementConfig<unknown, unknown>,
		storage = new Map<string, CacheEntry<unknown>>()
	) {
		this.#store = new TrackingCache(config.cache.store, storage);
		this.#config = restatementConfig(this.#store, { ...config, provider: new SharedState() });
	}

	public commit(): Promise<Patch> {
		return clientCommit(this.#config, this.#store);
	}

	public executeQuery<K extends GenericQueryKey, T, E>(
		options: ClientExecuteQueryOptions<K, T, E>
	): Promise<QueryExecutionResult<T, E>> {
		return clientExecuteQuery(this.#config as RestatementConfig<T, E>, options);
	}

	public runActiveQuery<K extends GenericQueryKey, T, E>(
		options: ClientRunQueryOptions<K, T, E>
	): Promise<QueryState<T, E>> {
		return clientRunActiveQuery(this.#config as RestatementConfig<T, E>, options);
	}

	public runQuery<K extends GenericQueryKey, T, E>(
		options: ClientRunQueryOptions<K, T, E>
	): Promise<QueryState<T, E>> {
		return clientRunQuery(this.#config as RestatementConfig<T, E>, options);
	}

	public executeMutation<I, T, E>(
		options: ClientExecuteMutationOptions<I, T, E>
	): Promise<MutationState<T, E>> {
		return clientExecuteMutation(this.#config as RestatementConfig<T, E>, options);
	}

	public getActiveKeys<K extends GenericQueryKey>(): Array<KeyPair<K>> {
		return clientGetActiveKeys(this.#config);
	}

	public getActiveData<T>(): Promise<Array<ClientActiveData<T>>> {
		return clientGetActiveData(this.#config as RestatementConfig<T, unknown>);
	}

	public get<K extends GenericQueryKey, T>(key: K): Promise<T | undefined> {
		return clientGet(this.#config as RestatementConfig<T, unknown>, key);
	}

	public set<K extends GenericQueryKey, T>(key: K, data: T, ttl?: Millisecond): Promise<void> {
		return clientSet(this.#config, key, data, ttl);
	}

	public invalidate<K extends GenericQueryKey>(key: K): Promise<void> {
		return clientInvalidate(this.#config, key);
	}

	public delete<K extends GenericQueryKey>(key: K): Promise<void> {
		return clientDelete(this.#config, key);
	}

	public clear(): Promise<void> {
		return clientClear(this.#config);
	}

	public loading(): number {
		return clientLoading(this.#config);
	}

	public waitAll(): Promise<number> {
		return clientWaitAll(this.#config);
	}

	/**
	 * Config
	 */
	readonly #config: RestatementConfig<unknown, unknown>;
	readonly #store: TrackingCache<string, unknown>;
}
