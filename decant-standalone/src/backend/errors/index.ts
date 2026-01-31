// ============================================================
// Enhanced Error Classes
// Comprehensive error hierarchy with error codes and context
// ============================================================

/**
 * Error codes enum for consistent error identification
 */
export enum ErrorCode {
  // Validation Errors (400)
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  URL_REQUIRED = 'URL_REQUIRED',
  URL_EMPTY = 'URL_EMPTY',
  URL_INVALID = 'URL_INVALID',
  URL_INVALID_PROTOCOL = 'URL_INVALID_PROTOCOL',
  URL_NO_HOSTNAME = 'URL_NO_HOSTNAME',
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_JSON = 'INVALID_JSON',
  SCHEMA_VALIDATION_FAILED = 'SCHEMA_VALIDATION_FAILED',

  // Not Found Errors (404)
  NOT_FOUND = 'NOT_FOUND',
  NODE_NOT_FOUND = 'NODE_NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',

  // Authentication/Authorization Errors (401, 403)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  SSRF_BLOCKED = 'SSRF_BLOCKED',

  // Conflict Errors (409)
  CONFLICT = 'CONFLICT',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',

  // Rate Limiting (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  // LLM Errors (502, 503, 504)
  LLM_UNAVAILABLE = 'LLM_UNAVAILABLE',
  LLM_TIMEOUT = 'LLM_TIMEOUT',
  LLM_INVALID_RESPONSE = 'LLM_INVALID_RESPONSE',
  LLM_RATE_LIMITED = 'LLM_RATE_LIMITED',
  LLM_NOT_INITIALIZED = 'LLM_NOT_INITIALIZED',
  LLM_API_ERROR = 'LLM_API_ERROR',
  LLM_PARSING_ERROR = 'LLM_PARSING_ERROR',
  LLM_SCHEMA_VALIDATION_ERROR = 'LLM_SCHEMA_VALIDATION_ERROR',

  // External Service Errors (502, 503)
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  SCRAPE_FAILED = 'SCRAPE_FAILED',
  SCRAPE_TIMEOUT = 'SCRAPE_TIMEOUT',
  SCRAPE_TOO_LARGE = 'SCRAPE_TOO_LARGE',
  SCRAPE_INVALID_CONTENT = 'SCRAPE_INVALID_CONTENT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_URL = 'INVALID_URL',
  FETCH_FAILED = 'FETCH_FAILED',
  CONTENT_TOO_LARGE = 'CONTENT_TOO_LARGE',
  NO_BODY = 'NO_BODY',
  TIMEOUT = 'TIMEOUT',
  INVALID_PROTOCOL = 'INVALID_PROTOCOL',
  HTTP_NOT_ALLOWED = 'HTTP_NOT_ALLOWED',

  // Import Errors (400, 500)
  IMPORT_FAILED = 'IMPORT_FAILED',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  CLASSIFICATION_FAILED = 'CLASSIFICATION_FAILED',
  HIERARCHY_GENERATION_FAILED = 'HIERARCHY_GENERATION_FAILED',
  API_KEY_MISSING = 'API_KEY_MISSING',

  // Database Errors (500, 503)
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
  DATABASE_QUERY_ERROR = 'DATABASE_QUERY_ERROR',
  DATABASE_TRANSACTION_ERROR = 'DATABASE_TRANSACTION_ERROR',
  DATABASE_CONSTRAINT_VIOLATION = 'DATABASE_CONSTRAINT_VIOLATION',

  // Internal Server Errors (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * Base application error class with enhanced context and metadata
 */
export class AppError extends Error {
  /** HTTP status code */
  public readonly statusCode: number;

  /** Machine-readable error code */
  public readonly code: ErrorCode;

  /** Whether this is an expected operational error vs programming error */
  public readonly isOperational: boolean;

  /** Additional context data for logging and debugging */
  public readonly context?: Record<string, unknown>;

  /** Timestamp when error occurred */
  public readonly timestamp: Date;

  constructor(
    message: string,
    statusCode: number = 500,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
    this.isOperational = true;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      ...(this.context && { context: this.context }),
    };
  }

  /**
   * Create error with additional context
   */
  withContext(context: Record<string, unknown>): this {
    return new (this.constructor as new (...args: unknown[]) => this)(
      this.message,
      this.statusCode,
      this.code,
      { ...this.context, ...context }
    );
  }
}

// ============================================================
// Validation Errors (400)
// ============================================================

/**
 * Validation error with field-level details
 */
export class ValidationError extends AppError {
  public readonly details?: Array<{ field: string; message: string }>;

  constructor(
    message = 'Validation failed',
    details?: Array<{ field: string; message: string }>,
    context?: Record<string, unknown>
  ) {
    super(message, 400, ErrorCode.VALIDATION_FAILED, context);
    this.details = details;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      ...(this.details && { details: this.details }),
    };
  }
}

/**
 * Invalid input error
 */
export class InvalidInputError extends AppError {
  constructor(message = 'Invalid input', context?: Record<string, unknown>) {
    super(message, 400, ErrorCode.INVALID_INPUT, context);
  }
}

/**
 * Schema validation error (for Zod or JSON schema failures)
 */
export class SchemaValidationError extends AppError {
  public readonly validationErrors?: unknown[];

  constructor(
    message = 'Schema validation failed',
    validationErrors?: unknown[],
    context?: Record<string, unknown>
  ) {
    super(message, 400, ErrorCode.SCHEMA_VALIDATION_FAILED, context);
    this.validationErrors = validationErrors;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      ...(this.validationErrors && { validationErrors: this.validationErrors }),
    };
  }
}

// ============================================================
// Not Found Errors (404)
// ============================================================

/**
 * Resource not found error
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', context?: Record<string, unknown>) {
    super(message, 404, ErrorCode.NOT_FOUND, context);
  }
}

/**
 * Node not found error (specific to Decant nodes)
 */
export class NodeNotFoundError extends NotFoundError {
  constructor(nodeId: string, context?: Record<string, unknown>) {
    super(`Node not found: ${nodeId}`, { ...context, nodeId });
    this.code = ErrorCode.NODE_NOT_FOUND;
  }
}

// ============================================================
// Authentication/Authorization Errors (401, 403)
// ============================================================

/**
 * Unauthorized error (401)
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', context?: Record<string, unknown>) {
    super(message, 401, ErrorCode.UNAUTHORIZED, context);
  }
}

/**
 * Forbidden error (403)
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', context?: Record<string, unknown>) {
    super(message, 403, ErrorCode.FORBIDDEN, context);
  }
}

/**
 * SSRF attempt blocked error
 */
export class SSRFError extends ForbiddenError {
  constructor(message = 'Access to requested URL is forbidden', context?: Record<string, unknown>) {
    super(message, { ...context, reason: 'ssrf_protection' });
    this.code = ErrorCode.SSRF_BLOCKED;
  }
}

// ============================================================
// Conflict Errors (409)
// ============================================================

/**
 * Resource conflict error
 */
export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', context?: Record<string, unknown>) {
    super(message, 409, ErrorCode.CONFLICT, context);
  }
}

// ============================================================
// Rate Limiting Errors (429)
// ============================================================

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(
    message = 'Too many requests',
    retryAfter?: number,
    context?: Record<string, unknown>
  ) {
    super(message, 429, ErrorCode.RATE_LIMIT_EXCEEDED, context);
    this.retryAfter = retryAfter;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      ...(this.retryAfter && { retryAfter: this.retryAfter }),
    };
  }
}

// ============================================================
// LLM Errors (502, 503, 504)
// ============================================================

/**
 * Base LLM error
 */
export class LLMError extends AppError {
  constructor(
    message: string,
    statusCode: number = 502,
    code: ErrorCode = ErrorCode.LLM_API_ERROR,
    context?: Record<string, unknown>
  ) {
    super(message, statusCode, code, context);
  }
}

/**
 * LLM service unavailable
 */
export class LLMUnavailableError extends LLMError {
  constructor(message = 'LLM service unavailable', context?: Record<string, unknown>) {
    super(message, 503, ErrorCode.LLM_UNAVAILABLE, context);
  }
}

/**
 * LLM request timeout
 */
export class LLMTimeoutError extends LLMError {
  constructor(message = 'LLM request timeout', context?: Record<string, unknown>) {
    super(message, 504, ErrorCode.LLM_TIMEOUT, context);
  }
}

/**
 * LLM returned invalid response
 */
export class LLMInvalidResponseError extends LLMError {
  constructor(message = 'LLM returned invalid response', context?: Record<string, unknown>) {
    super(message, 502, ErrorCode.LLM_INVALID_RESPONSE, context);
  }
}

/**
 * LLM rate limit exceeded
 */
export class LLMRateLimitError extends LLMError {
  constructor(message = 'LLM rate limit exceeded', context?: Record<string, unknown>) {
    super(message, 429, ErrorCode.LLM_RATE_LIMITED, context);
  }
}

/**
 * LLM provider not initialized
 */
export class LLMNotInitializedError extends LLMError {
  constructor(message = 'LLM provider not initialized', context?: Record<string, unknown>) {
    super(message, 503, ErrorCode.LLM_NOT_INITIALIZED, context);
  }
}

/**
 * LLM parsing error (JSON parsing or schema validation)
 */
export class LLMParsingError extends LLMError {
  constructor(message = 'Failed to parse LLM response', context?: Record<string, unknown>) {
    super(message, 502, ErrorCode.LLM_PARSING_ERROR, context);
  }
}

// ============================================================
// External Service Errors (502, 503)
// ============================================================

/**
 * External service error
 */
export class ExternalServiceError extends AppError {
  constructor(
    message = 'External service unavailable',
    statusCode: number = 502,
    code: ErrorCode = ErrorCode.EXTERNAL_SERVICE_ERROR,
    context?: Record<string, unknown>
  ) {
    super(message, statusCode, code, context);
  }
}

/**
 * Scraping error
 */
export class ScrapeError extends ExternalServiceError {
  constructor(
    message = 'Failed to scrape URL',
    code: ErrorCode = ErrorCode.SCRAPE_FAILED,
    context?: Record<string, unknown>
  ) {
    super(message, 502, code, context);
  }
}

/**
 * Scrape timeout error
 */
export class ScrapeTimeoutError extends ScrapeError {
  constructor(message = 'Scrape request timeout', context?: Record<string, unknown>) {
    super(message, ErrorCode.SCRAPE_TIMEOUT, context);
  }
}

/**
 * Content too large error
 */
export class ScrapeTooLargeError extends ScrapeError {
  constructor(message = 'Content size exceeds limit', context?: Record<string, unknown>) {
    super(message, ErrorCode.SCRAPE_TOO_LARGE, context);
  }
}

/**
 * Network error
 */
export class NetworkError extends ExternalServiceError {
  constructor(message = 'Network request failed', context?: Record<string, unknown>) {
    super(message, 502, ErrorCode.NETWORK_ERROR, context);
  }
}

// ============================================================
// Import Errors (400, 500)
// ============================================================

/**
 * Import error
 */
export class ImportError extends AppError {
  constructor(
    message = 'Import failed',
    statusCode: number = 500,
    code: ErrorCode = ErrorCode.IMPORT_FAILED,
    context?: Record<string, unknown>
  ) {
    super(message, statusCode, code, context);
  }
}

/**
 * Extraction error
 */
export class ExtractionError extends ImportError {
  constructor(message = 'Content extraction failed', context?: Record<string, unknown>) {
    super(message, 500, ErrorCode.EXTRACTION_FAILED, context);
  }
}

/**
 * Classification error
 */
export class ClassificationError extends ImportError {
  constructor(message = 'Classification failed', context?: Record<string, unknown>) {
    super(message, 500, ErrorCode.CLASSIFICATION_FAILED, context);
  }
}

/**
 * Hierarchy generation error
 */
export class HierarchyGenerationError extends ImportError {
  constructor(message = 'Hierarchy generation failed', context?: Record<string, unknown>) {
    super(message, 500, ErrorCode.HIERARCHY_GENERATION_FAILED, context);
  }
}

// ============================================================
// Database Errors (500, 503)
// ============================================================

/**
 * Database error
 */
export class DatabaseError extends AppError {
  constructor(
    message = 'Database error',
    statusCode: number = 500,
    code: ErrorCode = ErrorCode.DATABASE_ERROR,
    context?: Record<string, unknown>
  ) {
    super(message, statusCode, code, context);
  }
}

/**
 * Database connection error
 */
export class DatabaseConnectionError extends DatabaseError {
  constructor(message = 'Database connection failed', context?: Record<string, unknown>) {
    super(message, 503, ErrorCode.DATABASE_CONNECTION_ERROR, context);
  }
}

/**
 * Database query error
 */
export class DatabaseQueryError extends DatabaseError {
  constructor(message = 'Database query failed', context?: Record<string, unknown>) {
    super(message, 500, ErrorCode.DATABASE_QUERY_ERROR, context);
  }
}

/**
 * Database transaction error
 */
export class DatabaseTransactionError extends DatabaseError {
  constructor(message = 'Database transaction failed', context?: Record<string, unknown>) {
    super(message, 500, ErrorCode.DATABASE_TRANSACTION_ERROR, context);
  }
}

/**
 * Database constraint violation
 */
export class DatabaseConstraintError extends DatabaseError {
  constructor(message = 'Database constraint violation', context?: Record<string, unknown>) {
    super(message, 409, ErrorCode.DATABASE_CONSTRAINT_VIOLATION, context);
  }
}

// ============================================================
// Internal Server Errors (500)
// ============================================================

/**
 * Configuration error
 */
export class ConfigurationError extends AppError {
  constructor(message = 'Configuration error', context?: Record<string, unknown>) {
    super(message, 500, ErrorCode.CONFIGURATION_ERROR, context);
    this.isOperational = false; // Programming error
  }
}

/**
 * Not implemented error
 */
export class NotImplementedError extends AppError {
  constructor(message = 'Not implemented', context?: Record<string, unknown>) {
    super(message, 501, ErrorCode.NOT_IMPLEMENTED, context);
  }
}

/**
 * Service unavailable error
 */
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable', context?: Record<string, unknown>) {
    super(message, 503, ErrorCode.SERVICE_UNAVAILABLE, context);
  }
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Check if error is operational (expected) vs programming error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Extract error code from error
 */
export function getErrorCode(error: Error): ErrorCode | undefined {
  if (error instanceof AppError) {
    return error.code;
  }
  return undefined;
}

/**
 * Extract HTTP status code from error
 */
export function getStatusCode(error: Error): number {
  if (error instanceof AppError) {
    return error.statusCode;
  }
  return 500;
}

/**
 * Check if error should be retried
 */
export function isRetryableError(error: Error): boolean {
  if (!(error instanceof AppError)) {
    return false;
  }

  const retryableCodes = [
    ErrorCode.LLM_TIMEOUT,
    ErrorCode.LLM_RATE_LIMITED,
    ErrorCode.SCRAPE_TIMEOUT,
    ErrorCode.NETWORK_ERROR,
    ErrorCode.DATABASE_CONNECTION_ERROR,
    ErrorCode.SERVICE_UNAVAILABLE,
    ErrorCode.RATE_LIMIT_EXCEEDED,
  ];

  return retryableCodes.includes(error.code);
}

/**
 * Wrap unknown error in AppError
 */
export function wrapError(error: unknown, defaultMessage = 'An error occurred'): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, 500, ErrorCode.INTERNAL_ERROR, {
      originalError: error.name,
      stack: error.stack,
    });
  }

  return new AppError(defaultMessage, 500, ErrorCode.INTERNAL_ERROR, {
    originalError: String(error),
  });
}
