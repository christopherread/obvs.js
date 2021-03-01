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
  console.info(`Obvs: Creating new observable consumer - ${queue}`);

  const tags: string[] = [];

  channel
    .consume(
      queue,
      (message) => subscriber.next({ message, channel, options }),
      options
    )
    .then((reply) => {
      console.info(`Obvs: Created new observable consumer - ${queue}`);
      tags.push(reply.consumerTag);
    })
    .catch((err) => {
      console.error('Obvs: Consume error', err);
      subscriber.error(err);
    });

  return () => {
    console.info('Obvs: Cancelling observable consumer');

    tags.forEach((tag) => {
      channel
        .cancel(tag)
        .then(() => {
          console.info(`Obvs: Cancelled consumer - ${tag}`);
        })
        .catch((err) => {
          console.error(`Obvs: Error cancelling consumer - ${tag}`, err);
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


