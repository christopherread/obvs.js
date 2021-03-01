import { Observable } from 'rxjs';
import {
  map,
  switchMap
} from 'rxjs/operators';
import {
  Connection,
  Options
} from 'amqplib';
import { filterTruthy } from '../../utils/filterTruthy';
import { retryingChannel } from './channel';
import { MessageWrapper, wrapMessage } from "./message";
import { retryingConsumer } from './consumer';


export const messageSource = <T>(
  connection: Observable<Connection>,
  binding: { queue: string; source: string; pattern: string; },
  optionsConsume?: Options.Consume,
  prefetch = 50
): Observable<MessageWrapper<T>> => connection.pipe(
  switchMap((connection) => retryingChannel(connection, prefetch, [], [binding])),
  switchMap((channel) => retryingConsumer(channel, binding.queue, optionsConsume)),
  map((msg) => wrapMessage<T>(binding.queue, msg)),
  filterTruthy()
);
