import { Message } from 'amqplib';
import { ChannelMessage } from './channel';

const deserialize = <T>(
  msg: Message | undefined | null,
  queueName: string
): T | null => {
  if (!msg?.content) {
    return null;
  }
  try {
    return JSON.parse(msg.content.toString()) as T;
  } catch (err) {
    console.error(
      `Obvs: Message on queue ${queueName} is not valid JSON`,
      msg?.content.toString()
    );
    return null;
  }
};

export interface MessageWrapper<T> {
  payload: T;
  routingKey: string;
  message: Message;
  queue: string;
  messageId: string;
  ack: () => void;
  nack: () => void;
}

export const wrapMessage = <T>(
  queueName: string,
  msg: ChannelMessage | null
): MessageWrapper<T> | null => {
  const payload = deserialize<T>(msg?.message, queueName);
  if (!msg?.message || !payload) {
    return null;
  }
  return {
    payload,
    routingKey: msg.message.fields.routingKey,
    message: msg.message,
    queue: queueName,
    messageId: msg.message.properties.messageId,
    ack: () => {
      if (!msg.options?.noAck && msg.message) {
        msg.channel.ack(msg.message);
      }
    },
    nack: () => {
      if (!msg.options?.noAck && msg.message) {
        msg.channel.nack(msg.message);
      }
    },
  };
};
