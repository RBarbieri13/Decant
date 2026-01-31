# Error Handling and Structured Logging Implementation

Complete implementation of enhanced error handling and structured logging for the Decant standalone application.

## Overview

This implementation provides a production-ready error handling and logging system with:

- **Type-safe error classes** with consistent structure and error codes
- **Structured JSON logging** with request correlation and context tracking
- **Automatic error sanitization** for production environments
- **Request/response tracking** with correlation IDs
- **Performance monitoring** with timing metrics
- **Sensitive data redaction** in logs
- **Integration** between errors and logging systems

## Files Created

### 1. Error System

**Location**: `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/backend/errors/`

- **index.ts** - Enhanced error classes with error codes and context
  - Base `AppError` class with metadata
  - 40+ error codes in `ErrorCode` enum
  - 25+ specific error classes for different scenarios
  - Utility functions for error handling

- **README.md** - Comprehensive error system documentation
  - Error class hierarchy
  - Usage examples
  - Error codes reference
  - Best practices
  - Migration guide

- **EXAMPLES.md** - Real-world usage examples
  - Route handler patterns
  - Service layer examples
  - Database operations
  - LLM integration
  - External API calls
  - Error recovery strategies

### 2. Logging System

**Location**: `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/backend/logging/`

- **index.ts** - Enhanced structured logging with Pino
  - Request context tracking
  - Correlation ID support
  - Specialized logging methods
  - Module-scoped loggers
  - Error formatting integration
  - Sensitive data redaction

- **README.md** - Comprehensive logging documentation
  - Basic usage
  - Request context logging
  - Specialized logging methods
  - Configuration options
  - Output formats
  - Best practices

### 3. Middleware Updates

**Location**: `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/backend/middleware/`

- **errorHandler.ts** - Updated error handler middleware
  - Integration with new error classes
  - Enhanced logging with context
  - Automatic error sanitization
  - Global error handlers for uncaught exceptions
  - Request context tracking

- **requestLogger.ts** - Updated request logger middleware
  - Correlation ID support
  - Enhanced request/response serialization
  - Automatic ID headers (X-Request-ID, X-Correlation-ID)

## Key Features

### Error Classes

```typescript
// Type-safe error handling
throw new NotFoundError('User not found', { userId: '123' });
throw new ValidationError('Invalid input', [
  { field: 'email', message: 'Invalid format' }
]);
throw new LLMTimeoutError('Request timeout', { duration: 30000 });
throw new DatabaseError('Query failed', 500, ErrorCode.DATABASE_QUERY_ERROR);
```

### Error Codes

```typescript
enum ErrorCode {
  // Validation (400)
  VALIDATION_FAILED,
  INVALID_INPUT,

  // Not Found (404)
  NOT_FOUND,
  NODE_NOT_FOUND,

  // LLM (502, 503, 504)
  LLM_UNAVAILABLE,
  LLM_TIMEOUT,
  LLM_INVALID_RESPONSE,
  LLM_RATE_LIMITED,

  // Database (500, 503)
  DATABASE_ERROR,
  DATABASE_CONNECTION_ERROR,
  DATABASE_QUERY_ERROR,

  // And 30+ more...
}
```

### Structured Logging

```typescript
// Simple logging with context
log.info('User created', { userId: '123', email: 'user@example.com' });

// Error logging
log.logError('Operation failed', error, { operation: 'createUser' });

// Performance logging
log.logPerformance('database query', duration, { query: 'SELECT...' });

// LLM logging
log.logLLM('classification', 'gpt-4o-mini', tokens, duration);

// Request logging
log.logRequest('Request completed', requestContext);
```

### Request Tracking

```typescript
// Automatic correlation IDs in headers
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
X-Correlation-ID: 6ba7b810-9dad-11d1-80b4-00c04fd430c8

// All logs include these IDs
{
  "level": "info",
  "msg": "User created",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "correlationId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "userId": "123"
}
```

### Error Responses

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
  "details": [
    { "field": "email", "message": "Invalid email format" },
    { "field": "password", "message": "Password too short" }
  ],
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-01-30T12:34:56.789Z"
}
```

## Integration Points

### Route Handlers

```typescript
import { asyncHandler } from '../middleware/errorHandler.js';
import { log } from '../logging/index.js';
import { NotFoundError, ValidationError } from '../errors/index.js';

router.get('/users/:id', asyncHandler(async (req, res) => {
  const startTime = Date.now();

  log.info('Fetching user', { requestId: req.id, userId: req.params.id });

  const user = await db.users.findById(req.params.id);

  if (!user) {
    throw new NotFoundError('User not found', { userId: req.params.id });
  }

  log.logSuccess('User fetched', startTime, { userId: user.id });
  res.json(user);
}));
```

### Service Layer

```typescript
import { createModuleLogger } from '../logging/index.js';
import { DatabaseError, ErrorCode } from '../errors/index.js';

const log = createModuleLogger('UserService');

export class UserService {
  async getUser(id: string): Promise<User> {
    try {
      return await db.users.findById(id);
    } catch (error) {
      log.logError('Database query failed', error, { userId: id });
      throw new DatabaseError('Failed to fetch user', 500, ErrorCode.DATABASE_QUERY_ERROR);
    }
  }
}
```

### LLM Integration

```typescript
import { log } from '../logging/index.js';
import { LLMTimeoutError, LLMInvalidResponseError } from '../errors/index.js';

async function classify(content: string): Promise<Classification> {
  try {
    const result = await llm.completeWithSchema(messages, schema);

    log.logLLM('classification', result.model, result.usage, duration);

    return result.data;
  } catch (error) {
    if (error.message.includes('timeout')) {
      throw new LLMTimeoutError('LLM timeout', { duration });
    }
    throw new LLMInvalidResponseError('Invalid response');
  }
}
```

## Migration Guide

### From Old Logger

```typescript
// Old (still works)
import { log } from '../logger/index.js';
log.info('Message');

// New (preferred)
import { log } from '../logging/index.js';
log.info('Message', { context: 'data' });
```

### From Old Errors

```typescript
// Old (still works)
throw new AppError('Not found', 404, 'NOT_FOUND');

// New (preferred)
throw new NotFoundError('Not found', { resourceId: '123' });
```

### Adding to Existing Routes

1. Import new error classes:
   ```typescript
   import { NotFoundError, ValidationError } from '../errors/index.js';
   ```

2. Replace generic errors:
   ```typescript
   // Before
   if (!user) {
     throw new Error('User not found');
   }

   // After
   if (!user) {
     throw new NotFoundError('User not found', { userId });
   }
   ```

3. Add logging:
   ```typescript
   import { log } from '../logging/index.js';

   log.info('Operation started', { userId });
   ```

4. Use asyncHandler:
   ```typescript
   import { asyncHandler } from '../middleware/errorHandler.js';

   router.get('/path', asyncHandler(async (req, res) => {
     // Errors automatically caught and handled
   }));
   ```

## Configuration

### Environment Variables

```bash
# Logging
LOG_LEVEL=debug              # trace, debug, info, warn, error, fatal
LOG_FORMAT=pretty            # json, pretty
NODE_ENV=development         # development, production, test

# Server (existing)
PORT=3000
DATABASE_PATH=./data/decant.db
OPENAI_API_KEY=sk-...
```

### Production Recommendations

```bash
# Production settings
NODE_ENV=production
LOG_LEVEL=info
LOG_FORMAT=json
```

## Benefits

### Type Safety
- TypeScript types for all error classes
- Compile-time error checking
- IntelliSense support

### Debugging
- Request correlation IDs
- Structured context in logs
- Stack traces in development

### Monitoring
- Machine-readable error codes
- Performance metrics
- Timing information

### Security
- Automatic sensitive data redaction
- Production error message sanitization
- No internal details leaked

### Scalability
- Module-scoped loggers
- Performance tracking
- External service monitoring

## Testing

### Error Creation

```typescript
import { NotFoundError, ErrorCode } from '../errors/index.js';

test('creates error with context', () => {
  const error = new NotFoundError('User not found', { userId: '123' });

  expect(error.statusCode).toBe(404);
  expect(error.code).toBe(ErrorCode.NOT_FOUND);
  expect(error.context).toEqual({ userId: '123' });
  expect(error.isOperational).toBe(true);
});
```

### Error Handling

```typescript
import { isOperationalError, isRetryableError } from '../errors/index.js';

test('identifies operational errors', () => {
  const error = new NotFoundError('Not found');
  expect(isOperationalError(error)).toBe(true);
});

test('identifies retryable errors', () => {
  const error = new LLMTimeoutError('Timeout');
  expect(isRetryableError(error)).toBe(true);
});
```

### Logging

```typescript
import { log } from '../logging/index.js';

test('logs with context', () => {
  const spy = jest.spyOn(logger, 'info');

  log.info('Test message', { userId: '123' });

  expect(spy).toHaveBeenCalledWith({ userId: '123' }, 'Test message');
});
```

## Next Steps

1. **Update existing code**:
   - Replace generic Error throws with specific error classes
   - Add logging to key operations
   - Update route handlers to use asyncHandler

2. **Add monitoring**:
   - Set up log aggregation (e.g., Datadog, Elasticsearch)
   - Create dashboards for error rates
   - Set up alerts for critical errors

3. **Performance optimization**:
   - Use performance logs to identify bottlenecks
   - Monitor LLM usage and costs
   - Track database query performance

4. **Documentation**:
   - Document error codes for API consumers
   - Create runbooks for common errors
   - Update API documentation with error responses

## Resources

- [Error Classes Documentation](./src/backend/errors/README.md)
- [Logging Documentation](./src/backend/logging/README.md)
- [Usage Examples](./src/backend/errors/EXAMPLES.md)
- [Pino Documentation](https://getpino.io/)
- [Express Error Handling](https://expressjs.com/en/guide/error-handling.html)

## Support

For questions or issues:
1. Check the documentation files
2. Review the examples
3. Check existing error/logging usage in the codebase
4. Ensure environment variables are set correctly
