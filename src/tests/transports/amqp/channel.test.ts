import 'should';
import { Channel, Connection, Replies } from 'amqplib';
import {
  observableChannel,
  retryingChannel
} from "../../../transports/amqp/channel";
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

describe('amqp observable channel tests', () => {
  it('should set prefetch, check queues, and register listeners', async () => {
    const conn = stubInterface<Connection>();
    // @ts-expect-error: Bluebird/Promise
    conn.close.returns(Promise.resolve());

    const chan = stubInterface<Channel>();
    // @ts-expect-error: Bluebird/Promise
    chan.close.returns(Promise.resolve());
    // @ts-expect-error: Bluebird/Promise
    chan.unbindQueue.returns(Promise.resolve({} as Replies.Empty));
    // @ts-expect-error: Bluebird/Promise
    chan.deleteQueue.returns(Promise.resolve({ messageCount: 0 } as Replies.DeleteQueue));

    // @ts-expect-error: Bluebird/Promise
    conn.createChannel.returns(Promise.resolve(chan));

    const checkQueues = ['some.queue'];
    const prefetch = 10;
    const obs = observableChannel(conn, prefetch, checkQueues);
    await eventLoopTick();

    assert(conn.createChannel.notCalled, 'created channel before subscribing');
    assert(chan.on.notCalled, 'registered listeners before subscribing');

    const subscribers = [];
    for (let index = 0; index < 3; index++) {
      subscribers.push(obs.subscribe());
      await eventLoopTick();
    }

    assert.strictEqual(
      conn.createChannel.callCount,
      subscribers.length,
      'channel not created'
    );
    assert(chan.prefetch.calledWith(prefetch), 'did not set prefetch');
    assert.strictEqual(
      chan.checkQueue.callCount,
      checkQueues.length * subscribers.length,
      'did not assert queues'
    );
    assert(chan.on.calledWith('error'), 'error listener not registered');
    assert(chan.on.calledWith('close'), 'close listener not registered');

    subscribers.forEach((s) => s.unsubscribe());
  });

  it('should disconnect and register listeners after unsubcribed', async () => {
    const conn = stubInterface<Connection>();
    // @ts-expect-error: Bluebird/Promise
    conn.close.returns(Promise.resolve());

    const chan = stubInterface<Channel>();
    // @ts-expect-error: Bluebird/Promise
    chan.close.returns(Promise.resolve());
    // @ts-expect-error: Bluebird/Promise
    chan.unbindQueue.returns(Promise.resolve({} as Replies.Empty));
    // @ts-expect-error: Bluebird/Promise
    chan.deleteQueue.returns(Promise.resolve({ messageCount: 0 } as Replies.DeleteQueue));

    // @ts-ignore
    conn.createChannel.returns(Promise.resolve(chan));

    const checkQueues = ['some.queue'];
    const prefetch = 10;
    const obs = observableChannel(conn, prefetch, checkQueues);
    await eventLoopTick();

    const subscription1 = obs.subscribe();
    const subscription2 = obs.subscribe();
    const subscription3 = obs.subscribe();
    await eventLoopTick();

    assert.strictEqual(conn.createChannel.callCount, 3, 'channel not created');
    assert(chan.on.calledWith('error'), 'error listener not registered');
    assert(chan.on.calledWith('close'), 'close listener not registered');

    subscription1.unsubscribe();
    subscription2.unsubscribe();
    subscription3.unsubscribe();
    await eventLoopTick();

    assert(
      chan.removeAllListeners.callCount === 3,
      'removeAllListeners not called'
    );
    assert(chan.close.callCount === 3, 'close not called');
  });

  it('should not error/complete on channel error', async () => {
    const conn = stubInterface<Connection>();
    // @ts-expect-error: Bluebird/Promise
    conn.close.returns(Promise.resolve());

    const chan = stubInterface<Channel>();
    // @ts-expect-error: Bluebird/Promise
    chan.close.returns(Promise.resolve());
    // @ts-expect-error: Bluebird/Promise
    chan.unbindQueue.returns(Promise.resolve({} as Replies.Empty));
    // @ts-expect-error: Bluebird/Promise
    chan.deleteQueue.returns(Promise.resolve({ messageCount: 0 } as Replies.DeleteQueue));

    // @ts-ignore
    conn.createChannel.returns(Promise.resolve(chan));

    const checkQueues = ['some.queue'];
    const prefetch = 10;
    const obs = retryingChannel(conn, prefetch, checkQueues);
    await eventLoopTick();

    let listeners: { [ev: string]: (args?: any) => any } = {};
    let onNext = 0;
    let onError = false;
    let onComplete = false;

    chan.on.callsFake((ev, l) => {
      listeners[ev as string] = l;
      return chan;
    });
    chan.removeAllListeners.callsFake(() => {
      listeners = {};
      return chan;
    });

    const subscription = obs.subscribe(
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

    listeners.error(new Error('fake channel error'));

    await eventLoopTick(backoff.initialInterval);

    assert(onNext > 0, 'observable did not emit a channel');
    assert(!onError, 'observable threw error');
    assert(!onComplete, 'observable completed');

    subscription.unsubscribe();
  });

  it('should complete on channel close', async () => {
    const conn = stubInterface<Connection>();
    // @ts-expect-error: Bluebird/Promise
    conn.close.returns(Promise.resolve());

    const chan = stubInterface<Channel>();
    // @ts-expect-error: Bluebird/Promise
    chan.close.returns(Promise.resolve());
    // @ts-expect-error: Bluebird/Promise
    chan.unbindQueue.returns(Promise.resolve({} as Replies.Empty));
    // @ts-expect-error: Bluebird/Promise
    chan.deleteQueue.returns(Promise.resolve({ messageCount: 0 } as Replies.DeleteQueue));

    // @ts-ignore
    conn.createChannel.returns(Promise.resolve(chan));

    const checkQueues = ['some.queue'];
    const prefetch = 10;
    const obs = retryingChannel(conn, prefetch, checkQueues);
    await eventLoopTick();

    let listeners: { [ev: string]: (args?: any) => any } = {};
    let onNext = 0;
    let onError = false;
    let onComplete = false;

    chan.on.callsFake((ev, l) => {
      listeners[ev as string] = l;
      return chan;
    });
    chan.removeAllListeners.callsFake(() => {
      listeners = {};
      return chan;
    });

    const subscription = obs.subscribe(
      () => {
        onNext++;
      },
      (err) => {
        onError = true;
        console.log('err', err);
      },
      () => {
        onComplete = true;
      }
    );

    await eventLoopTick();

    listeners.close();

    assert.strictEqual(onNext, 1, 'observable didnt emit a channel');
    assert(!onError, 'observable errored when channel closed');
    assert(onComplete, 'observable didnt complete when channel closed');

    subscription.unsubscribe();
  });

  it('should emit new channel on channel error', async () => {
    const conn = stubInterface<Connection>();
    // @ts-expect-error: Bluebird/Promise
    conn.close.returns(Promise.resolve());

    const chan = stubInterface<Channel>();
    // @ts-expect-error: Bluebird/Promise
    chan.close.returns(Promise.resolve());
    // @ts-expect-error: Bluebird/Promise
    chan.unbindQueue.returns(Promise.resolve({} as Replies.Empty));
    // @ts-expect-error: Bluebird/Promise
    chan.deleteQueue.returns(Promise.resolve({ messageCount: 0 } as Replies.DeleteQueue));

    // @ts-expect-error: Bluebird/Promise
    conn.createChannel.returns(Promise.resolve(chan));

    const checkQueues = ['some.queue'];
    const bindQueues = [{
      queue: 'some.queue',
      source: 'some.exchange',
      pattern: ''
    }];
    const prefetch = 10;
    const obs = retryingChannel(conn, prefetch, checkQueues, bindQueues, backoff);
    await eventLoopTick();

    let listeners: { [ev: string]: (args?: any) => any } = {};
    let onNext = 0;
    let onError = false;
    let onComplete = false;

    chan.on.callsFake((ev, l) => {
      listeners[ev as string] = l;
      return chan;
    });
    chan.removeAllListeners.callsFake(() => {
      listeners = {};
      return chan;
    });

    const subscription = obs.subscribe(
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

    listeners.error(new Error('fake connection error'));

    await eventLoopTick(backoff.initialInterval - 2);

    assert.strictEqual(
      conn.createChannel.callCount,
      1,
      're-created channel before configured backoff interval'
    );

    await eventLoopTick(2);

    assert.strictEqual(
      conn.createChannel.callCount,
      2,
      'did not re-create channel'
    );
    assert.strictEqual(onNext, 2, 'observable did not emit a new channel');
    assert(!onError, 'observable errored');
    assert(!onComplete, 'observable completed');

    subscription.unsubscribe();
  });
});
