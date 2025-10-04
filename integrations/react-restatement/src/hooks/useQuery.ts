import { useRef, useState, useSyncExternalStore, type MutableRefObject } from 'react';
import {
	makeQueryInput,
	Query,
	type QueryState,
	type LocalQueryInput,
	type StateMetadata,
	type CacheHandler,
	type QueryStateHandler,
	updateQueryContextFn,
} from 'restatement';
import { useRestatementConfig } from '@/context/RestatementContext';

type StoreHandler = () => void;

type StoreSubscriber = (handler: StoreHandler) => StoreUnsubscriber;
type StoreUnsubscriber = () => void;

type StoreGetSnapshot<T, E = unknown> = () => QueryState<T, E>;

// eslint-disable-next-line jsdoc/require-jsdoc
function trackQueryState<K extends ReadonlyArray<unknown>, T, E = unknown>(
	query: Query<K, T, E>,
	storeHandlerRef: MutableRefObject<StoreHandler>,
	previousStateFn: QueryStateHandler<T, E> | null = null
): void {
	// eslint-disable-next-line jsdoc/require-jsdoc
	async function stateFn(
		state: QueryState<T, E>,
		metadata: StateMetadata,
		cache: CacheHandler
	): Promise<void> {
		storeHandlerRef.current();
		await previousStateFn?.(state, metadata, cache);
	}

	query.ctx.stateFn = stateFn;
}

// eslint-disable-next-line jsdoc/require-jsdoc
function makeSubscriber<K extends ReadonlyArray<unknown>, T, E = unknown>(
	query: Query<K, T, E>,
	storeHandlerRef: MutableRefObject<StoreHandler>
): StoreSubscriber {
	return storeHandler => {
		storeHandlerRef.current = storeHandler;

		return () => {
			query.dispose();
		};
	};
}

/**
 * No-op store handler
 */
function defaultStoreHandler(): void {
	// no-op
}

export type QueryHookOutput<K extends ReadonlyArray<unknown>, T, E = unknown> = [
	QueryState<T, E>,
	Query<K, T, E>,
];

/**
 * Query hook
 * @param config Query config
 * @returns Query
 */
export function useQuery<K extends ReadonlyArray<unknown>, T, E = unknown>(
	config: LocalQueryInput<K, T, E>
): QueryHookOutput<K, T, E> {
	const contextConfig = useRestatementConfig<T, E>();

	/**
	 * The query instance must have a stable reference throughout the hook lifecycle
	 */
	const [query] = useState<Query<K, T, E>>(() => {
		const queryInput = makeQueryInput<K, T, E>(contextConfig, config);
		return Query.create(queryInput);
	});

	const storeHandlerRef = useRef<StoreHandler>(defaultStoreHandler);
	const subscriberRef = useRef<StoreSubscriber>(makeSubscriber(query, storeHandlerRef));
	const getSnapshotRef = useRef<StoreGetSnapshot<T, E>>(() => query.getState());

	updateQueryContextFn(query.ctx, config);
	trackQueryState(query, storeHandlerRef, config.stateFn);

	const state = useSyncExternalStore<QueryState<T, E>>(
		subscriberRef.current,
		getSnapshotRef.current,
		getSnapshotRef.current
	);

	return [state, query];
}
