import { Observable } from 'rxjs';
import {
  map,
  publish,
  refCount,
  switchMap
} from 'rxjs/operators';
import {
  Connection,
  Options
} from 'amqplib';
import { filterTruthy } from '../../utils/filterTruthy';
import { Binding, retryingChannel } from './channel';
import { MessageWrapper, wrapMessage } from "./message";
import { retryingConsumer } from './consumer';
import { Message } from "../../core/messages";

const unwrap = <T extends Message>(msg: MessageWrapper<T>): T => ({ ...msg.payload, type: msg.payload.type });

export class MessageSource<T extends Message> {
  private messageObservable: Observable<T>;

  constructor(connections: Observable<Connection>, 
    binding: Binding,
    options?: Options.Consume,
    prefetch = 50) {
    this.messageObservable = connections.pipe(
      switchMap((connection) => retryingChannel(connection, prefetch, [], [binding])),
      switchMap((channel) => retryingConsumer(channel, binding.queue, options)),
      map((msg) => wrapMessage<T>(binding.queue, msg)),
      filterTruthy(),
      map(msg => unwrap(msg)),
      publish(),
      refCount()
    );
  }

  messages(): Observable<T> {
    return this.messageObservable;
  }
};
