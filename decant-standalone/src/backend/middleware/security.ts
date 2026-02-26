// ============================================================
// Security Middleware
// CORS configuration and security headers for Decant
// ============================================================

import { Request, Response, NextFunction, RequestHandler } from 'express';
import cors, { CorsOptions } from 'cors';
import { log } from '../logger/index.js';

// Environment configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const DEFAULT_CORS_ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:5173';
const CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS;

/**
 * Parse allowed origins from environment variable.
 * Supports wildcard suffix patterns like "chrome-extension://*"
 * which are converted to RegExp for matching.
 */
function parseAllowedOrigins(value?: string): (string | RegExp)[] | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;

  const origins = raw.split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0)
    .map(origin => {
      // Support simple wildcard suffix patterns:
      // - chrome-extension://*  (matches any extension ID)
      // - https://example.com*  (matches any origin with that prefix)
      // - chrome-extension://*/ (legacy)
      if (origin.endsWith('/*')) {
        origin = origin.slice(0, -1);
      }

      if (origin.endsWith('*')) {
        const prefix = origin.slice(0, -1);
        const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp('^' + escaped + '.*$');
      }

      return origin;
    });

  log.debug('Parsed CORS allowed origins', { origins, module: 'security' });
  return origins;
}

/**
 * Create configured CORS middleware
 *
 * Configuration:
 * - Origins from CORS_ALLOWED_ORIGINS env var (comma-separated)
 * - Default: localhost:3000, localhost:5173
 * - Supports credentials
 * - Methods: GET, POST, PUT, DELETE, OPTIONS
 */
export function createCorsMiddleware(): RequestHandler {
  const allowedOrigins = parseAllowedOrigins(
    CORS_ALLOWED_ORIGINS || (NODE_ENV === 'development' ? DEFAULT_CORS_ALLOWED_ORIGINS : undefined)
  );

  // If not configured (common in deployments), allow all origins.
  // API access is still protected via DECANT_ACCESS_TOKEN if enabled.
  if (!allowedOrigins) {
    log.warn('CORS_ALLOWED_ORIGINS not set; allowing all origins', { module: 'security' });
    return cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
      maxAge: 86400,
    });
  }

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        log.debug('CORS: Allowing request with no origin', { module: 'security' });
        callback(null, true);
        return;
      }

      // Check if origin is in allowed list
      const isAllowed = allowedOrigins.some(allowed => {
        if (typeof allowed === 'string') {
          return origin === allowed;
        }
        return allowed.test(origin);
      });

      if (isAllowed) {
        log.debug('CORS: Allowing request from origin', { origin, module: 'security' });
        callback(null, true);
      } else {
        log.warn('CORS blocked request from origin', {
          origin,
          allowedOrigins,
          module: 'security'
        });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    maxAge: 86400, // 24 hours
  };

  log.info('CORS middleware configured', {
    origins: allowedOrigins,
    credentials: true,
    module: 'security'
  });

  return cors(corsOptions);
}

/**
 * Security headers middleware
 *
 * Adds the following headers:
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - X-XSS-Protection: 1; mode=block
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Strict-Transport-Security (production only)
 */
export function securityHeaders(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Enable XSS filter in browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Control referrer information
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // HSTS in production (force HTTPS)
    if (NODE_ENV === 'production') {
      // max-age: 1 year, includeSubDomains
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
    }

    // Remove X-Powered-By header
    res.removeHeader('X-Powered-By');

    next();
  };
}

/**
 * Request body size configuration
 * Returns the configured limit for express.json()
 */
export const REQUEST_BODY_LIMIT = '1mb';

/**
 * Content Security Policy for API responses
 * More restrictive than typical web apps since this is an API server
 */
export function contentSecurityPolicy(): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction): void => {
    // Only apply CSP to HTML responses (for error pages, etc.)
    const originalSend = res.send.bind(res);
    res.send = function(body: any) {
      const contentType = res.get('Content-Type');
      if (contentType && contentType.includes('text/html')) {
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'"
        );
      }
      return originalSend(body);
    };
    next();
  };
}

/**
 * Combined security middleware - applies all security measures
 * Use this for convenience or apply individual middlewares for more control
 */
export function applySecurityMiddleware(app: {
  use: (middleware: RequestHandler) => void;
}): void {
  // Apply CORS
  app.use(createCorsMiddleware());

  // Apply security headers
  app.use(securityHeaders());

  // Apply CSP
  app.use(contentSecurityPolicy());

  log.info('Security middleware applied', { env: NODE_ENV, module: 'security' });
}

export default {
  createCorsMiddleware,
  securityHeaders,
  contentSecurityPolicy,
  applySecurityMiddleware,
  REQUEST_BODY_LIMIT,
};
