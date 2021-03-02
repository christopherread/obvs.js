import { RetryBackoffConfig } from 'backoff-rxjs';

const oneSecond = 1000; // 1 second in ms
const twoMinutes = 2 * 60 * 1000; // 2 minutes in ms

export const defaultBackoff: RetryBackoffConfig = {
  initialInterval: oneSecond,
  maxInterval: twoMinutes,
};

export const defaultPrefetch = 10;

export const DEFAULT_EXCHANGE_TYPE = 'topic';
