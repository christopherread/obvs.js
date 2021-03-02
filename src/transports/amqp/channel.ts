import { Observable, from } from 'rxjs';
import { publishReplay, refCount, switchMap } from 'rxjs/operators';
import { retryBackoff } from 'backoff-rxjs';
import {
  Channel,
  Connection,
  Message as AmqpMessage,
  Options
} from 'amqplib';
import { defaultPrefetch, defaultBackoff } from './defaults';
import { waitFor } from './common';

export interface ChannelMessage {
  message: AmqpMessage | null;
  channel: Channel;
  options?: Options.Consume;
}

export type QueueArgs = { 
  queue: string; 
  source: string; 
  pattern: string, 
  assertOptions?: Options.AssertQueue;
  options?: {
    delete?: boolean;
  }
}
export type ExchangeArgs = { 
  exchange: string, 
  type: string; 
  options?: Options.AssertExchange;
}

const createChannel = async (
  connection: Connection,
  prefetch: number,
  exchanges: ExchangeArgs[] = [],
  queues: QueueArgs[] = []
): Promise<Channel> => {
  console.info('Obvs creating new channel', exchanges, queues);

  const channel = await connection.createChannel();
  await channel.prefetch(prefetch);

  for (let i = 0; i < exchanges.length; i++) {
    const { exchange, type, options } = exchanges[i];
    await channel.assertExchange(exchange, type, options);
  }

  for (let i = 0; i < queues.length; i++) {
    const { queue, source, pattern, assertOptions: options } = queues[i];
    await channel.assertQueue(queue, options);
    await channel.bindQueue(queue, source, pattern);
  }
  return channel;
};

const registerChannelListeners = (channel: Channel, queues: QueueArgs[]): Observable<Channel> => new Observable<Channel>((subscriber) => {
  channel.on('error', (err: Error) => {
    console.error('Obvs channel error:', err.message);
    subscriber.error(err);
  });
  channel.on('close', () => {
    console.info('Obvs channel closed');
    subscriber.complete();
  });
  subscriber.next(channel);

  return () => {
    async function closeChannel() {
      console.info('Obvs closing channel', queues);
      try {
        channel.removeAllListeners();
      } catch (err) {
        console.error('Obvs channel error removing listners:', err.message)
      }

      const queuesToDelete = queues.filter(q => q.options?.delete);
      for (let i = 0; i < queuesToDelete.length; i++) {
        const { queue, source, pattern } = queuesToDelete[i];
        try {
          await channel.unbindQueue(queue, source, pattern);
          await channel.deleteQueue(queue);
        } catch (err) {
          console.error(`Obvs channel error deleting queue '${queue}':`, err.message)
        }
      }

      await waitFor(50); // allow consumers to close and cleanup
      await channel.close();
    }
    closeChannel().catch((err) => console.error('Obvs channel error when closing:', err.message));
  };
});

export const observableChannel = (
  connection: Connection,
  prefetch = defaultPrefetch,
  exchanges: ExchangeArgs[] = [],
  queues: QueueArgs[] = [],
): Observable<Channel> => new Observable<Channel>((subscriber) =>
  from(createChannel(connection, prefetch, exchanges, queues))
    .pipe(switchMap(channel => registerChannelListeners(channel, queues)))
    .subscribe(subscriber)
);

export const retryingChannel = (
  connection: Connection,
  prefetch = 10,
  exchanges: ExchangeArgs[] = [],
  queues: QueueArgs[] = [],
  backoff = defaultBackoff
): Observable<Channel> =>
  observableChannel(connection, prefetch, exchanges, queues).pipe(
    retryBackoff(backoff)
  );

export const shareableChannel = (
  connection: Connection,
  prefetch = 10,
  exchanges: ExchangeArgs[] = [],
  queues: QueueArgs[] = [],
  backoff = defaultBackoff
): Observable<Channel> =>
  retryingChannel(connection, prefetch, exchanges, queues, backoff).pipe(
    publishReplay(1),
    refCount(),
  );
