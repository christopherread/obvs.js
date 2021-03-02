import { Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import {
  Command,
  Event,
  Request,
  Response,
  Message
} from '../../core/messages';
import { shareableConnection } from './connection';
import { MessagePublisher, PublishArgs } from './MessagePublisher';
import { MessageSource } from './MessageSource';
import { ServiceEndpointClient } from '../../core/ServiceEndpointClient';
import { AmqpEndpointConfig } from './config';
import { Connection, Options } from 'amqplib';
import { DEFAULT_EXCHANGE_TYPE } from './defaults';
import { ExchangeArgs, QueueArgs } from './channel';

export class AmqpServiceEndpointClient<
  TCommand extends Command = Command,
  TEvent extends Event = Event,
  TRequest extends Request = Request,
  TResponse extends Response = Response>
  implements ServiceEndpointClient<TCommand, TEvent, TRequest, TResponse> {

  protected readonly commandExchange: ExchangeArgs;
  protected readonly eventExchange: ExchangeArgs;
  protected readonly requestExchange: ExchangeArgs;
  protected readonly responseExchange: ExchangeArgs;
  protected readonly eventsQueue: QueueArgs;
  protected readonly responseQueue: QueueArgs;
  protected readonly responseSource: MessageSource<TResponse>;
  protected readonly requestPublisher: MessagePublisher<TRequest>;
  protected readonly commandPublisher: MessagePublisher<TCommand>;

  protected readonly toRoutingKey: (msg: Message) => string;
  protected readonly types: Set<string> | undefined;
  protected readonly connections: Observable<Connection>;
  protected readonly queueSuffix: string;
  protected readonly name: string;
  protected readonly deleteQueues: boolean;

  constructor(cfg: AmqpEndpointConfig) {
    if (!cfg.url) {
      throw new Error('endpoint url not defined');
    }
    if (!cfg.name) {
      throw new Error('endpoint name not defined');
    }
    if (!cfg.types || cfg.types.size === 0) {
      throw new Error('endpoint types not defined');
    }

    this.name = cfg.name;
    this.types = cfg.types;
    this.toRoutingKey = (msg: Message) => `${cfg.name}.${msg.type}`;
    this.queueSuffix = cfg.options?.queueSuffix || `pid-${process.pid}`;

    // delete queues by default if using pid for queue suffix
    this.deleteQueues =
      cfg.options?.deleteQueues || (
        !cfg.options?.queueSuffix &&
        cfg.options?.deleteQueues === undefined
      )

    this.eventExchange = {
      exchange: `${cfg.name}.Events`,
      type: DEFAULT_EXCHANGE_TYPE,
    };
    this.commandExchange = {
      exchange: `${cfg.name}.Commands`,
      type: DEFAULT_EXCHANGE_TYPE,
    };
    this.requestExchange = {
      exchange: `${cfg.name}.Requests`,
      type: DEFAULT_EXCHANGE_TYPE,
    };
    this.responseExchange = {
      exchange: `${cfg.name}.Responses`,
      type: DEFAULT_EXCHANGE_TYPE,
    };

    const consumeOptions: Options.Consume = { noAck: true, exclusive: true };
    const pattern = '*.*';

    this.eventsQueue = {
      source: this.eventExchange.exchange,
      queue: `${this.eventExchange.exchange}-queue-${this.queueSuffix}`,
      pattern,
      options: {
        delete: this.deleteQueues
      }
    };
    this.responseQueue = {
      source: this.responseExchange.exchange,
      queue: `${this.responseExchange.exchange}-queue-${this.queueSuffix}`,
      pattern,
      options: {
        delete: this.deleteQueues
      }
    };

    this.connections = shareableConnection(cfg.url, cfg.factory);

    const eventSource = new MessageSource<TEvent>(
      this.connections,
      this.eventExchange,
      this.eventsQueue,
      consumeOptions
    );
    this.events = eventSource.messages();

    this.responseSource = new MessageSource<TResponse>(
      this.connections,
      this.responseExchange,
      this.responseQueue,
      consumeOptions
    );

    this.requestPublisher = new MessagePublisher<TRequest>(this.connections, this.requestExchange);
    this.commandPublisher = new MessagePublisher<TCommand>(this.connections, this.commandExchange);
  }

  events: Observable<TEvent>;

  send(command: TCommand): Promise<void> {
    this.commandPublisher.publish({
      routingKey: this.toRoutingKey(command),
      message: command
    });
    return Promise.resolve();
  }

  getResponses(request: TRequest): Observable<TResponse> {
    return new Observable<TResponse>(subscriber => {
      if (!request.requestId) {
        request.requestId = uuidv4();
      }
      const matches = (msg: TResponse) => msg.requestId === request.requestId;
      const publishArgs: PublishArgs<TRequest> = {
        routingKey: this.toRoutingKey(request),
        message: request
      };
      this.responseSource.messages().pipe(filter(r => matches(r))).subscribe(subscriber);
      this.requestPublisher.publish(publishArgs);
    });
  }

  canHandle({ type }: Message): boolean {
    return !!this.types?.has(type)
  }

  close(): Promise<void> {
    console.log('Obvs closing endpoint', this.name);
    this.commandPublisher.close();
    this.requestPublisher.close();
    return Promise.resolve();
  }
}
