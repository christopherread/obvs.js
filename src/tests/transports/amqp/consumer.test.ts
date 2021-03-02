import { Channel, ConsumeMessage, Replies } from 'amqplib';
import {
  observableConsumer,
  retryingConsumer
} from '../../../transports/amqp/consumer';
import { stubInterface } from 'ts-sinon';
import { RetryBackoffConfig } from 'backoff-rxjs';

import assert = require('assert');

const backoff: RetryBackoffConfig = {
  initialInterval: 5,
  maxInterval: 15,
  maxRetries: 3,
  resetOnSuccess: true,
};

const eventLoopTick = (ms = 1): Promise<void> =>
  new Promise((resolve) => setTimeout(() => resolve(), ms));

describe('amqp observable consumer tests', () => {
  it('should consume messagegs from channel', async () => {
    const chan = stubInterface<Channel>();
    // @ts-expect-error: Bluebird/Promise
    chan.close.returns(Promise.resolve());
    const reply: Replies.Consume = { consumerTag: 'some.tag' };
    const emptyReply: Replies.Empty = {};

    // @ts-ignore
    chan.consume.returns(Promise.resolve(reply));
    // @ts-ignore
    chan.cancel.returns(Promise.resolve(emptyReply));

    const obs = observableConsumer(chan, 'some.queue');
    await eventLoopTick();

    assert(chan.consume.notCalled, 'consume called before subscribing');

    const numSubscribers = 3;
    for (let index = 0; index < numSubscribers; index++) {
      obs.subscribe();
      await eventLoopTick();
    }

    assert.strictEqual(
      chan.consume.callCount,
      numSubscribers,
      'consume not called'
    );
  });

  it('should cancel consumer tag after unsubcribed', async () => {
    const chan = stubInterface<Channel>();
    // @ts-expect-error: Bluebird/Promise
    chan.close.returns(Promise.resolve());
    const reply: Replies.Consume = { consumerTag: 'some.tag' };
    const emptyReply: Replies.Empty = {};

    // @ts-ignore
    chan.consume.returns(Promise.resolve(reply));
    // @ts-ignore
    chan.cancel.returns(Promise.resolve(emptyReply));

    const obs = observableConsumer(chan, 'some.queue');
    await eventLoopTick();

    const subscription1 = obs.subscribe();
    const subscription2 = obs.subscribe();
    const subscription3 = obs.subscribe();
    await eventLoopTick();

    assert.strictEqual(chan.consume.callCount, 3, 'consume not called');

    subscription1.unsubscribe();
    subscription2.unsubscribe();
    subscription3.unsubscribe();
    await eventLoopTick();

    assert.strictEqual(chan.cancel.callCount, 3, 'cancel not called');
    assert(
      chan.cancel.calledWith(reply.consumerTag),
      'cancel not called with correct tag'
    );
  });

  it('should emit message from consume callback', async () => {
    const chan = stubInterface<Channel>();
    // @ts-expect-error: Bluebird/Promise
    chan.close.returns(Promise.resolve());
    const reply: Replies.Consume = { consumerTag: 'some.tag' };
    const emptyReply: Replies.Empty = {};

    let consumers: { [q: string]: (args: ConsumeMessage | null) => void } = {};

    // @ts-ignore
    chan.consume.callsFake((q, onMessage) => {
      consumers[q] = onMessage;
      return Promise.resolve(reply);
    });

    // @ts-ignore
    chan.cancel.callsFake(() => {
      consumers = {};
      return Promise.resolve(emptyReply);
    });

    const obs = retryingConsumer(chan, 'queue1', {}, backoff);
    await eventLoopTick();

    let onNext = 0;
    let onError = false;
    let onComplete = false;
    const subscription1 = obs.subscribe(
      () => {
        onNext++;
      },
      (err) => {
        onError = true;
        console.log('onError', err);
      },
      () => {
        onComplete = true;
        console.log('onComplete');
      }
    );
    await eventLoopTick();

    const msg = stubInterface<ConsumeMessage>();
    msg.properties.headers = {};
    consumers.queue1(msg);

    assert.strictEqual(onNext, 1, 'observable did not emit a new message');
    assert(!onError, 'observable errored');
    assert(!onComplete, 'observable completed');

    subscription1.unsubscribe();
  });
});
