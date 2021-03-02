# obvs.js
`Node.js` implementation of the popular .NET microservicebus library, `Obvs`, using `RxJS`.

## Getting started

First, you need a server. Create a ServiceBus, with a single RabbitMQ endpoint:
```
const serviceBus = obvs.configureServiceBus()
  .withEndpoint(
    amqp.configureAmqpEndpoint()
      .named('MyService')
      .connectTo('amqp://user:bitnami@localhost:5672')
      .handles('event1', 'response1')
      .withOptions({
        queueSuffix: 'server1'
      })
      .create()
  )
  .create();
```

Subscribe to commands and requests:
```
const commands = serviceBus.commands.subscribe(command => {
  const ev: Event1 = { type: 'event1' }
  serviceBus.publish(ev);
});

const requests = serviceBus.requests.subscribe(request => {
  const response: Response1 = { type: 'response1', requestId: request.requestId }
  serviceBus.reply(request, response);
});
```

In another process, create your client.
```
const serviceBusClient = obvs.configureServiceBus()
.withEndpointClient(
  amqp.configureAmqpEndpoint()
    .named('MyService')
    .connectTo('amqp://user:bitnami@localhost:5672')
    .handles('command1', 'request1')
    .withOptions({
      queueSuffix: 'client1'
    })
    .createClient()
)
.createClient();
```

Subscribe to events and send a command:
```
const events = serviceBusClient.events.subscribe(ev => {
  console.log(`Received event`, ev);
});

await serviceBusClient.send(command);
```

Send a request and receive a stream of responses:
```
const request: MyRequest1 = { type: 'request1', requestId: 'abcd1234' }
serviceBusClient.getResponses(request).pipe(take(1)).subscribe(r => {
  console.log(`Received response`, r);
});
```

## Examples
Examples pre-requisites: `node, npm, docker`.

Install dependencies
```
npm install
```

Run examples broker
```
cd examples
docker-compose up
```

Run examples server
```
npm run server
```

Run examples client
```
npm run client
```



