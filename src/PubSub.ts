export type Listener<T> = (topic: string, data: T) => void;

export type UnsubscribeHandle = () => void;

interface ListenerState<T> {
	/**
	 * Function listeners
	 */
	listeners: Set<Listener<T>>;
	/**
	 * Latest data published.
	 */
	data: T | null;
}

/**
 * @description Make default {@link ListenerState}
 * @returns default {@link ListenerState}
 */
function makeListenerState<T>(): ListenerState<T> {
	return {
		data: null,
		listeners: new Set(),
	};
}

export class PubSub<T> {
	public constructor() {
		this.#listenerMap = new Map<string, ListenerState<T>>();
	}

	public subscribe(topic: string, listener: Listener<T>): UnsubscribeHandle {
		const state = this.#listenerMap.get(topic) ?? makeListenerState();
		state.listeners.add(listener);
		this.#listenerMap.set(topic, state);
		return () => this.unsubscribe(topic, listener);
	}

	public unsubscribe(topic: string, listener: Listener<T>): void {
		const state = this.#listenerMap.get(topic) ?? makeListenerState();
		state.listeners.delete(listener);
		if (state.listeners.size === 0) this.#listenerMap.delete(topic);
	}

	public unsubscribeAll(topic: string): void {
		this.#listenerMap.delete(topic);
	}

	public publish(topic: string, data: T, ignore: Array<Listener<T>> = []): void {
		const state = this.#listenerMap.get(topic) ?? makeListenerState();
		state.data = data;
		for (const listener of state.listeners.keys()) {
			if (ignore.includes(listener)) continue;
			listener(topic, data);
		}
	}

	public latestValue(topic: string): T | null {
		const state = this.#listenerMap.get(topic) ?? makeListenerState();
		return state.data;
	}

	public topics(): IteratorObject<string, BuiltinIteratorReturn> {
		return this.#listenerMap.keys();
	}

	public subscriberCount(topic: string): number {
		return this.#listenerMap.get(topic)?.listeners.size ?? 0;
	}

	readonly #listenerMap: Map<string, ListenerState<T>>;
}

export class SubscriberHandle<T> {
	public readonly listener: Listener<T>;

	public constructor(listener: Listener<T>, provider: PubSub<T>) {
		this.#topic = null;
		this.listener = listener;
		this.#provider = provider;
	}

	public useTopic(topic: string | null): void {
		if (this.#topic !== null && this.#topic !== topic) {
			this.#provider.unsubscribe(this.#topic, this.listener);
		}

		if (topic) {
			this.#provider.subscribe(topic, this.listener);
		}

		this.#topic = topic;
	}

	public currentTopic(): string | null {
		return this.#topic;
	}

	public publish(topic: string, data: T): void {
		this.#provider.publish(topic, data, [this.listener]);
	}

	public publishCurrentTopic(data: T): boolean {
		if (!this.#topic) {
			return false;
		}

		this.#provider.publish(this.#topic, data, [this.listener]);
		return true;
	}

	public currentValue(): T | null {
		if (this.#topic === null) return null;

		return this.#provider.latestValue(this.#topic);
	}

	public unsubscribe(): void {
		if (this.#topic) this.#provider.unsubscribe(this.#topic, this.listener);
		this.#topic = null;
	}

	public [Symbol.dispose](): void {
		this.unsubscribe();
	}

	#topic: string | null;
	readonly #provider: PubSub<T>;
}
