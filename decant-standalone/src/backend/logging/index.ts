// ============================================================
// Enhanced Structured Logging
// Pino-based logging with request context and correlation IDs
// ============================================================

import pino, { Logger, LoggerOptions, DestinationStream } from 'pino';
import { randomUUID } from 'crypto';
import { AppError, ErrorCode, isOperationalError } from '../errors/index.js';

// Environment variables
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug');
const LOG_FORMAT = process.env.LOG_FORMAT || (NODE_ENV === 'production' ? 'json' : 'pretty');

/**
 * Valid log levels
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Log format options
 */
export type LogFormat = 'json' | 'pretty';

/**
 * Request context for logging
 */
export interface RequestContext {
  requestId: string;
  method?: string;
  path?: string;
  url?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  startTime?: number;
}

/**
 * Error context for structured logging
 */
export interface ErrorContext {
  name: string;
  message: string;
  code?: ErrorCode | string;
  statusCode?: number;
  stack?: string;
  context?: Record<string, unknown>;
  isOperational?: boolean;
}

/**
 * Structured log context
 */
export interface LogContext extends Record<string, unknown> {
  requestId?: string;
  correlationId?: string;
  userId?: string;
  err?: ErrorContext;
  req?: Partial<RequestContext>;
  duration?: number;
  [key: string]: unknown;
}

/**
 * Get pino-pretty transport configuration for development
 */
function getPrettyTransport(): DestinationStream {
  return pino.transport({
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
      ignore: 'pid,hostname',
      singleLine: false,
      messageFormat: '{msg}',
    },
  });
}

/**
 * Create logger options based on environment
 */
function createLoggerOptions(): LoggerOptions {
  const baseOptions: LoggerOptions = {
    level: LOG_LEVEL,
    base: {
      env: NODE_ENV,
    },
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    formatters: {
      level: (label) => ({ level: label }),
    },
    // Redact sensitive fields
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'apiKey',
        'password',
        'token',
        'secret',
        '*.apiKey',
        '*.password',
        '*.token',
        '*.secret',
      ],
      censor: '[REDACTED]',
    },
  };

  return baseOptions;
}

/**
 * Create the singleton logger instance
 */
function createLogger(): Logger {
  const options = createLoggerOptions();

  if (LOG_FORMAT === 'pretty' && NODE_ENV !== 'production') {
    return pino(options, getPrettyTransport());
  }

  return pino(options);
}

// Singleton logger instance
const logger = createLogger();

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: LogContext): Logger {
  return logger.child(context);
}

/**
 * Create logger with request context
 */
export function createRequestLogger(requestContext: RequestContext): Logger {
  return logger.child({
    requestId: requestContext.requestId,
    method: requestContext.method,
    path: requestContext.path,
    userId: requestContext.userId,
  });
}

/**
 * Get the current log level
 */
export function getLogLevel(): LogLevel {
  return logger.level as LogLevel;
}

/**
 * Set the log level at runtime
 */
export function setLogLevel(level: LogLevel): void {
  logger.level = level;
}

/**
 * Check if a log level is enabled
 */
export function isLevelEnabled(level: LogLevel): boolean {
  return logger.isLevelEnabled(level);
}

/**
 * Generate a correlation ID for tracing
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Format error for structured logging
 * Includes stack traces only in development
 */
export function formatError(error: Error | AppError): ErrorContext {
  const errorContext: ErrorContext = {
    name: error.name,
    message: error.message,
  };

  if (error instanceof AppError) {
    errorContext.code = error.code;
    errorContext.statusCode = error.statusCode;
    errorContext.isOperational = error.isOperational;
    if (error.context) {
      errorContext.context = error.context;
    }
  }

  // Include stack traces in development or for non-operational errors
  if (NODE_ENV !== 'production' || !isOperationalError(error)) {
    errorContext.stack = error.stack;
  }

  return errorContext;
}

/**
 * Format request context for logging
 */
export function formatRequestContext(req: RequestContext): Partial<RequestContext> {
  return {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    userId: req.userId,
    ip: req.ip,
  };
}

/**
 * Calculate request duration in milliseconds
 */
export function calculateDuration(startTime?: number): number | undefined {
  if (!startTime) return undefined;
  return Date.now() - startTime;
}

/**
 * Enhanced logging interface with context support
 */
export const log = {
  /**
   * Log at trace level (most verbose)
   */
  trace: (msg: string, context?: LogContext) => {
    logger.trace(context || {}, msg);
  },

  /**
   * Log at debug level (development details)
   */
  debug: (msg: string, context?: LogContext) => {
    logger.debug(context || {}, msg);
  },

  /**
   * Log at info level (general information)
   */
  info: (msg: string, context?: LogContext) => {
    logger.info(context || {}, msg);
  },

  /**
   * Log at warn level (warnings)
   */
  warn: (msg: string, context?: LogContext) => {
    logger.warn(context || {}, msg);
  },

  /**
   * Log at error level (errors)
   */
  error: (msg: string, context?: LogContext) => {
    logger.error(context || {}, msg);
  },

  /**
   * Log at fatal level (critical errors)
   */
  fatal: (msg: string, context?: LogContext) => {
    logger.fatal(context || {}, msg);
  },

  /**
   * Log an error with structured context
   */
  logError: (msg: string, error: Error | AppError, additionalContext?: LogContext) => {
    const errorContext = formatError(error);
    const context: LogContext = {
      ...additionalContext,
      err: errorContext,
    };

    // Use appropriate log level based on error severity
    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        logger.error(context, msg);
      } else if (error.statusCode >= 400) {
        logger.warn(context, msg);
      } else {
        logger.info(context, msg);
      }
    } else {
      logger.error(context, msg);
    }
  },

  /**
   * Log a request with context
   */
  logRequest: (msg: string, requestContext: RequestContext, additionalContext?: LogContext) => {
    const context: LogContext = {
      ...additionalContext,
      req: formatRequestContext(requestContext),
      duration: calculateDuration(requestContext.startTime),
    };
    logger.info(context, msg);
  },

  /**
   * Log successful operation with timing
   */
  logSuccess: (msg: string, startTime: number, context?: LogContext) => {
    const duration = Date.now() - startTime;
    logger.info({ ...context, duration }, msg);
  },

  /**
   * Log performance metric
   */
  logPerformance: (operation: string, duration: number, context?: LogContext) => {
    logger.debug({ ...context, operation, duration }, `Performance: ${operation}`);
  },

  /**
   * Log database query (debug only)
   */
  logQuery: (query: string, params?: unknown[], duration?: number) => {
    if (NODE_ENV === 'development') {
      logger.debug({ query, params, duration }, 'Database query');
    }
  },

  /**
   * Log LLM interaction
   */
  logLLM: (
    operation: string,
    model: string,
    tokens?: { prompt: number; completion: number; total: number },
    duration?: number
  ) => {
    logger.info(
      {
        operation,
        model,
        tokens,
        duration,
      },
      `LLM: ${operation}`
    );
  },

  /**
   * Log cache hit/miss
   */
  logCache: (operation: 'hit' | 'miss' | 'set' | 'invalidate', key: string, context?: LogContext) => {
    logger.debug({ ...context, cache: { operation, key } }, `Cache ${operation}: ${key}`);
  },

  /**
   * Log external API call
   */
  logExternalAPI: (service: string, endpoint: string, statusCode?: number, duration?: number) => {
    logger.info(
      {
        service,
        endpoint,
        statusCode,
        duration,
      },
      `External API: ${service}`
    );
  },
};

/**
 * Create a scoped logger for a specific module
 */
export function createModuleLogger(module: string): typeof log {
  const childLogger = logger.child({ module });

  return {
    trace: (msg: string, context?: LogContext) => {
      childLogger.trace(context || {}, msg);
    },
    debug: (msg: string, context?: LogContext) => {
      childLogger.debug(context || {}, msg);
    },
    info: (msg: string, context?: LogContext) => {
      childLogger.info(context || {}, msg);
    },
    warn: (msg: string, context?: LogContext) => {
      childLogger.warn(context || {}, msg);
    },
    error: (msg: string, context?: LogContext) => {
      childLogger.error(context || {}, msg);
    },
    fatal: (msg: string, context?: LogContext) => {
      childLogger.fatal(context || {}, msg);
    },
    logError: log.logError,
    logRequest: log.logRequest,
    logSuccess: log.logSuccess,
    logPerformance: log.logPerformance,
    logQuery: log.logQuery,
    logLLM: log.logLLM,
    logCache: log.logCache,
    logExternalAPI: log.logExternalAPI,
  };
}

// Export the raw pino logger for advanced usage
export { logger };

// Default export
export default logger;
