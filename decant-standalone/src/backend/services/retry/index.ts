// ============================================================
// Retry Logic with Exponential Backoff
// Generic retry utility for external service calls
// ============================================================

import { log } from '../../logger/index.js';

/**
 * Options for retry behavior
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts (including initial attempt)
   */
  maxAttempts: number;

  /**
   * Initial delay in milliseconds before first retry
   */
  initialDelayMs: number;

  /**
   * Maximum delay in milliseconds between retries
   */
  maxDelayMs: number;

  /**
   * Multiplier for exponential backoff (e.g., 2 = double each time)
   */
  backoffMultiplier: number;

  /**
   * Optional list of error codes/messages that should trigger retry
   * If not specified, uses isRetryableError function
   */
  retryableErrors?: string[];

  /**
   * Callback function called before each retry
   */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;

  /**
   * Enable jitter to prevent thundering herd
   * @default true
   */
  enableJitter?: boolean;

  /**
   * Maximum jitter percentage (0-1)
   * @default 0.3 (30%)
   */
  jitterFactor?: number;

  /**
   * Context string for logging
   */
  context?: string;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 30000, // 30 seconds
  maxDelayMs: 120000, // 2 minutes
  backoffMultiplier: 2,
  retryableErrors: [],
  onRetry: () => {},
  enableJitter: true,
  jitterFactor: 0.3,
  context: 'retry',
};

/**
 * HTTP status codes that are retryable
 */
const RETRYABLE_HTTP_CODES = [
  408, // Request Timeout
  429, // Too Many Requests (Rate Limit)
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
];

/**
 * Network error patterns that are retryable
 */
const RETRYABLE_ERROR_PATTERNS = [
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /ECONNREFUSED/i,
  /EHOSTUNREACH/i,
  /ENETUNREACH/i,
  /socket hang up/i,
  /network timeout/i,
  /connection refused/i,
  /connection reset/i,
];

/**
 * Calculate exponential backoff delay with optional jitter
 */
function calculateBackoffDelay(
  attempt: number,
  options: Required<RetryOptions>
): number {
  // Calculate base exponential delay
  const exponentialDelay =
    options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt);

  // Apply max delay cap
  const cappedDelay = Math.min(exponentialDelay, options.maxDelayMs);

  // Add jitter if enabled
  if (options.enableJitter) {
    const jitterRange = cappedDelay * options.jitterFactor;
    const jitter = Math.random() * jitterRange;
    return cappedDelay + jitter;
  }

  return cappedDelay;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse Retry-After header value
 * Returns delay in milliseconds or null if not present/invalid
 */
export function parseRetryAfterHeader(
  retryAfterValue: string | null
): number | null {
  if (!retryAfterValue) {
    return null;
  }

  // Try parsing as seconds (integer)
  const seconds = parseInt(retryAfterValue, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000; // Convert to milliseconds
  }

  // Try parsing as HTTP date
  const retryDate = new Date(retryAfterValue);
  if (!isNaN(retryDate.getTime())) {
    const delayMs = retryDate.getTime() - Date.now();
    return Math.max(0, delayMs);
  }

  return null;
}

/**
 * Check if an error is retryable based on error type and message
 */
export function isRetryableError(
  error: unknown,
  retryableErrors?: string[]
): boolean {
  if (!error) {
    return false;
  }

  // Check custom retryable error codes/messages
  if (retryableErrors && retryableErrors.length > 0) {
    const errorStr = String(error);
    if (retryableErrors.some((pattern) => errorStr.includes(pattern))) {
      return true;
    }
  }

  // Check for HTTP status codes
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;

    // Check status code
    const status = errorObj.status ?? errorObj.statusCode;
    if (typeof status === 'number' && RETRYABLE_HTTP_CODES.includes(status)) {
      return true;
    }

    // Check error code
    const code = errorObj.code;
    if (typeof code === 'string') {
      // Check network error codes
      if (RETRYABLE_ERROR_PATTERNS.some((pattern) => pattern.test(code))) {
        return true;
      }
    }
  }

  // Check error message
  if (error instanceof Error) {
    const message = error.message;
    if (RETRYABLE_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
      return true;
    }
  }

  return false;
}

/**
 * Extract Retry-After header from error if available
 */
function getRetryAfterFromError(error: unknown): number | null {
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;

    // Check for response object with headers
    if (
      errorObj.response &&
      typeof errorObj.response === 'object' &&
      errorObj.response !== null
    ) {
      const response = errorObj.response as Record<string, unknown>;
      if (
        response.headers &&
        typeof response.headers === 'object' &&
        response.headers !== null
      ) {
        const headers = response.headers as Record<string, string>;
        const retryAfter = headers['retry-after'] ?? headers['Retry-After'];
        return parseRetryAfterHeader(retryAfter);
      }
    }
  }

  return null;
}

/**
 * Execute a function with retry logic
 *
 * @param fn - Async function to execute
 * @param options - Retry options
 * @returns Result of the function execution
 * @throws Last error if all retries are exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts: Required<RetryOptions> = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  let lastError: unknown;
  const startTime = Date.now();

  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      // Execute the function
      const result = await fn();

      // Log success if we had to retry
      if (attempt > 0) {
        log.info('Retry succeeded', {
          context: opts.context,
          attempt: attempt + 1,
          totalAttempts: opts.maxAttempts,
          durationMs: Date.now() - startTime,
          module: 'retry',
        });
      }

      return result;
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (!isRetryableError(error, opts.retryableErrors)) {
        log.debug('Error is not retryable, throwing immediately', {
          context: opts.context,
          error: error instanceof Error ? error.message : String(error),
          module: 'retry',
        });
        throw error;
      }

      // Don't retry after the last attempt
      if (attempt >= opts.maxAttempts - 1) {
        break;
      }

      // Calculate delay for next retry
      let delayMs = calculateBackoffDelay(attempt, opts);

      // Check for Retry-After header
      const retryAfterMs = getRetryAfterFromError(error);
      if (retryAfterMs !== null) {
        // Use the longer of the two delays
        delayMs = Math.max(delayMs, retryAfterMs);

        log.debug('Using Retry-After header', {
          context: opts.context,
          retryAfterMs,
          calculatedDelayMs: delayMs,
          module: 'retry',
        });
      }

      // Call onRetry callback
      if (error instanceof Error) {
        opts.onRetry(error, attempt + 1, delayMs);
      }

      // Log retry attempt
      log.warn('Retrying after error', {
        context: opts.context,
        attempt: attempt + 1,
        maxAttempts: opts.maxAttempts,
        delayMs: Math.round(delayMs),
        error: error instanceof Error ? error.message : String(error),
        module: 'retry',
      });

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  // All retries exhausted
  log.error('All retry attempts exhausted', {
    context: opts.context,
    attempts: opts.maxAttempts,
    totalDurationMs: Date.now() - startTime,
    lastError: lastError instanceof Error ? lastError.message : String(lastError),
    module: 'retry',
  });

  throw lastError;
}

/**
 * Preset retry configurations for common scenarios
 */
export const RetryPresets = {
  /**
   * Quick retry for fast services (3 attempts, 1s -> 2s -> 4s)
   */
  FAST: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  } as Partial<RetryOptions>,

  /**
   * Standard retry for most services (3 attempts, 30s -> 60s -> 120s)
   */
  STANDARD: {
    maxAttempts: 3,
    initialDelayMs: 30000,
    maxDelayMs: 120000,
    backoffMultiplier: 2,
  } as Partial<RetryOptions>,

  /**
   * Patient retry for slow/unreliable services (5 attempts, 60s -> 120s -> ...)
   */
  PATIENT: {
    maxAttempts: 5,
    initialDelayMs: 60000,
    maxDelayMs: 300000,
    backoffMultiplier: 2,
  } as Partial<RetryOptions>,

  /**
   * Rate limit specific retry (respects 429 errors, longer delays)
   */
  RATE_LIMIT: {
    maxAttempts: 3,
    initialDelayMs: 60000,
    maxDelayMs: 300000,
    backoffMultiplier: 2,
    retryableErrors: ['429', 'Too Many Requests', 'Rate limit'],
  } as Partial<RetryOptions>,
};
