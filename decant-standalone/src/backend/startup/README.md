# Startup Validation Integration Guide

## Overview

The startup validation module performs comprehensive checks before the server starts:

1. Environment variable validation
2. Database migration status check
3. Disk space verification
4. LLM connectivity test (non-blocking)

## Integration into server.ts

Add these imports at the top of `server.ts`:

```typescript
import {
  validateStartup,
  printStartupResults,
  printStartupError,
  runPendingMigrationsIfNeeded,
} from './backend/startup/index.js';
import { initializeProvider } from './backend/services/llm/provider.js';
```

Add this function before creating the Express app:

```typescript
// ============================================================
// Startup Validation
// ============================================================

async function performStartupValidation(): Promise<void> {
  try {
    // Run all validations
    const result = await validateStartup();

    // Print formatted results
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

Place this code **before** the line:

```typescript
const app = express();
```

## What Gets Validated

### 1. Environment Variables

- PORT (must be 1-65535)
- NODE_ENV (must be development/production/test)
- LOG_LEVEL
- DATABASE_PATH
- OPENAI_API_KEY (optional, warning if missing)
- DECANT_MASTER_KEY (optional, warning if missing)

### 2. Disk Space

- Verifies DATA_DIR exists and is writable
- Warns if < 1GB available
- Fails if < 100MB available

### 3. Database Migrations

- Checks for pending migrations
- Reports migration status
- Auto-runs pending migrations on startup

### 4. LLM Connectivity

- Tests API key validity with minimal request
- Non-blocking: warns if unavailable
- Disables AI features if LLM not available

## Output Example

```
============================================================
DECANT STARTUP VALIDATION
============================================================

Environment:
  ✓ NODE_ENV: development
  ✓ PORT: 3000
  ✓ LOG_LEVEL: info
  ✓ DATABASE: default

Database:
  ✓ Migrations: 9 applied

Disk Space:
  ✓ Available: 125.45 GB
  ✓ Path: /Users/user/.decant/data

LLM Provider:
  ✓ Provider: openai
  ✓ Model: gpt-4o-mini

Enabled Features:
  ✓ AI Classification
  ✓ AI Enrichment
  ✓ Background Queue
  ✗ Encryption

============================================================
✓ READY TO START
============================================================
```

## Graceful Degradation

If LLM is unavailable, the server still starts with AI features disabled:

```
LLM Provider:
  ✗ Not available: Invalid API key

Enabled Features:
  ✗ AI Classification
  ✗ AI Enrichment
  ✓ Background Queue
  ✓ Encryption
```

## Error Handling

If critical errors occur (invalid port, no disk space), the server exits with:

```
✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗
ERRORS:
  ✗ Invalid PORT: 99999 (must be between 1-65535)
  ✗ Critically low disk space: 0.05GB available
✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗

Fix suggestions:
  - Set PORT to a valid number between 1-65535
  - Free up disk space or change DATABASE_PATH
  - Check your .env file or environment variables
  - See documentation for configuration details

✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗
✗ CANNOT START - FIX ERRORS ABOVE
✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗
```

## Testing

You can test individual validation functions:

```typescript
import {
  validateEnvironment,
  checkDiskSpace,
  checkDatabaseMigrations,
  checkLLMConnectivity,
} from './backend/startup/index.js';

// Test environment validation
const envResult = validateEnvironment();
console.log(envResult);

// Test disk space
const diskResult = checkDiskSpace();
console.log(diskResult);

// Test database migrations
const dbResult = checkDatabaseMigrations();
console.log(dbResult);

// Test LLM connectivity
const llmResult = await checkLLMConnectivity();
console.log(llmResult);
```
