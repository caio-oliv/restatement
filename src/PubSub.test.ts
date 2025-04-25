import { assert, describe, expect, it, vi } from 'vitest';
import { type Listener, PubSub, SubscriberHandle } from '@/lib';

describe('PubSub (un)subscribe', () => {
	it('subscribe to a topic', () => {
		const pubsub = new PubSub<string>();
		const listener: Listener<string> = vi.fn();

		pubsub.subscribe('event#1', listener);

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 1);

		expect(listener).toBeCalledTimes(0);
	});

	it('subscribe to a topic and unsubscribe with returned handler', () => {
		const pubsub = new PubSub<string>();
		const listener: Listener<string> = vi.fn();

		const unsubHandle = pubsub.subscribe('event#1', listener);

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 1);

		expect(listener).toBeCalledTimes(0);

		unsubHandle();

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 0);

		expect(listener).toBeCalledTimes(0);
	});

	it('subscribe to a topic and unsubscribe from it manually', () => {
		const pubsub = new PubSub<string>();
		const listener: Listener<string> = vi.fn();

		pubsub.subscribe('event#1', listener);

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 1);

		expect(listener).toBeCalledTimes(0);

		pubsub.unsubscribe('event#1', listener);

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 0);

		expect(listener).toBeCalledTimes(0);
	});

	it('subscribe to a topic twice with the same listener', () => {
		const pubsub = new PubSub<string>();
		const listener: Listener<string> = vi.fn();

		{
			pubsub.subscribe('event#1', listener);

			assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 1);

			expect(listener).toBeCalledTimes(0);
		}

		{
			pubsub.subscribe('event#1', listener);

			assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 1);

			expect(listener).toBeCalledTimes(0);
		}

		pubsub.unsubscribe('event#1', listener);

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 0);

		expect(listener).toBeCalledTimes(0);
	});

	it('subscribe to two topics with the same listener', () => {
		const pubsub = new PubSub<string>();
		const listener: Listener<string> = vi.fn();

		{
			pubsub.subscribe('event#1', listener);

			assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 1);

			expect(listener).toBeCalledTimes(0);
		}
		{
			pubsub.subscribe('event#2', listener);

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

	it('subscribe to a topic and return the default latest value', () => {
		const pubsub = new PubSub<string>();
		const listener: Listener<string> = vi.fn();

		const unsubHandle = pubsub.subscribe('event#1', listener);

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 1);
		assert.deepStrictEqual(pubsub.latestValue('event#1'), null);

		expect(listener).toBeCalledTimes(0);

		unsubHandle();

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 0);
		assert.deepStrictEqual(pubsub.latestValue('event#1'), null);

		expect(listener).toBeCalledTimes(0);
	});

	it('unsubscribe from a topic that does not exist', () => {
		const pubsub = new PubSub<string>();
		const listener: Listener<string> = vi.fn();

		pubsub.unsubscribe('event#1', listener);

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 0);
		assert.deepStrictEqual(pubsub.latestValue('event#1'), null);

		expect(listener).toBeCalledTimes(0);
	});

	it('unsubscribeAll from a topic that does not exist', () => {
		const pubsub = new PubSub<string>();

		pubsub.unsubscribeAll('event#1');

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 0);
		assert.deepStrictEqual(pubsub.latestValue('event#1'), null);
	});

	it('unsubscribeAll listeners', () => {
		const pubsub = new PubSub<string>();
		const listener1: Listener<string> = vi.fn();
		const listener2: Listener<string> = vi.fn();
		const listener3: Listener<string> = vi.fn();

		pubsub.subscribe('event#1', listener1);
		pubsub.subscribe('event#1', listener2);
		pubsub.subscribe('event#1', listener3);

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 3);
		assert.deepStrictEqual(pubsub.latestValue('event#1'), null);

		pubsub.unsubscribeAll('event#1');

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 0);
		assert.deepStrictEqual(pubsub.latestValue('event#1'), null);
	});
});

describe('PubSub publish', () => {
	it('publish to a topic with one listener', () => {
		const pubsub = new PubSub<string>();
		const listener = vi.fn();

		pubsub.subscribe('event#1', listener);

		pubsub.publish('event#1', 'message-1');

		expect(listener).toHaveBeenNthCalledWith(1, 'event#1', 'message-1');
	});

	it('publish to a topic with multiple listeners', () => {
		const pubsub = new PubSub<string>();
		const listener1 = vi.fn();
		const listener2 = vi.fn();
		const listener3 = vi.fn();

		pubsub.subscribe('event#1', listener1);
		pubsub.subscribe('event#1', listener2);
		pubsub.subscribe('event#1', listener3);

		pubsub.publish('event#1', 'message-1');

		expect(listener1).toHaveBeenNthCalledWith(1, 'event#1', 'message-1');
		expect(listener2).toHaveBeenNthCalledWith(1, 'event#1', 'message-1');
		expect(listener3).toHaveBeenNthCalledWith(1, 'event#1', 'message-1');
	});

	it('publish to a topic with multiple listeners ignoring the last one', () => {
		const pubsub = new PubSub<string>();
		const listener1 = vi.fn();
		const listener2 = vi.fn();
		const listener3 = vi.fn();

		pubsub.subscribe('event#1', listener1);
		pubsub.subscribe('event#1', listener2);
		pubsub.subscribe('event#1', listener3);

		pubsub.publish('event#1', 'message-1', [listener3]);

		expect(listener1).toHaveBeenCalledTimes(1);
		expect(listener2).toHaveBeenCalledTimes(1);
		expect(listener3).toHaveBeenCalledTimes(0);

		expect(listener1).toHaveBeenNthCalledWith(1, 'event#1', 'message-1');
		expect(listener2).toHaveBeenNthCalledWith(1, 'event#1', 'message-1');
	});

	it('publish to a topic that does not exist', () => {
		const pubsub = new PubSub<string>();

		pubsub.publish('event#1', 'message-1');

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 0);
		assert.deepStrictEqual(pubsub.latestValue('event#1'), null);
	});

	it('get the latest value published into a topic', () => {
		const pubsub = new PubSub<string>();
		const listener = vi.fn();

		pubsub.subscribe('event#1', listener);

		assert.deepStrictEqual(pubsub.subscriberCount('event#1'), 1);

		{
			pubsub.publish('event#1', 'message-1');

			assert.deepStrictEqual(pubsub.latestValue('event#1'), 'message-1');

			expect(listener).toHaveBeenNthCalledWith(1, 'event#1', 'message-1');
		}
		{
			pubsub.publish('event#1', 'message-99');

			assert.deepStrictEqual(pubsub.latestValue('event#1'), 'message-99');

			expect(listener).toHaveBeenNthCalledWith(2, 'event#1', 'message-99');
		}
	});
});

describe('SubscriberHandle (un)subscribe', () => {
	it('make a subscriber handle but not subscribe to any topic', () => {
		const pubsub = new PubSub();
		const listener = vi.fn();
		const handle = new SubscriberHandle(listener, pubsub);

		assert.strictEqual(handle.currentTopic(), null);
		assert.strictEqual(handle.currentValue(), null);

		assert.deepStrictEqual(Array.from(pubsub.topics()), []);
	});

	it('make a subscriber handler and subscribe to a topic', () => {
		const pubsub = new PubSub();
		const listener = vi.fn();
		const handle = new SubscriberHandle(listener, pubsub);

		handle.useTopic('event#1');

		assert.strictEqual(handle.currentTopic(), 'event#1');
		assert.deepStrictEqual(Array.from(pubsub.topics()), ['event#1']);
	});

	it('unsubscribe to a topic', () => {
		const pubsub = new PubSub();
		const listener = vi.fn();
		const handle = new SubscriberHandle(listener, pubsub);

		{
			handle.useTopic('event#1');

			assert.strictEqual(handle.currentTopic(), 'event#1');
			assert.deepStrictEqual(Array.from(pubsub.topics()), ['event#1']);
		}
		{
			handle.unsubscribe();

			assert.strictEqual(handle.currentTopic(), null);
			assert.deepStrictEqual(Array.from(pubsub.topics()), []);
		}
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
			handle.useTopic('event#1');

			assert.strictEqual(handle.currentTopic(), 'event#1');
			assert.deepStrictEqual(Array.from(pubsub.topics()), ['event#1']);
		}
		{
			handle.useTopic('event_2');

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

		handle.useTopic('event#1');

		handle.publishCurrentTopic('message-1');

		assert.deepStrictEqual(handle.currentTopic(), 'event#1');
		assert.deepStrictEqual(handle.currentValue(), 'message-1');
	});

	it('not publish to the current unprovided topic', () => {
		const pubsub = new PubSub();
		const handle = new SubscriberHandle(vi.fn(), pubsub);

		const published = handle.publishCurrentTopic('message-1');
		assert.strictEqual(published, false);

		assert.deepStrictEqual(handle.currentTopic(), null);
		assert.deepStrictEqual(handle.currentValue(), null);
	});

	it('publish to the current topic not calling the listener from the subscriber handle', () => {
		const pubsub = new PubSub();
		const handle1 = new SubscriberHandle(vi.fn(), pubsub);
		const handle2 = new SubscriberHandle(vi.fn(), pubsub);

		handle1.useTopic('event#1');
		handle2.useTopic('event#1');

		assert.strictEqual(pubsub.subscriberCount('event#1'), 2);

		assert.deepStrictEqual(handle1.currentTopic(), 'event#1');
		assert.deepStrictEqual(handle2.currentTopic(), 'event#1');

		{
			const published = handle1.publishCurrentTopic('message-1');
			assert.strictEqual(published, true);

			assert.deepStrictEqual(handle1.currentValue(), 'message-1');
			assert.deepStrictEqual(handle2.currentValue(), 'message-1');

			expect(handle1.listener).toHaveBeenCalledTimes(0);
			expect(handle2.listener).toHaveBeenCalledTimes(1);
		}
		{
			const published = handle2.publishCurrentTopic('message-2');
			assert.strictEqual(published, true);

			assert.deepStrictEqual(handle1.currentValue(), 'message-2');
			assert.deepStrictEqual(handle2.currentValue(), 'message-2');

			expect(handle1.listener).toHaveBeenCalledTimes(1);
			expect(handle2.listener).toHaveBeenCalledTimes(1);
		}
	});

	it('publish to a topic not calling the listener from the subscriber handle', () => {
		const pubsub = new PubSub();
		const handle1 = new SubscriberHandle(vi.fn(), pubsub);
		const handle2 = new SubscriberHandle(vi.fn(), pubsub);

		handle1.useTopic('event#1');
		handle2.useTopic('event#1');

		assert.strictEqual(pubsub.subscriberCount('event#1'), 2);

		assert.deepStrictEqual(handle1.currentTopic(), 'event#1');
		assert.deepStrictEqual(handle2.currentTopic(), 'event#1');

		{
			handle1.publish('event#1', 'message-1');

			assert.deepStrictEqual(handle1.currentValue(), 'message-1');
			assert.deepStrictEqual(handle2.currentValue(), 'message-1');

			expect(handle1.listener).toHaveBeenCalledTimes(0);
			expect(handle2.listener).toHaveBeenCalledTimes(1);
		}
		{
			handle2.publish('event#1', 'message-2');

			assert.deepStrictEqual(handle1.currentValue(), 'message-2');
			assert.deepStrictEqual(handle2.currentValue(), 'message-2');

			expect(handle1.listener).toHaveBeenCalledTimes(1);
			expect(handle2.listener).toHaveBeenCalledTimes(1);
		}
	});
});
