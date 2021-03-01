import { Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import {
  Command,
  Event,
  Request,
  Response,
  Message
} from "../../core/messages";
import { FactoryFunc, shareableConnection } from "./connection";
import { MessagePublisher } from './MessagePublisher';
import { MessageSource } from './MessageSource';
import { ServiceEndpointClient } from "../../core/ServiceEndpointClient";
import { AmqpEndpointConfig } from './config';
import { Connection } from 'amqplib';

export class AmqpServiceEndpointClient<
  TCommand extends Command = Command,
  TEvent extends Event = Event,
  TRequest extends Request = Request,
  TResponse extends Response = Response>
  implements ServiceEndpointClient<TCommand, TEvent, TRequest, TResponse> {

  protected readonly responseSource: MessageSource<TResponse>;
  protected readonly commandsExchange: string;
  protected readonly requestsExchange: string;
  protected readonly responsesExchange: string;
  protected readonly requestPublisher: MessagePublisher<TRequest>;
  protected readonly commandPublisher: MessagePublisher<TCommand>;
  protected readonly eventsExchange: string;
  protected readonly toRoutingKey: (msg: Message) => string;
  protected readonly types: Set<string> | undefined;
  protected readonly connections: Observable<Connection>;
  protected readonly queueSuffix: string;

  constructor(cfg: AmqpEndpointConfig) {
    if (!cfg.url) {
      throw new Error('endpoint url not defined');
    }
    if (!cfg.name) {
      throw new Error('endpoint name not defined');
    }

    this.eventsExchange = `${cfg.name}.Events`;
    this.commandsExchange = `${cfg.name}.Commands`;
    this.requestsExchange = `${cfg.name}.Requests`;
    this.responsesExchange = `${cfg.name}.Responses`;
    this.connections = shareableConnection(cfg.url, cfg.factory);
    this.queueSuffix = `Queue-${process.pid}`;

    const eventSource = new MessageSource<TEvent>(this.connections, {
      source: this.eventsExchange,
      queue: `${this.eventsExchange}-${this.queueSuffix}`,
      pattern: '*'
    });
    this.events = eventSource.messages();

    this.responseSource = new MessageSource<TResponse>(this.connections, {
      source: this.responsesExchange,
      queue: `${this.responsesExchange}-${this.queueSuffix}`,
      pattern: '*'
    });

    this.requestPublisher = new MessagePublisher<TRequest>(this.connections);
    this.commandPublisher = new MessagePublisher<TCommand>(this.connections);

    this.toRoutingKey = (msg: Message) => `${cfg.name}.${msg.type}`;
    this.types = cfg.types;
  }

  events: Observable<TEvent>;

  send(command: TCommand): Promise<void> {
    this.commandPublisher.publish({
      exchange: this.commandsExchange,
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
      const publishArgs = {
        exchange: this.requestsExchange,
        routingKey: this.toRoutingKey(request),
        message: request
      };
      this.responseSource.messages().pipe(filter(matches)).subscribe(subscriber);
      this.requestPublisher.publish(publishArgs);
    });
  }

  canHandle({ type }: Message) {
    return !!this.types?.has(type)
  }
}
