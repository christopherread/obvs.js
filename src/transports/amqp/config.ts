import { FactoryFunc } from "./connection";

export interface AmqpEndpointConfig {
  url?: string;
  factory?: FactoryFunc;
  name?: string;
  types?: Set<string>;
  options?: AmqpEndpointOptions;
}

export interface AmqpEndpointOptions {
  /** Optional unique queue suffix for this process, otherwise pid is used. */
  queueSuffix?: string;
  /** Optionally delete queues when closing channel */
  deleteQueues?: boolean;
}