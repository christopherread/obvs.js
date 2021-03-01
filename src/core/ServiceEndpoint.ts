import { Observable } from 'rxjs';
import { Command, Event, Request, Response } from './messages';
import { ServiceEndpointClient } from './ServiceEndpointClient';


export interface ServiceEndpoint<
  TCommand extends Command = Command,
  TEvent extends Event = Event,
  TRequest extends Request = Request,
  TResponse extends Response = Response> extends ServiceEndpointClient<TCommand, TEvent, TRequest, TResponse> {
  readonly requests: Observable<TRequest>;
  readonly commands: Observable<TCommand>;
  publish(event: TEvent): Promise<void>;
  reply(request: TRequest, response: TResponse): Promise<void>;
}
