import 'should';
import { Channel, Connection, ConsumeMessage, Options, Replies } from 'amqplib';
import { MessagePublisher } from "../../../transports/amqp/MessagePublisher";
import { shareableConnection } from "../../../transports/amqp/connection";
import { stubInterface } from 'ts-sinon';
import { RetryBackoffConfig } from 'backoff-rxjs';

import assert = require('assert');
import { publishReplay, refCount, take } from 'rxjs/operators';

const backoff: RetryBackoffConfig = {
  initialInterval: 5,
  maxInterval: 15,
  maxRetries: 3,
  resetOnSuccess: true,
};

const eventLoopTick = (ms = 1): Promise<void> =>
  new Promise((resolve) => setTimeout(() => resolve(), ms));

describe('amqp MessagePublisher tests', () => {
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

    // @ts-ignore
    conn.createChannel.returns(Promise.resolve(chan));

    const publisher = new MessagePublisher(connections);

    await eventLoopTick();

    publisher.publish({ exchange: 'ex', routingKey: 'route', message: {}})

    await eventLoopTick();
  });
});
