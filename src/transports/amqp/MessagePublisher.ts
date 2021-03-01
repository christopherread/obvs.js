import { Observable, Subscription } from 'rxjs';
import {
  switchMap
} from 'rxjs/operators';
import {
  Channel,
  Connection,
  Options
} from 'amqplib';
import { retryingChannel } from './channel';

export interface PublishArgs<T> {
  exchange: string;
  routingKey: string;
  message: T;
  options?: Options.Publish;
}

export class MessagePublisher<T = any> {
  private channel: Channel | undefined;
  private subscription: Subscription | undefined;
  constructor(connections: Observable<Connection>) {
    this.subscription = connections.pipe(switchMap((connection) => retryingChannel(connection)))
      .subscribe(
        c => this.channel = c, 
        () => this.channel = undefined, 
        () => this.channel = undefined);
  }

  publish({ exchange, routingKey, message, options }: PublishArgs<T>) {
    if (!this.channel) {
      throw new Error(`MessagePublisher error: channel is undefined`)
    }
    this.channel.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify(message)),
      options
    );
    return Promise.resolve();
  }

  close() {
    this.subscription?.unsubscribe();
    this.channel = undefined;
    this.subscription = undefined;
  }
}
