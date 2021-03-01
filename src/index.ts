import * as dotenv from 'dotenv';
dotenv.config();

import { merge } from 'rxjs';
import {
  filter,
  map,
  switchMap,
  take,
} from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { 
  Command, 
  Event, 
  Request, 
  Response, 
  ServiceEndpointConfig, 
  ServiceEndpointConfigurator, 
  Message, 
  ServiceBusConfig, 
  ServiceBusConfigurator,
  ServiceEndpoint, 
  ServiceEndpointClient 
} from './core';
import { shareableConnection } from "./transports/amqp/connection";
import { messagePublisher } from './transports/amqp/messagePublisher';
import { messageSource } from './transports/amqp/messageSource';

export const serviceEndpointConfigure = <
  TCommand extends Command = Command,
  TEvent extends Event = Event,
  TRequest extends Request = Request,
  TResponse extends Response = Response>(cfg: ServiceEndpointConfig = {}): ServiceEndpointConfigurator<TCommand, TEvent, TRequest, TResponse> => ({
    connectTo: (url: string) => {
      cfg.url = url
      return serviceEndpointConfigure<TCommand, TEvent, TRequest, TResponse>(cfg)
    },
    named: (name: string) => {
      cfg.name = name;
      return serviceEndpointConfigure<TCommand, TEvent, TRequest, TResponse>(cfg)
    },
    create: () => {
      if (!cfg.url) {
        throw new Error('endpoint url not defined');
      }
      if (!cfg.name) {
        throw new Error('endpoint name not defined');
      }
      const eventsExchange = `${cfg.name}.Events`;
      const commandsExchange = `${cfg.name}.Commands`;
      const requestsExchange = `${cfg.name}.Requests`;
      const responsesExchange = `${cfg.name}.Responses`;
      const connection = shareableConnection(cfg.url);
      const queueSuffix = `Queue-${process.pid}`;
      const eventsBinding = { source: eventsExchange, queue: `${eventsExchange}-${queueSuffix}`, pattern: '' };
      const commandsBinding = { source: commandsExchange, queue: `${commandsExchange}-${queueSuffix}`, pattern: '' };
      const requestsBinding = { source: requestsExchange, queue: `${requestsExchange}-${queueSuffix}`, pattern: '' };
      const requestPublisher = messagePublisher<TRequest>(connection);
      const eventPublisher = messagePublisher<TEvent>(connection);
      const commandPublisher = messagePublisher<TCommand>(connection);
      const responsePublisher = messagePublisher<TResponse>(connection);
      const toRoutingKey = <TMessage extends Message = Message>(msg: TMessage) => `${cfg.name}.${msg.type}`;
      return {
        events: messageSource<TEvent>(connection, eventsBinding).pipe(map(msg => ({ ...msg.payload, type: msg?.payload.type }))),
        commands: messageSource<TCommand>(connection, commandsBinding).pipe(map(msg => ({ ...msg.payload, type: msg?.payload.type }))),
        requests: messageSource<TRequest>(connection, requestsBinding).pipe(map(msg => ({ ...msg.payload, type: msg?.payload.type }))),
        getResponses: (request: TRequest) => {
          const requestId = uuidv4();
          const responsesBinding = { source: responsesExchange, queue: `${responsesExchange}-${queueSuffix}`, pattern: '' };
          const responses = messageSource<TResponse>(connection, responsesBinding)
            .pipe(
              filter(msg => msg.payload.requestId === requestId),
              map(msg => ({ ...msg.payload, type: msg?.payload.type }))
            );
          return requestPublisher.pipe(
            take(1),
            switchMap(publish => {
              publish(requestsExchange, toRoutingKey(request), request);
              return responses;
            })
          );
        },
        publish: async (ev: TEvent) => {
          const pub = await eventPublisher.pipe(take(1)).toPromise();
          pub(eventsExchange, toRoutingKey(ev), ev);
        },
        reply: async (request: TRequest, response: TResponse) => {
          const pub = await responsePublisher.pipe(take(1)).toPromise();
          response.requestId = request.requestId;
          pub(responsesExchange, toRoutingKey(response), response);
        },
        send: async (command: TCommand) => {
          const pub = await commandPublisher.pipe(take(1)).toPromise();
          pub(commandsExchange, toRoutingKey(command), command);
        }
      };
    },
    createClient: () => {
      if (!cfg.url) {
        throw new Error('endpoint url not defined');
      }
      if (!cfg.name) {
        throw new Error('endpoint name not defined');
      }
      const eventsExchange = `${cfg.name}.Events`;
      const commandsExchange = `${cfg.name}.Commands`;
      const requestsExchange = `${cfg.name}.Requests`;
      const responsesExchange = `${cfg.name}.Responses`;
      const connection = shareableConnection(cfg.url);
      const queueSuffix = `Queue-${process.pid}`;
      const eventsBinding = { source: eventsExchange, queue: `${eventsExchange}-${queueSuffix}`, pattern: '' };
      const requestPublisher = messagePublisher<TRequest>(connection);
      const commandPublisher = messagePublisher<TCommand>(connection);
      const toRoutingKey = <TMessage extends Message = Message>(msg: TMessage) => `${cfg.name}.${msg.type}`;
      return {
        events: messageSource<TEvent>(connection, eventsBinding).pipe(map(msg => ({ ...msg.payload, type: msg?.payload.type }))),
        getResponses: (request: TRequest) => {
          const requestId = uuidv4();
          const responsesBinding = { source: responsesExchange, queue: `${responsesExchange}-${queueSuffix}`, pattern: '' };
          const responses = messageSource<TResponse>(connection, responsesBinding)
            .pipe(
              filter(msg => msg.payload.requestId === requestId),
              map(msg => ({ ...msg.payload, type: msg?.payload.type }))
            );
          return requestPublisher.pipe(
            take(1),
            switchMap(publish => {
              publish(requestsExchange, toRoutingKey(request), request);
              return responses;
            })
          );
        },
        send: async (command: TCommand) => {
          const pub = await commandPublisher.pipe(take(1)).toPromise();
          pub(commandsExchange, toRoutingKey(command), command);
        }
      };
    }
  })

export const serviceBusConfigure = <
  TCommand extends Command = Command,
  TEvent extends Event = Event,
  TRequest extends Request = Request,
  TResponse extends Response = Response>(cfg: ServiceBusConfig<TCommand, TEvent, TRequest, TResponse> = { endpoints: [], endpointClients: [] }): ServiceBusConfigurator<TCommand, TEvent, TRequest, TResponse> => ({
    withEndpoint: (endpoint: (cfg: ServiceEndpointConfigurator) => ServiceEndpoint<TCommand, TEvent, TRequest, TResponse>) => {
      cfg.endpoints.push(endpoint(serviceEndpointConfigure()));
      return serviceBusConfigure<TCommand, TEvent, TRequest, TResponse>(cfg);
    },
    withEndpointClient: (endpoint: (cfg: ServiceEndpointConfigurator) => ServiceEndpointClient<TCommand, TEvent, TRequest, TResponse>) => {
      cfg.endpointClients.push(endpoint(serviceEndpointConfigure()));
      return serviceBusConfigure<TCommand, TEvent, TRequest, TResponse>(cfg);
    },
    create: () => ({
      events: merge(
        ...cfg.endpoints.map(ep => ep.events),
        ...cfg.endpointClients.map(ep => ep.events)
      ),
      commands: merge(...cfg.endpoints.map(ep => ep.commands)),
      requests: merge(...cfg.endpoints.map(ep => ep.requests)),
      getResponses: (request: TRequest) => merge(
        ...cfg.endpoints.map(ep => ep.getResponses(request)),
        ...cfg.endpointClients.map(ep => ep.getResponses(request))
      ),
      publish: async (event: TEvent) => { await Promise.all(cfg.endpoints.map(ep => ep.publish(event))); },
      reply: async (request: TRequest, response: TResponse) => { await Promise.all(cfg.endpoints.map(ep => ep.reply(request, response))); },
      send: async (command: TCommand) => { await Promise.all(cfg.endpoints.map(ep => ep.send(command))); },
    }),
    createClient: () => ({
      events: merge(
        ...cfg.endpoints.map(ep => ep.events),
        ...cfg.endpointClients.map(ep => ep.events)
      ),
      getResponses: (request: TRequest) => merge(
        ...cfg.endpoints.map(ep => ep.getResponses(request)),
        ...cfg.endpointClients.map(ep => ep.getResponses(request))
      ),
      publish: async (event: TEvent) => { await Promise.all(cfg.endpoints.map(ep => ep.publish(event))); },
      send: async (command: TCommand) => { await Promise.all(cfg.endpoints.map(ep => ep.send(command))); },
    })
  });