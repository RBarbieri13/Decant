# Structured Logging System

Comprehensive structured logging system for the Decant standalone application using Pino logger with request context and correlation IDs.

## Overview

The logging system provides:
- Structured JSON logging (production) or pretty output (development)
- Request correlation IDs for tracing across services
- Automatic sensitive data redaction
- Performance and timing metrics
- Integration with error handling system
- Module-scoped loggers

## Basic Usage

### Simple Logging

```typescript
import { log } from '../logging/index.js';

log.info('Application started');
log.debug('Debug information');
log.warn('Warning message');
log.error('Error occurred');
```

### Logging with Context

```typescript
import { log } from '../logging/index.js';

log.info('User logged in', {
  userId: '123',
  username: 'john',
  ip: '192.168.1.1'
});

log.error('Database query failed', {
  query: 'SELECT * FROM users',
  error: 'Connection timeout',
  duration: 5000
});
```

### Logging Errors

```typescript
import { log } from '../logging/index.js';
import { NotFoundError } from '../errors/index.js';

try {
  throw new NotFoundError('User not found', { userId: '123' });
} catch (error) {
  log.logError('Failed to fetch user', error, {
    operation: 'getUserById',
    requestId: 'abc-123'
  });
}
```

## Request Context Logging

### In Route Handlers

```typescript
import { log } from '../logging/index.js';

router.get('/users/:id', async (req, res) => {
  const requestContext = {
    requestId: req.id,
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    startTime: Date.now()
  };

  log.logRequest('Fetching user', requestContext, {
    userId: req.params.id
  });

  // ... do work

  log.logRequest('User fetched successfully', requestContext);
});
```

### Request Correlation

The system automatically tracks requests with correlation IDs:

```typescript
// Request headers include:
// X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
// X-Correlation-ID: 6ba7b810-9dad-11d1-80b4-00c04fd430c8

// These IDs are automatically included in all logs for that request
```

## Specialized Logging Methods

### Performance Logging

```typescript
import { log } from '../logging/index.js';

const startTime = Date.now();

// ... do work

const duration = Date.now() - startTime;
log.logPerformance('database query', duration, {
  query: 'SELECT * FROM users',
  rowCount: 150
});
```

### Success with Timing

```typescript
import { log } from '../logging/index.js';

const startTime = Date.now();

// ... do work

log.logSuccess('User created successfully', startTime, {
  userId: '123',
  username: 'john'
});
```

### Database Query Logging

```typescript
import { log } from '../logging/index.js';

const duration = 45; // ms
log.logQuery(
  'SELECT * FROM users WHERE id = ?',
  ['123'],
  duration
);
```

### LLM Interaction Logging

```typescript
import { log } from '../logging/index.js';

log.logLLM(
  'classification',
  'gpt-4o-mini',
  {
    prompt: 150,
    completion: 80,
    total: 230
  },
  1250 // duration in ms
);
```

### Cache Operations

```typescript
import { log } from '../logging/index.js';

log.logCache('hit', 'user:123');
log.logCache('miss', 'user:456');
log.logCache('set', 'user:123', { ttl: 3600 });
log.logCache('invalidate', 'user:123');
```

### External API Calls

```typescript
import { log } from '../logging/index.js';

log.logExternalAPI(
  'openai',
  '/v1/chat/completions',
  200,
  1250
);
```

## Module-Scoped Loggers

Create a logger specific to a module:

```typescript
import { createModuleLogger } from '../logging/index.js';

const log = createModuleLogger('UserService');

log.info('User service initialized'); // Logs: { module: 'UserService', ... }
log.debug('Fetching user data'); // Logs: { module: 'UserService', ... }
```

## Child Loggers with Context

Create a child logger with fixed context:

```typescript
import { createChildLogger } from '../logging/index.js';

const requestLogger = createChildLogger({
  requestId: 'abc-123',
  userId: '456'
});

// All logs from this logger include requestId and userId
requestLogger.info('Processing request');
requestLogger.debug('Validating input');
```

## Request Logger

Create a logger for a specific request:

```typescript
import { createRequestLogger } from '../logging/index.js';

const logger = createRequestLogger({
  requestId: 'abc-123',
  method: 'GET',
  path: '/api/users/456',
  userId: '789'
});

logger.info('Request started');
logger.info('Request completed');
```

## Log Levels

Available log levels (from most to least verbose):

1. `trace` - Very detailed debugging
2. `debug` - Detailed debugging (development)
3. `info` - General information (default in production)
4. `warn` - Warnings
5. `error` - Errors
6. `fatal` - Critical errors (application crash)

### Setting Log Level

```typescript
import { setLogLevel, getLogLevel, isLevelEnabled } from '../logging/index.js';

// Set level at runtime
setLogLevel('debug');

// Check current level
const level = getLogLevel();

// Check if level is enabled
if (isLevelEnabled('debug')) {
  // Expensive debug operation
}
```

## Configuration

Set via environment variables:

```bash
# Log level
LOG_LEVEL=debug

# Log format (json or pretty)
LOG_FORMAT=pretty

# Environment (affects default settings)
NODE_ENV=development
```

## Output Formats

### Pretty Format (Development)

```
[2026-01-30 12:34:56.789] INFO: User logged in
    userId: "123"
    username: "john"
    requestId: "550e8400-e29b-41d4-a716-446655440000"
```

### JSON Format (Production)

```json
{
  "level": "info",
  "time": "2026-01-30T12:34:56.789Z",
  "msg": "User logged in",
  "userId": "123",
  "username": "john",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "env": "production"
}
```

## Sensitive Data Redaction

The logger automatically redacts sensitive fields:

```typescript
log.info('Request processed', {
  apiKey: 'secret-key',        // Redacted
  password: 'user-password',   // Redacted
  token: 'auth-token',         // Redacted
  email: 'user@example.com',   // Not redacted
  userId: '123'                // Not redacted
});

// Output:
{
  "apiKey": "[REDACTED]",
  "password": "[REDACTED]",
  "token": "[REDACTED]",
  "email": "user@example.com",
  "userId": "123"
}
```

Redacted fields:
- `authorization` header
- `cookie` header
- `apiKey`
- `password`
- `token`
- `secret`
- Any nested field with these names

## Error Formatting

Errors are automatically formatted with structured context:

```typescript
import { formatError } from '../logging/index.js';
import { NotFoundError } from '../errors/index.js';

const error = new NotFoundError('User not found', { userId: '123' });
const formatted = formatError(error);

// Returns:
{
  name: 'NotFoundError',
  message: 'User not found',
  code: 'NOT_FOUND',
  statusCode: 404,
  isOperational: true,
  context: { userId: '123' },
  stack: '...' // Only in development
}
```

## Request Context Helpers

```typescript
import {
  formatRequestContext,
  calculateDuration
} from '../logging/index.js';

const req = {
  requestId: 'abc-123',
  method: 'GET',
  path: '/api/users',
  userId: '456',
  ip: '192.168.1.1',
  startTime: Date.now()
};

// Format for logging
const formatted = formatRequestContext(req);
// Returns: { requestId, method, path, userId, ip }

// Calculate duration
const duration = calculateDuration(req.startTime);
// Returns: number of milliseconds since startTime
```

## Best Practices

1. **Use appropriate log levels**:
   - `debug`: Development details
   - `info`: General operations
   - `warn`: Unexpected but handled situations
   - `error`: Errors that need attention

2. **Include context**: Add relevant data for debugging
   ```typescript
   log.info('User created', { userId: '123', email: 'user@example.com' });
   ```

3. **Use structured data**: Pass objects instead of string concatenation
   ```typescript
   // Good
   log.info('Processing order', { orderId: '123', items: 5 });

   // Bad
   log.info(`Processing order 123 with 5 items`);
   ```

4. **Don't log sensitive data**: Avoid passwords, tokens, credit cards
   ```typescript
   // Bad
   log.info('Login attempt', { password: 'secret123' });

   // Good
   log.info('Login attempt', { username: 'john' });
   ```

5. **Use module loggers**: Create scoped loggers for modules
   ```typescript
   const log = createModuleLogger('PaymentService');
   ```

6. **Log performance metrics**: Track slow operations
   ```typescript
   log.logPerformance('database query', duration, { query: 'SELECT ...' });
   ```

7. **Include request context**: Add request IDs for tracing
   ```typescript
   log.info('Processing request', { requestId: req.id });
   ```

## Integration with Error Handling

Errors are automatically logged by the error handler middleware:

```typescript
// In route handler
throw new NotFoundError('User not found', { userId: '123' });

// Automatically logged as:
{
  "level": "warn",
  "msg": "NotFoundError: User not found",
  "request": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "method": "GET",
    "path": "/api/users/123"
  },
  "err": {
    "name": "NotFoundError",
    "message": "User not found",
    "code": "NOT_FOUND",
    "statusCode": 404,
    "context": { "userId": "123" }
  }
}
```

## Examples

### Complete Route Handler Example

```typescript
import { asyncHandler } from '../middleware/errorHandler.js';
import { log } from '../logging/index.js';
import { NotFoundError, DatabaseError } from '../errors/index.js';

router.get('/users/:id', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const requestContext = {
    requestId: req.id,
    method: req.method,
    path: req.path,
    startTime
  };

  log.info('Fetching user', {
    ...requestContext,
    userId: req.params.id
  });

  try {
    const user = await db.users.findById(req.params.id);

    if (!user) {
      throw new NotFoundError('User not found', { userId: req.params.id });
    }

    log.logSuccess('User fetched successfully', startTime, {
      requestId: req.id,
      userId: user.id
    });

    res.json(user);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error; // Let error handler deal with it
    }

    // Wrap database errors
    throw new DatabaseError('Failed to fetch user', 500, ErrorCode.DATABASE_QUERY_ERROR, {
      userId: req.params.id,
      originalError: error.message
    });
  }
}));
```

### Service Layer Example

```typescript
import { createModuleLogger } from '../logging/index.js';
import { DatabaseError } from '../errors/index.js';

const log = createModuleLogger('UserService');

export class UserService {
  async getUser(userId: string): Promise<User> {
    const startTime = Date.now();

    log.debug('Fetching user from database', { userId });

    try {
      const user = await db.users.findById(userId);

      log.logPerformance('getUserById', Date.now() - startTime, {
        userId,
        found: !!user
      });

      return user;
    } catch (error) {
      log.logError('Database query failed', error, { userId });
      throw new DatabaseError('Failed to fetch user');
    }
  }
}
```

## Migration from Old Logger

The new logging system is mostly backward compatible:

```typescript
// Old code (still works)
import { log } from '../logger/index.js';
log.info('Message');
log.error('Error', { context: 'data' });

// New code (preferred)
import { log } from '../logging/index.js';
log.info('Message', { structured: 'context' });
log.logError('Error message', error, { additional: 'context' });
```

To migrate:
1. Update imports from `../logger/index.js` to `../logging/index.js`
2. Pass context as objects instead of separate arguments
3. Use specialized logging methods (`logError`, `logLLM`, etc.)
4. Add request context to route handlers
5. Use module-scoped loggers for better organization
