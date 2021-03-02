import * as obvs from '../../src';
import * as amqp from '../../src/transports/amqp';
import { MyCommand1, MyEvent1, MyResponse1 } from './types';

const waitFor = (ms: number = 1): Promise<void> =>
  new Promise((resolve) => setTimeout(() => resolve(), ms));

async function main() {
  console.log('Starting server...');

  const serviceBus = obvs.configureServiceBus()
    .withEndpoint(
      amqp.configureAmqpEndpoint()
        .named('MyService')
        .connectTo('amqp://user:bitnami@localhost:5672')
        .handles('event1', 'response1')
        .withOptions({
          queueSuffix: 'server1',
          deleteQueues: true
        })
        .create()
    )
    .create();

  const commands = serviceBus.commands.subscribe(command => {
    console.log(`Received command`, command);
    const ev: MyEvent1 = { type: 'event1', result: (command as MyCommand1).data * 10 };
    waitFor(100);
    serviceBus.publish(ev).then(() => console.log(`Published event`, ev));
  });

  const requests = serviceBus.requests.subscribe(request => {
    console.log(`Received request`, request);
    const response: MyResponse1 = { type: 'response1', requestId: request.requestId };
    waitFor(100);
    serviceBus.reply(request, response).then(() => console.log(`Replied with response`, response));
  });

  console.log('Server started');

  process.on("SIGINT", async () => {
    console.log('Stopping server...');
    commands.unsubscribe();
    requests.unsubscribe();
    serviceBus.close();
    waitFor(100).then(() => process.exit(0));
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

