// ============================================================
// Pino Logger Configuration
// Structured logging for Decant application
// ============================================================

import pino, { Logger, LoggerOptions, DestinationStream } from 'pino';

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
 * Get pino-pretty transport configuration for development
 */
function getPrettyTransport(): DestinationStream {
  // Dynamic import for pino-pretty to avoid bundling issues
  // Using pino.transport for proper integration
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
 * @param context - Additional context to add to log entries
 * @returns Child logger instance
 */
export function createChildLogger(context: Record<string, unknown>): Logger {
  return logger.child(context);
}

/**
 * Get the current log level
 */
export function getLogLevel(): LogLevel {
  return logger.level as LogLevel;
}

/**
 * Set the log level at runtime
 * @param level - New log level
 */
export function setLogLevel(level: LogLevel): void {
  logger.level = level;
}

/**
 * Check if a log level is enabled
 * @param level - Log level to check
 */
export function isLevelEnabled(level: LogLevel): boolean {
  return logger.isLevelEnabled(level);
}

// Export convenience methods that match console API for easy migration
export const log = {
  /**
   * Log at trace level (most verbose)
   */
  trace: (msg: string, ...args: unknown[]) => logger.trace(formatArgs(args), msg),

  /**
   * Log at debug level (development details)
   */
  debug: (msg: string, ...args: unknown[]) => logger.debug(formatArgs(args), msg),

  /**
   * Log at info level (general information)
   */
  info: (msg: string, ...args: unknown[]) => logger.info(formatArgs(args), msg),

  /**
   * Log at warn level (warnings)
   */
  warn: (msg: string, ...args: unknown[]) => logger.warn(formatArgs(args), msg),

  /**
   * Log at error level (errors)
   */
  error: (msg: string, ...args: unknown[]) => logger.error(formatArgs(args), msg),

  /**
   * Log at fatal level (critical errors)
   */
  fatal: (msg: string, ...args: unknown[]) => logger.fatal(formatArgs(args), msg),
};

/**
 * Format additional arguments into a context object
 */
function formatArgs(args: unknown[]): Record<string, unknown> {
  if (args.length === 0) return {};

  // If first arg is an object, use it as context
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
    // Handle Error objects specially
    if (args[0] instanceof Error) {
      return {
        err: {
          message: args[0].message,
          name: args[0].name,
          stack: args[0].stack,
        },
      };
    }
    return args[0] as Record<string, unknown>;
  }

  // Otherwise wrap in data array
  return { data: args };
}

// Export the raw pino logger for advanced usage
export { logger };

// Default export for simple import
export default logger;
