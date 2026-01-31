# Startup Validation - Quick Start Guide

## TL;DR

The startup validation system checks your environment before starting the server. It validates environment variables, database migrations, disk space, and LLM connectivity.

## Quick Integration (3 Steps)

### 1. Add to server.ts imports

```typescript
import {
  validateStartup,
  printStartupResults,
  printStartupError,
  runPendingMigrationsIfNeeded,
} from './backend/startup/index.js';
import { initializeProvider } from './backend/services/llm/provider.js';
```

### 2. Add before `const app = express();`

```typescript
async function performStartupValidation(): Promise<void> {
  try {
    const result = await validateStartup();
    printStartupResults(result);

    if (!result.canStart) {
      log.fatal('Startup validation failed');
      process.exit(1);
    }

    if (result.details.database.pendingCount > 0) {
      runPendingMigrationsIfNeeded();
    }

    if (result.features.aiClassification && config.OPENAI_API_KEY) {
      initializeProvider({
        type: 'openai',
        apiKey: config.OPENAI_API_KEY,
        model: config.OPENAI_MODEL,
      });
    }
  } catch (error) {
    printStartupError(error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

await performStartupValidation();
```

### 3. Test it

```bash
npm run dev:server
```

## What You'll See

### Success

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

LLM Provider:
  ✓ Provider: openai
  ✓ Model: gpt-4o-mini

Enabled Features:
  ✓ AI Classification
  ✓ AI Enrichment
  ✓ Background Queue
  ✓ Encryption

============================================================
✓ READY TO START
============================================================
```

### Warning (No API Key)

```
LLM Provider:
  ✗ Not available: No API key configured

Enabled Features:
  ✗ AI Classification
  ✗ AI Enrichment
  ✓ Background Queue
  ✓ Encryption

⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠
WARNINGS:
  ⚠ No OPENAI_API_KEY configured - AI features disabled
⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠⚠
```

Server still starts, just without AI features.

### Error (Invalid Config)

```
✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗
ERRORS:
  ✗ Invalid PORT: 99999 (must be between 1-65535)
✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗

Fix suggestions:
  - Set PORT to a valid number between 1-65535
✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗
✗ CANNOT START - FIX ERRORS ABOVE
✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗✗
```

Server exits with code 1.

## Environment Variables

### Required
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production/test)

### Optional for AI Features
- `OPENAI_API_KEY` - Enables AI classification/enrichment

### Optional for Security
- `DECANT_MASTER_KEY` - Enables encryption (min 32 chars)

### Example .env

```bash
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
OPENAI_API_KEY=sk-your-key-here
DECANT_MASTER_KEY=your-32-character-secret-key
```

## Common Issues

### "Invalid PORT"
**Problem**: PORT is outside 1-65535 range
**Fix**: `export PORT=3000`

### "No OPENAI_API_KEY configured"
**Problem**: No API key set (warning only)
**Fix**: `export OPENAI_API_KEY=sk-...` or accept degraded mode

### "Critically low disk space"
**Problem**: Less than 100MB available
**Fix**: Free up disk space or change DATABASE_PATH

### "Database directory not writable"
**Problem**: No write permissions
**Fix**: `chmod 755 ~/.decant/data`

## Commands

```bash
# Start server (with validation)
npm run dev:server

# Validate without starting
tsx src/backend/startup/cli.ts

# Or add to package.json:
npm run validate

# Check migrations
npm run migrate:status

# Run tests
npm test startup
```

## Feature Flags

| Feature          | Requires          | Fallback      |
|------------------|-------------------|---------------|
| AI Classification| OPENAI_API_KEY    | Manual tags   |
| AI Enrichment    | OPENAI_API_KEY    | No enrichment |
| Encryption       | DECANT_MASTER_KEY | No encryption |
| Background Queue | (always on)       | N/A           |

## Validation Sequence

1. **Environment** - Check PORT, NODE_ENV, LOG_LEVEL
2. **Disk Space** - Verify directory writable, > 100MB free
3. **Database** - Check migrations, auto-run if pending
4. **LLM** - Test API key validity (non-blocking)
5. **Features** - Determine enabled/disabled features
6. **Decision** - Start or exit based on errors

## When Does It Run?

**Every server startup**, before Express app creation.

Total time: ~500ms (LLM check can be slower but doesn't block).

## Graceful Degradation

The server starts even if:
- No OpenAI API key (AI features disabled)
- No master key (encryption disabled)
- LLM connectivity issues (AI features disabled)
- Low disk space (warning only if > 100MB)

The server exits only if:
- Invalid PORT
- Invalid NODE_ENV
- Disk space < 100MB
- Database directory not writable
- Database migration failure

## Testing

```bash
# Valid config
PORT=3000 npm run dev:server

# Missing API key (should warn)
unset OPENAI_API_KEY && npm run dev:server

# Invalid port (should fail)
PORT=99999 npm run dev:server

# Validation only (no server start)
npm run validate
```

## Need More Details?

- **Integration**: See `src/backend/startup/INTEGRATION.md`
- **Architecture**: See `src/backend/startup/ARCHITECTURE.md`
- **Full Docs**: See `STARTUP_VALIDATION_SUMMARY.md`
- **Code Changes**: See `src/backend/startup/SERVER_INTEGRATION.patch`

## One-Line Summary

**Validates environment, database, disk, and LLM before server starts. Exits on critical errors, warns on optional features.**
