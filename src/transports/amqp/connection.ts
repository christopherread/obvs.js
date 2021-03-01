import { Observable, from } from 'rxjs';
import {
  publishReplay,
  refCount,
  switchMap
} from 'rxjs/operators';
import { retryBackoff, RetryBackoffConfig } from 'backoff-rxjs';
import { connect, Connection } from 'amqplib';
import { defaultBackoff } from './defaults';

export type FactoryFunc = (url: string) => Promise<Connection>;
export const connectAsync: FactoryFunc = async (url: string): Promise<Connection> => await connect(url);

const registerConnectionListeners = (
  connection: Connection
): Observable<Connection> => new Observable<Connection>((subscriber) => {
  console.info('Obvs: Creating new observable connection');

  connection.on('error', (err: Error) => {
    console.error('Obvs: Connection error', err);
    subscriber.error(err);
  });
  connection.on('close', () => {
    console.info('Obvs: Connection closed');
    subscriber.complete();
  });
  subscriber.next(connection);

  return () => {
    try {
      console.info('Obvs: Closing observable connection');

      connection.removeAllListeners();
      connection
        .close()
        .then(() => console.info('Obvs: Closed observable connection'))
        .catch((err) => console.error('Obvs: Connection error when closing', err)
        );
    } catch (err) {
      console.error('Obvs: Connection error when closing', err);
    }
  };
});

export const observableConnection = (
  url: string,
  factory: FactoryFunc = connectAsync
): Observable<Connection> => new Observable<Connection>((subscriber) => from(factory(url))
  .pipe(switchMap(registerConnectionListeners))
  .subscribe(subscriber)
);

export const retryingConnection = (
  url: string,
  factory: FactoryFunc = connectAsync,
  backoff: RetryBackoffConfig = defaultBackoff
): Observable<Connection> => observableConnection(url, factory).pipe(retryBackoff(backoff));

export const shareableConnection = (
  url: string,
  factory: FactoryFunc = connectAsync,
  backoff: RetryBackoffConfig = defaultBackoff
): Observable<Connection> => retryingConnection(url, factory, backoff).pipe(publishReplay(1), refCount());
