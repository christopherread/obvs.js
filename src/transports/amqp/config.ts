import { FactoryFunc } from "./connection";

export interface AmqpEndpointConfig {
    url?: string;
    factory?: FactoryFunc;
    name?: string;
    types?: Set<string>;
    getQueueSuffix?: () => string;
}