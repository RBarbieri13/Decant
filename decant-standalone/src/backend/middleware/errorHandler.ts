// ============================================================
// Enhanced Error Handler Middleware
// Centralized error handling with structured logging and sanitization
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { log, formatError, RequestContext } from '../logging/index.js';
import { isProduction } from '../config/index.js';
import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
  SSRFError,
  LLMError,
  ImportError,
  DatabaseError,
  ErrorCode,
  isOperationalError,
  getStatusCode,
} from '../errors/index.js';

// Re-export error classes for backward compatibility
export {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
  SSRFError,
};

/**
 * Structured error response type
 */
interface ErrorResponse {
  error: string;
  requestId?: string;
  code?: string | ErrorCode;
  details?: Array<{ field: string; message: string }>;
  retryAfter?: number;
  timestamp?: string;
}

/**
 * Format Zod validation errors
 */
function formatZodError(error: ZodError): Array<{ field: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'unknown',
    message: issue.message,
  }));
}

/**
 * Get request ID from request object
 */
function getRequestId(req: Request): string | undefined {
  return (req as Request & { id?: string }).id;
}

/**
 * Build request context for logging
 */
function buildRequestContext(req: Request): RequestContext {
  return {
    requestId: getRequestId(req) || '',
    method: req.method,
    path: req.path,
    url: req.url,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
  };
}

/**
 * Sanitize error message for production
 * Removes potentially sensitive information
 */
function sanitizeErrorMessage(message: string, error?: Error): string {
  // In production, hide internal details for non-operational errors
  if (isProduction() && (!error || !isOperationalError(error))) {
    // Don't expose file paths
    if (message.includes('/') || message.includes('\\')) {
      return 'An internal error occurred';
    }
    // Don't expose SQL errors
    if (message.toLowerCase().includes('sql') || message.toLowerCase().includes('database')) {
      return 'A database error occurred';
    }
    // Don't expose stack traces
    if (message.includes('at ') && message.includes(':')) {
      return 'An internal error occurred';
    }
    // Don't expose module paths
    if (message.includes('node_modules') || message.includes('src/')) {
      return 'An internal error occurred';
    }
  }
  return message;
}

/**
 * Determine log level based on error type and status code
 */
function getLogLevel(error: Error, statusCode: number): 'error' | 'warn' | 'info' | 'debug' {
  // Non-operational errors are always logged as errors
  if (!isOperationalError(error)) {
    return 'error';
  }

  // Operational errors based on status code
  if (statusCode >= 500) {
    return 'error';
  }
  if (statusCode >= 400) {
    return 'warn';
  }
  return 'info';
}

/**
 * Enhanced error handler middleware
 * Must be registered as the last middleware in Express app
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = getRequestId(req);
  const requestContext = buildRequestContext(req);

  // Default status code and response
  let statusCode = 500;
  let response: ErrorResponse = {
    error: 'Internal server error',
    requestId,
    timestamp: new Date().toISOString(),
  };

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    statusCode = 400;
    const details = formatZodError(err);

    log.warn('Validation error', {
      req: requestContext,
      validationErrors: details,
    });

    response = {
      error: 'Validation failed',
      requestId,
      code: ErrorCode.VALIDATION_FAILED,
      details,
      timestamp: new Date().toISOString(),
    };
  }
  // Handle custom AppError and subclasses
  else if (err instanceof AppError) {
    statusCode = err.statusCode;
    const logLevel = getLogLevel(err, statusCode);

    // Build error context for logging
    const errorContext = formatError(err);
    const logContext = {
      req: requestContext,
      err: errorContext,
    };

    // Log based on severity
    switch (logLevel) {
      case 'error':
        log.error(`${err.name}: ${err.message}`, logContext);
        break;
      case 'warn':
        log.warn(`${err.name}: ${err.message}`, logContext);
        break;
      case 'info':
        log.info(`${err.name}: ${err.message}`, logContext);
        break;
      case 'debug':
        log.debug(`${err.name}: ${err.message}`, logContext);
        break;
    }

    response = {
      error: sanitizeErrorMessage(err.message, err),
      requestId,
      code: err.code,
      timestamp: new Date().toISOString(),
    };

    // Include validation details if present
    if (err instanceof ValidationError && err.details) {
      response.details = err.details;
    }

    // Include retry-after header for rate limit errors
    if (err instanceof RateLimitError && err.retryAfter) {
      response.retryAfter = err.retryAfter;
      res.setHeader('Retry-After', String(err.retryAfter));
    }
  }
  // Handle generic errors
  else {
    // Log full error details for unexpected errors
    log.error('Unhandled error', {
      req: requestContext,
      err: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
    });

    // Sanitize message for production
    response = {
      error: sanitizeErrorMessage(err.message, err) || 'Internal server error',
      requestId,
      code: ErrorCode.INTERNAL_ERROR,
      timestamp: new Date().toISOString(),
    };
  }

  // Send response
  res.status(statusCode).json(response);
}

/**
 * Async handler wrapper to catch errors in async route handlers
 * Wraps async functions and forwards errors to error handler
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found handler for unmatched routes
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  const requestId = getRequestId(req);

  log.debug('Route not found', {
    requestId,
    method: req.method,
    url: req.url,
    path: req.path,
  });

  next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
}

/**
 * Global error handler for uncaught exceptions and unhandled rejections
 * Should be called during application startup
 */
export function setupGlobalErrorHandlers(): void {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    log.fatal('Uncaught exception', {
      err: formatError(error),
    });

    // Give the logger time to write, then exit
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));

    log.fatal('Unhandled promise rejection', {
      err: formatError(error),
    });

    // Give the logger time to write, then exit
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Handle SIGTERM gracefully
  process.on('SIGTERM', () => {
    log.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
  });

  // Handle SIGINT gracefully (Ctrl+C)
  process.on('SIGINT', () => {
    log.info('SIGINT received, shutting down gracefully');
    process.exit(0);
  });
}

export default errorHandler;
