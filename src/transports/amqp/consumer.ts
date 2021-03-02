import { Observable } from 'rxjs';
import { retryBackoff } from 'backoff-rxjs';
import {
  Channel,

  Options
} from 'amqplib';
import { ChannelMessage } from './channel';
import { defaultBackoff } from './defaults';

export const observableConsumer = (
  channel: Channel,
  queue: string,
  options?: Options.Consume
): Observable<ChannelMessage> => new Observable<ChannelMessage>((subscriber) => {
  console.info(`Obvs creating new consumer on queue '${queue}'`);

  const tags: string[] = [];

  channel
    .consume(
      queue,
      (message) => subscriber.next({ message, channel, options }),
      options
    )
    .then((reply) => {
      tags.push(reply.consumerTag);
    })
    .catch((err) => {
      console.error('Obvs consume error:', err.message);
      subscriber.error(err);
    });

  return () => {
    console.info('Obvs cancelling consumer');

    tags.forEach((tag) => {
      channel
        .cancel(tag)
        .then(() => {
          console.info(`Obvs cancelled consumer '${tag}'`);
        })
        .catch((err) => {
          console.error(`Obvs error cancelling consumer '${tag}':`, err.message);
          subscriber.error(err);
        });
    });
  };
});

export const retryingConsumer = (
  channel: Channel,
  queue: string,
  options?: Options.Consume,
  backoff = defaultBackoff
): Observable<ChannelMessage> => observableConsumer(channel, queue, options).pipe(retryBackoff(backoff));


