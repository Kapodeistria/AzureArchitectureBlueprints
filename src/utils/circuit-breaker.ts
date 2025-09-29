/**
 * Circuit Breaker Pattern
 * Prevents cascading failures by stopping requests to failing services
 */

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening circuit
  successThreshold: number; // Number of successes to close circuit
  timeout: number; // Time to wait before attempting reset (ms)
  monitoringWindow: number; // Time window for failure tracking (ms)
}

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Blocking requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export interface CircuitStats {
  state: CircuitState;
  failures: number;
  successes: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  nextAttemptTime?: number;
}

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private consecutiveFailures: number = 0;
  private consecutiveSuccesses: number = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private nextAttemptTime?: number;
  private failureTimestamps: number[] = [];

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      successThreshold: config.successThreshold || 2,
      timeout: config.timeout || 60000, // 1 minute default
      monitoringWindow: config.monitoringWindow || 120000 // 2 minutes default
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        console.log('🔄 Circuit breaker: Attempting reset (HALF_OPEN)');
        this.state = CircuitState.HALF_OPEN;
      } else {
        const waitTime = this.nextAttemptTime ? this.nextAttemptTime - Date.now() : 0;
        throw new Error(
          `Circuit breaker is OPEN. Service unavailable. Retry in ${Math.ceil(waitTime / 1000)}s`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Record successful execution
   */
  private onSuccess(): void {
    this.successes++;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;
    this.lastSuccessTime = Date.now();

    // If in HALF_OPEN state, check if we can close the circuit
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        console.log('✅ Circuit breaker: Service recovered (CLOSED)');
        this.state = CircuitState.CLOSED;
        this.consecutiveFailures = 0;
        this.failureTimestamps = [];
      }
    }
  }

  /**
   * Record failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    const now = Date.now();
    this.lastFailureTime = now;
    this.failureTimestamps.push(now);

    // Clean up old failure timestamps outside monitoring window
    this.failureTimestamps = this.failureTimestamps.filter(
      timestamp => now - timestamp < this.config.monitoringWindow
    );

    // Check if we should open the circuit
    if (
      this.state === CircuitState.CLOSED &&
      this.failureTimestamps.length >= this.config.failureThreshold
    ) {
      this.openCircuit();
    } else if (this.state === CircuitState.HALF_OPEN) {
      // Failed during half-open, go back to open
      console.log('❌ Circuit breaker: Service still failing (OPEN)');
      this.openCircuit();
    }
  }

  /**
   * Open the circuit
   */
  private openCircuit(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = Date.now() + this.config.timeout;
    console.warn(
      `⚠️  Circuit breaker OPENED after ${this.consecutiveFailures} consecutive failures. ` +
      `Next attempt in ${this.config.timeout / 1000}s`
    );
  }

  /**
   * Check if enough time has passed to attempt reset
   */
  private shouldAttemptReset(): boolean {
    return (
      this.nextAttemptTime !== undefined &&
      Date.now() >= this.nextAttemptTime
    );
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.failureTimestamps = [];
    this.nextAttemptTime = undefined;
    console.log('🔄 Circuit breaker manually reset');
  }

  /**
   * Check if circuit is allowing requests
   */
  isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  /**
   * Get failure rate within monitoring window
   */
  getFailureRate(): number {
    const totalAttempts = this.failures + this.successes;
    if (totalAttempts === 0) return 0;
    return (this.failures / totalAttempts) * 100;
  }
}

// Pre-configured circuit breakers for different agent types
export const researchCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 60000, // 1 min
  monitoringWindow: 180000 // 3 min
});

export const wafCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 90000, // 1.5 min
  monitoringWindow: 240000 // 4 min
});

export const apiCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000, // 30s
  monitoringWindow: 120000 // 2 min
});