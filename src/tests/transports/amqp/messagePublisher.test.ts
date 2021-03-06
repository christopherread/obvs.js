import 'should';
import { Channel, Connection } from 'amqplib';
import { MessagePublisher } from '../../../transports/amqp/MessagePublisher';
import { shareableConnection } from '../../../transports/amqp/connection';
import { stubInterface } from 'ts-sinon';
import { RetryBackoffConfig } from 'backoff-rxjs';

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

    // @ts-expect-error: Bluebird/Promise
    conn.createChannel.returns(Promise.resolve(chan));

    const publisher = new MessagePublisher(connections, {
      exchange: 'ex',
      type: 'topic'
    });

    await eventLoopTick();

    publisher.publish({ routingKey: 'route', message: { type: 'test1' }})

    await eventLoopTick();
  });
});
