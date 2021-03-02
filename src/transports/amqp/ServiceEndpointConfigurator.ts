import {
  Command,
  Event,
  Request,
  Response,
} from '../../core/messages';
import { AmqpServiceEndpointClient } from './ServiceEndpointClient';
import { AmqpServiceEndpoint } from './ServiceEndpoint';
import { AmqpEndpointConfig, AmqpEndpointOptions } from './config';
import { ServiceEndpoint } from '../../core/ServiceEndpoint';
import { ServiceEndpointClient } from '../../core/ServiceEndpointClient';
import { FactoryFunc } from './connection';

export interface AmqpEndpointConfigurator<
  TCommand extends Command = Command,
  TEvent extends Event = Event,
  TRequest extends Request = Request,
  TResponse extends Response = Response> {
  connectTo: (url: string) => AmqpEndpointConfigurator<TCommand, TEvent, TRequest, TResponse>;
  named: (name: string) => AmqpEndpointConfigurator<TCommand, TEvent, TRequest, TResponse>;
  handles: (...types: string[]) => AmqpEndpointConfigurator<TCommand, TEvent, TRequest, TResponse>;
  withOptions: (options: AmqpEndpointOptions) => AmqpEndpointConfigurator<TCommand, TEvent, TRequest, TResponse>;
  create: () => ServiceEndpoint<TCommand, TEvent, TRequest, TResponse>;
  createClient: () => ServiceEndpointClient<TCommand, TEvent, TRequest, TResponse>;
}

const validateConfig = (cfg: AmqpEndpointConfig) => {
  const errors: string[] = [];
  if (!cfg.url) {
    errors.push(`please specify amqp broker url`);
  }
  if (!cfg.name) {
    errors.push(`please specify service name`);
  }
  if (!cfg.types || cfg.types.size === 0) {
    errors.push(`please specify list of message types for the service`);
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}

export const configureAmqpEndpoint = <
  TCommand extends Command = Command,
  TEvent extends Event = Event,
  TRequest extends Request = Request,
  TResponse extends Response = Response>(cfg: AmqpEndpointConfig = {}): AmqpEndpointConfigurator<TCommand, TEvent, TRequest, TResponse> => ({
    connectTo: (url: string, factory?: FactoryFunc) => {
      cfg.url = url;
      cfg.factory = factory;
      return configureAmqpEndpoint<TCommand, TEvent, TRequest, TResponse>(cfg);
    },
    named: (name: string) => {
      cfg.name = name;
      return configureAmqpEndpoint<TCommand, TEvent, TRequest, TResponse>(cfg);
    },
    handles: (...types: string[]) => {
      if (!cfg.types) {
        cfg.types = new Set<string>(types)
      } else {
        types.forEach(t => cfg.types?.add(t));
      }
      return configureAmqpEndpoint<TCommand, TEvent, TRequest, TResponse>(cfg);
    },
    withOptions: (options: AmqpEndpointOptions) => {
      cfg.options = options;
      return configureAmqpEndpoint<TCommand, TEvent, TRequest, TResponse>(cfg);
    },
    createClient: () => {
      validateConfig(cfg);
      return new AmqpServiceEndpointClient<TCommand, TEvent, TRequest, TResponse>(cfg)
    },
    create: () => {
      validateConfig(cfg);
      return new AmqpServiceEndpoint<TCommand, TEvent, TRequest, TResponse>(cfg);
    },
  });
