import { assert, describe, expect, it, vi } from 'vitest';
import type { PublishSubscribe } from '@/lib';
import { SharedState } from '@/pubsub/PubSubInternal';

describe('SharedState', () => {
	it('subscribe and unsubscribe to a topic', () => {
		const shared = new SharedState();
		const listener = vi.fn();

		const unsub = shared.subscribe('home', listener, 'init');

		assert.strictEqual(shared.getState('home'), 'init');

		unsub();

		assert.strictEqual(shared.getState('home'), null);
	});

	it('drop the state only when all subscribers are gone', () => {
		const shared = new SharedState<string, string>();
		const listener = vi.fn();

		const unsub1 = shared.subscribe('home', listener, 'init');

		assert.strictEqual(shared.getState('home'), 'init');

		const unsub2 = shared.subscribe('home', listener, old => old ?? 'replaced');

		unsub1();

		assert.strictEqual(shared.getState('home'), 'init');

		unsub2();

		assert.strictEqual(shared.getState('home'), null);
	});

	it('unsubscribe all listeners from a topic', () => {
		const shared = new SharedState<string, string>();
		const listener = vi.fn();

		shared.subscribe('other.topic', listener, 'hi');

		shared.subscribe('home', listener, 'init');
		shared.subscribe('home', listener, old => old ?? 'replaced');

		assert.strictEqual(shared.getState('home'), 'init');

		shared.unsubscribeAll('home');

		assert.strictEqual(shared.getState('home'), null);
		assert.strictEqual(shared.getState('other.topic'), 'hi');
	});

	it('unsubscribe multiple times from same topic', () => {
		const shared = new SharedState<string, string>();
		const listener = vi.fn();

		shared.subscribe('other.topic', listener, 'hi');

		shared.subscribe('home', listener, 'init');

		assert.strictEqual(shared.getState('home'), 'init');

		shared.unsubscribe('home');

		assert.strictEqual(shared.getState('home'), null);
		assert.strictEqual(shared.getState('other.topic'), 'hi');

		shared.unsubscribe('home');

		assert.strictEqual(shared.getState('home'), null);
		assert.strictEqual(shared.getState('other.topic'), 'hi');
	});

	it('publish does not call the listener function', () => {
		const shared = new SharedState<string, string>();
		const listener = vi.fn();

		shared.subscribe('broadcast', listener, 'init');

		(shared as PublishSubscribe<string, string>).publish('broadcast', 'event#1');

		expect(listener).toHaveBeenCalledTimes(0);
	});

	it('set the state of a topic', () => {
		const shared = new SharedState<string, number>();
		const listener = vi.fn();

		shared.subscribe('delete_event', listener, 0);

		shared.setState('delete_event', 100);

		assert.strictEqual(shared.getState('delete_event'), 100);
	});

	it('not set the state of an nonexistent topic', () => {
		const shared = new SharedState<string, number>();

		shared.setState('delete_event', 100);

		assert.strictEqual(shared.getState('delete_event'), null);
	});
});

describe('SharedState iterator', () => {
	it('list all topics', () => {
		const pubsub = new SharedState<string, string>();
		const listener = vi.fn();

		pubsub.subscribe('event#1', listener, 'initial state');

		assert.deepStrictEqual(Array.from(pubsub.topics()), ['event#1']);
	});

	it('list all entries (topic, state)', () => {
		const pubsub = new SharedState<string, string>();
		const listener = vi.fn();

		pubsub.subscribe('event#1', listener, 'state@0');

		assert.deepStrictEqual(Array.from(pubsub.entries()), [['event#1', 'state@0']]);

		pubsub.subscribe('event#32', listener, 'state@1');

		assert.deepStrictEqual(Array.from(pubsub.entries()), [
			['event#1', 'state@0'],
			['event#32', 'state@1'],
		]);
	});

	it('list all states', () => {
		const pubsub = new SharedState<string, string>();
		const listener = vi.fn();

		pubsub.subscribe('event#1', listener, 'state@0');

		assert.deepStrictEqual(Array.from(pubsub.states()), ['state@0']);

		pubsub.subscribe('event#32', listener, 'state@1');

		assert.deepStrictEqual(Array.from(pubsub.states()), ['state@0', 'state@1']);
	});
});
