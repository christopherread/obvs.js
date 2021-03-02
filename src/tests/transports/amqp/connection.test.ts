import 'should';
import { Connection } from 'amqplib';
import { shareableConnection } from "../../../transports/amqp/connection";
import sinon, { stubInterface } from 'ts-sinon';
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

describe('amqp observable connection tests', () => {
  it('should connect and register listeners once', async () => {
    const conn = stubInterface<Connection>();
    // @ts-expect-error: Bluebird/Promise
    conn.close.returns(Promise.resolve());

    const factory = sinon.fake.returns(Promise.resolve(conn));

    const obs = shareableConnection('some.uri', factory);
    await eventLoopTick();

    assert.strictEqual(factory.callCount, 0, 'connected before subscribing');
    assert(conn.on.notCalled, 'registered listeners before subscribing');

    const subscription1 = obs.subscribe();
    const subscription2 = obs.subscribe();
    const subscription3 = obs.subscribe();
    await eventLoopTick();

    assert(factory.callCount > 0, 'did not connect');
    assert.strictEqual(factory.callCount, 1, 'connected more than once');
    assert(conn.on.calledWith('error'), 'error listener not registered');
    assert(conn.on.calledWith('close'), 'close listener not registered');

    subscription1.unsubscribe();
    subscription2.unsubscribe();
    subscription3.unsubscribe();
  });

  it('should disconnect and register listeners after all unsubcribed', async () => {
    const conn = stubInterface<Connection>();
    // @ts-expect-error: Bluebird/Promise
    conn.close.returns(Promise.resolve());
    const factory = sinon.fake.returns(Promise.resolve(conn));

    const obs = shareableConnection('some.uri', factory);
    await eventLoopTick();

    const subscription1 = obs.subscribe();
    const subscription2 = obs.subscribe();
    const subscription3 = obs.subscribe();
    await eventLoopTick();

    assert(factory.callCount > 0, 'did not connect');
    assert.strictEqual(factory.callCount, 1, 'connected more than once');
    assert(conn.on.calledWith('error'), 'error listener not registered');
    assert(conn.on.calledWith('close'), 'close listener not registered');

    subscription1.unsubscribe();
    await eventLoopTick();

    assert(
      conn.removeAllListeners.notCalled,
      'removeAllListeners called before all unsubscribed'
    );
    assert(conn.close.notCalled, 'close called before all unsubscribed');

    subscription2.unsubscribe();
    subscription3.unsubscribe();
    await eventLoopTick(200);

    assert(conn.removeAllListeners.called, 'removeAllListeners not called');
    assert(conn.close.called, 'close not called');
  });

  it('should reconnect and re-register listeners on new subscription', async () => {
    const conn = stubInterface<Connection>();
    // @ts-expect-error: Bluebird/Promise
    conn.close.returns(Promise.resolve());
    const factory = sinon.fake.returns(Promise.resolve(conn));

    const obs = shareableConnection('some.uri', factory);
    await eventLoopTick();

    const subscription1 = obs.subscribe();
    const subscription2 = obs.subscribe();
    const subscription3 = obs.subscribe();
    await eventLoopTick();

    assert(factory.callCount > 0, 'did not connect');
    assert.strictEqual(factory.callCount, 1, 'connected more than once');
    assert(conn.on.calledWith('error'), 'error listener not registered');
    assert(conn.on.calledWith('close'), 'close listener not registered');

    subscription1.unsubscribe();
    await eventLoopTick();

    assert(
      conn.removeAllListeners.notCalled,
      'removeAllListeners called before all unsubscribed'
    );
    assert(conn.close.notCalled, 'close called before all unsubscribed');

    subscription2.unsubscribe();
    subscription3.unsubscribe();
    await eventLoopTick(200);

    assert(conn.removeAllListeners.called, 'removeAllListeners not called');
    assert(conn.close.called, 'close not called');

    const subscription4 = obs.subscribe();
    await eventLoopTick(200);

    assert(factory.callCount > 1, 'did not re-connect');
    assert.strictEqual(factory.callCount, 2, 're-connected more than once');

    subscription4.unsubscribe();
  });

  it('should not error/complete on connection error', async () => {
    const conn = stubInterface<Connection>();
    // @ts-expect-error: Bluebird/Promise
    conn.close.returns(Promise.resolve());

    const factory = sinon.fake.returns(Promise.resolve(conn));

    const obs = shareableConnection('some.uri', factory, backoff);

    let listeners: { [ev: string]: (args?: any) => any } = {};
    let onNext = 0;
    let onError = false;
    let onComplete = false;

    conn.on.callsFake((ev, l) => {
      listeners[ev as string] = l;
      return conn;
    });
    conn.removeAllListeners.callsFake(() => {
      listeners = {};
      return conn;
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

    await eventLoopTick(backoff.initialInterval);

    assert(onNext > 0, 'observable did not emit a connection');
    assert(!onError, 'observable threw error');
    assert(!onComplete, 'observable completed');

    subscription.unsubscribe();
  });

  it('should complete on connection close', async () => {
    const conn = stubInterface<Connection>();
    // @ts-expect-error: Bluebird/Promise
    conn.close.returns(Promise.resolve());

    const factory = sinon.fake.returns(Promise.resolve(conn));

    const obs = shareableConnection('some.uri', factory);

    let listeners: { [ev: string]: (args?: any) => any } = {};
    let onNext = 0;
    let onError = false;
    let onComplete = false;

    conn.on.callsFake((ev, l) => {
      listeners[ev as string] = l;
      return conn;
    });
    conn.removeAllListeners.callsFake(() => {
      listeners = {};
      return conn;
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

    assert.strictEqual(onNext, 1, 'observable didnt emit a connection');
    assert(!onError, 'observable errored when connection closed');
    assert(onComplete, 'observable didnt complete when connection closed');

    subscription.unsubscribe();
  });

  it('should emit new connection on connection error', async () => {
    const conn = stubInterface<Connection>();
    // @ts-expect-error: Bluebird/Promise
    conn.close.returns(Promise.resolve());

    const factory = sinon.fake.returns(Promise.resolve(conn));

    const obs = shareableConnection('some.uri', factory, backoff);

    let listeners: { [ev: string]: (args?: any) => any } = {};
    let onNext = 0;
    let onError = false;
    let onComplete = false;

    conn.on.callsFake((ev, l) => {
      listeners[ev as string] = l;
      return conn;
    });
    conn.removeAllListeners.callsFake(() => {
      listeners = {};
      return conn;
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
      factory.callCount,
      1,
      're-connected before configured backoff interval'
    );

    await eventLoopTick(2);

    assert.strictEqual(factory.callCount, 2, 'did not re-connect');
    assert.strictEqual(onNext, 2, 'observable did not emit a new connection');
    assert(!onError, 'observable errored');
    assert(!onComplete, 'observable completed');

    subscription.unsubscribe();
  });
});
