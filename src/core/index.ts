import { Observable } from 'rxjs';


export interface Message {
  type: string;
}

export type Event = Message;
export type Command = Message;

export interface Request extends Message {
  requestId: string;
}

export interface Response extends Message {
  requestId: string;
}

export interface ServiceEndpointClient<
  TCommand extends Command = Command,
  TEvent extends Event = Event,
  TRequest extends Request = Request,
  TResponse extends Response = Response> {
  events: Observable<TEvent>;
  send: (command: TCommand) => Promise<void>;
  getResponses: (request: TRequest) => Observable<TResponse>;
}

export interface ServiceEndpoint<
  TCommand extends Command = Command,
  TEvent extends Event = Event,
  TRequest extends Request = Request,
  TResponse extends Response = Response> extends ServiceEndpointClient<TCommand, TEvent, TRequest, TResponse> {
  requests: Observable<TRequest>;
  commands: Observable<TCommand>;
  publish: (event: TEvent) => Promise<void>;
  reply: (request: TRequest, response: TResponse) => Promise<void>;
}

export interface ServiceBusClient<
  TCommand extends Command = Command,
  TEvent extends Event = Event,
  TRequest extends Request = Request,
  TResponse extends Response = Response> {
  events: Observable<TEvent>;
  send: (command: TCommand) => Promise<void>;
  getResponses: (request: TRequest) => Observable<TResponse>;
}

export interface ServiceBus<
  TCommand extends Command = Command,
  TEvent extends Event = Event,
  TRequest extends Request = Request,
  TResponse extends Response = Response> extends ServiceBusClient<TCommand, TEvent, TRequest, TResponse> {
  requests: Observable<TRequest>;
  commands: Observable<TCommand>;
  publish: (event: TEvent) => Promise<void>;
  reply: (request: TRequest, response: TResponse) => Promise<void>;
}

export interface ServiceBusConfig<
  TCommand extends Command = Command,
  TEvent extends Event = Event,
  TRequest extends Request = Request,
  TResponse extends Response = Response> {
  endpoints: ServiceEndpoint<TCommand, TEvent, TRequest, TResponse>[];
  endpointClients: ServiceEndpointClient<TCommand, TEvent, TRequest, TResponse>[];
}

export interface ServiceEndpointConfig {
  url?: string;
  name?: string;
  getQueueSuffix?: () => string;
}

export interface ServiceEndpointConfigurator<
  TCommand extends Command = Command,
  TEvent extends Event = Event,
  TRequest extends Request = Request,
  TResponse extends Response = Response> {
  connectTo: (url: string) => ServiceEndpointConfigurator<TCommand, TEvent, TRequest, TResponse>;
  named: (name: string) => ServiceEndpointConfigurator<TCommand, TEvent, TRequest, TResponse>;
  create: () => ServiceEndpoint<TCommand, TEvent, TRequest, TResponse>;
  createClient: () => ServiceEndpointClient<TCommand, TEvent, TRequest, TResponse>;
}

export interface ServiceBusConfigurator<
  TCommand extends Command = Command,
  TEvent extends Event = Event,
  TRequest extends Request = Request,
  TResponse extends Response = Response> {
  withEndpoint: (endpoint: (cfg: ServiceEndpointConfigurator) => ServiceEndpoint<TCommand, TEvent, TRequest, TResponse>) => ServiceBusConfigurator<TCommand, TEvent, TRequest, TResponse>;
  withEndpointClient: (endpoint: (cfg: ServiceEndpointConfigurator) => ServiceEndpointClient<TCommand, TEvent, TRequest, TResponse>) => ServiceBusConfigurator<TCommand, TEvent, TRequest, TResponse>;
  create: () => ServiceBus<TCommand, TEvent, TRequest, TResponse>;
  createClient: () => ServiceBusClient<TCommand, TEvent, TRequest, TResponse>;
}
