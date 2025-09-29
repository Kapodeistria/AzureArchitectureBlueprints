/**
 * Concurrency Limiter Utility
 * Controls parallel execution to prevent API throttling and resource exhaustion
 */

export interface ConcurrencyConfig {
  maxConcurrent: number;
  queueTimeout?: number;
  retryOnThrottle?: boolean;
}

export class ConcurrencyLimiter {
  private maxConcurrent: number;
  private running: number = 0;
  private queue: Array<() => void> = [];
  private queueTimeout: number;
  private retryOnThrottle: boolean;

  constructor(config: ConcurrencyConfig) {
    this.maxConcurrent = config.maxConcurrent;
    this.queueTimeout = config.queueTimeout || 30000;
    this.retryOnThrottle = config.retryOnThrottle ?? true;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Wait for slot to be available
    await this.acquireSlot();

    try {
      const result = await fn();
      return result;
    } catch (error) {
      // Handle throttling errors
      if (this.isThrottleError(error) && this.retryOnThrottle) {
        console.warn('⚠️ Rate limit hit, waiting before retry...');
        await this.delay(2000);
        return this.execute(fn); // Retry once
      }
      throw error;
    } finally {
      this.releaseSlot();
    }
  }

  private async acquireSlot(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return;
    }

    // Wait in queue
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.queue.indexOf(resolve);
        if (index > -1) {
          this.queue.splice(index, 1);
        }
        reject(new Error('Concurrency queue timeout'));
      }, this.queueTimeout);

      const wrappedResolve = () => {
        clearTimeout(timeout);
        resolve();
      };

      this.queue.push(wrappedResolve);
    });
  }

  private releaseSlot(): void {
    this.running--;

    // Process next in queue
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        this.running++;
        next();
      }
    }
  }

  private isThrottleError(error: any): boolean {
    return (
      error?.status === 429 ||
      error?.code === 'rate_limit_exceeded' ||
      error?.message?.includes('rate limit')
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent
    };
  }
}

// Global limiters for different agent types
export const researchLimiter = new ConcurrencyLimiter({
  maxConcurrent: 3, // Limit research agents to 3 concurrent
  queueTimeout: 60000
});

export const wafLimiter = new ConcurrencyLimiter({
  maxConcurrent: 3, // Limit WAF agents to 3 concurrent
  queueTimeout: 90000
});

export const analysisLimiter = new ConcurrencyLimiter({
  maxConcurrent: 5, // General analysis agents
  queueTimeout: 45000
});