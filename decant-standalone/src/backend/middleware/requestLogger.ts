// ============================================================
// Request Logging Middleware
// HTTP request/response logging with pino-http and correlation IDs
// ============================================================

import pinoHttp, { HttpLogger, Options } from 'pino-http';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import logger, { generateCorrelationId } from '../logging/index.js';

// Environment variables
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Generate a unique request ID for correlation
 */
function generateRequestId(): string {
  return randomUUID();
}

/**
 * Custom serializers for request/response objects
 */
const serializers = {
  req: (req: Request) => ({
    id: req.id,
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    params: req.params,
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length'],
      host: req.headers.host,
      // Don't log sensitive headers
    },
  }),
  res: (res: any) => ({
    statusCode: res.statusCode,
    headers: res.getHeaders ? {
      'content-type': res.getHeader?.('content-type'),
      'content-length': res.getHeader?.('content-length'),
    } : {},
  }),
};

/**
 * Create pino-http options
 */
function createHttpLoggerOptions(): Options {
  return {
    logger,

    // Generate unique request ID
    genReqId: generateRequestId,

    // Custom serializers
    serializers,

    // Customize log level based on status code
    customLogLevel: (_req, res, error) => {
      if (error || res.statusCode >= 500) {
        return 'error';
      }
      if (res.statusCode >= 400) {
        return 'warn';
      }
      if (res.statusCode >= 300) {
        return 'info';
      }
      return 'info';
    },

    // Custom success message
    customSuccessMessage: (req, res) => {
      const method = req.method;
      const url = req.url;
      const status = res.statusCode;
      return `${method} ${url} ${status}`;
    },

    // Custom error message
    customErrorMessage: (req, res, error) => {
      const method = req.method;
      const url = req.url;
      const status = res.statusCode;
      const errorMsg = error?.message || 'Unknown error';
      return `${method} ${url} ${status} - ${errorMsg}`;
    },

    // Custom attributes to add to log object
    customAttributeKeys: {
      req: 'request',
      res: 'response',
      err: 'error',
      responseTime: 'responseTimeMs',
    },

    // Custom props to add to each log
    customProps: (req) => {
      const customReq = req as Request & { correlationId?: string };
      return {
        requestId: req.id,
        correlationId: customReq.correlationId,
      };
    },

    // Auto-logging configuration
    autoLogging: {
      // Don't log health checks or static assets in production
      ignore: (req) => {
        const url = req.url || '';

        // Skip health check endpoints
        if (url === '/health' || url === '/api/health') {
          return true;
        }

        // In production, skip static asset requests
        if (NODE_ENV === 'production') {
          const staticExtensions = ['.js', '.css', '.png', '.jpg', '.ico', '.svg', '.woff', '.woff2'];
          if (staticExtensions.some(ext => url.endsWith(ext))) {
            return true;
          }
        }

        return false;
      },
    },
  };
}

/**
 * Create the pino-http middleware
 */
export function createRequestLogger(): HttpLogger {
  return pinoHttp(createHttpLoggerOptions());
}

/**
 * Express middleware that adds request ID and correlation ID to req object
 * and attaches the pino logger
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Generate request ID if not already present
  if (!req.id) {
    (req as Request & { id: string }).id = generateRequestId();
  }

  // Generate correlation ID from header or create new one
  const correlationIdHeader = req.get('x-correlation-id');
  const correlationId = correlationIdHeader || generateCorrelationId();
  (req as Request & { correlationId: string }).correlationId = correlationId;

  // Add IDs to response headers for debugging
  res.setHeader('X-Request-ID', String(req.id));
  res.setHeader('X-Correlation-ID', correlationId);

  next();
}

// Export the default request logger instance
export const requestLogger = createRequestLogger();

/**
 * Combined middleware that includes request ID handling
 */
export function httpLogger(req: Request, res: Response, next: NextFunction): void {
  requestIdMiddleware(req, res, () => {
    requestLogger(req, res, next);
  });
}

export default httpLogger;
