# Quick Reference: Errors & Logging

Quick reference for using the error handling and logging systems in Decant.

## Error Classes - Quick Pick

```typescript
import {
  // Validation (400)
  ValidationError,
  InvalidInputError,

  // Not Found (404)
  NotFoundError,
  NodeNotFoundError,

  // Auth (401, 403)
  UnauthorizedError,
  ForbiddenError,
  SSRFError,

  // Rate Limit (429)
  RateLimitError,

  // LLM (502, 503, 504)
  LLMError,
  LLMTimeoutError,
  LLMUnavailableError,
  LLMInvalidResponseError,

  // Scraping (502)
  ScrapeError,
  ScrapeTimeoutError,
  NetworkError,

  // Import (500)
  ImportError,
  ClassificationError,

  // Database (500)
  DatabaseError,
  DatabaseQueryError,

  // Error codes
  ErrorCode,
} from '../errors/index.js';
```

## Common Error Patterns

### Not Found
```typescript
throw new NotFoundError('User not found', { userId: '123' });
```

### Validation
```typescript
throw new ValidationError('Invalid input', [
  { field: 'email', message: 'Invalid email format' }
]);
```

### Database
```typescript
throw new DatabaseQueryError('Query failed', { query, params });
```

### LLM
```typescript
throw new LLMTimeoutError('Request timeout', { model, duration });
```

### Scraping
```typescript
throw new ScrapeError('Failed to fetch URL', { url, statusCode });
```

## Logging - Quick Pick

```typescript
import { log } from '../logging/index.js';

// Basic
log.info('Message', { context });
log.error('Error message', { context });
log.warn('Warning', { context });
log.debug('Debug info', { context });

// Specialized
log.logError('Error occurred', error, { context });
log.logSuccess('Operation completed', startTime, { context });
log.logPerformance('operation', duration, { context });
log.logLLM('classification', model, tokens, duration);
log.logCache('hit', key);
log.logQuery(sql, params, duration);
```

## Common Logging Patterns

### Route Handler
```typescript
router.get('/users/:id', asyncHandler(async (req, res) => {
  const startTime = Date.now();

  log.info('Fetching user', {
    requestId: req.id,
    userId: req.params.id
  });

  const user = await db.users.findById(req.params.id);

  if (!user) {
    throw new NotFoundError('User not found', { userId: req.params.id });
  }

  log.logSuccess('User fetched', startTime, { userId: user.id });
  res.json(user);
}));
```

### Service Method
```typescript
async getUser(id: string): Promise<User> {
  try {
    log.debug('Fetching user', { userId: id });
    return await db.users.findById(id);
  } catch (error) {
    log.logError('Failed to fetch user', error, { userId: id });
    throw new DatabaseError('Database error');
  }
}
```

### LLM Call
```typescript
const startTime = Date.now();

try {
  const result = await llm.complete(messages);

  log.logLLM('completion', result.model, result.usage, Date.now() - startTime);

  return result;
} catch (error) {
  log.logError('LLM call failed', error);
  throw new LLMTimeoutError('Request timeout');
}
```

## Module Logger

```typescript
import { createModuleLogger } from '../logging/index.js';

const log = createModuleLogger('UserService');

log.info('User service initialized');
log.debug('Processing request', { userId });
```

## Route Handler Template

```typescript
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { log } from '../logging/index.js';
import { NotFoundError, ValidationError } from '../errors/index.js';

const router = Router();

router.get('/:id', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;

  log.info('Operation started', { requestId: req.id, id });

  // Validation
  if (!isValid(id)) {
    throw new ValidationError('Invalid ID', [
      { field: 'id', message: 'Must be UUID' }
    ]);
  }

  // Database query
  const result = await db.query(id);

  if (!result) {
    throw new NotFoundError('Not found', { id });
  }

  log.logSuccess('Operation completed', startTime, { id });
  res.json(result);
}));

export default router;
```

## Service Template

```typescript
import { createModuleLogger } from '../logging/index.js';
import { NotFoundError, DatabaseError } from '../errors/index.js';

const log = createModuleLogger('MyService');

export class MyService {
  async getById(id: string): Promise<Resource> {
    const startTime = Date.now();

    log.debug('Fetching resource', { id });

    try {
      const resource = await db.resources.findById(id);

      if (!resource) {
        throw new NotFoundError('Resource not found', { id });
      }

      log.logPerformance('getById', Date.now() - startTime, { id });

      return resource;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;

      log.logError('Database query failed', error, { id });
      throw new DatabaseError('Failed to fetch resource');
    }
  }
}
```

## Error Utilities

```typescript
import {
  isOperationalError,
  isRetryableError,
  getErrorCode,
  getStatusCode,
  wrapError,
} from '../errors/index.js';

// Check if error is operational
if (isOperationalError(error)) {
  // Expected error
}

// Check if should retry
if (isRetryableError(error)) {
  await retry();
}

// Get error code
const code = getErrorCode(error); // ErrorCode | undefined

// Get status code
const status = getStatusCode(error); // number

// Wrap unknown error
const appError = wrapError(unknownError);
```

## Error Response Examples

### Success
```json
{
  "data": { "id": "123", "name": "John" }
}
```

### Error
```json
{
  "error": "User not found",
  "code": "NOT_FOUND",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-01-30T12:34:56.789Z"
}
```

### Validation Error
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_FAILED",
  "details": [
    { "field": "email", "message": "Invalid format" }
  ],
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-01-30T12:34:56.789Z"
}
```

## Environment Variables

```bash
# Required
NODE_ENV=development          # development | production | test

# Optional
LOG_LEVEL=debug              # trace | debug | info | warn | error | fatal
LOG_FORMAT=pretty            # json | pretty
```

## Common Imports

```typescript
// Errors
import {
  NotFoundError,
  ValidationError,
  DatabaseError,
  LLMError,
  ErrorCode,
} from '../errors/index.js';

// Logging
import { log, createModuleLogger } from '../logging/index.js';

// Middleware
import { asyncHandler } from '../middleware/errorHandler.js';
```

## Tips

1. **Always use asyncHandler** for async route handlers
2. **Use specific error classes** instead of generic Error
3. **Include context** in logs and errors
4. **Log at appropriate levels** (debug for details, info for operations)
5. **Measure performance** with startTime and logSuccess
6. **Don't log sensitive data** (passwords, tokens, keys)
7. **Add request IDs** for tracing (automatically included)
8. **Use module loggers** for better organization

## Common Mistakes

### ❌ Don't
```typescript
// Generic error
throw new Error('Not found');

// String concatenation
log.info(`User ${userId} created`);

// No error handling
const user = await db.findUser(id);

// Sensitive data
log.info('Login', { password: '...' });
```

### ✅ Do
```typescript
// Specific error with context
throw new NotFoundError('User not found', { userId });

// Structured logging
log.info('User created', { userId });

// Error handling
try {
  const user = await db.findUser(id);
} catch (error) {
  log.logError('Query failed', error, { userId: id });
  throw new DatabaseError('Failed to fetch user');
}

// Safe logging
log.info('Login attempt', { username });
```

## Documentation Links

- [Full Error Documentation](./src/backend/errors/README.md)
- [Full Logging Documentation](./src/backend/logging/README.md)
- [Complete Examples](./src/backend/errors/EXAMPLES.md)
- [Implementation Guide](./ERROR_AND_LOGGING_IMPLEMENTATION.md)
