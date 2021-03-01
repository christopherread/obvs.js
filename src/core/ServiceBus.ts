import { merge, Observable } from 'rxjs';
import {
  Command,
  Event,
  Request,
  Response,
} from './messages';
import { ServiceBusConfig } from './config';
import { ServiceBusClient, ServiceBusClientInstance } from './ServiceBusClient';

export interface ServiceBus<
  TCommand extends Command = Command,
  TEvent extends Event = Event,
  TRequest extends Request = Request,
  TResponse extends Response = Response> extends ServiceBusClient<TCommand, TEvent, TRequest, TResponse> {
  readonly requests: Observable<TRequest>;
  readonly commands: Observable<TCommand>;
  publish(event: TEvent): Promise<void>;
  reply(request: TRequest, response: TResponse): Promise<void>;
}

export class ServiceBusInstance<
  TCommand extends Command = Command,
  TEvent extends Event = Event,
  TRequest extends Request = Request,
  TResponse extends Response = Response>
  extends ServiceBusClientInstance<TCommand, TEvent, TRequest, TResponse>
  implements ServiceBus<TCommand, TEvent, TRequest, TResponse> {

  constructor(cfg: ServiceBusConfig<TCommand, TEvent, TRequest, TResponse>) {
    super(cfg);
    this.commands = merge(...this.endpoints.map(ep => ep.commands));
    this.requests = merge(...this.endpoints.map(ep => ep.requests));
  }

  requests: Observable<TRequest>;
  commands: Observable<TCommand>;

  async publish(event: TEvent): Promise<void> {
    await Promise.all(this.endpoints
      .filter(ep => ep.canHandle(event))
      .map(ep => ep.publish(event))
    );
  }

  async reply(request: TRequest, response: TResponse): Promise<void> {
    await Promise.all(this.endpoints
      .filter(ep => ep.canHandle(response))
      .map(ep => ep.reply(request, response))
    );
  }
}
