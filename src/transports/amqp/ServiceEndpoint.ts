import { Options } from 'amqplib';
import { Observable } from 'rxjs';
import {
  Command,
  Event,
  Request,
  Response
} from "../../core/messages";
import { ServiceEndpoint } from "../../core/ServiceEndpoint";
import { QueueArgs } from './channel';
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
  protected readonly requestQueue: QueueArgs;
  protected readonly commandQueue: QueueArgs;

  constructor(cfg: AmqpEndpointConfig) {
    super(cfg);

    if (!cfg.url) {
      throw new Error('endpoint url not defined');
    }
    if (!cfg.name) {
      throw new Error('endpoint name not defined');
    }
    if (!cfg.types || cfg.types.size === 0) {
      throw new Error('endpoint types not defined');
    }

    const consumeOptions: Options.Consume = { noAck: true };
    const pattern = '*.*';

    this.requestQueue = {
      source: this.requestExchange.exchange,
      queue: `${this.requestExchange.exchange}-queue-${this.queueSuffix}`,
      pattern,
      options: {
        delete: this.deleteQueues
      }
    };
    this.commandQueue = {
      source: this.commandExchange.exchange,
      queue: `${this.commandExchange.exchange}-queue-${this.queueSuffix}`,
      pattern,
      options: {
        delete: this.deleteQueues
      }
    };

    const requestSource = new MessageSource<TRequest>(
      this.connections,
      this.requestExchange,
      this.requestQueue,
      consumeOptions);
    this.requests = requestSource.messages();

    const commandSource = new MessageSource<TCommand>(
      this.connections,
      this.commandExchange,
      this.commandQueue,
      consumeOptions);
    this.commands = commandSource.messages();

    this.eventPublisher = new MessagePublisher<TEvent>(this.connections, this.eventExchange);
    this.responsePublisher = new MessagePublisher<TResponse>(this.connections, this.responseExchange);
  }

  requests: Observable<TRequest>;
  commands: Observable<TCommand>;

  publish(event: TEvent): Promise<void> {
    this.eventPublisher.publish({
      routingKey: this.toRoutingKey(event),
      message: event
    });
    return Promise.resolve();
  }

  reply(request: TRequest, response: TResponse): Promise<void> {
    response.requestId = request.requestId;
    this.responsePublisher.publish({
      routingKey: this.toRoutingKey(response),
      message: response
    });
    return Promise.resolve();
  }

  close(): Promise<void> {
    super.close();
    this.eventPublisher.close();
    this.responsePublisher.close();
    return Promise.resolve();
  }
}


