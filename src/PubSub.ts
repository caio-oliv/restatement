import { syncPromiseResolver } from '@/Internal';

/**
 * Listener function
 */
export type Listener<in T> = (topic: string, data: T) => void | Promise<void>;

/**
 * Unsubscriber function handler
 */
export type UnsubscribeHandle = () => void;

interface ListenerState<in T, out S> {
	/**
	 * Function listeners
	 */
	readonly listeners: Set<Listener<T>>;
	/**
	 * Shared state between listeners.
	 */
	state: S | null;
}

/**
 * Make default {@link ListenerState}
 * @returns Default {@link ListenerState}
 */
function makeListenerState<T, S>(): ListenerState<T, S> {
	return {
		listeners: new Set(),
		state: null,
	};
}

/**
 * Publisher-Subscriber
 */
export class PubSub<in out T, out S> {
	public constructor() {
		this.#listenerMap = new Map<string, ListenerState<T, S>>();
	}

	/**
	 * Subscribe a listener to a topic
	 * @param topic Topic
	 * @param listener Listener function
	 * @returns Unsubscriber handle
	 */
	public subscribe(topic: string, listener: Listener<T>): UnsubscribeHandle {
		const state = this.#listenerMap.get(topic) ?? makeListenerState();
		state.listeners.add(listener);
		this.#listenerMap.set(topic, state);
		return () => this.unsubscribe(topic, listener);
	}

	/**
	 * Unsubscribe a listener from a topic
	 * @param topic Topic
	 * @param listener Listener function
	 */
	public unsubscribe(topic: string, listener: Listener<T>): void {
		const state = this.#listenerMap.get(topic);
		if (!state) return;

		state.listeners.delete(listener);
		if (state.listeners.size === 0) this.#listenerMap.delete(topic);
	}

	/**
	 * Unsubscribe all listeners from a topic
	 * @param topic Topic
	 */
	public unsubscribeAll(topic: string): void {
		this.#listenerMap.delete(topic);
	}

	/**
	 * Publish a data value to a topic
	 * @param topic Topic
	 * @param data Data
	 * @param ignore Ignore list
	 */
	public publish(topic: string, data: T, ignore: Array<Listener<T>> = []): void {
		const state = this.#listenerMap.get(topic);
		if (!state) return;

		for (const listener of state.listeners) {
			if (ignore.includes(listener)) continue;
			syncPromiseResolver(() => listener(topic, data));
		}
	}

	/**
	 * Get the topic state
	 * @param topic Topic
	 * @returns Topic state
	 */
	public getState(topic: string): S | null {
		const state = this.#listenerMap.get(topic);
		if (!state) return null;

		return state.state;
	}

	/**
	 * Set the topic state
	 * @param topic Topic
	 * @param state State
	 * @returns `true` if the state was set
	 */
	public setState(topic: string, state: S): boolean {
		const lState = this.#listenerMap.get(topic);
		if (!lState) {
			return false;
		}
		lState.state = state;
		this.#listenerMap.set(topic, lState);
		return true;
	}

	/**
	 * Returns a iterator of all topics
	 * @returns Topic iterator
	 */
	public topics(): IteratorObject<string, BuiltinIteratorReturn> {
		return this.#listenerMap.keys();
	}

	/**
	 * Get the subscriber count from a topic
	 * @param topic Topic
	 * @returns Subscriber count
	 */
	public subscriberCount(topic: string): number {
		return this.#listenerMap.get(topic)?.listeners.size ?? 0;
	}

	readonly #listenerMap: Map<string, ListenerState<T, S>>;
}

export interface Subscriber<in T, out S> {
	/**
	 * Change the subscriber topic
	 * @param topic Optional new topic
	 */
	useTopic(topic: string | null): void;
	/**
	 * Get current topic
	 * @returns topic
	 */
	currentTopic(): string | null;

	/**
	 * Get the state from a topic
	 * @returns Current state
	 */
	getCurrentState(): S | null;
	/**
	 * Set the state of a topic
	 * @param state Topic state
	 */
	setCurrentState(state: S): boolean;

	/**
	 * Publish value to current topic
	 * @param data Data
	 * @returns `true` if the value was published
	 */
	publish(data: T): boolean;
	/**
	 * Publish value to provided topic
	 * @param topic Topic
	 * @param data Data
	 */
	publishTopic(topic: string, data: T): void;

	/**
	 * Unsubscribe itself from the provider
	 */
	unsubscribe(): void;
}

export class SubscriberHandle<T, S> implements Subscriber<T, S> {
	public readonly listener: Listener<T>;

	public constructor(listener: Listener<T>, provider: PubSub<T, S>) {
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

	public getCurrentState(): S | null {
		if (this.#topic === null) return null;

		return this.#provider.getState(this.#topic);
	}

	public setCurrentState(state: S): boolean {
		if (this.#topic === null) return false;

		return this.#provider.setState(this.#topic, state);
	}

	public publish(data: T): boolean {
		if (!this.#topic) {
			return false;
		}

		this.#provider.publish(this.#topic, data, [this.listener]);
		return true;
	}

	public publishTopic(topic: string, data: T): void {
		this.#provider.publish(topic, data, [this.listener]);
	}

	public unsubscribe(): void {
		if (this.#topic) this.#provider.unsubscribe(this.#topic, this.listener);
		this.#topic = null;
	}

	public [Symbol.dispose](): void {
		this.unsubscribe();
	}

	#topic: string | null;
	readonly #provider: PubSub<T, S>;
}

export class DummySubscriber<T, S> implements Subscriber<T, S> {
	public constructor() {
		this.#topic = null;
	}

	public useTopic(topic: string | null): void {
		this.#topic = topic;
	}

	public currentTopic(): string | null {
		return this.#topic;
	}

	// eslint-disable-next-line class-methods-use-this, @typescript-eslint/class-methods-use-this
	public getCurrentState(): S | null {
		return null;
	}

	// eslint-disable-next-line class-methods-use-this, @typescript-eslint/class-methods-use-this
	public setCurrentState(): boolean {
		return false;
	}

	// eslint-disable-next-line class-methods-use-this, @typescript-eslint/class-methods-use-this
	public publish(): boolean {
		return false;
	}

	// eslint-disable-next-line class-methods-use-this, @typescript-eslint/class-methods-use-this
	public publishTopic(): void {
		return;
	}

	public unsubscribe(): void {
		this.#topic = null;
	}

	#topic: string | null;
}
