# Error Handling System

Comprehensive error handling system for the Decant standalone application with structured error classes, error codes, and context tracking.

## Overview

The error system provides:
- Type-safe error classes with consistent structure
- Machine-readable error codes for client handling
- Context tracking for debugging
- Operational vs programming error classification
- Production-safe error messages

## Error Class Hierarchy

```
Error (JavaScript built-in)
└── AppError (Base application error)
    ├── ValidationError
    │   ├── InvalidInputError
    │   └── SchemaValidationError
    ├── NotFoundError
    │   └── NodeNotFoundError
    ├── UnauthorizedError
    ├── ForbiddenError
    │   └── SSRFError
    ├── ConflictError
    ├── RateLimitError
    ├── LLMError
    │   ├── LLMUnavailableError
    │   ├── LLMTimeoutError
    │   ├── LLMInvalidResponseError
    │   ├── LLMRateLimitError
    │   ├── LLMNotInitializedError
    │   └── LLMParsingError
    ├── ExternalServiceError
    │   ├── ScrapeError
    │   │   ├── ScrapeTimeoutError
    │   │   └── ScrapeTooLargeError
    │   └── NetworkError
    ├── ImportError
    │   ├── ExtractionError
    │   ├── ClassificationError
    │   └── HierarchyGenerationError
    ├── DatabaseError
    │   ├── DatabaseConnectionError
    │   ├── DatabaseQueryError
    │   ├── DatabaseTransactionError
    │   └── DatabaseConstraintError
    ├── ConfigurationError
    ├── NotImplementedError
    └── ServiceUnavailableError
```

## Usage Examples

### Basic Error Throwing

```typescript
import { NotFoundError, ValidationError, ErrorCode } from '../errors/index.js';

// Simple error
throw new NotFoundError('User not found');

// Error with context
throw new NotFoundError('User not found', { userId: '123' });

// Validation error with field details
throw new ValidationError('Invalid request', [
  { field: 'email', message: 'Invalid email format' },
  { field: 'password', message: 'Password too short' }
]);
```

### LLM Errors

```typescript
import {
  LLMTimeoutError,
  LLMInvalidResponseError,
  LLMNotInitializedError
} from '../errors/index.js';

// Timeout error
throw new LLMTimeoutError('Request timeout after 30s', {
  model: 'gpt-4o-mini',
  duration: 30000
});

// Invalid response
throw new LLMInvalidResponseError('Failed to parse JSON response', {
  model: 'gpt-4o-mini',
  rawResponse: 'invalid json...'
});

// Not initialized
throw new LLMNotInitializedError('Call initializeProvider() first');
```

### Database Errors

```typescript
import {
  DatabaseQueryError,
  DatabaseConnectionError,
  DatabaseConstraintError
} from '../errors/index.js';

// Query error
throw new DatabaseQueryError('Failed to fetch user', {
  query: 'SELECT * FROM users WHERE id = ?',
  params: ['123']
});

// Connection error
throw new DatabaseConnectionError('Cannot connect to database', {
  host: 'localhost',
  port: 5432
});

// Constraint violation
throw new DatabaseConstraintError('Unique constraint violation', {
  table: 'users',
  constraint: 'users_email_unique',
  value: 'duplicate@example.com'
});
```

### Import Errors

```typescript
import {
  ScrapeError,
  ScrapeTimeoutError,
  ClassificationError
} from '../errors/index.js';

// Scrape error
throw new ScrapeError('Failed to fetch URL', {
  url: 'https://example.com',
  statusCode: 403
});

// Scrape timeout
throw new ScrapeTimeoutError('Request timeout', {
  url: 'https://example.com',
  timeout: 30000
});

// Classification error
throw new ClassificationError('LLM classification failed', {
  url: 'https://example.com',
  phase: 'phase1'
});
```

### Adding Context to Errors

```typescript
import { AppError } from '../errors/index.js';

try {
  // Some operation
  throw new NotFoundError('Resource not found');
} catch (error) {
  if (error instanceof AppError) {
    // Add additional context
    throw error.withContext({
      operation: 'fetchUserData',
      timestamp: Date.now()
    });
  }
  throw error;
}
```

### Error Checking

```typescript
import {
  isOperationalError,
  isRetryableError,
  getErrorCode,
  getStatusCode
} from '../errors/index.js';

try {
  // Some operation
} catch (error) {
  // Check if error is operational (expected)
  if (isOperationalError(error)) {
    console.log('Expected error:', error.message);
  }

  // Check if error should be retried
  if (isRetryableError(error)) {
    // Retry the operation
  }

  // Get error code
  const code = getErrorCode(error);
  if (code === ErrorCode.LLM_TIMEOUT) {
    // Handle timeout specifically
  }

  // Get HTTP status code
  const status = getStatusCode(error);
  console.log('Status:', status);
}
```

### In Route Handlers

```typescript
import { asyncHandler } from '../middleware/errorHandler.js';
import { NotFoundError, ValidationError } from '../errors/index.js';

// Using asyncHandler wrapper
router.get('/users/:id', asyncHandler(async (req, res) => {
  const userId = req.params.id;

  // Validation
  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  // Fetch user
  const user = await db.users.findById(userId);

  if (!user) {
    throw new NotFoundError(`User not found: ${userId}`, { userId });
  }

  res.json(user);
}));
```

## Error Response Format

All errors are automatically converted to consistent JSON responses:

```json
{
  "error": "User not found",
  "code": "NOT_FOUND",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-01-30T12:34:56.789Z"
}
```

With validation details:

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_FAILED",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-01-30T12:34:56.789Z",
  "details": [
    { "field": "email", "message": "Invalid email format" },
    { "field": "password", "message": "Password too short" }
  ]
}
```

With retry-after for rate limits:

```json
{
  "error": "Too many requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-01-30T12:34:56.789Z",
  "retryAfter": 60
}
```

## Error Codes

All error codes are defined in the `ErrorCode` enum:

```typescript
enum ErrorCode {
  // Validation (400)
  VALIDATION_FAILED,
  INVALID_INPUT,
  SCHEMA_VALIDATION_FAILED,

  // Not Found (404)
  NOT_FOUND,
  NODE_NOT_FOUND,

  // Auth (401, 403)
  UNAUTHORIZED,
  FORBIDDEN,
  SSRF_BLOCKED,

  // Rate Limiting (429)
  RATE_LIMIT_EXCEEDED,

  // LLM Errors (502, 503, 504)
  LLM_UNAVAILABLE,
  LLM_TIMEOUT,
  LLM_INVALID_RESPONSE,
  LLM_RATE_LIMITED,
  LLM_NOT_INITIALIZED,
  LLM_API_ERROR,
  LLM_PARSING_ERROR,

  // External Services (502, 503)
  EXTERNAL_SERVICE_ERROR,
  SCRAPE_FAILED,
  SCRAPE_TIMEOUT,
  NETWORK_ERROR,

  // Import Errors
  IMPORT_FAILED,
  EXTRACTION_FAILED,
  CLASSIFICATION_FAILED,

  // Database (500, 503)
  DATABASE_ERROR,
  DATABASE_CONNECTION_ERROR,
  DATABASE_QUERY_ERROR,
  DATABASE_TRANSACTION_ERROR,

  // Internal (500)
  INTERNAL_ERROR,
  CONFIGURATION_ERROR,
  SERVICE_UNAVAILABLE,
}
```

## Best Practices

1. **Use specific error types**: Prefer `NotFoundError` over generic `AppError`
2. **Add context**: Include relevant data for debugging
3. **Don't include sensitive data**: Avoid passwords, tokens, or PII in context
4. **Use asyncHandler**: Wrap async route handlers to automatically catch errors
5. **Operational vs Programming**: Operational errors are expected (404, validation), programming errors are bugs
6. **Production safety**: Error messages are automatically sanitized in production
7. **Logging**: Errors are automatically logged with appropriate severity

## Integration with Logging

Errors are automatically logged by the error handler middleware with structured context:

```typescript
// This happens automatically
log.error('NotFoundError: User not found', {
  req: {
    requestId: '550e8400-e29b-41d4-a716-446655440000',
    method: 'GET',
    path: '/api/users/123',
  },
  err: {
    name: 'NotFoundError',
    message: 'User not found',
    code: 'NOT_FOUND',
    statusCode: 404,
    context: { userId: '123' }
  }
});
```

## Migration from Old Error System

The new error system is backward compatible. Old code using the previous `AppError` class will continue to work:

```typescript
// Old code (still works)
throw new AppError('Not found', 404, 'NOT_FOUND');

// New code (preferred)
throw new NotFoundError('Not found');
```

To migrate:
1. Replace generic `AppError` with specific error types
2. Use `ErrorCode` enum instead of string literals
3. Add context objects for better debugging
4. Use the `asyncHandler` wrapper for route handlers
