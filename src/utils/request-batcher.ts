/**
 * Request Batcher
 * Batches compatible OpenAI requests to reduce API calls and improve throughput
 */

import OpenAI from 'openai';

export interface BatchRequest {
  id: string;
  messages: any[];
  options: any;
  resolve: (result: any) => void;
  reject: (error: any) => void;
}

export interface BatcherConfig {
  maxBatchSize: number;
  maxWaitTime: number; // milliseconds
  enableBatching: boolean;
}

export class RequestBatcher {
  private config: BatcherConfig;
  private queue: BatchRequest[] = [];
  private batchTimer?: NodeJS.Timeout;
  private client: OpenAI;

  constructor(client: OpenAI, config: Partial<BatcherConfig> = {}) {
    this.client = client;
    this.config = {
      maxBatchSize: config.maxBatchSize || 5,
      maxWaitTime: config.maxWaitTime || 100, // 100ms default
      enableBatching: config.enableBatching ?? true
    };
  }

  /**
   * Add request to batch queue
   */
  async batchRequest(messages: any[], options: any = {}): Promise<any> {
    if (!this.config.enableBatching) {
      // Batching disabled, execute immediately
      return this.executeSingle(messages, options);
    }

    return new Promise((resolve, reject) => {
      const request: BatchRequest = {
        id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        messages,
        options,
        resolve,
        reject
      };

      this.queue.push(request);

      // If batch is full, process immediately
      if (this.queue.length >= this.config.maxBatchSize) {
        this.processBatch();
      } else {
        // Otherwise, set timer if not already set
        if (!this.batchTimer) {
          this.batchTimer = setTimeout(() => {
            this.processBatch();
          }, this.config.maxWaitTime);
        }
      }
    });
  }

  /**
   * Process queued batch requests
   */
  private async processBatch(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    if (this.queue.length === 0) {
      return;
    }

    const batch = this.queue.splice(0, this.config.maxBatchSize);
    console.log(`🔄 Processing batch of ${batch.length} requests`);

    // Check if requests are compatible for true batching
    const canBatch = this.canBatchRequests(batch);

    if (canBatch) {
      await this.executeBatched(batch);
    } else {
      // Execute in parallel instead
      await this.executeParallel(batch);
    }
  }

  /**
   * Check if requests can be batched together
   */
  private canBatchRequests(batch: BatchRequest[]): boolean {
    if (batch.length <= 1) return false;

    // Check if all requests have similar options
    const firstOptions = batch[0].options;
    return batch.every(req => {
      return (
        req.options.temperature === firstOptions.temperature &&
        req.options.maxTokens === firstOptions.maxTokens &&
        req.options.model === firstOptions.model
      );
    });
  }

  /**
   * Execute requests as a true batch (if API supports it)
   * Note: OpenAI doesn't support true batching for chat completions yet,
   * but this provides infrastructure for when it does
   */
  private async executeBatched(batch: BatchRequest[]): Promise<void> {
    // Currently, OpenAI chat completions don't support true batching
    // Fall back to parallel execution
    await this.executeParallel(batch);
  }

  /**
   * Execute requests in parallel
   */
  private async executeParallel(batch: BatchRequest[]): Promise<void> {
    const startTime = Date.now();

    const promises = batch.map(async (request) => {
      try {
        const result = await this.executeSingle(request.messages, request.options);
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }
    });

    await Promise.allSettled(promises);

    const executionTime = Date.now() - startTime;
    console.log(`✅ Batch completed in ${executionTime}ms (${batch.length} requests)`);
  }

  /**
   * Execute a single request
   */
  private async executeSingle(messages: any[], options: any): Promise<any> {
    return this.client.chat.completions.create({
      messages,
      ...options
    });
  }

  /**
   * Flush any pending requests
   */
  async flush(): Promise<void> {
    if (this.queue.length > 0) {
      await this.processBatch();
    }
  }

  /**
   * Get batcher statistics
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      maxBatchSize: this.config.maxBatchSize,
      maxWaitTime: this.config.maxWaitTime,
      batchingEnabled: this.config.enableBatching
    };
  }
}

/**
 * Optimized OpenAI call with request batching
 */
export async function batchedOpenAICall(
  client: OpenAI,
  messages: any[],
  options: any = {},
  batcher?: RequestBatcher
): Promise<any> {
  if (batcher) {
    return batcher.batchRequest(messages, options);
  }

  // No batcher, execute directly
  return client.chat.completions.create({
    messages,
    ...options
  });
}