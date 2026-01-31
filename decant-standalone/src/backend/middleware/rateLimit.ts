// ============================================================
// Rate Limiting Middleware
// ============================================================

import rateLimit, { Options } from 'express-rate-limit';
import { RequestHandler } from 'express';
import { log } from '../logger/index.js';

// Environment configuration with defaults
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
const RATE_LIMIT_IMPORT_MAX = parseInt(process.env.RATE_LIMIT_IMPORT_MAX || '10', 10);
const RATE_LIMIT_SETTINGS_MAX = parseInt(process.env.RATE_LIMIT_SETTINGS_MAX || '5', 10);

// Track recent violations to avoid log spam
const recentViolations = new Map<string, number>();
const VIOLATION_LOG_COOLDOWN_MS = 60000; // Only log once per minute per IP

/**
 * Log rate limit violations without spamming
 */
function logViolation(ip: string, limiterName: string): void {
  const key = `${ip}-${limiterName}`;
  const now = Date.now();
  const lastLogged = recentViolations.get(key);

  if (!lastLogged || now - lastLogged > VIOLATION_LOG_COOLDOWN_MS) {
    log.warn(`Rate limit exceeded`, { limiter: limiterName, ip, module: 'rateLimit' });
    recentViolations.set(key, now);
  }

  // Clean up old entries periodically
  if (recentViolations.size > 1000) {
    const cutoff = now - VIOLATION_LOG_COOLDOWN_MS;
    for (const [k, v] of recentViolations.entries()) {
      if (v < cutoff) {
        recentViolations.delete(k);
      }
    }
  }
}

/**
 * Create a rate limiter with custom configuration
 */
function createRateLimiter(
  name: string,
  windowMs: number,
  max: number,
  customMessage?: string
): RequestHandler {
  const retryAfterSeconds = Math.ceil(windowMs / 1000);

  const options: Partial<Options> = {
    windowMs,
    max,
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers

    // Skip rate limiting for certain requests (can be overridden)
    skip: () => false,

    // Custom key generator - use IP address
    keyGenerator: (req) => {
      // Support for proxied requests (X-Forwarded-For header)
      const forwarded = req.headers['x-forwarded-for'];
      if (forwarded) {
        const ips = typeof forwarded === 'string' ? forwarded : forwarded[0];
        return ips.split(',')[0].trim();
      }
      return req.ip || req.socket.remoteAddress || 'unknown';
    },

    // Handler for when rate limit is exceeded
    handler: (req, res) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      logViolation(ip, name);

      res.status(429).json({
        error: 'Too many requests',
        message: customMessage || 'Please try again later',
        retryAfter: retryAfterSeconds,
      });
    },

    // Skip if request was already handled
    requestWasSuccessful: (_req, res) => res.statusCode < 400,
  };

  // Cast to RequestHandler to avoid type conflicts between different express type versions
  return rateLimit(options) as unknown as RequestHandler;
}

/**
 * Global rate limiter - applies to all routes
 * Default: 100 requests per minute per IP
 */
export const globalLimiter = createRateLimiter(
  'global',
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX,
  'Too many requests from this IP, please try again later'
);

/**
 * Import rate limiter - for expensive AI calls
 * Default: 10 requests per minute per IP
 */
export const importLimiter = createRateLimiter(
  'import',
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_IMPORT_MAX,
  'Too many import requests. AI classification is resource-intensive, please wait before trying again'
);

/**
 * Settings rate limiter - for sensitive endpoints
 * Default: 5 requests per minute per IP
 */
export const settingsLimiter = createRateLimiter(
  'settings',
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_SETTINGS_MAX,
  'Too many settings requests, please try again later'
);

/**
 * Factory function to create custom rate limiters
 */
export function createCustomLimiter(
  name: string,
  options: {
    windowMs?: number;
    max?: number;
    message?: string;
  }
): RequestHandler {
  return createRateLimiter(
    name,
    options.windowMs || RATE_LIMIT_WINDOW_MS,
    options.max || RATE_LIMIT_MAX,
    options.message
  );
}

/**
 * Middleware to skip rate limiting (for health checks, etc.)
 */
export function skipRateLimit(_req: Express.Request, _res: Express.Response, next: () => void): void {
  next();
}
