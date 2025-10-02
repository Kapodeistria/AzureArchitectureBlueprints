/**
 * Production-Ready Service Bus Client
 * Implements best practices from Azure AI Foundry and Service Bus Integration Guide
 */

import {
  ServiceBusClient,
  ServiceBusSender,
  ServiceBusReceiver,
  ServiceBusProcessor,
  ServiceBusProcessorOptions,
  ServiceBusMessage,
  ProcessMessageArgs,
  ProcessErrorArgs,
  ServiceBusReceivedMessage,
  ServiceBusClientOptions,
  ServiceBusRetryMode
} from '@azure/service-bus';
import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient } from '@azure/storage-blob';
import { createHash } from 'crypto';

export interface ServiceBusConfig {
  fullyQualifiedNamespace?: string;
  connectionString?: string;
  queueName: string;
  deadLetterQueueName?: string;
  useManagedIdentity?: boolean;

  // Processing configuration
  maxConcurrentCalls?: number;
  prefetchCount?: number;
  maxAutoLockRenewalDurationInMinutes?: number;

  // Reliability configuration
  maxDeliveryCount?: number;
  lockDurationInSeconds?: number;
  enableDuplicateDetection?: boolean;
  duplicateDetectionWindowInMinutes?: number;

  // Performance configuration
  enableBatching?: boolean;
  batchFlushIntervalInMs?: number;

  // Storage for claim check pattern
  storageConnectionString?: string;
  storageContainerName?: string;
}

export interface MessageContext {
  messageId: string;
  sessionId?: string;
  correlationId?: string;
  subject?: string;
  contentType?: string;
  replyTo?: string;
  partitionKey?: string;
  scheduledEnqueueTimeUtc?: Date;
  timeToLive?: number;
}

export interface ClaimCheckMessage {
  blobUrl: string;
  contentType: string;
  size: number;
  checksum: string;
  metadata?: Record<string, unknown>;
}

/**
 * Production Service Bus Client with all best practices
 */
export class ProductionServiceBusClient {
  private client: ServiceBusClient | null = null;
  private sender: ServiceBusSender | null = null;
  private processor: ServiceBusProcessor | null = null;
  private blobClient: BlobServiceClient | null = null;
  private readonly config: Required<ServiceBusConfig>;
  private readonly messageIdCache = new Map<string, Date>();
  private readonly circuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    isOpen: false,
    halfOpenAttempts: 0
  };

  // Circuit breaker thresholds
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT_MS = 60000; // 1 minute
  private readonly CIRCUIT_BREAKER_HALF_OPEN_ATTEMPTS = 3;

  constructor(config: ServiceBusConfig) {
    this.config = this.applyDefaults(config);
    this.validateConfig();
  }

  private applyDefaults(config: ServiceBusConfig): Required<ServiceBusConfig> {
    return {
      fullyQualifiedNamespace: config.fullyQualifiedNamespace || process.env.SERVICE_BUS_NAMESPACE || '',
      connectionString: config.connectionString || process.env.SERVICE_BUS_CONNECTION || '',
      queueName: config.queueName,
      deadLetterQueueName: config.deadLetterQueueName || `${config.queueName}/$deadletterqueue`,
      useManagedIdentity: config.useManagedIdentity !== false,

      // Production defaults for AI workloads
      maxConcurrentCalls: config.maxConcurrentCalls || 4,
      prefetchCount: config.prefetchCount || 5, // Conservative for long-running AI jobs
      maxAutoLockRenewalDurationInMinutes: config.maxAutoLockRenewalDurationInMinutes || 45,

      maxDeliveryCount: config.maxDeliveryCount || 10,
      lockDurationInSeconds: config.lockDurationInSeconds || 300, // 5 minutes
      enableDuplicateDetection: config.enableDuplicateDetection ?? true,
      duplicateDetectionWindowInMinutes: config.duplicateDetectionWindowInMinutes || 60,

      enableBatching: config.enableBatching ?? true,
      batchFlushIntervalInMs: config.batchFlushIntervalInMs || 20,

      storageConnectionString: config.storageConnectionString || process.env.STORAGE_CONNECTION || '',
      storageContainerName: config.storageContainerName || 'claimcheck'
    };
  }

  private validateConfig(): void {
    if (!this.config.fullyQualifiedNamespace && !this.config.connectionString) {
      throw new Error('Either fullyQualifiedNamespace or connectionString must be provided');
    }

    if (!this.config.queueName) {
      throw new Error('Queue name is required');
    }

    // Validate processing parameters based on AI workload requirements
    if (this.config.maxConcurrentCalls > 8) {
      console.warn('⚠️  MaxConcurrentCalls > 8 may overwhelm AI endpoints');
    }

    if (this.config.prefetchCount > 10 && this.config.maxAutoLockRenewalDurationInMinutes < 30) {
      console.warn('⚠️  High prefetch with short lock renewal may cause lock expiration');
    }
  }

  /**
   * Initialize the Service Bus client with retry configuration
   */
  public async initialize(): Promise<void> {
    try {
      const clientOptions: ServiceBusClientOptions = {
        retryOptions: {
          mode: ServiceBusRetryMode.Exponential,
          maxRetries: 5,
          delay: 1000,
          maxDelay: 60000,
          tryTimeout: 60000
        }
      };

      if (this.config.useManagedIdentity && this.config.fullyQualifiedNamespace) {
        const fqdn = this.config.fullyQualifiedNamespace.includes('.')
          ? this.config.fullyQualifiedNamespace
          : `${this.config.fullyQualifiedNamespace}.servicebus.windows.net`;

        this.client = new ServiceBusClient(
          fqdn,
          new DefaultAzureCredential(),
          clientOptions
        );
      } else if (this.config.connectionString) {
        this.client = new ServiceBusClient(
          this.config.connectionString,
          clientOptions
        );
      }

      if (!this.client) {
        throw new Error('Failed to initialize Service Bus client');
      }

      // Initialize sender for the queue
      this.sender = this.client.createSender(this.config.queueName);

      // Initialize blob client for claim check pattern
      if (this.config.storageConnectionString) {
        this.blobClient = BlobServiceClient.fromConnectionString(
          this.config.storageConnectionString
        );
      }

      console.log('✅ Service Bus client initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Service Bus client:', error);
      throw error;
    }
  }

  /**
   * Send a message with automatic claim check for large payloads
   */
  public async sendMessage(
    body: unknown,
    context?: MessageContext,
    options?: { useClaimCheck?: boolean; claimCheckThreshold?: number }
  ): Promise<void> {
    if (!this.sender) {
      throw new Error('Service Bus client not initialized');
    }

    // Check circuit breaker
    if (this.isCircuitOpen()) {
      throw new Error('Circuit breaker is open - too many failures');
    }

    try {
      const serializedBody = JSON.stringify(body);
      const bodySizeKb = Buffer.byteLength(serializedBody) / 1024;

      // Use claim check pattern for large messages (> 256KB for Standard, > 1MB for Premium)
      const threshold = options?.claimCheckThreshold || 256;
      const shouldUseClaimCheck = options?.useClaimCheck !== false && bodySizeKb > threshold;

      let message: ServiceBusMessage;

      if (shouldUseClaimCheck) {
        const claimCheckUrl = await this.storeClaimCheck(serializedBody, context?.messageId);
        const claimCheckMessage: ClaimCheckMessage = {
          blobUrl: claimCheckUrl,
          contentType: 'application/json',
          size: bodySizeKb,
          checksum: this.calculateChecksum(serializedBody),
          metadata: { originalMessageId: context?.messageId }
        };

        message = {
          body: claimCheckMessage,
          messageId: context?.messageId || this.generateMessageId(),
          contentType: 'application/vnd.claimcheck+json',
          ...this.buildMessageProperties(context)
        };
      } else {
        message = {
          body,
          messageId: context?.messageId || this.generateMessageId(),
          ...this.buildMessageProperties(context)
        };
      }

      // Check for duplicate processing (idempotency)
      if (await this.isDuplicateMessage(message.messageId!)) {
        console.log(`⚠️  Duplicate message detected, skipping: ${message.messageId}`);
        return;
      }

      await this.sender.sendMessages(message);
      this.recordSuccess();

      // Cache message ID for duplicate detection
      this.cacheMessageId(message.messageId!);

      console.log(`✅ Message sent: ${message.messageId}`);
    } catch (error) {
      this.recordFailure();
      console.error('❌ Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Send messages in batch for improved throughput
   */
  public async sendBatch(
    messages: Array<{ body: unknown; context?: MessageContext }>
  ): Promise<void> {
    if (!this.sender) {
      throw new Error('Service Bus client not initialized');
    }

    try {
      const batch = await this.sender.createMessageBatch();

      for (const msg of messages) {
        const message: ServiceBusMessage = {
          body: msg.body,
          messageId: msg.context?.messageId || this.generateMessageId(),
          ...this.buildMessageProperties(msg.context)
        };

        if (!batch.tryAddMessage(message)) {
          // Send current batch and create new one
          await this.sender.sendMessages(batch);
          const newBatch = await this.sender.createMessageBatch();

          if (!newBatch.tryAddMessage(message)) {
            // Message too large even for empty batch - use claim check
            await this.sendMessage(msg.body, msg.context, { useClaimCheck: true });
          }
        }
      }

      if (batch.count > 0) {
        await this.sender.sendMessages(batch);
      }

      console.log(`✅ Batch sent: ${messages.length} messages`);
    } catch (error) {
      console.error('❌ Failed to send batch:', error);
      throw error;
    }
  }

  /**
   * Start processing messages with comprehensive error handling
   */
  public async startProcessor(
    processMessage: (message: ServiceBusReceivedMessage) => Promise<void>,
    processError?: (args: ProcessErrorArgs) => Promise<void>
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Service Bus client not initialized');
    }

    const processorOptions: ServiceBusProcessorOptions = {
      receiveMode: 'peekLock',
      maxConcurrentCalls: this.config.maxConcurrentCalls,
      prefetchCount: this.config.prefetchCount,
      autoCompleteMessages: false, // Explicit completion for reliability
      maxAutoLockRenewalDuration: this.config.maxAutoLockRenewalDurationInMinutes * 60
    };

    this.processor = this.client.createProcessor(
      this.config.queueName,
      processorOptions
    );

    // Message handler with idempotency and error handling
    this.processor.processMessage = async (args: ProcessMessageArgs) => {
      const { message } = args;

      try {
        // Check for duplicate processing
        if (await this.isDuplicateMessage(message.messageId!)) {
          console.log(`⚠️  Duplicate message, completing: ${message.messageId}`);
          await args.completeMessage(message);
          return;
        }

        // Check if this is a claim check message
        let actualBody = message.body;
        if (message.contentType === 'application/vnd.claimcheck+json') {
          const claimCheck = message.body as ClaimCheckMessage;
          actualBody = await this.retrieveClaimCheck(claimCheck.blobUrl);
        }

        // Process the message
        const messageToProcess = { ...message, body: actualBody };
        await processMessage(messageToProcess as ServiceBusReceivedMessage);

        // Mark as complete
        await args.completeMessage(message);
        this.cacheMessageId(message.messageId!);

        console.log(`✅ Message processed: ${message.messageId}`);
      } catch (error) {
        console.error(`❌ Error processing message ${message.messageId}:`, error);

        // Determine if error is permanent or transient
        if (this.isPermanentError(error)) {
          // Dead letter the message with reason
          await args.deadLetterMessage(message, {
            deadLetterReason: 'PermanentProcessingFailure',
            deadLetterErrorDescription: error instanceof Error ? error.message : String(error)
          });
        } else {
          // Abandon for retry
          await args.abandonMessage(message);
        }
      }
    };

    // Error handler
    this.processor.processError = processError || (async (args: ProcessErrorArgs) => {
      console.error('❌ Error from Service Bus:', {
        fullyQualifiedNamespace: args.fullyQualifiedNamespace,
        entityPath: args.entityPath,
        errorSource: args.errorSource,
        error: args.error
      });
    });

    await this.processor.start();
    console.log('✅ Message processor started');
  }

  /**
   * Process dead letter queue messages
   */
  public async processDeadLetterQueue(
    handler: (message: ServiceBusReceivedMessage) => Promise<void>
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Service Bus client not initialized');
    }

    const dlqReceiver = this.client.createReceiver(
      this.config.queueName,
      { subQueueType: 'deadLetter', receiveMode: 'peekLock' }
    );

    try {
      const messages = await dlqReceiver.receiveMessages(10, {
        maxWaitTimeInMs: 5000
      });

      for (const message of messages) {
        try {
          console.log(`🔍 Processing DLQ message: ${message.messageId}`, {
            reason: message.deadLetterReason,
            description: message.deadLetterErrorDescription
          });

          await handler(message);
          await dlqReceiver.completeMessage(message);
        } catch (error) {
          console.error(`❌ Failed to process DLQ message ${message.messageId}:`, error);
          // Could implement retry or alert logic here
        }
      }
    } finally {
      await dlqReceiver.close();
    }
  }

  /**
   * Stop the processor gracefully
   */
  public async stopProcessor(): Promise<void> {
    if (this.processor) {
      await this.processor.stop();
      await this.processor.close();
      this.processor = null;
      console.log('✅ Message processor stopped');
    }
  }

  /**
   * Close all connections
   */
  public async close(): Promise<void> {
    try {
      if (this.processor) {
        await this.stopProcessor();
      }
      if (this.sender) {
        await this.sender.close();
        this.sender = null;
      }
      if (this.client) {
        await this.client.close();
        this.client = null;
      }
      console.log('✅ Service Bus client closed');
    } catch (error) {
      console.error('❌ Error closing Service Bus client:', error);
      throw error;
    }
  }

  // Helper methods

  private buildMessageProperties(context?: MessageContext): Partial<ServiceBusMessage> {
    const props: Partial<ServiceBusMessage> = {};

    if (context?.sessionId) props.sessionId = context.sessionId;
    if (context?.correlationId) props.correlationId = context.correlationId;
    if (context?.subject) props.subject = context.subject;
    if (context?.contentType) props.contentType = context.contentType;
    if (context?.replyTo) props.replyTo = context.replyTo;
    if (context?.partitionKey) props.partitionKey = context.partitionKey;
    if (context?.scheduledEnqueueTimeUtc) props.scheduledEnqueueTimeUtc = context.scheduledEnqueueTimeUtc;
    if (context?.timeToLive) props.timeToLive = context.timeToLive;

    return props;
  }

  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async isDuplicateMessage(messageId: string): Promise<boolean> {
    // Check in-memory cache
    if (this.messageIdCache.has(messageId)) {
      const processedTime = this.messageIdCache.get(messageId)!;
      const hourAgo = new Date(Date.now() - 3600000);
      return processedTime > hourAgo;
    }

    // In production, check distributed cache (Redis/Cosmos DB)
    // This is a placeholder for the actual implementation
    return false;
  }

  private cacheMessageId(messageId: string): void {
    this.messageIdCache.set(messageId, new Date());

    // Clean up old entries (older than 1 hour)
    const hourAgo = new Date(Date.now() - 3600000);
    for (const [id, time] of this.messageIdCache.entries()) {
      if (time < hourAgo) {
        this.messageIdCache.delete(id);
      }
    }
  }

  private async storeClaimCheck(data: string, messageId?: string): Promise<string> {
    if (!this.blobClient) {
      throw new Error('Blob storage not configured for claim check pattern');
    }

    const containerClient = this.blobClient.getContainerClient(this.config.storageContainerName);
    await containerClient.createIfNotExists();

    const blobName = `${messageId || this.generateMessageId()}-${Date.now()}.json`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.upload(data, Buffer.byteLength(data), {
      blobHTTPHeaders: { blobContentType: 'application/json' }
    });

    return blockBlobClient.url;
  }

  private async retrieveClaimCheck(blobUrl: string): Promise<unknown> {
    if (!this.blobClient) {
      throw new Error('Blob storage not configured for claim check pattern');
    }

    const url = new URL(blobUrl);
    const pathParts = url.pathname.split('/');
    const containerName = pathParts[1];
    const blobName = pathParts.slice(2).join('/');

    const containerClient = this.blobClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);

    const downloadResponse = await blobClient.download();
    const downloaded = await this.streamToBuffer(downloadResponse.readableStreamBody!);

    return JSON.parse(downloaded.toString());
  }

  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  private calculateChecksum(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  private isPermanentError(error: unknown): boolean {
    if (error instanceof Error) {
      // Add patterns for permanent errors
      const permanentPatterns = [
        /invalid.*schema/i,
        /unauthorized/i,
        /forbidden/i,
        /not.*found/i,
        /bad.*request/i
      ];

      return permanentPatterns.some(pattern => pattern.test(error.message));
    }
    return false;
  }

  // Circuit breaker implementation

  private isCircuitOpen(): boolean {
    const now = Date.now();

    if (this.circuitBreakerState.isOpen) {
      // Check if timeout has passed
      if (now - this.circuitBreakerState.lastFailureTime > this.CIRCUIT_BREAKER_TIMEOUT_MS) {
        // Move to half-open state
        this.circuitBreakerState.isOpen = false;
        this.circuitBreakerState.halfOpenAttempts = 0;
        return false;
      }
      return true;
    }

    return false;
  }

  private recordSuccess(): void {
    this.circuitBreakerState.failures = 0;
    this.circuitBreakerState.halfOpenAttempts = 0;
  }

  private recordFailure(): void {
    this.circuitBreakerState.failures++;
    this.circuitBreakerState.lastFailureTime = Date.now();

    if (this.circuitBreakerState.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreakerState.isOpen = true;
      console.error('⚠️  Circuit breaker opened due to repeated failures');
    }
  }

  // Monitoring methods

  public getHealthStatus(): {
    isHealthy: boolean;
    circuitBreakerOpen: boolean;
    cachedMessages: number;
    recentFailures: number;
  } {
    return {
      isHealthy: !this.circuitBreakerState.isOpen && this.circuitBreakerState.failures < 3,
      circuitBreakerOpen: this.circuitBreakerState.isOpen,
      cachedMessages: this.messageIdCache.size,
      recentFailures: this.circuitBreakerState.failures
    };
  }
}