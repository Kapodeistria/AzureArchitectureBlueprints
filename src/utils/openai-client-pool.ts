/**
 * OpenAI Client Pool
 * Singleton client pool to reduce initialization overhead and manage connections efficiently
 */

import OpenAI from 'openai';
import config from '../config/config.js';

export interface ClientPoolConfig {
  maxClients?: number;
  reuseClients?: boolean;
  enableHealthCheck?: boolean;
}

export class OpenAIClientPool {
  private static instance: OpenAIClientPool;
  private client: OpenAI | null = null;
  private config: ClientPoolConfig;
  private initializationTime: number = 0;
  private requestCount: number = 0;
  private errorCount: number = 0;

  private constructor(poolConfig: ClientPoolConfig = {}) {
    this.config = {
      maxClients: 1, // Singleton pattern - one shared client
      reuseClients: true,
      enableHealthCheck: true,
      ...poolConfig
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(poolConfig?: ClientPoolConfig): OpenAIClientPool {
    if (!OpenAIClientPool.instance) {
      OpenAIClientPool.instance = new OpenAIClientPool(poolConfig);
    }
    return OpenAIClientPool.instance;
  }

  /**
   * Get or create OpenAI client
   */
  getClient(): OpenAI {
    if (this.client && this.config.reuseClients) {
      return this.client;
    }

    const startTime = Date.now();
    const azureConfig = config.getAzureConfig();

    if (!azureConfig.openai.apiKey) {
      throw new Error('AZURE_OPENAI_API_KEY is required');
    }

    this.client = new OpenAI({
      apiKey: azureConfig.openai.apiKey,
      baseURL: `${azureConfig.openai.endpoint}/openai/deployments/${azureConfig.foundry.modelDeploymentName}`,
      defaultQuery: { 'api-version': azureConfig.foundry.apiVersion },
      defaultHeaders: {
        'api-key': azureConfig.openai.apiKey,
      },
      timeout: 60000, // 60 second default timeout
      maxRetries: 2, // Built-in retry logic
    });

    this.initializationTime = Date.now() - startTime;
    console.log(`✅ OpenAI client initialized in ${this.initializationTime}ms`);

    return this.client;
  }

  /**
   * Execute a request with automatic client management
   */
  async executeRequest<T>(
    requestFn: (client: OpenAI) => Promise<T>
  ): Promise<T> {
    const client = this.getClient();
    this.requestCount++;

    try {
      const result = await requestFn(client);
      return result;
    } catch (error) {
      this.errorCount++;
      throw error;
    }
  }

  /**
   * Health check for the client pool
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    initializationTime: number;
    requestCount: number;
    errorCount: number;
    errorRate: number;
  }> {
    if (!this.config.enableHealthCheck) {
      return {
        healthy: true,
        initializationTime: this.initializationTime,
        requestCount: this.requestCount,
        errorCount: this.errorCount,
        errorRate: 0
      };
    }

    try {
      const client = this.getClient();
      // Simple health check - verify client is accessible
      const healthy = client !== null;

      const errorRate = this.requestCount > 0
        ? (this.errorCount / this.requestCount) * 100
        : 0;

      return {
        healthy,
        initializationTime: this.initializationTime,
        requestCount: this.requestCount,
        errorCount: this.errorCount,
        errorRate
      };
    } catch (error) {
      return {
        healthy: false,
        initializationTime: this.initializationTime,
        requestCount: this.requestCount,
        errorCount: this.errorCount,
        errorRate: 100
      };
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      initializationTime: this.initializationTime,
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      errorRate: this.requestCount > 0
        ? ((this.errorCount / this.requestCount) * 100).toFixed(2) + '%'
        : '0%',
      clientInitialized: this.client !== null
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.requestCount = 0;
    this.errorCount = 0;
  }

  /**
   * Force recreation of client (useful for config changes)
   */
  recreateClient(): OpenAI {
    this.client = null;
    return this.getClient();
  }
}

// Export singleton instance for global use
export const clientPool = OpenAIClientPool.getInstance();

// Convenience function for getting a client
export function getOpenAIClient(): OpenAI {
  return clientPool.getClient();
}