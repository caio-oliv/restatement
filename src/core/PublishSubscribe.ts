/**
 * Listener function
 */
export type Listener<in T> = (topic: string, data: T) => void | Promise<void>;

/**
 * Unsubscriber function handler
 */
export type UnsubscribeHandle = () => void;

export type PubSubSetStateFn<in out S> = (old: S | null) => S;

export type PubSubUpdateStateValue<S> = S | PubSubSetStateFn<S>;

/**
 * Publish-Subscribe
 */
export interface PublishSubscribe<T, S> {
	/**
	 * Subscribe a listener to a topic
	 * @param topic Topic
	 * @param listener Listener function
	 * @param state State
	 * @returns Unsubscriber handle
	 */
	subscribe(
		topic: string,
		listener: Listener<T>,
		state: PubSubUpdateStateValue<S>
	): UnsubscribeHandle;
	/**
	 * Unsubscribe a listener from a topic
	 * @param topic Topic
	 * @param listener Listener function
	 */
	unsubscribe(topic: string, listener: Listener<T>): void;
	/**
	 * Unsubscribe all listeners from a topic
	 * @param topic Topic
	 */
	unsubscribeAll(topic: string): void;

	/**
	 * Publish a data value to a topic
	 * @param topic Topic
	 * @param data Data
	 * @param ignore Ignore list
	 */
	publish(topic: string, data: T, ignore?: Array<Listener<T>>): void;

	/**
	 * Get the topic state
	 * @param topic Topic
	 * @returns Topic state
	 */
	getState(topic: string): S | null;
	/**
	 * Set the topic state
	 * @param topic Topic
	 * @param state State
	 * @returns `true` if the state was set
	 */
	setState(topic: string, state: PubSubUpdateStateValue<S>): boolean;

	/**
	 * Returns an iterator of all topics
	 * @yields Topic
	 */
	topics(): IteratorObject<string, BuiltinIteratorReturn>;
	/**
	 * Returns an iterator of all topics and states
	 * @yields Topic and state tuple
	 */
	entries(): IteratorObject<[string, S], BuiltinIteratorReturn>;
	/**
	 * Returns an iterator of all states
	 * @yields State
	 */
	states(): IteratorObject<S, BuiltinIteratorReturn>;
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
