import type {
	Listener,
	PublishSubscribe,
	PubSubUpdateStateValue,
	Subscriber,
	UnsubscribeHandle,
} from '@/core/PublishSubscribe';
import { syncPromiseResolver } from '@/Internal';
import { applyState } from '@/pubsub/PubSubInternal';

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

export class PubSub<in out T, in out S> implements PublishSubscribe<T, S> {
	public constructor() {
		this.#listenerMap = new Map<string, ListenerState<T, S>>();
	}

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

	public unsubscribe(topic: string, listener: Listener<T>): void {
		const state = this.#listenerMap.get(topic);
		if (!state) return;

		state.listeners.delete(listener);
		if (state.listeners.size === 0) this.#listenerMap.delete(topic);
	}

	public unsubscribeAll(topic: string): void {
		this.#listenerMap.delete(topic);
	}

	public publish(topic: string, data: T, ignore: Array<Listener<T>> = []): void {
		const state = this.#listenerMap.get(topic);
		if (!state) return;

		for (const listener of state.listeners) {
			if (ignore.includes(listener)) continue;
			syncPromiseResolver(() => listener(topic, data));
		}
	}

	public getState(topic: string): S | null {
		const state = this.#listenerMap.get(topic);
		if (!state) return null;

		return state.state;
	}

	public setState(topic: string, state: PubSubUpdateStateValue<S>): boolean {
		const lstate = this.#listenerMap.get(topic);
		if (!lstate) {
			return false;
		}
		lstate.state = applyState(lstate.state, state);
		this.#listenerMap.set(topic, lstate);
		return true;
	}

	public topics(): IteratorObject<string, BuiltinIteratorReturn> {
		return this.#listenerMap.keys();
	}

	public *entries(): IteratorObject<[string, S], BuiltinIteratorReturn> {
		for (const [topic, lState] of this.#listenerMap.entries()) {
			yield [topic, lState.state];
		}
	}

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

export class SubscriberHandle<T, S> implements Subscriber<T, S> {
	public readonly listener: Listener<T>;

	public constructor(listener: Listener<T>, provider: PublishSubscribe<T, S>) {
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
	readonly #provider: PublishSubscribe<T, S>;
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
