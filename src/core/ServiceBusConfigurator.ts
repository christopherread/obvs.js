import {
  Command,
  Event,
  Request,
  Response,
} from './messages';
import { ServiceBusConfig } from './config';
import { ServiceEndpointClient } from './ServiceEndpointClient'
import { ServiceEndpoint } from './ServiceEndpoint'
import { ServiceBus, ServiceBusInstance } from './ServiceBus';
import { ServiceBusClient, ServiceBusClientInstance } from './ServiceBusClient';

export interface ServiceBusConfigurator<
  TCommand extends Command = Command,
  TEvent extends Event = Event,
  TRequest extends Request = Request,
  TResponse extends Response = Response> {
  withEndpoint: (endpoint: ServiceEndpoint<TCommand, TEvent, TRequest, TResponse>) => ServiceBusConfigurator<TCommand, TEvent, TRequest, TResponse>;
  withEndpointClient: (endpoint: ServiceEndpointClient<TCommand, TEvent, TRequest, TResponse>) => ServiceBusConfigurator<TCommand, TEvent, TRequest, TResponse>;
  create: () => ServiceBus<TCommand, TEvent, TRequest, TResponse>;
  createClient: () => ServiceBusClient<TCommand, TEvent, TRequest, TResponse>;
}

export const configureServiceBus = <
  TCommand extends Command = Command,
  TEvent extends Event = Event,
  TRequest extends Request = Request,
  TResponse extends Response = Response>(cfg: ServiceBusConfig<TCommand, TEvent, TRequest, TResponse> = { endpoints: [], endpointClients: [] }): ServiceBusConfigurator<TCommand, TEvent, TRequest, TResponse> => ({
    withEndpoint: (endpoint: ServiceEndpoint<TCommand, TEvent, TRequest, TResponse>) => {
      cfg.endpoints.push(endpoint);
      return configureServiceBus<TCommand, TEvent, TRequest, TResponse>(cfg);
    },
    withEndpointClient: (endpoint: ServiceEndpointClient<TCommand, TEvent, TRequest, TResponse>) => {
      cfg.endpointClients.push(endpoint);
      return configureServiceBus<TCommand, TEvent, TRequest, TResponse>(cfg);
    },
    create: () => new ServiceBusInstance(cfg),
    createClient: () => new ServiceBusClientInstance(cfg)
  });