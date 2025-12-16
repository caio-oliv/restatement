import type {
	Listener,
	PublishSubscribe,
	PubSubSetStateFn,
	PubSubUpdateStateValue,
	UnsubscribeHandle,
} from '@/core/PublishSubscribe';

interface InternalState<S> {
	listener: number;
	state: S;
}

/**
 * Apply the state
 * @param old Old state
 * @param state State
 * @returns State
 */
export function applyState<S>(old: S | null, state: PubSubUpdateStateValue<S>): S {
	if (typeof state === 'function') {
		return (state as PubSubSetStateFn<S>)(old);
	} else {
		return state;
	}
}

export class SharedState<T, S> implements PublishSubscribe<T, S> {
	public constructor() {
		this.#shared = new Map();
	}

	public subscribe(
		topic: string,
		_: Listener<T>,
		state: PubSubUpdateStateValue<S>
	): UnsubscribeHandle {
		const inner = this.#shared.get(topic);
		if (inner) {
			inner.listener += 1;
			inner.state = applyState(inner.state, state);
		} else {
			this.#shared.set(topic, { listener: 1, state: applyState(null, state) });
		}

		return () => this.unsubscribe(topic);
	}

	public unsubscribe(topic: string): void {
		const inner = this.#shared.get(topic);
		if (!inner) return;

		inner.listener -= 1;
		if (inner.listener === 0) this.#shared.delete(topic);
	}

	public unsubscribeAll(topic: string): void {
		this.#shared.delete(topic);
	}

	// eslint-disable-next-line class-methods-use-this, @typescript-eslint/class-methods-use-this
	public publish(): void {
		// no-op
	}

	public getState(topic: string): S | null {
		const inner = this.#shared.get(topic);
		if (!inner) return null;

		return inner.state;
	}

	public setState(topic: string, state: PubSubUpdateStateValue<S>): boolean {
		const inner = this.#shared.get(topic);
		if (!inner) {
			return false;
		}
		inner.state = applyState(inner.state, state);
		this.#shared.set(topic, inner);
		return true;
	}

	public topics(): IteratorObject<string, BuiltinIteratorReturn> {
		return this.#shared.keys();
	}

	public *entries(): IteratorObject<[string, S], undefined, unknown> {
		for (const [topic, inner] of this.#shared.entries()) {
			yield [topic, inner.state];
		}
	}

	public *states(): IteratorObject<S, undefined, unknown> {
		for (const inner of this.#shared.values()) {
			yield inner.state;
		}
	}

	readonly #shared: Map<string, InternalState<S>>;
}
