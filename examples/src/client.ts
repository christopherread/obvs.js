import { take } from 'rxjs/operators';
import * as obvs from '../../src';
import * as amqp from '../../src/transports/amqp';
import { MyCommand1, MyRequest1 } from './types';

const eventLoopTick = (ms = 1): Promise<void> =>
  new Promise((resolve) => setTimeout(() => resolve(), ms));

async function main() {
  console.log('Starting client...');

  const serviceBusClient = obvs.configureServiceBus()
    .withEndpointClient(
      amqp.configureAmqpEndpoint()
        .named('MyService')
        .connectTo('amqp://user:bitnami@localhost:5672')
        .handles('command1', 'request1')
        .withOptions({
          queueSuffix: 'client1',
          deleteQueues: true
        })
        .createClient()
    )
    .createClient();

  const events = serviceBusClient.events.subscribe(ev => {
    console.log(`Received event`, ev);
  });

  console.log('Client started');
  await eventLoopTick(100); // wait for publisher to connect

  for (let index = 0; index < 10; index++) {
    const command: MyCommand1 = { type: 'command1', data: index }
    await serviceBusClient.send(command);
    console.log('Sent command', command);
    await eventLoopTick(500);
  }

  const request: MyRequest1 = { type: 'request1', requestId: 'abcd1234' }
  serviceBusClient.getResponses(request).pipe(take(1)).subscribe(r => {
    console.log(`Received response`, r);
  });

  await eventLoopTick(500);

  process.on("SIGINT", () => {
    console.log('Stopping client...');
    events.unsubscribe();
    serviceBusClient.close();
    eventLoopTick(100).then(() => process.exit(0));
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

