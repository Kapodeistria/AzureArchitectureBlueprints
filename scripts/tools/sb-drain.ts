#!/usr/bin/env node
/**
 * Read and drain messages from Service Bus queue
 * Usage: npx tsx scripts/tools/sb-drain.ts [queue-name] [max-messages]
 */

import { ServiceBusClient, ServiceBusReceivedMessage } from '@azure/service-bus';

const CONNECTION_STRING = process.env.SERVICE_BUS_CONNECTION || '';
const QUEUE_NAME = process.argv[2] || 'casestudy-status';
const MAX_MESSAGES = parseInt(process.argv[3] || '10', 10);

async function main() {
  if (!CONNECTION_STRING) {
    console.error('Error: SERVICE_BUS_CONNECTION environment variable required');
    console.error('Usage: SERVICE_BUS_CONNECTION="..." npx tsx scripts/tools/sb-drain.ts [queue] [max]');
    process.exit(1);
  }

  const client = new ServiceBusClient(CONNECTION_STRING);
  const receiver = client.createReceiver(QUEUE_NAME, { receiveMode: 'peekLock' });

  try {
    console.log(`📥 Reading messages from queue: ${QUEUE_NAME}`);
    console.log(`Max messages: ${MAX_MESSAGES}`);
    console.log('');

    const messages = await receiver.receiveMessages(MAX_MESSAGES, { maxWaitTimeInMs: 5000 });

    if (messages.length === 0) {
      console.log('✅ No messages in queue');
      return;
    }

    console.log(`📬 Received ${messages.length} message(s):`);
    console.log('');

    for (const msg of messages) {
      console.log('─'.repeat(60));
      console.log(`Message ID: ${msg.messageId}`);
      console.log(`Session ID: ${msg.sessionId || 'N/A'}`);
      console.log(`Enqueued at: ${msg.enqueuedTimeUtc}`);
      console.log(`Delivery count: ${msg.deliveryCount}`);
      console.log(`Content type: ${msg.contentType || 'N/A'}`);

      if (msg.body) {
        console.log('Body:');
        console.log(JSON.stringify(msg.body, null, 2));
      }

      // Complete the message (removes from queue)
      await receiver.completeMessage(msg);
      console.log('✅ Message completed (removed from queue)');
      console.log('');
    }

    console.log('─'.repeat(60));
    console.log(`✅ Processed ${messages.length} message(s)`);
  } catch (error: any) {
    console.error('❌ Failed to read messages:', error.message);
    process.exit(1);
  } finally {
    await receiver.close();
    await client.close();
  }
}

main();