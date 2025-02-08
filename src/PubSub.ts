export type Listener<T> = (topic: string, data: T) => void;

export type UnsubscribeHandle = () => void;

export interface SubscribeListener<T> {
	readonly topic: string;
	readonly listener: Listener<T>;
}

export interface PublishSubscribe<T> {
	subscribe(topic: string, listener: Listener<T>): UnsubscribeHandle;
	publish(topic: string, data: T): void;
	subscriberCount(topic: string): number;
}

export class PubSub<T> implements PublishSubscribe<T> {
	public constructor() {
		this.listenerMap = new Map();
	}

	public subscribe = (topic: string, listener: Listener<T>): UnsubscribeHandle => {
		const listeners = this.listenerMap.get(topic) ?? [];
		listeners.push(listener);
		this.listenerMap.set(topic, listeners);
		return () => this.unsubscribe(topic, listener);
	};

	public unsubscribe = (topic: string, listener: Listener<T>): void => {
		const listeners = this.listenerMap.get(topic) ?? [];
		for (const [index, activeListener] of listeners.entries()) {
			if (activeListener === listener) listeners.splice(index, 1);
		}
		if (listeners.length === 0) this.listenerMap.delete(topic);
	};

	public publish = (topic: string, state: T): void => {
		const listeners = this.listenerMap.get(topic) ?? [];
		for (const listener of listeners) {
			listener(topic, state);
		}
	};

	public subscriberCount = (topic: string): number => {
		return this.listenerMap.get(topic)?.length ?? 0;
	};

	private readonly listenerMap: Map<string, Array<Listener<T>>>;
}

export class SubscriberHandle<T> {
	public readonly listener: Listener<T>;

	public constructor(listener: Listener<T>, provider: PubSub<T>) {
		this.topic = null;
		this.listener = listener;
		this.provider = provider;
	}

	public useTopic = (topic: string): void => {
		if (this.topic !== null && this.topic !== topic)
			this.provider.unsubscribe(this.topic, this.listener);

		this.provider.subscribe(topic, this.listener);
		this.topic = topic;
	};

	public currentTopic = (): string | null => {
		return this.topic;
	};

	public unsubscribe = (): void => {
		if (this.topic) this.provider.unsubscribe(this.topic, this.listener);
		this.topic = null;
	};

	private topic: string | null;
	private readonly provider: PubSub<T>;
}
