# Startup Validation Architecture

## System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   SERVER STARTUP SEQUENCE                    │
└─────────────────────────────────────────────────────────────┘

1. INITIALIZATION
   ├── Load environment variables
   ├── Parse with Zod schemas (config.ts)
   └── Initialize logger

2. STARTUP VALIDATION ◄── NEW
   ├── validateEnvironment()
   │   ├── Check PORT range (1-65535)
   │   ├── Check NODE_ENV (dev/prod/test)
   │   ├── Check LOG_LEVEL
   │   ├── Warn if no OPENAI_API_KEY
   │   └── Warn if no DECANT_MASTER_KEY
   │
   ├── checkDiskSpace()
   │   ├── Verify directory exists
   │   ├── Test write permissions
   │   ├── Check available space
   │   ├── Warn if < 1GB
   │   └── Error if < 100MB
   │
   ├── checkDatabaseMigrations()
   │   ├── Connect to database
   │   ├── Query migration status
   │   ├── Count applied migrations
   │   ├── List pending migrations
   │   └── Auto-run if any pending
   │
   └── checkLLMConnectivity() [async, non-blocking]
       ├── Skip if no API key
       ├── Create test provider
       ├── Send minimal request
       ├── Retry with backoff
       └── Return availability status

3. FEATURE DETERMINATION
   ├── aiClassification = LLM available?
   ├── aiEnrichment = LLM available?
   ├── backgroundQueue = always true
   └── encryption = DECANT_MASTER_KEY present?

4. DECISION POINT
   ├── If errors.length > 0 → EXIT(1)
   └── If errors.length = 0 → CONTINUE

5. LLM PROVIDER INIT
   └── If AI features enabled → initializeProvider()

6. EXPRESS APP CREATION
   └── const app = express()

7. MIDDLEWARE & ROUTES
   ├── CORS
   ├── Security headers
   ├── Body parser
   ├── Request logger
   ├── Metrics
   ├── Health checks
   ├── Rate limiting
   └── API routes

8. SERVICE STARTUP
   ├── Database connection
   ├── Cache auto-cleanup
   ├── Metrics collection
   └── Processing queue

9. HTTP SERVER START
   └── app.listen(PORT)

10. GRACEFUL SHUTDOWN HANDLERS
    ├── SIGTERM handler
    ├── SIGINT handler
    ├── Uncaught exception handler
    └── Unhandled rejection handler
```

## Module Dependencies

```
┌──────────────────────────────────────────────────────────────┐
│                    startup/index.ts                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ validateStartup()                                      │  │
│  │  ├── validateEnvironment()                            │  │
│  │  ├── checkDiskSpace()                                 │  │
│  │  ├── checkDatabaseMigrations()                        │  │
│  │  └── checkLLMConnectivity()                           │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
         │         │         │         │
         ▼         ▼         ▼         ▼
┌──────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐
│ config/  │ │  fs     │ │database/ │ │services/llm/ │
│ index.ts │ │  os     │ │ index.ts │ │ provider.ts  │
└──────────┘ └─────────┘ └──────────┘ └──────────────┘
```

## Validation Flow Diagram

```
START
  │
  ▼
┌─────────────────────┐
│ validateEnvironment │
└─────────────────────┘
  │
  ├── Valid? ──NO──► Add to errors[] ──┐
  │                                     │
  ▼                                     │
┌─────────────────────┐                 │
│   checkDiskSpace    │                 │
└─────────────────────┘                 │
  │                                     │
  ├── OK? ──NO──► Add to errors[] ─────┤
  │                                     │
  ▼                                     │
┌─────────────────────┐                 │
│checkDatabaseMigrate │                 │
└─────────────────────┘                 │
  │                                     │
  ├── Ready? ──NO──► Add to errors[] ──┤
  │                                     │
  ▼                                     │
┌─────────────────────┐                 │
│checkLLMConnectivity │                 │
└─────────────────────┘                 │
  │                                     │
  ├── Not available? ──► Add to warnings│
  │                                     │
  ▼                                     │
┌─────────────────────┐                 │
│ Determine Features  │                 │
└─────────────────────┘                 │
  │                                     │
  ▼                                     │
┌─────────────────────┐                 │
│ Print Results       │◄────────────────┘
└─────────────────────┘
  │
  ├── errors.length > 0? ──YES──► EXIT(1)
  │
  ├── pendingMigrations? ──YES──► Run migrations
  │
  ├── AI available? ──YES──► Initialize LLM
  │
  ▼
CONTINUE TO APP
```

## Error Handling Strategy

```
┌────────────────────────────────────────────────────────┐
│                    ERROR SEVERITY                       │
├────────────────────────────────────────────────────────┤
│                                                         │
│  CRITICAL (exit 1)                                     │
│  ├── Invalid PORT                                      │
│  ├── Invalid NODE_ENV                                  │
│  ├── Disk space < 100MB                                │
│  ├── Database directory not writable                   │
│  └── Database migration failure                        │
│                                                         │
│  WARNINGS (continue with degraded features)            │
│  ├── No OPENAI_API_KEY (disable AI)                   │
│  ├── No DECANT_MASTER_KEY (disable encryption)        │
│  ├── Invalid LLM API key (disable AI)                 │
│  ├── Disk space < 1GB (warn but continue)             │
│  ├── Debug logging in production                      │
│  └── Pending migrations (auto-run)                    │
│                                                         │
└────────────────────────────────────────────────────────┘
```

## Feature Flag Matrix

```
┌─────────────────┬──────────────┬────────────────┬─────────────┐
│     Feature     │   Requires   │   Fallback     │  Severity   │
├─────────────────┼──────────────┼────────────────┼─────────────┤
│ AI Classify     │ OPENAI_KEY   │ Manual tags    │  Warning    │
│ AI Enrich       │ OPENAI_KEY   │ No enrichment  │  Warning    │
│ Encryption      │ MASTER_KEY   │ No encryption  │  Warning    │
│ Background Queue│ (none)       │ N/A            │  Always on  │
│ Database        │ Disk space   │ N/A            │  Critical   │
│ HTTP Server     │ Valid PORT   │ N/A            │  Critical   │
└─────────────────┴──────────────┴────────────────┴─────────────┘
```

## Data Flow

```
Environment Variables
        │
        ▼
   ┌─────────┐
   │  Zod    │
   │ Schema  │
   └─────────┘
        │
        ▼
   ┌─────────┐
   │ Config  │
   │ Object  │
   └─────────┘
        │
        ├────────────────────┬──────────────┬───────────────┐
        ▼                    ▼              ▼               ▼
┌───────────────┐  ┌────────────────┐  ┌──────────┐  ┌──────────┐
│ Validate Env  │  │ Check Disk     │  │ Check DB │  │Check LLM │
└───────────────┘  └────────────────┘  └──────────┘  └──────────┘
        │                    │              │               │
        └────────────────────┴──────────────┴───────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Validation Result│
                    │  ├── canStart    │
                    │  ├── warnings    │
                    │  ├── errors      │
                    │  └── features    │
                    └──────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
            ┌──────────────┐    ┌─────────────┐
            │  Print to    │    │   Log to    │
            │  Console     │    │  Pino/JSON  │
            └──────────────┘    └─────────────┘
                    │
            ┌───────┴────────┐
            ▼                ▼
    ┌──────────────┐  ┌─────────────┐
    │  EXIT(1)     │  │  CONTINUE   │
    └──────────────┘  └─────────────┘
```

## Retry Logic (LLM Connectivity)

```
┌────────────────────────────────────────────────────────┐
│           LLM Request with Exponential Backoff          │
└────────────────────────────────────────────────────────┘

Attempt 1
  │
  ├─ Success? ──YES──► Return result
  │
  ├─ Retryable error? ──NO──► Throw error
  │
  └─ Wait: baseDelay * 2^0 + jitter (1000ms + ~300ms)
      │
      ▼
Attempt 2
  │
  ├─ Success? ──YES──► Return result
  │
  ├─ Retryable error? ──NO──► Throw error
  │
  └─ Wait: baseDelay * 2^1 + jitter (2000ms + ~600ms)
      │
      ▼
Attempt 3 (final)
  │
  ├─ Success? ──YES──► Return result
  │
  └─ Throw last error

Retryable Errors:
  - 429 (Rate limit)
  - 500 (Server error)
  - 502 (Bad gateway)
  - 503 (Service unavailable)
  - 504 (Gateway timeout)
  - ECONNRESET
  - ETIMEDOUT
  - ENOTFOUND
```

## Integration Points

```
┌────────────────────────────────────────────────────────┐
│                     server.ts                          │
├────────────────────────────────────────────────────────┤
│                                                         │
│  1. Imports                                            │
│     └── startup/index.ts                               │
│                                                         │
│  2. performStartupValidation() ◄── NEW                │
│     ├── validateStartup()                              │
│     ├── printStartupResults()                          │
│     ├── runPendingMigrationsIfNeeded()                 │
│     └── initializeProvider()                           │
│                                                         │
│  3. const app = express()                              │
│                                                         │
│  4. Middleware registration                            │
│                                                         │
│  5. initializeDatabase()                               │
│                                                         │
│  6. Cache/Metrics/Queue startup                        │
│                                                         │
│  7. app.listen()                                       │
│                                                         │
│  8. Graceful shutdown handlers                         │
│                                                         │
└────────────────────────────────────────────────────────┘
```

## Testing Strategy

```
Unit Tests
  ├── validateEnvironment()
  │   ├── Valid configuration
  │   ├── Invalid PORT
  │   ├── Invalid NODE_ENV
  │   ├── Missing API key (warning)
  │   └── Production warnings
  │
  ├── checkDiskSpace()
  │   ├── Sufficient space
  │   ├── Low space warning
  │   ├── Critical space error
  │   └── Permission denied
  │
  ├── checkDatabaseMigrations()
  │   ├── All applied
  │   ├── Pending migrations
  │   └── Database error
  │
  └── checkLLMConnectivity()
      ├── Valid API key
      ├── Invalid API key
      ├── Network error
      └── Retry logic

Integration Tests
  ├── Full validation flow
  ├── Auto-migration on startup
  ├── Feature flag determination
  └── Server startup with validation

CLI Tests
  ├── Exit code 0 on success
  ├── Exit code 1 on failure
  └── Output format validation
```

## Performance Considerations

```
┌────────────────────────────────────────────────────────┐
│              Validation Performance                     │
├────────────────────────────────────────────────────────┤
│                                                         │
│  validateEnvironment()        ~1ms   (sync)            │
│  checkDiskSpace()             ~5ms   (sync, I/O)       │
│  checkDatabaseMigrations()    ~10ms  (sync, DB query)  │
│  checkLLMConnectivity()       ~500ms (async, network)  │
│                                                         │
│  Total: ~516ms (typical)                               │
│                                                         │
│  Note: LLM check is parallel, doesn't block            │
│        Environment/Disk/DB checks run sequentially     │
│                                                         │
└────────────────────────────────────────────────────────┘
```

## Security Considerations

```
┌────────────────────────────────────────────────────────┐
│                  Security Features                      │
├────────────────────────────────────────────────────────┤
│                                                         │
│  1. Sensitive Data Handling                            │
│     ├── API keys never logged                          │
│     ├── Only log hasKey: boolean                       │
│     └── Master key never exposed                       │
│                                                         │
│  2. Error Messages                                     │
│     ├── Don't leak internal paths in production        │
│     ├── Sanitize error messages                        │
│     └── Log details to secure logs only                │
│                                                         │
│  3. Production Hardening                               │
│     ├── Warn about debug logging                       │
│     ├── Encourage encryption                           │
│     └── Validate CORS configuration                    │
│                                                         │
└────────────────────────────────────────────────────────┘
```

## Monitoring & Observability

```
Structured Logs (Pino)
  ├── Validation start/end
  ├── Each check result
  ├── Feature flags enabled
  ├── Warnings (non-blocking)
  └── Errors (blocking)

Console Output
  ├── ASCII box formatting
  ├── Color-coded results
  ├── Clear action items
  └── Fix suggestions

Metrics (future)
  ├── startup_validation_duration_seconds
  ├── startup_validation_failures_total
  ├── startup_features_enabled (gauge)
  └── startup_warnings_total
```

## Future Architecture

```
Planned Enhancements
  ├── Plugin system for custom validators
  ├── Config file validation (JSON schema)
  ├── Network connectivity checks
  ├── External service health checks
  ├── Database backup before migrations
  ├── Rollback on migration failure
  └── Notification on startup failures
```

This architecture provides a robust, extensible, and production-ready startup validation system that catches errors early while maintaining graceful degradation for optional features.
