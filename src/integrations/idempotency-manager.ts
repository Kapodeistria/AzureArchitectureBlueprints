/**
 * Idempotency Manager for Service Bus Message Processing
 * Prevents duplicate processing using distributed cache
 */

import { createClient, RedisClientType } from 'redis';
import { CosmosClient, Container } from '@azure/cosmos';
import { createHash } from 'crypto';

export interface IdempotencyConfig {
  provider: 'redis' | 'cosmos' | 'memory';
  connectionString?: string;
  ttlSeconds?: number;
  keyPrefix?: string;

  // Redis specific
  redisHost?: string;
  redisPort?: number;
  redisPassword?: string;
  redisDatabase?: number;

  // Cosmos DB specific
  cosmosEndpoint?: string;
  cosmosKey?: string;
  cosmosDatabase?: string;
  cosmosContainer?: string;
}

export interface ProcessingRecord {
  messageId: string;
  processingKey: string;
  timestamp: Date;
  status: 'processing' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  attempts?: number;
}

/**
 * Abstract base class for idempotency providers
 */
abstract class IdempotencyProvider {
  protected ttlSeconds: number;
  protected keyPrefix: string;

  constructor(config: IdempotencyConfig) {
    this.ttlSeconds = config.ttlSeconds || 3600; // 1 hour default
    this.keyPrefix = config.keyPrefix || 'idempotency';
  }

  abstract initialize(): Promise<void>;
  abstract checkAndSet(key: string, value: ProcessingRecord): Promise<boolean>;
  abstract get(key: string): Promise<ProcessingRecord | null>;
  abstract update(key: string, value: ProcessingRecord): Promise<void>;
  abstract delete(key: string): Promise<void>;
  abstract close(): Promise<void>;

  protected generateKey(messageId: string): string {
    return `${this.keyPrefix}:${messageId}`;
  }
}

/**
 * Redis-based idempotency provider for production use
 */
class RedisIdempotencyProvider extends IdempotencyProvider {
  private client: RedisClientType | null = null;

  constructor(private config: IdempotencyConfig) {
    super(config);
  }

  async initialize(): Promise<void> {
    const redisConfig = {
      socket: {
        host: this.config.redisHost || 'localhost',
        port: this.config.redisPort || 6379,
        reconnectStrategy: (attempts: number) => Math.min(attempts * 100, 3000)
      },
      password: this.config.redisPassword,
      database: this.config.redisDatabase || 0
    };

    if (this.config.connectionString) {
      this.client = createClient({ url: this.config.connectionString });
    } else {
      this.client = createClient(redisConfig);
    }

    this.client.on('error', (err) => {
      console.error('❌ Redis client error:', err);
    });

    this.client.on('ready', () => {
      console.log('✅ Redis client ready for idempotency checks');
    });

    await this.client.connect();
  }

  async checkAndSet(messageId: string, value: ProcessingRecord): Promise<boolean> {
    if (!this.client) throw new Error('Redis client not initialized');

    const key = this.generateKey(messageId);
    const serialized = JSON.stringify(value);

    // Use SET NX (set if not exists) with TTL
    const result = await this.client.set(key, serialized, {
      NX: true, // Only set if not exists
      EX: this.ttlSeconds
    });

    return result === 'OK';
  }

  async get(messageId: string): Promise<ProcessingRecord | null> {
    if (!this.client) throw new Error('Redis client not initialized');

    const key = this.generateKey(messageId);
    const value = await this.client.get(key);

    if (value) {
      return JSON.parse(value) as ProcessingRecord;
    }

    return null;
  }

  async update(messageId: string, value: ProcessingRecord): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');

    const key = this.generateKey(messageId);
    const serialized = JSON.stringify(value);

    await this.client.set(key, serialized, {
      EX: this.ttlSeconds
    });
  }

  async delete(messageId: string): Promise<void> {
    if (!this.client) throw new Error('Redis client not initialized');

    const key = this.generateKey(messageId);
    await this.client.del(key);
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
}

/**
 * Cosmos DB-based idempotency provider for global distribution
 */
class CosmosIdempotencyProvider extends IdempotencyProvider {
  private client: CosmosClient | null = null;
  private container: Container | null = null;

  constructor(private config: IdempotencyConfig) {
    super(config);
  }

  async initialize(): Promise<void> {
    if (this.config.connectionString) {
      this.client = new CosmosClient(this.config.connectionString);
    } else if (this.config.cosmosEndpoint && this.config.cosmosKey) {
      this.client = new CosmosClient({
        endpoint: this.config.cosmosEndpoint,
        key: this.config.cosmosKey
      });
    } else {
      throw new Error('Cosmos DB connection configuration missing');
    }

    const database = this.client.database(this.config.cosmosDatabase || 'idempotency');
    this.container = database.container(this.config.cosmosContainer || 'processing-records');

    // Ensure database and container exist
    await database.read();
    await this.container.read();

    console.log('✅ Cosmos DB initialized for idempotency checks');
  }

  async checkAndSet(messageId: string, value: ProcessingRecord): Promise<boolean> {
    if (!this.container) throw new Error('Cosmos container not initialized');

    try {
      const document = {
        id: messageId,
        ...value,
        ttl: this.ttlSeconds,
        _ts: Date.now()
      };

      await this.container.items.create(document);
      return true;
    } catch (error: any) {
      if (error.code === 409) {
        // Document already exists
        return false;
      }
      throw error;
    }
  }

  async get(messageId: string): Promise<ProcessingRecord | null> {
    if (!this.container) throw new Error('Cosmos container not initialized');

    try {
      const { resource } = await this.container.item(messageId, messageId).read();
      if (resource) {
        return resource as ProcessingRecord;
      }
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }

    return null;
  }

  async update(messageId: string, value: ProcessingRecord): Promise<void> {
    if (!this.container) throw new Error('Cosmos container not initialized');

    const document = {
      id: messageId,
      ...value,
      ttl: this.ttlSeconds,
      _ts: Date.now()
    };

    await this.container.item(messageId, messageId).replace(document);
  }

  async delete(messageId: string): Promise<void> {
    if (!this.container) throw new Error('Cosmos container not initialized');

    await this.container.item(messageId, messageId).delete();
  }

  async close(): Promise<void> {
    // Cosmos client doesn't need explicit closing
    this.client = null;
    this.container = null;
  }
}

/**
 * In-memory idempotency provider for development/testing
 */
class MemoryIdempotencyProvider extends IdempotencyProvider {
  private cache = new Map<string, { record: ProcessingRecord; expiry: number }>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  async initialize(): Promise<void> {
    // Start cleanup interval to remove expired entries
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (value.expiry < now) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Clean up every minute

    console.log('✅ Memory cache initialized for idempotency checks');
  }

  async checkAndSet(messageId: string, value: ProcessingRecord): Promise<boolean> {
    const key = this.generateKey(messageId);

    if (this.cache.has(key)) {
      const cached = this.cache.get(key)!;
      if (cached.expiry > Date.now()) {
        return false; // Already processing or processed
      }
    }

    const expiry = Date.now() + (this.ttlSeconds * 1000);
    this.cache.set(key, { record: value, expiry });
    return true;
  }

  async get(messageId: string): Promise<ProcessingRecord | null> {
    const key = this.generateKey(messageId);
    const cached = this.cache.get(key);

    if (cached && cached.expiry > Date.now()) {
      return cached.record;
    }

    return null;
  }

  async update(messageId: string, value: ProcessingRecord): Promise<void> {
    const key = this.generateKey(messageId);
    const expiry = Date.now() + (this.ttlSeconds * 1000);
    this.cache.set(key, { record: value, expiry });
  }

  async delete(messageId: string): Promise<void> {
    const key = this.generateKey(messageId);
    this.cache.delete(key);
  }

  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

/**
 * Main idempotency manager that coordinates duplicate detection
 */
export class IdempotencyManager {
  private provider: IdempotencyProvider;
  private metrics = {
    duplicatesDetected: 0,
    messagesProcessed: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  constructor(config: IdempotencyConfig) {
    switch (config.provider) {
      case 'redis':
        this.provider = new RedisIdempotencyProvider(config);
        break;
      case 'cosmos':
        this.provider = new CosmosIdempotencyProvider(config);
        break;
      case 'memory':
        this.provider = new MemoryIdempotencyProvider(config);
        break;
      default:
        throw new Error(`Unknown idempotency provider: ${config.provider}`);
    }
  }

  /**
   * Initialize the idempotency manager
   */
  async initialize(): Promise<void> {
    await this.provider.initialize();
    console.log('✅ Idempotency manager initialized');
  }

  /**
   * Check if a message is already being processed or has been processed
   */
  async isDuplicate(messageId: string): Promise<boolean> {
    const existing = await this.provider.get(messageId);

    if (existing) {
      this.metrics.duplicatesDetected++;
      this.metrics.cacheHits++;
      console.log(`⚠️  Duplicate detected: ${messageId} (status: ${existing.status})`);
      return true;
    }

    this.metrics.cacheMisses++;
    return false;
  }

  /**
   * Start processing a message (returns false if already processing)
   */
  async startProcessing(
    messageId: string,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    const record: ProcessingRecord = {
      messageId,
      processingKey: this.generateProcessingKey(messageId, metadata),
      timestamp: new Date(),
      status: 'processing',
      attempts: 1
    };

    const success = await this.provider.checkAndSet(messageId, record);

    if (success) {
      this.metrics.messagesProcessed++;
      console.log(`🎯 Started processing: ${messageId}`);
    } else {
      this.metrics.duplicatesDetected++;
      console.log(`⚠️  Already processing: ${messageId}`);
    }

    return success;
  }

  /**
   * Mark a message as successfully processed
   */
  async completeProcessing(
    messageId: string,
    result?: unknown
  ): Promise<void> {
    const existing = await this.provider.get(messageId);

    if (existing) {
      existing.status = 'completed';
      existing.result = result;
      await this.provider.update(messageId, existing);
      console.log(`✅ Completed processing: ${messageId}`);
    }
  }

  /**
   * Mark a message as failed
   */
  async failProcessing(
    messageId: string,
    error: string
  ): Promise<void> {
    const existing = await this.provider.get(messageId);

    if (existing) {
      existing.status = 'failed';
      existing.error = error;
      existing.attempts = (existing.attempts || 0) + 1;
      await this.provider.update(messageId, existing);
      console.log(`❌ Failed processing: ${messageId}`);
    }
  }

  /**
   * Get processing status for a message
   */
  async getStatus(messageId: string): Promise<ProcessingRecord | null> {
    return this.provider.get(messageId);
  }

  /**
   * Clear a message from the idempotency cache
   */
  async clear(messageId: string): Promise<void> {
    await this.provider.delete(messageId);
    console.log(`🗑️  Cleared idempotency record: ${messageId}`);
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics(): {
    duplicatesDetected: number;
    messagesProcessed: number;
    duplicateRate: number;
    cacheHitRate: number;
  } {
    const totalChecks = this.metrics.cacheHits + this.metrics.cacheMisses;
    return {
      duplicatesDetected: this.metrics.duplicatesDetected,
      messagesProcessed: this.metrics.messagesProcessed,
      duplicateRate: totalChecks > 0
        ? (this.metrics.duplicatesDetected / totalChecks) * 100
        : 0,
      cacheHitRate: totalChecks > 0
        ? (this.metrics.cacheHits / totalChecks) * 100
        : 0
    };
  }

  /**
   * Close the idempotency manager
   */
  async close(): Promise<void> {
    await this.provider.close();
    console.log('✅ Idempotency manager closed');
  }

  /**
   * Generate a unique processing key based on message content
   */
  private generateProcessingKey(messageId: string, metadata?: Record<string, unknown>): string {
    const content = JSON.stringify({ messageId, metadata });
    return createHash('sha256').update(content).digest('hex');
  }
}

/**
 * Create an idempotency manager with default configuration
 */
export function createIdempotencyManager(
  provider: 'redis' | 'cosmos' | 'memory' = 'memory'
): IdempotencyManager {
  const config: IdempotencyConfig = {
    provider,
    ttlSeconds: 3600, // 1 hour
    keyPrefix: 'agentflow'
  };

  // Add provider-specific configuration from environment
  if (provider === 'redis') {
    config.connectionString = process.env.REDIS_CONNECTION_STRING;
    config.redisHost = process.env.REDIS_HOST;
    config.redisPort = parseInt(process.env.REDIS_PORT || '6379');
    config.redisPassword = process.env.REDIS_PASSWORD;
  } else if (provider === 'cosmos') {
    config.connectionString = process.env.COSMOS_CONNECTION_STRING;
    config.cosmosEndpoint = process.env.COSMOS_ENDPOINT;
    config.cosmosKey = process.env.COSMOS_KEY;
    config.cosmosDatabase = process.env.COSMOS_DATABASE || 'idempotency';
    config.cosmosContainer = process.env.COSMOS_CONTAINER || 'processing-records';
  }

  return new IdempotencyManager(config);
}