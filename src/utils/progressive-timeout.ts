/**
 * Progressive Timeout Strategy
 * Implements intelligent timeout handling with fast fallbacks and slower retries
 */

export interface TimeoutConfig {
  fast: number;
  normal: number;
  slow: number;
  enableFallback?: boolean;
}

export interface TimeoutResult<T> {
  result: T;
  timeoutLevel: 'fast' | 'normal' | 'slow' | 'fallback';
  executionTime: number;
}

export class ProgressiveTimeout {
  private config: TimeoutConfig;

  constructor(config: TimeoutConfig) {
    this.config = {
      enableFallback: true,
      ...config
    };
  }

  async execute<T>(
    fn: () => Promise<T>,
    fallbackFn?: () => T
  ): Promise<TimeoutResult<T>> {
    const startTime = Date.now();

    // Try fast timeout first
    try {
      const result = await this.executeWithTimeout(fn, this.config.fast);
      return {
        result,
        timeoutLevel: 'fast',
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      if (!this.isTimeoutError(error)) {
        throw error; // Non-timeout error, propagate immediately
      }
      console.log(`⏱️ Fast timeout (${this.config.fast}ms) exceeded, trying normal...`);
    }

    // Try normal timeout
    try {
      const result = await this.executeWithTimeout(fn, this.config.normal);
      return {
        result,
        timeoutLevel: 'normal',
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      if (!this.isTimeoutError(error)) {
        throw error;
      }
      console.log(`⏱️ Normal timeout (${this.config.normal}ms) exceeded, trying slow...`);
    }

    // Try slow timeout (last attempt)
    try {
      const result = await this.executeWithTimeout(fn, this.config.slow);
      return {
        result,
        timeoutLevel: 'slow',
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      if (!this.isTimeoutError(error)) {
        throw error;
      }
      console.log(`⏱️ Slow timeout (${this.config.slow}ms) exceeded`);

      // Use fallback if available and enabled
      if (this.config.enableFallback && fallbackFn) {
        console.log('🔄 Using fallback response...');
        const result = fallbackFn();
        return {
          result,
          timeoutLevel: 'fallback',
          executionTime: Date.now() - startTime
        };
      }

      throw new Error('All timeout attempts exhausted and no fallback available');
    }
  }

  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      )
    ]);
  }

  private isTimeoutError(error: any): boolean {
    return error?.message === 'Timeout' || error?.code === 'ETIMEDOUT';
  }
}

// Pre-configured timeout strategies for different agent types
export const researchTimeout = new ProgressiveTimeout({
  fast: 30000,    // 30s
  normal: 60000,  // 1m
  slow: 120000,   // 2m
  enableFallback: true
});

export const wafTimeout = new ProgressiveTimeout({
  fast: 60000,    // 1m
  normal: 120000, // 2m
  slow: 180000,   // 3m
  enableFallback: true
});

export const analysisTimeout = new ProgressiveTimeout({
  fast: 15000,    // 15s
  normal: 30000,  // 30s
  slow: 45000,    // 45s
  enableFallback: true
});