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
	state: S;
}

export type PubSubSetStateFn<in out S> = (old: S | null) => S;

export type PubSubUpdateStateValue<S> = S | PubSubSetStateFn<S>;

/**
 * Apply the state
 * @param old Old state
 * @param state State
 * @returns State
 */
function applyState<S>(old: S | null, state: PubSubUpdateStateValue<S>): S {
	if (typeof state === 'function') {
		return (state as PubSubSetStateFn<S>)(old);
	} else {
		return state;
	}
}

/**
 * Publisher-Subscriber
 */
export class PubSub<in out T, in out S> {
	public constructor() {
		this.#listenerMap = new Map<string, ListenerState<T, S>>();
	}

	/**
	 * Subscribe a listener to a topic
	 * @param topic Topic
	 * @param listener Listener function
	 * @param state State
	 * @returns Unsubscriber handle
	 */
	public subscribe(
		topic: string,
		listener: Listener<T>,
		state: PubSubUpdateStateValue<S>
	): UnsubscribeHandle {
		const lstate = this.#listenerMap.get(topic);
		if (!lstate) {
			this.#listenerMap.set(topic, {
				listeners: new Set([listener]),
				state: applyState(null, state),
			});
		} else {
			lstate.listeners.add(listener);
			lstate.state = applyState(lstate.state, state);
		}

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
	public setState(topic: string, state: PubSubUpdateStateValue<S>): boolean {
		const lstate = this.#listenerMap.get(topic);
		if (!lstate) {
			return false;
		}
		lstate.state = applyState(lstate.state, state);
		this.#listenerMap.set(topic, lstate);
		return true;
	}

	/**
	 * Returns an iterator of all topics
	 * @returns Topic iterator
	 */
	public topics(): IteratorObject<string, BuiltinIteratorReturn> {
		return this.#listenerMap.keys();
	}

	/**
	 * Returns an iterator of all topics and states
	 * @yields Topic and state tuple
	 */
	public *entries(): IteratorObject<[string, S], BuiltinIteratorReturn> {
		for (const [topic, lState] of this.#listenerMap.entries()) {
			yield [topic, lState.state];
		}
	}

	/**
	 * Returns an iterator of all states
	 * @yields Topic and state tuple
	 */
	public *states(): IteratorObject<S, BuiltinIteratorReturn> {
		for (const lstate of this.#listenerMap.values()) {
			yield lstate.state;
		}
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

export interface Subscriber<in T, in out S> {
	/**
	 * Change the subscriber topic
	 * @param topic Optional new topic
	 * @param state State
	 */
	useTopic(topic: string | null, state: PubSubUpdateStateValue<S>): void;
	/**
	 * Get current topic
	 * @returns topic
	 */
	currentTopic(): string | null;

	/**
	 * Get the state from a topic
	 * @returns Current state
	 */
	getState(): S | null;
	/**
	 * Set the state of a topic
	 * @param state Topic state
	 */
	setState(state: PubSubUpdateStateValue<S>): boolean;

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

	public useTopic(topic: string | null, state: PubSubUpdateStateValue<S>): void {
		if (this.#topic !== null && this.#topic !== topic) {
			this.#provider.unsubscribe(this.#topic, this.listener);
		}

		if (topic) {
			this.#provider.subscribe(topic, this.listener, state);
		}

		this.#topic = topic;
	}

	public currentTopic(): string | null {
		return this.#topic;
	}

	public getState(): S | null {
		if (this.#topic === null) return null;

		return this.#provider.getState(this.#topic);
	}

	public setState(state: S): boolean {
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
	public getState(): S | null {
		return null;
	}

	// eslint-disable-next-line class-methods-use-this, @typescript-eslint/class-methods-use-this
	public setState(): boolean {
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
