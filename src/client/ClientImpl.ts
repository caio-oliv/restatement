import type {
	GenericQueryKey,
	QueryExecutionResult,
	QueryState,
	KeyPair,
	Millisecond,
	MutationState,
} from '@/core/Type';
import type {
	Client,
	ClientActiveData,
	ClientExecuteMutationOptions,
	ClientExecuteQueryOptions,
	ClientRunQueryOptions,
} from '@/core/Client';
import type { RestatementConfig } from '@/Config';
import {
	clientExecuteQuery,
	clientRunActiveQuery,
	clientRunQuery,
	clientExecuteMutation,
	clientGetActiveKeys,
	clientGetActiveData,
	clientGet,
	clientSet,
	clientInvalidate,
	clientDelete,
	clientClear,
	clientLoading,
	clientWaitAll,
} from '@/client/InternalClientImpl';

export class ClientImpl implements Client {
	public constructor(config: RestatementConfig<unknown, unknown>) {
		this.#config = config;
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
}
