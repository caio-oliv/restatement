import { useRestatementConfig } from '@/context/RestatementContext';
import { useState } from 'react';
import { makeClient, makeDetachedClient, type Client, type DetachedClient } from 'restatement';

/**
 * Client hook
 * @returns Client
 */
export function useClient(): Client {
	const config = useRestatementConfig<unknown, unknown>();
	const [client] = useState(() => makeClient(config));
	return client;
}

/**
 * Detached Client hook
 * @returns Detached Client
 */
export function useDetachedClient(): DetachedClient {
	const config = useRestatementConfig<unknown, unknown>();
	const [client] = useState(() => makeDetachedClient(config));
	return client;
}
