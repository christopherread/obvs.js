import { Observable, from } from 'rxjs';
import {
  publishReplay,
  refCount,
  switchMap
} from 'rxjs/operators';
import { retryBackoff, RetryBackoffConfig } from 'backoff-rxjs';
import { connect, Connection } from 'amqplib';
import { defaultBackoff } from './defaults';
import { waitFor } from './common';

export type FactoryFunc = (url: string) => Promise<Connection>;
export const connectAsync: FactoryFunc = async (url: string): Promise<Connection> => {
  try {
    return await connect(url);
  } catch (err) {
    console.error(`error connecting to ${url}`, err);
    throw err;
  }
}

const registerConnectionListeners = (
  connection: Connection
): Observable<Connection> => new Observable<Connection>((subscriber) => {
  console.info('Obvs creating new connection');

  connection.on('error', (err: Error) => {
    console.error('Obvs connection error:', err.message);
    subscriber.error(err);
  });
  connection.on('close', () => {
    console.info('Obvs connection closed');
    subscriber.complete();
  });
  subscriber.next(connection);

  return () => {
    async function closeConnection() {
      console.info('Obvs closing connection');
      connection.removeAllListeners();
      await waitFor(100); // allow channels to close and clean-up first
      await connection.close();
    }
    closeConnection().catch((err) => console.error('Obvs connection error when closing:', err.message));
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
