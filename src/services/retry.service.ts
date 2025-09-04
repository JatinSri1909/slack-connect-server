import { AxiosError } from 'axios';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryCondition?: (error: AxiosError) => boolean;
}

export class RetryService {
  private static readonly DEFAULT_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffMultiplier: 2,
    retryCondition: (error: AxiosError) => {
      // Retry on network errors, timeouts, and 5xx errors
      return (
        !error.response ||
        error.code === 'ECONNABORTED' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNRESET' ||
        (error.response.status >= 500 && error.response.status < 600)
      );
    },
  };

  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    let lastError: Error;

    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry if it's the last attempt
        if (attempt === finalConfig.maxRetries) {
          break;
        }

        // Check if we should retry this error
        if (error instanceof AxiosError && finalConfig.retryCondition) {
          if (!finalConfig.retryCondition(error)) {
            break;
          }
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          finalConfig.baseDelay * Math.pow(finalConfig.backoffMultiplier, attempt),
          finalConfig.maxDelay
        );

        console.log(
          `Attempt ${attempt + 1} failed, retrying in ${delay}ms...`,
          error instanceof AxiosError ? error.message : error
        );

        await this.delay(delay);
      }
    }

    throw lastError!;
  }

  static async executeApiCallWithRetry<T>(
    apiCall: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    return this.executeWithRetry(apiCall, {
      ...config,
      retryCondition: (error: AxiosError) => {
        // Retry on network errors, timeouts, 5xx errors, and rate limits
        return (
          !error.response ||
          error.code === 'ECONNABORTED' ||
          error.code === 'ENOTFOUND' ||
          error.code === 'ECONNRESET' ||
          error.response.status === 429 || // Rate limited
          (error.response.status >= 500 && error.response.status < 600)
        );
      },
    });
  }

  static async executeDatabaseOperationWithRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    return this.executeWithRetry(operation, {
      ...config,
      maxRetries: 2, // Fewer retries for database operations
      baseDelay: 500, // Shorter delay for database operations
      retryCondition: (error: any) => {
        // Retry on database lock errors and connection issues
        return (
          error.code === 'SQLITE_BUSY' ||
          error.code === 'SQLITE_LOCKED' ||
          error.message?.includes('database is locked')
        );
      },
    });
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static isRateLimited(error: AxiosError): boolean {
    return error.response?.status === 429;
  }

  static getRetryAfterDelay(error: AxiosError): number {
    const retryAfter = error.response?.headers['retry-after'];
    if (retryAfter) {
      return parseInt(retryAfter) * 1000; // Convert to milliseconds
    }
    return 0;
  }
}
