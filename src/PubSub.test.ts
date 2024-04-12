import { assert, describe, it } from 'vitest';
import { Listener, PubSub, SubscriberHandle } from '@/PubSub';

describe('PubSub', () => {
	it('subscribe to a topic', () => {
		const pubsub = new PubSub<string>();
		const listener: Listener<string> = () => {};

		pubsub.subscribe('customer:events', listener);

		assert.strictEqual(pubsub.subscriberCount('customer:events'), 1);
	});

	it('unsubscribe from a topic', () => {
		const pubsub = new PubSub<string>();
		const listener: Listener<string> = () => {};

		const unsubHandler = pubsub.subscribe('customer:events', listener);
		assert.strictEqual(pubsub.subscriberCount('customer:events'), 1);

		unsubHandler();
		assert.strictEqual(pubsub.subscriberCount('customer:events'), 0);
	});

	it('publish, subscribe and receive a message from a topic', () => {
		let listenerCalled = 0;
		const pubsub = new PubSub<{ message: string }>();
		const listener: Listener<{ message: string }> = (topic, data) => {
			listenerCalled += 1;
			assert.strictEqual(topic, 'notification:user');
			assert.deepStrictEqual(data, { message: 'new update available' });
		};
		pubsub.subscribe('notification:user', listener);

		pubsub.publish('notification:user', { message: 'new update available' });

		assert.strictEqual(listenerCalled, 1);
	});

	it('publish, subscribe, receive message, and unsubscribe from a topic', () => {
		const listenerCall: Array<[string, { message: string }]> = [];
		const pubsub = new PubSub<{ message: string }>();
		const listener: Listener<{ message: string }> = (topic, data) => {
			listenerCall.push([topic, data]);
		};
		pubsub.subscribe('notification:user', listener);
		const unsubHandler = pubsub.subscribe('notification:customer', listener);

		pubsub.publish('notification:customer', { message: 'new update available' });
		pubsub.publish('notification:user', { message: 'usage exceeded current data plan' });
		unsubHandler();
		pubsub.publish('notification:customer', { message: 'new update available' });
		pubsub.publish('notification:customer', { message: '+1' });
		pubsub.publish('notification:user', { message: 'hello again' });

		assert.strictEqual(pubsub.subscriberCount('notification:customer'), 0);
		assert.strictEqual(pubsub.subscriberCount('notification:user'), 1);

		assert.deepStrictEqual(listenerCall, [
			['notification:customer', { message: 'new update available' }],
			['notification:user', { message: 'usage exceeded current data plan' }],
			['notification:user', { message: 'hello again' }],
		]);
	});
});

describe('SubscriberHandle', () => {
	it('create a subscriber handle, use a topic and unsubscribe', () => {
		const pubsub = new PubSub<string>();
		const listener = () => {};

		const subHandle = new SubscriberHandle(listener, pubsub);

		assert.strictEqual(subHandle.currentTopic(), null);
		assert.strictEqual(pubsub.subscriberCount('notification'), 0);

		subHandle.useTopic('notification');

		assert.strictEqual(subHandle.currentTopic(), 'notification');
		assert.strictEqual(pubsub.subscriberCount('notification'), 1);

		subHandle.unsubscribe();

		assert.strictEqual(subHandle.currentTopic(), null);
		assert.strictEqual(pubsub.subscriberCount('notification'), 0);
	});

	it('create a subscriber handle, use a topic and reaceive messages', () => {
		const listenerCall: Array<{ topic: string; data: string }> = [];
		const pubsub = new PubSub<string>();
		const listener = (topic: string, data: string) => {
			listenerCall.push({ topic, data });
		};

		const subHandle = new SubscriberHandle(listener, pubsub);
		subHandle.useTopic('notification');

		pubsub.publish('notification', '#1');
		pubsub.publish('notification:user', 'new product you might have interest');

		subHandle.useTopic('customer:updates');

		pubsub.publish('customer:updates', 'address updated');

		subHandle.useTopic('/dev/null');

		pubsub.publish('customer:updates', 'address updated again');

		assert.deepStrictEqual(listenerCall, [
			{ topic: 'notification', data: '#1' },
			{ topic: 'customer:updates', data: 'address updated' },
		]);
	});
});
