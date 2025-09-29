/**
 * Structured Error Handler
 * Preserves context and provides better debugging information
 */

export interface ErrorContext {
  agentName?: string;
  taskId?: string;
  taskType?: string;
  timestamp: number;
  phase?: string;
  additionalData?: Record<string, any>;
}

export interface StructuredError extends Error {
  context: ErrorContext;
  originalError?: Error;
  code?: string;
  statusCode?: number;
}

export class ErrorHandler {
  /**
   * Wrap an error with context information
   */
  static wrapError(
    error: Error | any,
    context: Partial<ErrorContext>,
    message?: string
  ): StructuredError {
    const structuredError: StructuredError = new Error(
      message || error?.message || 'Unknown error'
    ) as StructuredError;

    structuredError.context = {
      timestamp: Date.now(),
      ...context
    };

    structuredError.originalError = error instanceof Error ? error : undefined;
    structuredError.name = 'StructuredError';

    // Preserve error codes if available
    if (error?.code) {
      structuredError.code = error.code;
    }
    if (error?.status || error?.statusCode) {
      structuredError.statusCode = error.status || error.statusCode;
    }

    // Preserve stack trace
    if (error?.stack) {
      structuredError.stack = error.stack;
    }

    return structuredError;
  }

  /**
   * Handle and log error with full context
   */
  static handle(error: Error | StructuredError, fallbackContext?: Partial<ErrorContext>): void {
    const isStructured = this.isStructuredError(error);

    if (isStructured) {
      this.logStructuredError(error as StructuredError);
    } else {
      const wrapped = this.wrapError(error, fallbackContext || {});
      this.logStructuredError(wrapped);
    }
  }

  /**
   * Log structured error with full context
   */
  private static logStructuredError(error: StructuredError): void {
    const context = error.context;

    console.error('\n❌ STRUCTURED ERROR:');
    console.error(`Message: ${error.message}`);
    console.error(`Time: ${new Date(context.timestamp).toISOString()}`);

    if (context.agentName) {
      console.error(`Agent: ${context.agentName}`);
    }
    if (context.taskId) {
      console.error(`Task ID: ${context.taskId}`);
    }
    if (context.taskType) {
      console.error(`Task Type: ${context.taskType}`);
    }
    if (context.phase) {
      console.error(`Phase: ${context.phase}`);
    }
    if (error.code) {
      console.error(`Error Code: ${error.code}`);
    }
    if (error.statusCode) {
      console.error(`Status Code: ${error.statusCode}`);
    }

    if (context.additionalData) {
      console.error('Additional Data:', JSON.stringify(context.additionalData, null, 2));
    }

    if (error.originalError) {
      console.error('Original Error:', error.originalError.message);
    }

    if (error.stack) {
      console.error('Stack Trace:', error.stack);
    }

    console.error(''); // Empty line for readability
  }

  /**
   * Check if error is structured
   */
  static isStructuredError(error: any): error is StructuredError {
    return error && typeof error === 'object' && 'context' in error;
  }

  /**
   * Create error from agent operation
   */
  static agentError(
    error: Error | any,
    agentName: string,
    taskType: string,
    taskId?: string,
    additionalData?: Record<string, any>
  ): StructuredError {
    return this.wrapError(error, {
      agentName,
      taskType,
      taskId,
      additionalData
    });
  }

  /**
   * Create error from API operation
   */
  static apiError(
    error: Error | any,
    endpoint: string,
    method?: string,
    additionalData?: Record<string, any>
  ): StructuredError {
    return this.wrapError(error, {
      phase: 'api-call',
      additionalData: {
        endpoint,
        method: method || 'unknown',
        ...additionalData
      }
    });
  }

  /**
   * Create timeout error
   */
  static timeoutError(
    operation: string,
    timeoutMs: number,
    context: Partial<ErrorContext> = {}
  ): StructuredError {
    return this.wrapError(
      new Error(`Operation timed out after ${timeoutMs}ms`),
      {
        ...context,
        phase: 'timeout',
        additionalData: {
          operation,
          timeoutMs,
          ...context.additionalData
        }
      },
      `Timeout: ${operation}`
    );
  }

  /**
   * Convert error to user-friendly message
   */
  static toUserMessage(error: Error | StructuredError): string {
    if (this.isStructuredError(error)) {
      const ctx = error.context;
      let message = `Error in ${ctx.agentName || 'operation'}`;

      if (ctx.taskType) {
        message += ` (${ctx.taskType})`;
      }

      message += `: ${error.message}`;

      return message;
    }

    return error.message || 'An unknown error occurred';
  }

  /**
   * Extract actionable information from error
   */
  static getActionableInfo(error: Error | StructuredError): {
    isRetryable: boolean;
    suggestedAction: string;
    category: 'network' | 'api' | 'timeout' | 'validation' | 'unknown';
  } {
    const message = error.message.toLowerCase();
    const code = (error as any).code;
    const statusCode = (error as any).statusCode;

    // Determine if retryable
    const isRetryable =
      statusCode === 429 || // Rate limit
      statusCode === 503 || // Service unavailable
      code === 'ECONNRESET' ||
      code === 'ETIMEDOUT' ||
      message.includes('timeout') ||
      message.includes('rate limit');

    // Determine category
    let category: 'network' | 'api' | 'timeout' | 'validation' | 'unknown' = 'unknown';
    if (message.includes('timeout') || code === 'ETIMEDOUT') {
      category = 'timeout';
    } else if (statusCode || message.includes('api')) {
      category = 'api';
    } else if (code?.startsWith('E') || message.includes('network')) {
      category = 'network';
    } else if (message.includes('invalid') || message.includes('validation')) {
      category = 'validation';
    }

    // Suggested actions
    let suggestedAction = 'Check logs for details';
    if (isRetryable) {
      suggestedAction = 'Retry the operation after a brief wait';
    } else if (category === 'validation') {
      suggestedAction = 'Check input parameters and configuration';
    } else if (category === 'network') {
      suggestedAction = 'Verify network connectivity and try again';
    } else if (statusCode === 401 || statusCode === 403) {
      suggestedAction = 'Verify API credentials and permissions';
    }

    return {
      isRetryable,
      suggestedAction,
      category
    };
  }
}

// Export convenience functions
export const wrapError = ErrorHandler.wrapError.bind(ErrorHandler);
export const handleError = ErrorHandler.handle.bind(ErrorHandler);
export const agentError = ErrorHandler.agentError.bind(ErrorHandler);
export const apiError = ErrorHandler.apiError.bind(ErrorHandler);
export const timeoutError = ErrorHandler.timeoutError.bind(ErrorHandler);