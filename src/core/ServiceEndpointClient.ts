import { Observable } from 'rxjs';
import { Command, Event, Request, Response, Message } from './index';


export interface ServiceEndpointClient<
  TCommand extends Command = Command,
  TEvent extends Event = Event,
  TRequest extends Request = Request,
  TResponse extends Response = Response> {
  readonly events: Observable<TEvent>;
  send(command: TCommand): Promise<void>;
  getResponses(request: TRequest): Observable<TResponse>;
  canHandle(message: Message): boolean;
}
