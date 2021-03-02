import { merge, Observable } from 'rxjs';
import {
  Command,
  Event,
  Request,
  Response,
} from './messages';
import { ServiceBusConfig } from './config';
import { ServiceEndpointClient } from './ServiceEndpointClient'
import { ServiceEndpoint } from './ServiceEndpoint'

export interface ServiceBusClient<
  TCommand extends Command = Command,
  TEvent extends Event = Event,
  TRequest extends Request = Request,
  TResponse extends Response = Response> {
  readonly events: Observable<TEvent>;
  send(command: TCommand): Promise<void>;
  getResponses(request: TRequest): Observable<TResponse>;
  close(): Promise<void>;
}

export class ServiceBusClientInstance<
  TCommand extends Command = Command,
  TEvent extends Event = Event,
  TRequest extends Request = Request,
  TResponse extends Response = Response>
  implements ServiceBusClient<TCommand, TEvent, TRequest, TResponse>
{
  protected endpointClients: ServiceEndpointClient<TCommand, TEvent, TRequest, TResponse>[];
  protected endpoints: ServiceEndpoint<TCommand, TEvent, TRequest, TResponse>[];

  constructor(cfg: ServiceBusConfig<TCommand, TEvent, TRequest, TResponse>) {
    this.events = merge<TEvent>(
      ...cfg.endpoints.map(ep => ep.events),
      ...cfg.endpointClients.map(ep => ep.events)
    );
    this.endpoints = cfg.endpoints;
    this.endpointClients = cfg.endpointClients;
  }

  events: Observable<TEvent>;

  async send(command: TCommand): Promise<void> {
    await Promise.all([
      ...this.endpointClients.filter(ep => ep.canHandle(command)).map(ep => ep.send(command)),
      ...this.endpoints.filter(ep => ep.canHandle(command)).map(ep => ep.send(command)),
    ]);
  }

  getResponses(request: TRequest): Observable<TResponse> {
    return merge<TResponse>(
      ...this.endpoints.filter(ep => ep.canHandle(request)).map(ep => ep.getResponses(request)),
      ...this.endpointClients.filter(ep => ep.canHandle(request)).map(ep => ep.getResponses(request))
    )
  }

  async close(): Promise<void> {
    await Promise.all([
      ...this.endpointClients.map(ep => ep.close()),
      ...this.endpoints.map(ep => ep.close()),
    ]);
  }
}


