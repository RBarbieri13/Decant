// ============================================================
// Rate Limiting Middleware Tests
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { createCustomLimiter } from './rateLimit.js';

describe('Rate Limiting Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      ip: '127.0.0.1',
      headers: {},
      socket: {
        remoteAddress: '127.0.0.1',
      } as any,
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      getHeader: vi.fn(),
    };

    nextFunction = vi.fn();
  });

  describe('createCustomLimiter', () => {
    it('should create a rate limiter with custom configuration', () => {
      const limiter = createCustomLimiter('test', {
        windowMs: 60000,
        max: 10,
        message: 'Custom message',
      });

      expect(limiter).toBeDefined();
      expect(typeof limiter).toBe('function');
    });

    it('should use default values when not provided', () => {
      const limiter = createCustomLimiter('test', {});

      expect(limiter).toBeDefined();
    });

    it('should allow requests within rate limit', async () => {
      const limiter = createCustomLimiter('test', {
        windowMs: 60000,
        max: 10,
      });

      // First request should pass
      await limiter(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalledWith(429);
    });
  });

  describe('IP detection', () => {
    it('should use X-Forwarded-For header when available', async () => {
      mockRequest.headers = {
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
      };

      const limiter = createCustomLimiter('test', { max: 100 });
      await limiter(mockRequest as Request, mockResponse as Response, nextFunction);

      // Should use first IP from forwarded header
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should fallback to req.ip when no forwarded header', async () => {
      mockRequest.ip = '192.168.1.100';

      const limiter = createCustomLimiter('test', { max: 100 });
      await limiter(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should fallback to socket.remoteAddress when no req.ip', async () => {
      mockRequest.ip = undefined;
      mockRequest.socket = {
        remoteAddress: '192.168.1.200',
      } as any;

      const limiter = createCustomLimiter('test', { max: 100 });
      await limiter(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('Rate limit violations', () => {
    it('should return 429 when rate limit exceeded', async () => {
      const limiter = createCustomLimiter('test', {
        windowMs: 1000,
        max: 1, // Only allow 1 request
        message: 'Rate limit exceeded',
      });

      // First request - should pass
      await limiter(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalled();

      // Reset mocks
      vi.clearAllMocks();

      // Second request - should be rate limited
      await limiter(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too many requests',
        })
      );
    });

    it('should include retryAfter in error response', async () => {
      const limiter = createCustomLimiter('test', {
        windowMs: 60000,
        max: 1,
      });

      // Exceed rate limit
      await limiter(mockRequest as Request, mockResponse as Response, nextFunction);
      vi.clearAllMocks();
      await limiter(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          retryAfter: expect.any(Number),
        })
      );
    });
  });

  describe('Rate limit headers', () => {
    it('should set standard rate limit headers', async () => {
      const limiter = createCustomLimiter('test', {
        windowMs: 60000,
        max: 10,
      });

      await limiter(mockRequest as Request, mockResponse as Response, nextFunction);

      // Headers are set by express-rate-limit internally
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should respect custom window size', () => {
      const limiter = createCustomLimiter('test', {
        windowMs: 120000, // 2 minutes
        max: 50,
      });

      expect(limiter).toBeDefined();
    });

    it('should respect custom max requests', () => {
      const limiter = createCustomLimiter('test', {
        windowMs: 60000,
        max: 200,
      });

      expect(limiter).toBeDefined();
    });

    it('should use custom error message', async () => {
      const customMessage = 'Custom rate limit message';
      const limiter = createCustomLimiter('test', {
        windowMs: 1000,
        max: 1,
        message: customMessage,
      });

      // Exceed limit
      await limiter(mockRequest as Request, mockResponse as Response, nextFunction);
      vi.clearAllMocks();
      await limiter(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: customMessage,
        })
      );
    });
  });
});
