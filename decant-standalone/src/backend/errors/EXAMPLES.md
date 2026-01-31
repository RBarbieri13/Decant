# Error and Logging Examples

Complete examples showing how to use the error and logging systems together in real-world scenarios.

## Table of Contents

- [Route Handler Examples](#route-handler-examples)
- [Service Layer Examples](#service-layer-examples)
- [Database Operations](#database-operations)
- [LLM Integration](#llm-integration)
- [External API Calls](#external-api-calls)
- [Import/Scraping Operations](#importscraping-operations)
- [Error Recovery](#error-recovery)

## Route Handler Examples

### Basic CRUD Operations

```typescript
import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { log } from '../logging/index.js';
import {
  NotFoundError,
  ValidationError,
  DatabaseError,
  ErrorCode
} from '../errors/index.js';

const router = Router();

// GET single resource
router.get('/users/:id', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;

  log.info('Fetching user', {
    requestId: req.id,
    userId: id
  });

  const user = await db.users.findById(id);

  if (!user) {
    throw new NotFoundError(`User not found: ${id}`, { userId: id });
  }

  log.logSuccess('User fetched', startTime, {
    requestId: req.id,
    userId: id
  });

  res.json(user);
}));

// POST create resource
router.post('/users', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { email, name } = req.body;

  // Validation
  const errors: Array<{ field: string; message: string }> = [];

  if (!email || !email.includes('@')) {
    errors.push({ field: 'email', message: 'Valid email is required' });
  }

  if (!name || name.length < 2) {
    errors.push({ field: 'name', message: 'Name must be at least 2 characters' });
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid user data', errors);
  }

  log.info('Creating user', {
    requestId: req.id,
    email
  });

  try {
    const user = await db.users.create({ email, name });

    log.logSuccess('User created', startTime, {
      requestId: req.id,
      userId: user.id
    });

    res.status(201).json(user);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      throw new ConflictError('User with this email already exists', {
        email,
        constraint: 'users_email_unique'
      });
    }
    throw new DatabaseError('Failed to create user', 500, ErrorCode.DATABASE_ERROR, {
      email,
      originalError: error.message
    });
  }
}));

// PUT update resource
router.put('/users/:id', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;
  const { name } = req.body;

  log.info('Updating user', {
    requestId: req.id,
    userId: id
  });

  const user = await db.users.findById(id);
  if (!user) {
    throw new NotFoundError(`User not found: ${id}`, { userId: id });
  }

  const updated = await db.users.update(id, { name });

  log.logSuccess('User updated', startTime, {
    requestId: req.id,
    userId: id
  });

  res.json(updated);
}));

// DELETE resource
router.delete('/users/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  log.info('Deleting user', {
    requestId: req.id,
    userId: id
  });

  const user = await db.users.findById(id);
  if (!user) {
    throw new NotFoundError(`User not found: ${id}`, { userId: id });
  }

  await db.users.delete(id);

  log.info('User deleted', {
    requestId: req.id,
    userId: id
  });

  res.status(204).send();
}));

export default router;
```

## Service Layer Examples

### User Service with Complete Error Handling

```typescript
import { createModuleLogger } from '../logging/index.js';
import {
  NotFoundError,
  DatabaseError,
  ValidationError,
  ErrorCode
} from '../errors/index.js';

const log = createModuleLogger('UserService');

export class UserService {
  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<User> {
    const startTime = Date.now();

    log.debug('Fetching user', { userId });

    try {
      const user = await db.users.findById(userId);

      if (!user) {
        log.warn('User not found', { userId });
        throw new NotFoundError(`User not found: ${userId}`, { userId });
      }

      log.logPerformance('getUser', Date.now() - startTime, {
        userId,
        found: true
      });

      return user;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      log.logError('Failed to fetch user', error, { userId });
      throw new DatabaseError(
        'Failed to fetch user from database',
        500,
        ErrorCode.DATABASE_QUERY_ERROR,
        { userId, originalError: error.message }
      );
    }
  }

  /**
   * Create new user
   */
  async createUser(data: CreateUserInput): Promise<User> {
    const startTime = Date.now();

    log.info('Creating user', { email: data.email });

    // Validation
    this.validateUserData(data);

    try {
      const user = await db.users.create(data);

      log.logSuccess('User created', startTime, {
        userId: user.id,
        email: user.email
      });

      return user;
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        log.warn('Duplicate user email', { email: data.email });
        throw new ConflictError('User with this email already exists', {
          email: data.email
        });
      }

      log.logError('Failed to create user', error, { email: data.email });
      throw new DatabaseError(
        'Failed to create user',
        500,
        ErrorCode.DATABASE_ERROR,
        { email: data.email }
      );
    }
  }

  /**
   * Validate user data
   */
  private validateUserData(data: CreateUserInput): void {
    const errors: Array<{ field: string; message: string }> = [];

    if (!data.email || !data.email.includes('@')) {
      errors.push({ field: 'email', message: 'Valid email is required' });
    }

    if (!data.name || data.name.length < 2) {
      errors.push({ field: 'name', message: 'Name must be at least 2 characters' });
    }

    if (errors.length > 0) {
      log.warn('User data validation failed', { errors });
      throw new ValidationError('Invalid user data', errors);
    }
  }
}
```

## Database Operations

### Transaction with Error Handling

```typescript
import { log } from '../logging/index.js';
import {
  DatabaseTransactionError,
  DatabaseError,
  ErrorCode
} from '../errors/index.js';

async function transferFunds(fromId: string, toId: string, amount: number): Promise<void> {
  const startTime = Date.now();

  log.info('Starting fund transfer', {
    fromId,
    toId,
    amount
  });

  const db = getDatabase();

  try {
    await db.transaction(async (tx) => {
      // Debit from account
      const fromAccount = await tx.accounts.findById(fromId);
      if (!fromAccount) {
        throw new NotFoundError(`Account not found: ${fromId}`, { accountId: fromId });
      }

      if (fromAccount.balance < amount) {
        throw new ValidationError('Insufficient funds', [
          { field: 'amount', message: 'Insufficient funds' }
        ], { balance: fromAccount.balance, requested: amount });
      }

      await tx.accounts.update(fromId, {
        balance: fromAccount.balance - amount
      });

      // Credit to account
      const toAccount = await tx.accounts.findById(toId);
      if (!toAccount) {
        throw new NotFoundError(`Account not found: ${toId}`, { accountId: toId });
      }

      await tx.accounts.update(toId, {
        balance: toAccount.balance + amount
      });

      // Log transaction
      await tx.transactions.create({
        fromId,
        toId,
        amount,
        timestamp: new Date()
      });
    });

    log.logSuccess('Fund transfer completed', startTime, {
      fromId,
      toId,
      amount
    });
  } catch (error) {
    log.logError('Fund transfer failed', error, {
      fromId,
      toId,
      amount
    });

    if (error instanceof NotFoundError || error instanceof ValidationError) {
      throw error;
    }

    throw new DatabaseTransactionError(
      'Failed to complete fund transfer',
      { fromId, toId, amount, originalError: error.message }
    );
  }
}
```

## LLM Integration

### Classification with LLM Error Handling

```typescript
import { log } from '../logging/index.js';
import {
  LLMTimeoutError,
  LLMInvalidResponseError,
  LLMNotInitializedError,
  ClassificationError,
  ErrorCode
} from '../errors/index.js';
import { getProvider } from '../services/llm/provider.js';

async function classifyContent(url: string, content: string): Promise<Classification> {
  const startTime = Date.now();

  log.info('Starting LLM classification', {
    url,
    contentLength: content.length
  });

  try {
    const provider = getProvider();

    const result = await provider.completeWithSchema(
      [
        { role: 'system', content: 'You are a content classifier.' },
        { role: 'user', content: `Classify this content: ${content}` }
      ],
      ClassificationSchema,
      { model: 'gpt-4o-mini', temperature: 0.3 }
    );

    log.logLLM(
      'classification',
      result.model,
      {
        prompt: result.usage.promptTokens,
        completion: result.usage.completionTokens,
        total: result.usage.totalTokens
      },
      Date.now() - startTime
    );

    return result.data;
  } catch (error) {
    log.logError('LLM classification failed', error, {
      url,
      contentLength: content.length
    });

    if (error.message === 'LLM provider not initialized') {
      throw new LLMNotInitializedError(
        'LLM provider not initialized. Configure OPENAI_API_KEY.',
        { url }
      );
    }

    if (error.message.includes('timeout')) {
      throw new LLMTimeoutError('LLM request timeout', {
        url,
        duration: Date.now() - startTime
      });
    }

    if (error.message.includes('parse') || error.message.includes('validation')) {
      throw new LLMInvalidResponseError('Invalid LLM response', {
        url,
        error: error.message
      });
    }

    throw new ClassificationError('Classification failed', {
      url,
      originalError: error.message
    });
  }
}
```

## External API Calls

### Web Scraping with Error Handling

```typescript
import { log } from '../logging/index.js';
import {
  ScrapeError,
  ScrapeTimeoutError,
  ScrapeTooLargeError,
  NetworkError,
  SSRFError
} from '../errors/index.js';

async function scrapeUrl(url: string): Promise<ScrapedContent> {
  const startTime = Date.now();

  log.info('Starting URL scrape', { url });

  // Validate URL (SSRF protection)
  if (isPrivateIP(url)) {
    log.warn('SSRF attempt blocked', { url });
    throw new SSRFError('Access to private IPs is forbidden', { url });
  }

  try {
    const response = await fetch(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Decant/1.0'
      }
    });

    if (!response.ok) {
      throw new ScrapeError(`HTTP ${response.status}: ${response.statusText}`, {
        url,
        statusCode: response.status
      });
    }

    // Check content size
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
      throw new ScrapeTooLargeError('Content size exceeds 5MB limit', {
        url,
        size: parseInt(contentLength)
      });
    }

    const content = await response.text();

    log.logExternalAPI(
      'web-scraper',
      url,
      response.status,
      Date.now() - startTime
    );

    return {
      url,
      content,
      statusCode: response.status,
      contentType: response.headers.get('content-type') || 'text/html'
    };
  } catch (error) {
    log.logError('Scrape failed', error, { url });

    if (error instanceof ScrapeError || error instanceof SSRFError) {
      throw error;
    }

    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      throw new ScrapeTimeoutError('Request timeout after 30s', {
        url,
        duration: Date.now() - startTime
      });
    }

    if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
      throw new NetworkError('Network request failed', {
        url,
        error: error.message
      });
    }

    throw new ScrapeError('Failed to scrape URL', {
      url,
      error: error.message
    });
  }
}
```

## Import/Scraping Operations

### Full Import Pipeline with Error Handling

```typescript
import { log } from '../logging/index.js';
import {
  ImportError,
  ExtractionError,
  ClassificationError,
  HierarchyGenerationError,
  ScrapeError
} from '../errors/index.js';

async function importUrl(url: string): Promise<ImportResult> {
  const startTime = Date.now();
  const correlationId = generateCorrelationId();

  log.info('Starting URL import', {
    url,
    correlationId
  });

  try {
    // Step 1: Scrape URL
    log.debug('Step 1: Scraping URL', { url, correlationId });
    const scraped = await scrapeUrl(url);

    // Step 2: Extract content
    log.debug('Step 2: Extracting content', { url, correlationId });
    const extracted = await extractContent(scraped);
    if (!extracted) {
      throw new ExtractionError('Failed to extract meaningful content', {
        url,
        correlationId
      });
    }

    // Step 3: Classify content
    log.debug('Step 3: Classifying content', { url, correlationId });
    const classification = await classifyContent(url, extracted.text);

    // Step 4: Generate hierarchy codes
    log.debug('Step 4: Generating hierarchy codes', { url, correlationId });
    const hierarchyCodes = await generateHierarchyCodes(classification);

    // Step 5: Create node
    log.debug('Step 5: Creating node', { url, correlationId });
    const node = await createNode({
      url,
      title: extracted.title,
      content: extracted.text,
      classification,
      hierarchyCodes
    });

    log.logSuccess('URL import completed', startTime, {
      url,
      nodeId: node.id,
      correlationId
    });

    return {
      success: true,
      nodeId: node.id,
      classification,
      hierarchyCodes
    };
  } catch (error) {
    log.logError('URL import failed', error, {
      url,
      correlationId,
      duration: Date.now() - startTime
    });

    // Re-throw specific errors
    if (
      error instanceof ScrapeError ||
      error instanceof ExtractionError ||
      error instanceof ClassificationError ||
      error instanceof HierarchyGenerationError
    ) {
      throw error;
    }

    // Wrap unknown errors
    throw new ImportError('Import failed', 500, ErrorCode.IMPORT_FAILED, {
      url,
      correlationId,
      originalError: error.message
    });
  }
}
```

## Error Recovery

### Retry with Exponential Backoff

```typescript
import { log } from '../logging/index.js';
import { isRetryableError } from '../errors/index.js';

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      log.debug('Attempting operation', { attempt, maxAttempts });
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error)) {
        log.warn('Non-retryable error, not retrying', {
          error: error.message,
          attempt
        });
        throw error;
      }

      if (attempt < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        log.info('Retrying after delay', {
          attempt,
          maxAttempts,
          delayMs: delay,
          error: error.message
        });
        await sleep(delay);
      } else {
        log.error('Max retry attempts reached', {
          attempt,
          maxAttempts,
          error: error.message
        });
      }
    }
  }

  throw lastError;
}

// Usage
const user = await withRetry(
  () => fetchUserFromAPI(userId),
  3,
  1000
);
```

### Graceful Degradation

```typescript
import { log } from '../logging/index.js';
import { LLMError, ScrapeError } from '../errors/index.js';

async function importUrlWithFallback(url: string): Promise<ImportResult> {
  try {
    // Try full import with LLM classification
    return await importUrlWithLLM(url);
  } catch (error) {
    if (error instanceof LLMError) {
      log.warn('LLM unavailable, falling back to basic import', {
        url,
        error: error.message
      });

      try {
        // Fallback to basic import without LLM
        return await importUrlBasic(url);
      } catch (fallbackError) {
        log.error('Fallback import also failed', fallbackError, { url });
        throw fallbackError;
      }
    }

    throw error;
  }
}
```

## Summary

Key takeaways:

1. **Always use asyncHandler** for route handlers
2. **Log at appropriate levels** (debug for details, info for operations, warn/error for issues)
3. **Include context** in both logs and errors
4. **Use specific error types** instead of generic AppError
5. **Add correlation IDs** for tracking operations across services
6. **Measure performance** with timing logs
7. **Handle errors gracefully** with fallbacks and retries
8. **Don't leak sensitive data** in logs or error messages
9. **Use structured logging** with objects instead of strings
10. **Let the middleware handle** final error formatting and responses
