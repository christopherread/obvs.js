import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { retryBackoff } from 'backoff-rxjs';
import {
  Channel,

  Connection,
  Message as AmqpMessage,
  Options
} from 'amqplib';
import { defaultPrefetch, defaultBackoff } from './defaults';

export interface ChannelMessage {
  message: AmqpMessage | null;
  channel: Channel;
  options?: Options.Consume;
}

const createChannel = async (
  connection: Connection,
  prefetch: number,
  checkQueues: string[] = [],
  bindQueues: { queue: string; source: string; pattern: string; }[] = []
): Promise<Channel> => {
  const channel = await connection.createChannel();
  await channel.prefetch(prefetch);
  for (let i = 0; i < checkQueues.length; i++) {
    await channel.checkQueue(checkQueues[i]);
  }
  for (let i = 0; i < bindQueues.length; i++) {
    const { queue, source, pattern } = bindQueues[i];
    await channel.bindQueue(queue, source, pattern);
  }
  return channel;
};

const registerChannelListeners = (channel: Channel, unbindQueues: { queue: string; source: string; pattern: string; }[]): Observable<Channel> => new Observable<Channel>((subscriber) => {
  console.info('Obvs: Creating new observable channel');

  channel.on('error', (err: Error) => {
    console.error('Obvs: Channel error', err);
    subscriber.error(err);
  });
  channel.on('close', () => {
    console.info('Obvs: Channel closed');
    subscriber.complete();
  });
  subscriber.next(channel);

  return () => {
    try {
      console.info('Obvs: Closing observable channel');
      channel.removeAllListeners();

      for (let i = 0; i < unbindQueues.length; i++) {
        const { queue, source, pattern } = unbindQueues[i];
        channel.unbindQueue(queue, source, pattern)
          .then(() => console.info('Obvs: unbind queue', queue))
          .catch((err) => console.error('Obvs: Channel error when unbinding queue', queue, err));
        channel.deleteQueue(queue)
          .then(() => console.info('Obvs: deleted queue', queue))
          .catch((err) => console.error('Obvs: Channel error when deleting queue', queue, err));
      }

      channel
        .close()
        .then(() => console.info('Obvs: Closed observable channel'))
        .catch((err) => console.error('Obvs: Channel error when closing', err));
    } catch (err) {
      console.error('Obvs: Channel error when closing', err);
    }
  };
});

export const observableChannel = (
  connection: Connection,
  prefetch = defaultPrefetch,
  checkQueues: string[] = [],
  bindQueues: { queue: string; source: string; pattern: string; }[] = []
): Observable<Channel> => new Observable<Channel>((subscriber) => from(createChannel(connection, prefetch, checkQueues, bindQueues))
  .pipe(switchMap(channel => registerChannelListeners(channel, bindQueues)))
  .subscribe(subscriber)
);

export const retryingChannel = (
  connection: Connection,
  prefetch = 10,
  checkQueues: string[] = [],
  bindQueues: { queue: string; source: string; pattern: string; }[] = [],
  backoff = defaultBackoff
): Observable<Channel> => observableChannel(connection, prefetch, checkQueues, bindQueues).pipe(
  retryBackoff(backoff)
);
