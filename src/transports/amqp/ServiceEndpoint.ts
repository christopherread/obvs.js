import { Observable } from 'rxjs';
import {
  Command,
  Event,
  Request,
  Response
} from "../../core/messages";
import { ServiceEndpoint } from "../../core/ServiceEndpoint";
import { AmqpEndpointConfig } from './config';
import { MessagePublisher } from './MessagePublisher';
import { MessageSource } from './MessageSource';
import { AmqpServiceEndpointClient } from './ServiceEndpointClient';

export class AmqpServiceEndpoint<
  TCommand extends Command = Command,
  TEvent extends Event = Event,
  TRequest extends Request = Request,
  TResponse extends Response = Response>
  extends AmqpServiceEndpointClient<TCommand, TEvent, TRequest, TResponse>
  implements ServiceEndpoint<TCommand, TEvent, TRequest, TResponse> {

  protected readonly eventPublisher: MessagePublisher<TEvent>;
  protected readonly responsePublisher: MessagePublisher<TResponse>;

  constructor(cfg: AmqpEndpointConfig) {
    super(cfg);

    if (!cfg.url) {
      throw new Error('endpoint url not defined');
    }
    if (!cfg.name) {
      throw new Error('endpoint name not defined');
    }

    const requestSource = new MessageSource<TRequest>(this.connections, {
      source: this.requestsExchange,
      queue: `${this.requestsExchange}-${this.queueSuffix}`,
      pattern: '*'
    });
    this.requests = requestSource.messages();

    const commandSource = new MessageSource<TCommand>(this.connections, {
      source: this.commandsExchange,
      queue: `${this.commandsExchange}-${this.queueSuffix}`,
      pattern: '*'
    });
    this.commands = commandSource.messages();

    this.eventPublisher = new MessagePublisher<TEvent>(this.connections);
    this.responsePublisher = new MessagePublisher<TResponse>(this.connections);
  }

  requests: Observable<TRequest>;
  commands: Observable<TCommand>;

  publish(event: TEvent): Promise<void> {
    this.eventPublisher.publish({
      exchange: this.eventsExchange,
      routingKey: this.toRoutingKey(event),
      message: event
    });
    return Promise.resolve();
  }

  reply(request: TRequest, response: TResponse): Promise<void> {
    response.requestId = request.requestId;
    this.responsePublisher.publish({
      exchange: this.responsesExchange,
      routingKey: this.toRoutingKey(response),
      message: response
    });
    return Promise.resolve();
  }
}


