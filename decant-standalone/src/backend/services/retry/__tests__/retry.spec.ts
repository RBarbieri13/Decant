// ============================================================
// Retry Logic Tests
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  withRetry,
  isRetryableError,
  parseRetryAfterHeader,
  RetryPresets,
} from '../index.js';

describe('Retry Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await withRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValue('success');

      const result = await withRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffMultiplier: 2,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable error', async () => {
      const error = { status: 400 };
      const fn = vi.fn().mockRejectedValue(error);

      await expect(
        withRetry(fn, {
          maxAttempts: 3,
          initialDelayMs: 10,
          maxDelayMs: 100,
          backoffMultiplier: 2,
        })
      ).rejects.toEqual(error);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throw after max attempts', async () => {
      const error = { status: 503 };
      const fn = vi.fn().mockRejectedValue(error);

      await expect(
        withRetry(fn, {
          maxAttempts: 3,
          initialDelayMs: 10,
          maxDelayMs: 100,
          backoffMultiplier: 2,
        })
      ).rejects.toEqual(error);

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();
      const error = new Error('Service unavailable');
      (error as unknown as { status: number }).status = 503;

      const fn = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      await withRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffMultiplier: 2,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        error,
        1,
        expect.any(Number)
      );
    });

    it('should use exponential backoff', async () => {
      const delays: number[] = [];
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ status: 503 })
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValue('success');

      await withRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 100,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        enableJitter: false,
        onRetry: (_error, _attempt, delayMs) => {
          delays.push(delayMs);
        },
      });

      // First retry: 100ms, second retry: 200ms
      expect(delays[0]).toBe(100);
      expect(delays[1]).toBe(200);
    });

    it('should apply max delay cap', async () => {
      const delays: number[] = [];
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ status: 503 })
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValue('success');

      await withRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 1500,
        backoffMultiplier: 2,
        enableJitter: false,
        onRetry: (_error, _attempt, delayMs) => {
          delays.push(delayMs);
        },
      });

      // First retry: 1000ms, second retry: capped at 1500ms (not 2000ms)
      expect(delays[0]).toBe(1000);
      expect(delays[1]).toBe(1500);
    });

    it('should add jitter when enabled', async () => {
      const delays: number[] = [];
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ status: 503 })
        .mockRejectedValueOnce({ status: 503 })
        .mockResolvedValue('success');

      await withRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 100,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        enableJitter: true,
        jitterFactor: 0.3,
        onRetry: (_error, _attempt, delayMs) => {
          delays.push(delayMs);
        },
      });

      // With 30% jitter, delay should be between base and base * 1.3
      expect(delays[0]).toBeGreaterThanOrEqual(100);
      expect(delays[0]).toBeLessThanOrEqual(130);

      expect(delays[1]).toBeGreaterThanOrEqual(200);
      expect(delays[1]).toBeLessThanOrEqual(260);
    });

    it('should respect Retry-After header', async () => {
      const delays: number[] = [];
      const error = {
        status: 429,
        response: {
          headers: {
            'retry-after': '5', // 5 seconds
          },
        },
      };

      const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('success');

      await withRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 100,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        enableJitter: false,
        onRetry: (_error, _attempt, delayMs) => {
          delays.push(delayMs);
        },
      });

      // Should use Retry-After (5000ms) instead of calculated delay (100ms)
      expect(delays[0]).toBe(5000);
    });

    it('should retry on custom error patterns', async () => {
      const error = new Error('Custom timeout error');
      const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('success');

      const result = await withRetry(fn, {
        maxAttempts: 3,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffMultiplier: 2,
        retryableErrors: ['timeout'],
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable HTTP status codes', () => {
      expect(isRetryableError({ status: 408 })).toBe(true); // Timeout
      expect(isRetryableError({ status: 429 })).toBe(true); // Rate limit
      expect(isRetryableError({ status: 500 })).toBe(true); // Server error
      expect(isRetryableError({ status: 502 })).toBe(true); // Bad gateway
      expect(isRetryableError({ status: 503 })).toBe(true); // Service unavailable
      expect(isRetryableError({ status: 504 })).toBe(true); // Gateway timeout
    });

    it('should identify non-retryable HTTP status codes', () => {
      expect(isRetryableError({ status: 400 })).toBe(false); // Bad request
      expect(isRetryableError({ status: 401 })).toBe(false); // Unauthorized
      expect(isRetryableError({ status: 403 })).toBe(false); // Forbidden
      expect(isRetryableError({ status: 404 })).toBe(false); // Not found
      expect(isRetryableError({ status: 422 })).toBe(false); // Validation error
    });

    it('should identify retryable network errors', () => {
      expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
      expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
      expect(isRetryableError(new Error('ENOTFOUND'))).toBe(true);
      expect(isRetryableError(new Error('socket hang up'))).toBe(true);
    });

    it('should use custom retryable patterns', () => {
      const error = new Error('Custom retryable error');
      expect(isRetryableError(error, ['Custom'])).toBe(true);
      expect(isRetryableError(error, ['NotMatching'])).toBe(false);
    });
  });

  describe('parseRetryAfterHeader', () => {
    it('should parse seconds value', () => {
      expect(parseRetryAfterHeader('30')).toBe(30000);
      expect(parseRetryAfterHeader('60')).toBe(60000);
    });

    it('should parse HTTP date value', () => {
      const futureDate = new Date(Date.now() + 5000);
      const result = parseRetryAfterHeader(futureDate.toUTCString());
      expect(result).toBeGreaterThan(4000);
      expect(result).toBeLessThan(6000);
    });

    it('should return null for invalid values', () => {
      expect(parseRetryAfterHeader(null)).toBe(null);
      expect(parseRetryAfterHeader('invalid')).toBe(null);
      expect(parseRetryAfterHeader('')).toBe(null);
    });
  });

  describe('RetryPresets', () => {
    it('should have FAST preset', () => {
      expect(RetryPresets.FAST).toEqual({
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
      });
    });

    it('should have STANDARD preset', () => {
      expect(RetryPresets.STANDARD).toEqual({
        maxAttempts: 3,
        initialDelayMs: 30000,
        maxDelayMs: 120000,
        backoffMultiplier: 2,
      });
    });

    it('should have PATIENT preset', () => {
      expect(RetryPresets.PATIENT).toEqual({
        maxAttempts: 5,
        initialDelayMs: 60000,
        maxDelayMs: 300000,
        backoffMultiplier: 2,
      });
    });

    it('should have RATE_LIMIT preset', () => {
      expect(RetryPresets.RATE_LIMIT).toEqual({
        maxAttempts: 3,
        initialDelayMs: 60000,
        maxDelayMs: 300000,
        backoffMultiplier: 2,
        retryableErrors: ['429', 'Too Many Requests', 'Rate limit'],
      });
    });
  });
});
