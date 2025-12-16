import { assert, describe, expect, it, vi } from 'vitest';
import { DummySubscriber, type Listener, PubSub, SubscriberHandle } from '@/lib';

describe('PubSub (un)subscribe', () => {
	it('subscribe to a topic', () => {
		const pubsub = new PubSub<string, string>();
		const listener: Listener<string> = vi.fn();

		pubsub.subscribe('event#1', listener, 'state');

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 1);

		expect(listener).toBeCalledTimes(0);
	});

	it('subscribe to a topic and unsubscribe with returned handler', () => {
		const pubsub = new PubSub<string, string>();
		const listener: Listener<string> = vi.fn();

		const unsubHandle = pubsub.subscribe('event#1', listener, 'state');

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 1);

		expect(listener).toBeCalledTimes(0);

		unsubHandle();

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 0);

		expect(listener).toBeCalledTimes(0);
	});

	it('subscribe to a topic and unsubscribe from it manually', () => {
		const pubsub = new PubSub<string, string>();
		const listener: Listener<string> = vi.fn();

		pubsub.subscribe('event#1', listener, 'state');

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 1);

		expect(listener).toBeCalledTimes(0);

		pubsub.unsubscribe('event#1', listener);

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 0);

		expect(listener).toBeCalledTimes(0);
	});

	it('subscribe to a topic twice with the same listener', () => {
		const pubsub = new PubSub<string, string>();
		const listener: Listener<string> = vi.fn();

		{
			pubsub.subscribe('event#1', listener, 'state');

			assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 1);

			expect(listener).toBeCalledTimes(0);
		}

		{
			pubsub.subscribe('event#1', listener, 'state');

			assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 1);

			expect(listener).toBeCalledTimes(0);
		}

		pubsub.unsubscribe('event#1', listener);

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 0);

		expect(listener).toBeCalledTimes(0);
	});

	it('subscribe to two topics with the same listener', () => {
		const pubsub = new PubSub<string, string>();
		const listener: Listener<string> = vi.fn();

		{
			pubsub.subscribe('event#1', listener, 'state');

			assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 1);

			expect(listener).toBeCalledTimes(0);
		}
		{
			pubsub.subscribe('event#2', listener, 'state');

			assert.deepStrictEqual(pubsub.subscriberCount('event#2'), 1);

			expect(listener).toBeCalledTimes(0);
		}

		{
			pubsub.unsubscribe('event#1', listener);

			assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 0);

			expect(listener).toBeCalledTimes(0);
		}
		{
			pubsub.unsubscribe('event#2', listener);

			assert.deepStrictEqual(pubsub.subscriberCount('event#2'), 0);

			expect(listener).toBeCalledTimes(0);
		}
	});

	it('unsubscribe from a topic that does not exist', () => {
		const pubsub = new PubSub<string, string>();
		const listener: Listener<string> = vi.fn();

		pubsub.unsubscribe('event#1', listener);

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 0);

		expect(listener).toBeCalledTimes(0);
	});

	it('unsubscribeAll from a topic that does not exist', () => {
		const pubsub = new PubSub<string, string>();

		pubsub.unsubscribeAll('event#1');

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 0);
	});

	it('unsubscribeAll listeners', () => {
		const pubsub = new PubSub<string, string>();
		const listener1: Listener<string> = vi.fn();
		const listener2: Listener<string> = vi.fn();
		const listener3: Listener<string> = vi.fn();

		pubsub.subscribe('event#1', listener1, 'state');
		pubsub.subscribe('event#1', listener2, 'state');
		pubsub.subscribe('event#1', listener3, 'state');

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 3);

		pubsub.unsubscribeAll('event#1');

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 0);
	});
});

describe('PubSub publish', () => {
	it('publish to a topic with one listener', () => {
		const pubsub = new PubSub();
		const listener = vi.fn();

		pubsub.subscribe('event#1', listener, 'state');

		pubsub.publish('event#1', 'message-1');

		expect(listener).toHaveBeenNthCalledWith(1, 'event#1', 'message-1');
	});

	it('publish to a topic with multiple listeners', () => {
		const pubsub = new PubSub();
		const listener1 = vi.fn();
		const listener2 = vi.fn();
		const listener3 = vi.fn();

		pubsub.subscribe('event#1', listener1, 'state');
		pubsub.subscribe('event#1', listener2, 'state');
		pubsub.subscribe('event#1', listener3, 'state');

		pubsub.publish('event#1', 'message-1');

		expect(listener1).toHaveBeenNthCalledWith(1, 'event#1', 'message-1');
		expect(listener2).toHaveBeenNthCalledWith(1, 'event#1', 'message-1');
		expect(listener3).toHaveBeenNthCalledWith(1, 'event#1', 'message-1');
	});

	it('publish to a topic with multiple listeners ignoring the last one', () => {
		const pubsub = new PubSub();
		const listener1 = vi.fn();
		const listener2 = vi.fn();
		const listener3 = vi.fn();

		pubsub.subscribe('event#1', listener1, 'state');
		pubsub.subscribe('event#1', listener2, 'state');
		pubsub.subscribe('event#1', listener3, 'state');

		pubsub.publish('event#1', 'message-1', [listener3]);

		expect(listener1).toHaveBeenCalledTimes(1);
		expect(listener2).toHaveBeenCalledTimes(1);
		expect(listener3).toHaveBeenCalledTimes(0);

		expect(listener1).toHaveBeenNthCalledWith(1, 'event#1', 'message-1');
		expect(listener2).toHaveBeenNthCalledWith(1, 'event#1', 'message-1');
	});

	it('publish to a topic that does not exist', () => {
		const pubsub = new PubSub();

		pubsub.publish('event#1', 'message-1');

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 0);
	});
});

describe('PubSub shared state', () => {
	it('set the state of a topic', () => {
		const pubsub = new PubSub<string, string>();
		const listener = vi.fn();

		pubsub.subscribe('event#1', listener, 'initial state');

		const setted = pubsub.setState('event#1', 'state1');

		assert.strictEqual(setted, true);
		assert.strictEqual(pubsub.getState('event#1'), 'state1');
	});

	it('not set the state of a topic that does not exist', () => {
		const pubsub = new PubSub<string, string>();

		const setted = pubsub.setState('event#1', 'state1');

		assert.strictEqual(setted, false);
		assert.strictEqual(pubsub.getState('event#1'), null);
	});
});

describe('SubscriberHandle (un)subscribe', () => {
	it('make a subscriber handle but not subscribe to any topic', () => {
		const pubsub = new PubSub();
		const listener = vi.fn();
		const handle = new SubscriberHandle(listener, pubsub);

		assert.strictEqual(handle.currentTopic(), null);

		assert.deepStrictEqual(Array.from(pubsub.topics()), []);
	});

	it('make a subscriber handler and subscribe to a topic', () => {
		const pubsub = new PubSub();
		const listener = vi.fn();
		const handle = new SubscriberHandle(listener, pubsub);

		handle.useTopic('event#1', 'state');

		assert.strictEqual(handle.currentTopic(), 'event#1');
		assert.deepStrictEqual(Array.from(pubsub.topics()), ['event#1']);
	});

	it('unsubscribe to a topic', () => {
		const pubsub = new PubSub();
		const listener = vi.fn();
		const handle = new SubscriberHandle(listener, pubsub);

		{
			handle.useTopic('event#1', 'state');

			assert.strictEqual(handle.currentTopic(), 'event#1');
			assert.deepStrictEqual(Array.from(pubsub.topics()), ['event#1']);
		}
		{
			handle.unsubscribe();

			assert.strictEqual(handle.currentTopic(), null);
			assert.deepStrictEqual(Array.from(pubsub.topics()), []);
		}
	});

	it('unsubscribe to a topic when disposed', () => {
		const pubsub = new PubSub();
		const listener = vi.fn();

		{
			using handle = new SubscriberHandle(listener, pubsub);
			handle.useTopic('event#1', 'state');

			assert.strictEqual(handle.currentTopic(), 'event#1');
			assert.deepStrictEqual(Array.from(pubsub.topics()), ['event#1']);
		}

		assert.deepStrictEqual(Array.from(pubsub.topics()), []);
	});

	it('unsubscribe without a topic', () => {
		const pubsub = new PubSub();
		const listener = vi.fn();
		const handle = new SubscriberHandle(listener, pubsub);

		assert.strictEqual(handle.currentTopic(), null);
		assert.deepStrictEqual(Array.from(pubsub.topics()), []);

		handle.unsubscribe();

		assert.strictEqual(handle.currentTopic(), null);
		assert.deepStrictEqual(Array.from(pubsub.topics()), []);
	});

	it('unsubscribe to a topic by subscribing to new one', () => {
		const pubsub = new PubSub();
		const listener = vi.fn();
		const handle = new SubscriberHandle(listener, pubsub);

		{
			handle.useTopic('event#1', 'state');

			assert.strictEqual(handle.currentTopic(), 'event#1');
			assert.deepStrictEqual(Array.from(pubsub.topics()), ['event#1']);
		}
		{
			handle.useTopic('event_2', 'state');

			assert.strictEqual(handle.currentTopic(), 'event_2');
			assert.deepStrictEqual(Array.from(pubsub.topics()), ['event_2']);
		}
	});
});

describe('SubscriberHandle publish', () => {
	it('publish to the current topic', () => {
		const pubsub = new PubSub();
		const listener = vi.fn();
		const handle = new SubscriberHandle(listener, pubsub);

		handle.useTopic('event#1', 'state');

		handle.publish('message-1');

		assert.deepStrictEqual(handle.currentTopic(), 'event#1');
	});

	it('not publish to the current unprovided topic', () => {
		const pubsub = new PubSub();
		const handle = new SubscriberHandle(vi.fn(), pubsub);

		const published = handle.publish('message-1');
		assert.strictEqual(published, false);

		assert.deepStrictEqual(handle.currentTopic(), null);
	});

	it('publish to the current topic not calling the listener from the subscriber handle', () => {
		const pubsub = new PubSub();
		const handle1 = new SubscriberHandle(vi.fn(), pubsub);
		const handle2 = new SubscriberHandle(vi.fn(), pubsub);

		handle1.useTopic('event#1', 'state');
		handle2.useTopic('event#1', 'state');

		assert.strictEqual(pubsub.subscriberCount('event#1'), 2);

		assert.deepStrictEqual(handle1.currentTopic(), 'event#1');
		assert.deepStrictEqual(handle2.currentTopic(), 'event#1');

		{
			const published = handle1.publish('message-1');
			assert.strictEqual(published, true);

			expect(handle1.listener).toHaveBeenCalledTimes(0);
			expect(handle2.listener).toHaveBeenCalledTimes(1);
		}
		{
			const published = handle2.publish('message-2');
			assert.strictEqual(published, true);

			expect(handle1.listener).toHaveBeenCalledTimes(1);
			expect(handle2.listener).toHaveBeenCalledTimes(1);
		}
	});

	it('publish to a topic not calling the listener from the subscriber handle', () => {
		const pubsub = new PubSub();
		const handle1 = new SubscriberHandle(vi.fn(), pubsub);
		const handle2 = new SubscriberHandle(vi.fn(), pubsub);

		handle1.useTopic('event#1', 'state');
		handle2.useTopic('event#1', 'state');

		assert.strictEqual(pubsub.subscriberCount('event#1'), 2);

		assert.deepStrictEqual(handle1.currentTopic(), 'event#1');
		assert.deepStrictEqual(handle2.currentTopic(), 'event#1');

		{
			handle1.publishTopic('event#1', 'message-1');

			expect(handle1.listener).toHaveBeenCalledTimes(0);
			expect(handle2.listener).toHaveBeenCalledTimes(1);
		}
		{
			handle2.publishTopic('event#1', 'message-2');

			expect(handle1.listener).toHaveBeenCalledTimes(1);
			expect(handle2.listener).toHaveBeenCalledTimes(1);
		}
	});
});

describe('SubscriberHandle shared state', () => {
	it('set the state of a topic', () => {
		const pubsub = new PubSub();
		const handle = new SubscriberHandle(vi.fn(), pubsub);

		handle.useTopic('event#1', 'state');

		const setted = handle.setState('state1');

		assert.strictEqual(setted, true);
		assert.strictEqual(handle.getState(), 'state1');
	});

	it('set the state of a topic using a function', () => {
		const pubsub = new PubSub();
		const handle = new SubscriberHandle(vi.fn(), pubsub);

		handle.useTopic('event#1', 'state');
		handle.setState('prev-state');

		const setted = handle.setState((old: string) => (old.startsWith('prev') ? 'new-state' : ''));

		assert.strictEqual(setted, true);
		assert.strictEqual(handle.getState(), 'new-state');
	});

	it('not set the state of a topic that does not exist', () => {
		const pubsub = new PubSub();
		const handle = new SubscriberHandle(vi.fn(), pubsub);

		const setted = handle.setState('state1');

		assert.strictEqual(setted, false);
		assert.strictEqual(handle.getState(), null);
	});
});

describe('DummySubscriber', () => {
	it('DummySubscriber assertions', () => {
		const sub = new DummySubscriber<number, string>();

		sub.useTopic('topic#2');

		assert.deepStrictEqual(sub.currentTopic(), 'topic#2');

		assert.deepStrictEqual(sub.setState(), false);
		assert.deepStrictEqual(sub.getState(), null);

		assert.deepStrictEqual(sub.publish(), false);

		sub.useTopic('topic#1');

		assert.deepStrictEqual(sub.currentTopic(), 'topic#1');

		sub.unsubscribe();

		assert.deepStrictEqual(sub.currentTopic(), null);
	});
});
