import * as obvs from '../../src';

export interface MyCommand1 extends obvs.Event {
  type: 'command1';
  data: number;
}

export interface MyEvent1 extends obvs.Event {
  type: 'event1';
  result: number;
}

export interface MyRequest1 extends obvs.Request {
  type: 'request1';
}

export interface MyResponse1 extends obvs.Response {
  type: 'response1';
}