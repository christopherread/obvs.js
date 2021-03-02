import { Observable, Subscription } from 'rxjs';
import {
  switchMap
} from 'rxjs/operators';
import {
  Channel,
  Connection,
  Options
} from 'amqplib';
import { ExchangeArgs, retryingChannel } from './channel';
import { Message } from 'src/core/messages';

export interface PublishArgs<T> {
  routingKey: string;
  message: T;
  options?: Options.Publish;
}

export class MessagePublisher<T extends Message> {
  private channel: Channel | undefined;
  private subscription: Subscription | undefined;
  private exchange: ExchangeArgs;

  constructor(connections: Observable<Connection>, exchange: ExchangeArgs) {
    this.exchange = exchange;
    this.subscription = connections.pipe(switchMap((connection) => retryingChannel(connection, 10, [exchange])))
      .subscribe(
        c => this.channel = c, 
        () => this.channel = undefined, 
        () => this.channel = undefined);
  }

  publish({ routingKey, message, options }: PublishArgs<T>): Promise<void> {
    if (!this.channel) {
      throw new Error('MessagePublisher error: channel is undefined')
    }
    this.channel.publish(
      this.exchange.exchange,
      routingKey,
      Buffer.from(JSON.stringify(message)),
      options
    );
    return Promise.resolve();
  }

  close(): void {
    this.subscription?.unsubscribe();
    this.channel = undefined;
    this.subscription = undefined;
  }
}
