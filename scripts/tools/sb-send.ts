#!/usr/bin/env node
/**
 * Send a test message to Service Bus queue
 * Usage: npx tsx scripts/tools/sb-send.ts [queue-name] [message]
 */

import { ServiceBusClient } from '@azure/service-bus';

const CONNECTION_STRING = process.env.SERVICE_BUS_CONNECTION || '';
const QUEUE_NAME = process.argv[2] || 'casestudy-jobs';
const MESSAGE_BODY = process.argv[3] || JSON.stringify({
  caseStudyInput: 'Test message from sb-send.ts',
  quickMode: true,
  timestamp: new Date().toISOString(),
  source: 'diagnostic-tool'
});

async function main() {
  if (!CONNECTION_STRING) {
    console.error('Error: SERVICE_BUS_CONNECTION environment variable required');
    console.error('Usage: SERVICE_BUS_CONNECTION="..." npx tsx scripts/tools/sb-send.ts [queue] [message]');
    process.exit(1);
  }

  const client = new ServiceBusClient(CONNECTION_STRING);
  const sender = client.createSender(QUEUE_NAME);

  try {
    let body: any;
    try {
      body = JSON.parse(MESSAGE_BODY);
    } catch {
      body = MESSAGE_BODY;
    }

    const message = {
      body,
      contentType: 'application/json',
      messageId: `test-${Date.now()}`,
      sessionId: `test-session-${Date.now()}` // For session-aware queues
    };

    console.log(`📤 Sending message to queue: ${QUEUE_NAME}`);
    console.log(`Message ID: ${message.messageId}`);
    console.log(`Session ID: ${message.sessionId}`);
    console.log(`Body:`, body);

    await sender.sendMessages(message);

    console.log('✅ Message sent successfully');
  } catch (error: any) {
    console.error('❌ Failed to send message:', error.message);
    process.exit(1);
  } finally {
    await sender.close();
    await client.close();
  }
}

main();