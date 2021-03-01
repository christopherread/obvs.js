import 'should';
import { Channel, Connection, ConsumeMessage, Replies } from 'amqplib';
import { MessageSource } from "../../../transports/amqp/MessageSource";
import { shareableConnection } from "../../../transports/amqp/connection";
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

describe('amqp MessageSource tests', () => {
  it('should emit message from consumer', async () => {
    const conn = stubInterface<Connection>();
    // @ts-expect-error: Bluebird/Promise
    conn.close.returns(Promise.resolve());
    
    const connections = shareableConnection(
      'some.uri',
      () => Promise.resolve(conn),
      backoff
    );
    const chan = stubInterface<Channel>();
    // @ts-expect-error: Bluebird/Promise
    chan.close.returns(Promise.resolve());
    // @ts-expect-error: Bluebird/Promise
    chan.unbindQueue.returns(Promise.resolve({} as Replies.Empty));
    // @ts-expect-error: Bluebird/Promise
    chan.deleteQueue.returns(Promise.resolve({ messageCount: 0 } as Replies.DeleteQueue));

    const reply: Replies.Consume = { consumerTag: 'some.tag' };
    const emptyReply: Replies.Empty = {};

    let consumers: { [q: string]: (args: ConsumeMessage | null) => void } = {};

    // @ts-ignore
    chan.consume.callsFake((q, onMessage, opt) => {
      consumers[q] = onMessage;
      return Promise.resolve(reply);
    });

    // @ts-ignore
    chan.cancel.callsFake((t) => {
      consumers = {};
      return Promise.resolve(emptyReply);
    });

    // @ts-ignore
    conn.createChannel.returns(Promise.resolve(chan));

    const prefetch = 10;
    const source = new MessageSource(connections, { queue: 'queue1', source: 'ex1', pattern:'' }, {}, prefetch);
    await eventLoopTick();

    let onNext = 0;
    let onError = false;
    let onComplete = false;
    const subscription1 = source.messages().subscribe(
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
    msg.properties.headers = {} as any;
    msg.content = Buffer.from(JSON.stringify({ data: '123' }))
    consumers.queue1(msg);

    await eventLoopTick();

    assert.strictEqual(onNext, 1, 'observable did not emit a new message');
    assert(!onError, 'observable errored');
    assert(!onComplete, 'observable completed');

    subscription1.unsubscribe();
  });
});
