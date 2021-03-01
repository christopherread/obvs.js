import { Observable } from 'rxjs';
import {
  map,
  switchMap
} from 'rxjs/operators';
import {
  Connection,
  Options
} from 'amqplib';
import { retryingChannel } from './channel';

type PublisherFunc<T> = (exchange: string, routingKey: string, message: T, options?: Options.Publish) => boolean;

export const messagePublisher = <T>(
  connection: Observable<Connection>
): Observable<PublisherFunc<T>> => connection.pipe(
  switchMap((connection) => retryingChannel(connection)),
  map((channel) => (exchange: string, routingKey: string, message: T, options?: Options.Publish) =>
    channel.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify(message)),
      options
    )
  )
);
