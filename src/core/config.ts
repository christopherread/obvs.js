import {
  Command,
  Event,
  Request,
  Response,
} from './messages';
import { ServiceEndpoint } from './ServiceEndpoint';
import { ServiceEndpointClient } from './ServiceEndpointClient';

export interface ServiceBusConfig<
  TCommand extends Command = Command,
  TEvent extends Event = Event,
  TRequest extends Request = Request,
  TResponse extends Response = Response> {
  endpoints: ServiceEndpoint<TCommand, TEvent, TRequest, TResponse>[];
  endpointClients: ServiceEndpointClient<TCommand, TEvent, TRequest, TResponse>[];
}


