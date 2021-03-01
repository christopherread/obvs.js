import 'should';
import { Channel, Connection, ConsumeMessage, Options, Replies } from 'amqplib';
import { messagePublisher } from "../../../transports/amqp/messagePublisher";
import { shareableConnection } from "../../../transports/amqp/connection";
import { stubInterface } from 'ts-sinon';
import { RetryBackoffConfig } from 'backoff-rxjs';

import assert = require('assert');
import { take } from 'rxjs/operators';

const backoff: RetryBackoffConfig = {
  initialInterval: 5,
  maxInterval: 15,
  maxRetries: 3,
  resetOnSuccess: true,
};

const eventLoopTick = (ms = 1): Promise<void> =>
  new Promise((resolve) => setTimeout(() => resolve(), ms));

describe('amqp messagePublisher tests', () => {
  it('should emit message from consumer', async () => {
    const conn = stubInterface<Connection>();
    // @ts-expect-error: Bluebird/Promise
    conn.close.returns(Promise.resolve());
    
    const obsConn = shareableConnection(
      'some.uri',
      () => Promise.resolve(conn),
      backoff
    );
    const chan = stubInterface<Channel>();
    // @ts-expect-error: Bluebird/Promise
    chan.close.returns(Promise.resolve());

    // @ts-ignore
    conn.createChannel.returns(Promise.resolve(chan));

    const obs = messagePublisher(obsConn);
    await eventLoopTick();

    const publisher1 = await obs.pipe(take(1)).toPromise();
    
    await eventLoopTick();

    const publisher2 = await obs.pipe(take(1)).toPromise();

    assert(publisher1, 'publisher1')
    assert(publisher2, 'publisher2')
  });
});
