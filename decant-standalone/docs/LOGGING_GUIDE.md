# Decant Logging Guide

A quick reference for using structured logging in the Decant application.

## Quick Start

```typescript
import { log } from './backend/logger/index.js';

// Basic logging
log.info('User action completed');
log.error('Operation failed', { err: error });
log.debug('Processing item', { itemId: 123 });

// With structured context
log.info('Import started', {
  url,
  module: 'import',
  userId: 'user-123'
});
```

## Log Levels

Use the appropriate log level for your message:

| Level | When to Use | Example |
|-------|-------------|---------|
| `trace` | Very detailed debugging (rarely used) | Function entry/exit, variable values |
| `debug` | Development debugging | Processing steps, intermediate results |
| `info` | General information | Operation started/completed, milestones |
| `warn` | Warning conditions | Deprecated API usage, fallback behavior |
| `error` | Error conditions | Failed operations, caught exceptions |
| `fatal` | Critical failures that require shutdown | Database connection lost, critical resource unavailable |

## Common Patterns

### 1. Operation Logging
```typescript
log.info('Starting backup operation', { module: 'backup' });
try {
  const result = await createBackup();
  log.info('Backup completed', {
    module: 'backup',
    filename: result.filename,
    sizeBytes: result.size
  });
} catch (error) {
  log.error('Backup failed', { err: error, module: 'backup' });
  throw error;
}
```

### 2. Error Logging
```typescript
// Pino automatically serializes Error objects
try {
  // operation
} catch (error) {
  log.error('Database query failed', {
    err: error,  // Includes message, stack trace, name
    query: 'SELECT...',
    params: { id: 123 }
  });
}
```

### 3. Request Context
```typescript
// Request logging is automatic via middleware
// But you can add context in route handlers:
export async function importUrl(req: Request, res: Response) {
  log.info('Import requested', {
    url: req.body.url,
    requestId: req.id,  // Added by middleware
    module: 'import'
  });
}
```

### 4. Performance Tracking
```typescript
const startTime = Date.now();
// ... operation ...
const duration = Date.now() - startTime;

log.info('Classification complete', {
  module: 'classifier',
  durationMs: duration,
  segment: result.segment
});
```

### 5. Module Context
```typescript
// Use consistent module names throughout your code
log.debug('Processing node', { module: 'nodes', nodeId: id });
log.info('Migration applied', { module: 'migrations', name: '001_initial' });
log.error('Scraping failed', { module: 'scraper', url, err: error });
```

## Best Practices

### DO ✓

1. **Use structured context:**
   ```typescript
   log.info('User created', { userId: 123, email: 'user@example.com' });
   ```

2. **Include module names for filtering:**
   ```typescript
   log.debug('Cache hit', { module: 'cache', key: 'user:123' });
   ```

3. **Log operation boundaries:**
   ```typescript
   log.info('Starting import', { url, module: 'import' });
   // ... work ...
   log.info('Import complete', { nodeId, module: 'import' });
   ```

4. **Use appropriate log levels:**
   ```typescript
   log.debug('Detailed state', { state });  // Development only
   log.info('Operation complete');          // Always logged
   log.error('Operation failed', { err });  // Always logged
   ```

5. **Include error objects:**
   ```typescript
   log.error('Failed to connect', { err: error, host, port });
   ```

### DON'T ✗

1. **Don't log sensitive data:**
   ```typescript
   // BAD - exposes API key
   log.debug('Calling API', { apiKey: process.env.API_KEY });

   // GOOD - redact sensitive data
   log.debug('Calling API', { apiKeyPresent: !!process.env.API_KEY });
   ```

2. **Don't use string concatenation:**
   ```typescript
   // BAD - not structured
   log.info(`User ${userId} created account`);

   // GOOD - structured
   log.info('User created account', { userId });
   ```

3. **Don't log at wrong level:**
   ```typescript
   // BAD - error should be 'error' level
   log.info('Database connection failed', { err: error });

   // GOOD
   log.error('Database connection failed', { err: error });
   ```

4. **Don't log inside tight loops:**
   ```typescript
   // BAD - creates massive log volume
   for (const item of items) {
     log.debug('Processing item', { item });
   }

   // GOOD - log summary
   log.debug('Processing batch', { count: items.length });
   // ... process items ...
   log.info('Batch processed', { processed: items.length, errors: errorCount });
   ```

5. **Don't ignore errors:**
   ```typescript
   // BAD - silent failure
   try {
     await operation();
   } catch (error) {
     // nothing
   }

   // GOOD - log and handle
   try {
     await operation();
   } catch (error) {
     log.error('Operation failed', { err: error });
     throw error; // or handle appropriately
   }
   ```

## Environment Configuration

### Development
```bash
# Pretty printed, colorized output
NODE_ENV=development
LOG_LEVEL=debug
LOG_FORMAT=pretty
```

### Production
```bash
# JSON format for log aggregation
NODE_ENV=production
LOG_LEVEL=info
LOG_FORMAT=json
```

### Debugging
```bash
# Maximum verbosity
LOG_LEVEL=trace
```

## Filtering Logs

### By Module
```bash
# In development (grep pretty output)
pnpm run dev:server 2>&1 | grep "import"

# In production (jq for JSON)
pnpm run start 2>&1 | jq 'select(.module == "import")'
```

### By Level
```bash
# Only errors
pnpm run start 2>&1 | jq 'select(.level == "error")'

# Warnings and errors
pnpm run start 2>&1 | jq 'select(.level == "warn" or .level == "error")'
```

### By Request ID
```bash
# All logs for a specific request
pnpm run start 2>&1 | jq 'select(.requestId == "abc-123")'
```

## Advanced Usage

### Child Loggers
Create a child logger with default context:

```typescript
import { createChildLogger } from './backend/logger/index.js';

const logger = createChildLogger({
  module: 'classifier',
  version: '1.0'
});

// All logs from this logger include module and version
logger.info('Processing content'); // { module: 'classifier', version: '1.0', msg: '...' }
```

### Runtime Log Level Changes
```typescript
import { setLogLevel, getLogLevel } from './backend/logger/index.js';

console.log(getLogLevel()); // 'info'
setLogLevel('debug');
console.log(getLogLevel()); // 'debug'
```

### Check if Level is Enabled
```typescript
import { isLevelEnabled } from './backend/logger/index.js';

if (isLevelEnabled('debug')) {
  // Only compute expensive debug data if it will be logged
  const debugData = computeExpensiveDebugInfo();
  log.debug('Debug info', debugData);
}
```

## Request Logging

HTTP requests are automatically logged by the middleware with:
- Request ID (added to `X-Request-ID` response header)
- Method, URL, path
- Status code
- Response time in milliseconds
- Query parameters
- Error details (if any)

No manual logging needed for standard HTTP requests!

## Common Modules

Use these consistent module names across the codebase:

- `import` - Import operations
- `scraper` - URL scraping
- `classifier` - AI classification
- `backup` - Backup/restore operations
- `migrations` - Database migrations
- `nodes` - Node CRUD operations
- `search` - Search operations
- `taxonomy` - Taxonomy operations
- `settings` - Settings management

## Troubleshooting

### Logs not showing in development
- Check `LOG_LEVEL` - may be set too high (e.g., 'error' only)
- Verify `LOG_FORMAT=pretty` for readable output

### Too many logs in production
- Set `LOG_LEVEL=info` or `LOG_LEVEL=warn`
- Remove debug logs from hot paths

### Can't parse logs
- Ensure `LOG_FORMAT=json` in production
- Use `jq` or similar tool for parsing

### Missing request context
- Ensure request logging middleware is applied in server.ts
- Check that `httpLogger` is added before routes

## Examples from Codebase

### Import Flow
```typescript
// /routes/import.ts
log.info('Starting import', { url, module: 'import' });
log.debug('Scraping URL...', { module: 'import' });
log.debug('Scraped content', { title, domain, module: 'import' });
log.debug('Classifying with AI...', { module: 'import' });
log.info('Import complete', { nodeId, title, segment, module: 'import' });
```

### Database Migrations
```typescript
// /database/migrations/runner.ts
log.debug(`Running migration: ${name}`, { migration: name, module: 'migrations' });
log.info(`Applied ${count} migration(s)`, { count, migrations: applied, module: 'migrations' });
log.error(`Migration failed: ${name}`, { migration: name, err: error, module: 'migrations' });
```

### Server Startup
```typescript
// /server.ts
log.info('Initializing database...');
log.info('Database initialized successfully');
log.info(`Decant server running at http://localhost:${PORT}`);
```

## Resources

- [Pino Documentation](https://getpino.io/)
- [pino-http Documentation](https://github.com/pinojs/pino-http)
- [Best Practices for Logging](https://betterstack.com/community/guides/logging/nodejs-logging-best-practices/)
