import { useRestatementConfig } from '@/context/RestatementContext';
import { useState } from 'react';
import { client, detachedClient, type Client, type DetachedClient } from 'restatement';

/**
 * Client hook
 * @returns Client
 */
export function useClient(): Client {
	const config = useRestatementConfig<unknown, unknown>();
	const [cli] = useState(() => client(config));
	return cli;
}

/**
 * Detached Client hook
 * @returns Detached Client
 */
export function useDetachedClient(): DetachedClient {
	const config = useRestatementConfig<unknown, unknown>();
	const [client] = useState(() => detachedClient(config));
	return client;
}
