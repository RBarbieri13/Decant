# Server.ts Integration Snippet

## Complete Code to Add to server.ts

### Step 1: Add Imports

Add these imports after the existing imports in `server.ts`:

```typescript
import {
  validateStartup,
  printStartupResults,
  printStartupError,
  runPendingMigrationsIfNeeded,
} from './backend/startup/index.js';
import { initializeProvider } from './backend/services/llm/provider.js';
```

### Step 2: Add Startup Validation Function

Add this function **before** the line `const app = express();`:

```typescript
// ============================================================
// Startup Validation
// ============================================================

async function performStartupValidation(): Promise<void> {
  try {
    // Run all validations
    const result = await validateStartup();

    // Print formatted results to console
    printStartupResults(result);

    // Exit if critical errors
    if (!result.canStart) {
      log.fatal('Startup validation failed - cannot start server');
      process.exit(1);
    }

    // Auto-run pending migrations if any
    if (result.details.database.pendingCount > 0) {
      log.info('Running pending migrations...');
      const applied = runPendingMigrationsIfNeeded();
      log.info(`Applied ${applied.length} migration(s)`, { migrations: applied });
    }

    // Initialize LLM provider if available
    if (result.features.aiClassification && config.OPENAI_API_KEY) {
      log.info('Initializing LLM provider...');
      initializeProvider({
        type: 'openai',
        apiKey: config.OPENAI_API_KEY,
        model: config.OPENAI_MODEL,
      });
      log.info('LLM provider initialized', { model: config.OPENAI_MODEL });
    }

    // Log enabled features
    log.info('Feature flags', {
      aiClassification: result.features.aiClassification,
      aiEnrichment: result.features.aiEnrichment,
      backgroundQueue: result.features.backgroundQueue,
      encryption: result.features.encryption,
    });

    // Log warnings to structured logs
    if (result.warnings.length > 0) {
      result.warnings.forEach(warning => {
        log.warn(warning);
      });
    }
  } catch (error) {
    printStartupError(error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

// Run startup validation before initializing app
await performStartupValidation();
```

### Step 3: Update Graceful Shutdown

Add metrics cleanup to the `gracefulShutdown` function. Find the section that stops the cache auto-cleanup and add this before it:

```typescript
// Stop metrics stats collection
stopStatsCollection();
log.info('Metrics stats collection stopped');
```

## Full Sequence After Integration

Your `server.ts` should now follow this sequence:

1. **Imports** (all at top)
2. **Startup Validation** (runs before anything else)
   - Environment checks
   - Disk space checks
   - Database migration checks
   - LLM connectivity test
   - Feature flag determination
3. **Express App Creation** (`const app = express()`)
4. **Middleware Registration**
5. **Database Initialization** (migrations already validated)
6. **Service Startup** (cache, metrics, queue)
7. **Route Registration**
8. **Server Listen**
9. **Graceful Shutdown Handlers**

## Command Line Usage

You can also run validation without starting the server:

```bash
# Run validation check
tsx src/backend/startup/cli.ts

# Or add to package.json:
{
  "scripts": {
    "validate": "tsx src/backend/startup/cli.ts"
  }
}

# Then run:
npm run validate
```

## Environment Variables Summary

The startup validation checks these environment variables:

### Required
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production/test)

### Optional with Defaults
- `LOG_LEVEL` - Logging verbosity (default: info)
- `DATABASE_PATH` - Database location (default: ~/.decant/data/decant.db)

### Optional for Features
- `OPENAI_API_KEY` - Enables AI classification/enrichment
- `DECANT_MASTER_KEY` - Enables encryption (min 32 chars)

### Advanced
- `RATE_LIMIT_WINDOW_MS` - Rate limit window (default: 60000)
- `RATE_LIMIT_MAX` - Max requests per window (default: 100)
- `CORS_ALLOWED_ORIGINS` - CORS whitelist (comma-separated)
- `SCRAPER_TIMEOUT_MS` - Web scraper timeout (default: 30000)
- `SCRAPER_MAX_SIZE_BYTES` - Max page size (default: 5MB)

## Example .env File

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Logging
LOG_LEVEL=info
LOG_FORMAT=pretty

# Database
DATABASE_PATH=/Users/you/.decant/data/decant.db

# AI Features (optional)
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini

# Security (optional)
DECANT_MASTER_KEY=your-32-character-secret-key-here

# Rate Limiting (optional)
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100

# CORS (optional, defaults to allow all in dev)
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://app.example.com
```

## Troubleshooting

### "Invalid PORT" Error
```
✗ Invalid PORT: 99999 (must be between 1-65535)
```
**Fix**: Set `PORT` to a valid number between 1-65535.

### "Critically low disk space" Error
```
✗ Critically low disk space: 0.05GB available (minimum 100MB required)
```
**Fix**: Free up disk space or change `DATABASE_PATH` to a different drive.

### "Database directory not writable" Error
```
✗ Database directory not writable: EACCES: permission denied
```
**Fix**: Ensure the user running the server has write permissions to the data directory.

### "LLM connectivity issue" Warning
```
⚠ LLM connectivity issue: Invalid API key
```
**Fix**: Check your `OPENAI_API_KEY`. This is non-critical; the server will start without AI features.

### Pending Migrations
```
⚠ 2 pending database migration(s): 007_add_metadata_registry, 008_add_similarity
```
**Fix**: The migrations will auto-run on startup. No action needed.

## Testing the Integration

1. **Valid Configuration**
   ```bash
   PORT=3000 NODE_ENV=development npm run dev:server
   ```
   Should show all green checkmarks and start successfully.

2. **Missing API Key** (graceful degradation)
   ```bash
   unset OPENAI_API_KEY
   PORT=3000 NODE_ENV=development npm run dev:server
   ```
   Should show warning but still start with AI features disabled.

3. **Invalid Port** (should fail)
   ```bash
   PORT=99999 NODE_ENV=development npm run dev:server
   ```
   Should fail validation and exit with error.

4. **Validation Only** (no server start)
   ```bash
   npm run validate
   ```
   Shows validation results without starting the server.
