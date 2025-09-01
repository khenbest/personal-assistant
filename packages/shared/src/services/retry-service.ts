/**
 * Generic Retry Service with Exponential Backoff
 * Portable utility for retrying async operations with configurable backoff strategies
 * 
 * Features:
 * - Exponential backoff with jitter
 * - Custom retry conditions
 * - Multiple fallback operations
 * - TypeScript support
 * - Zero dependencies
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  exponentialBase?: number;
  jitter?: boolean;
  jitterFactor?: number;
  retryCondition?: (error: any, attempt: number) => boolean;
  onRetry?: (error: any, attempt: number, nextDelay: number) => void;
}

export interface RetryResult<T> {
  result?: T;
  error?: any;
  attempts: number;
  totalTime: number;
  success: boolean;
}

/**
 * Default retry condition for HTTP-like errors
 */
export const defaultRetryCondition = (error: any, _attempt: number): boolean => {
  // Don't retry if we've hit max attempts
  if (!error) return false;

  // Check for rate limit errors (429)
  if (error.status === 429 || error.statusCode === 429) {
    return true;
  }

  // Check for server errors (500+)
  if (error.status >= 500 || error.statusCode >= 500) {
    return true;
  }

  // Check for timeout errors
  if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
    return true;
  }

  // Check for specific error messages
  const message = error.message?.toLowerCase() || '';
  if (message.includes('rate limit') || 
      message.includes('too many requests') ||
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('429') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')) {
    return true;
  }

  // Don't retry client errors (400-499, except 429)
  if (error.status >= 400 && error.status < 500) {
    return false;
  }

  return false;
};

export class RetryService {
  /**
   * Execute a function with automatic retry logic
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      baseDelay = 1000,
      maxDelay = 30000,
      exponentialBase = 2,
      jitter = true,
      jitterFactor = 0.1,
      retryCondition = defaultRetryCondition,
      onRetry
    } = options;

    let lastError: any;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        lastError = error;

        // Check if we should retry
        const shouldRetry = retryCondition(error, attempt);

        if (!shouldRetry || attempt === maxAttempts) {
          throw error;
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(
          attempt,
          baseDelay,
          maxDelay,
          exponentialBase,
          jitter,
          jitterFactor
        );

        // Call onRetry callback if provided
        if (onRetry) {
          onRetry(error, attempt, delay);
        }

        // Wait before retrying
        await this.delay(delay);
      }
    }

    throw lastError;
  }

  /**
   * Execute multiple operations with retry, stopping on first success
   */
  static async executeWithFallback<T>(
    operations: Array<() => Promise<T>>,
    options: RetryOptions = {}
  ): Promise<T> {
    const errors: any[] = [];
    
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      
      if (!operation) {
        continue;
      }
      
      try {
        const result = await this.executeWithRetry(operation, {
          ...options,
          // Reduce attempts for later fallbacks
          maxAttempts: Math.max(1, (options.maxAttempts || 3) - i),
        });
        
        return result;
      } catch (error) {
        errors.push(error);
      }
    }

    // All operations failed - throw aggregate error
    const aggregateError = new Error(`All ${operations.length} operations failed`);
    (aggregateError as any).errors = errors;
    throw aggregateError;
  }

  /**
   * Create a retry wrapper for a specific operation
   */
  static createRetryWrapper<T extends any[], R>(
    operation: (...args: T) => Promise<R>,
    options: RetryOptions = {}
  ): (...args: T) => Promise<R> {
    return (...args: T) => {
      return this.executeWithRetry(
        () => operation(...args),
        options
      );
    };
  }

  /**
   * Execute with detailed result information
   */
  static async executeWithDetails<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let attempts = 0;
    
    try {
      const result = await this.executeWithRetry(operation, {
        ...options,
        onRetry: (error, attempt, delay) => {
          attempts = attempt;
          if (options.onRetry) {
            options.onRetry(error, attempt, delay);
          }
        }
      });
      
      return {
        result,
        attempts: attempts + 1,
        totalTime: Date.now() - startTime,
        success: true
      };
    } catch (error) {
      return {
        error,
        attempts: attempts + 1,
        totalTime: Date.now() - startTime,
        success: false
      };
    }
  }

  /**
   * Calculate delay with exponential backoff and optional jitter
   */
  private static calculateDelay(
    attempt: number,
    baseDelay: number,
    maxDelay: number,
    exponentialBase: number,
    jitter: boolean,
    jitterFactor: number
  ): number {
    // Exponential backoff: delay = baseDelay * (exponentialBase ^ (attempt - 1))
    let delay = baseDelay * Math.pow(exponentialBase, attempt - 1);

    // Apply maximum delay limit
    delay = Math.min(delay, maxDelay);

    // Apply jitter to avoid thundering herd
    if (jitter) {
      const jitterAmount = delay * jitterFactor;
      const randomJitter = (Math.random() - 0.5) * 2 * jitterAmount;
      delay += randomJitter;
    }

    return Math.max(100, Math.floor(delay)); // Minimum 100ms delay
  }

  /**
   * Simple delay promise
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Extract retry delay from error headers (for rate limiting)
   */
  static extractRetryAfter(error: any): number | null {
    // Check for Retry-After header
    const retryAfter = error.headers?.['retry-after'] || 
                       error.response?.headers?.['retry-after'] ||
                       error.retryAfter;
    
    if (retryAfter) {
      // If it's a number, treat as seconds
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        return seconds * 1000;
      }
      
      // If it's a date, calculate delay
      const retryDate = new Date(retryAfter);
      if (!isNaN(retryDate.getTime())) {
        return Math.max(0, retryDate.getTime() - Date.now());
      }
    }
    
    return null;
  }
}

/**
 * Convenience function for simple retry operations
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  return RetryService.executeWithRetry(operation, options);
}

/**
 * Convenience function for fallback operations
 */
export async function retryWithFallback<T>(
  operations: Array<() => Promise<T>>,
  options?: RetryOptions
): Promise<T> {
  return RetryService.executeWithFallback(operations, options);
}

/**
 * LLM-specific retry condition
 */
export const llmRetryCondition = (error: any, attempt: number): boolean => {
  // First check the default conditions
  if (defaultRetryCondition(error, attempt)) {
    return true;
  }

  // Check for LLM-specific error patterns
  const message = error.message?.toLowerCase() || '';
  
  // OpenAI/Anthropic rate limits
  if (message.includes('rate_limit_exceeded') ||
      message.includes('insufficient_quota') ||
      message.includes('token limit')) {
    return true;
  }

  // Model overloaded
  if (message.includes('overloaded') ||
      message.includes('capacity') ||
      message.includes('busy')) {
    return true;
  }

  // API errors that might be transient
  if (message.includes('api error') && error.status >= 500) {
    return true;
  }

  return false;
};

export default RetryService;