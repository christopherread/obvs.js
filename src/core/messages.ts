export interface Message {
  type: string;
}

export type Event = Message;

export type Command = Message;

export interface Request extends Message {
  requestId: string;
}

export interface Response extends Message {
  requestId: string;
}
