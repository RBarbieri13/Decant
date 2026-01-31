# Troubleshooting Guide

This guide covers common issues, debugging techniques, and recovery procedures for the Decant application.

## Table of Contents

- [Common Errors](#common-errors)
- [Debugging Tools](#debugging-tools)
- [Performance Issues](#performance-issues)
- [Recovery Procedures](#recovery-procedures)
- [Database Issues](#database-issues)
- [Import Pipeline Issues](#import-pipeline-issues)
- [LLM Integration Issues](#llm-integration-issues)

---

## Common Errors

### 1. "LLM API key not configured"

**Symptom**: Import requests fail with error code `LLM_NOT_INITIALIZED`

**Cause**: OpenAI API key has not been set or has been deleted.

**Solution**:

```bash
# Via API
curl -X POST http://localhost:3000/api/settings/api-key \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "sk-..."}'

# Via environment variable
export OPENAI_API_KEY=sk-your-key-here
npm start
```

**Check API key status**:
```bash
curl http://localhost:3000/api/settings/api-key/status
```

**Expected response**:
```json
{
  "configured": true,
  "source": "keystore",
  "model": "gpt-4o-mini"
}
```

---

### 2. "Database locked" (SQLITE_BUSY)

**Symptom**: Requests fail with `SQLITE_BUSY` or `database is locked` error

**Cause**: SQLite doesn't handle high write concurrency well. This typically happens when:
- Multiple processes are accessing the same database
- Long-running transactions are blocking writes
- Database file is on a network filesystem (NFS, SMB)

**Solution**:

**Immediate fix**:
```bash
# Stop the server
kill <pid>

# Check for stale lock files
ls -la ~/.decant/data/
rm ~/.decant/data/decant.db-shm  # If server is stopped
rm ~/.decant/data/decant.db-wal  # If server is stopped

# Restart
npm start
```

**Prevent future occurrences**:
1. Ensure only one Decant server instance is running
2. Don't run the database on network storage
3. Check for long-running queries in logs
4. Consider increasing WAL mode timeout (advanced)

**Advanced configuration** (`src/backend/database/connection.ts`):
```typescript
// Increase busy timeout to 5 seconds
db.pragma('busy_timeout = 5000');
```

---

### 3. "Rate limit exceeded"

**Symptom**: Requests fail with HTTP 429, error code `RATE_LIMIT_EXCEEDED`

**Cause**: Too many requests in a short time period. Default limits:
- Global: 100 requests per 60 seconds
- Import endpoints: 10 requests per 60 seconds
- Settings endpoints: 5 requests per 60 seconds

**Solution**:

**Check current rate limits**:
```bash
# View config in logs when server starts
npm start
# Look for: "rateLimitMax", "rateLimitImportMax"
```

**Adjust via environment variables**:
```bash
# Increase limits
export RATE_LIMIT_MAX=200
export RATE_LIMIT_IMPORT_MAX=20
export RATE_LIMIT_SETTINGS_MAX=10
export RATE_LIMIT_WINDOW_MS=60000  # Window in milliseconds

npm start
```

**Wait and retry**:
The error response includes a `retryAfter` field (in seconds):
```json
{
  "error": "Too many requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 45
}
```

---

### 4. "Import failed: SSRF protection"

**Symptom**: Import requests fail with error code `SSRF_BLOCKED`

**Cause**: The URL is blocked by SSRF (Server-Side Request Forgery) protection. This blocks:
- Private IP ranges (10.x.x.x, 192.168.x.x, 127.x.x.x)
- Localhost addresses
- Link-local addresses (169.254.x.x)
- Non-HTTP/HTTPS protocols

**Solution**:

**For development**: Disable SSRF protection
```bash
# In development environment only
export NODE_ENV=development
npm run dev
```

**For production**: Use public URLs only
```bash
# Bad: Localhost
POST /api/import { "url": "http://localhost:8080/page" }

# Bad: Private IP
POST /api/import { "url": "http://192.168.1.100/resource" }

# Good: Public URL
POST /api/import { "url": "https://example.com/article" }
```

**Verify URL before importing**:
```bash
# Test URL accessibility
curl -I https://example.com/article
```

---

### 5. "Migration failed"

**Symptom**: Server won't start, logs show migration errors

**Cause**: Database migration encountered an error during upgrade

**Solution**:

**Check migration status**:
```bash
npm run migrate:status
```

**Reset to last known good state**:
```bash
# 1. Stop the server
kill <pid>

# 2. Restore from backup
npm run restore -- --file ~/.decant/backups/decant-backup-YYYY-MM-DD-HH-MM-SS.db

# 3. Restart
npm start
```

**Force re-run migrations** (dangerous):
```bash
# This will drop and recreate the migrations table
sqlite3 ~/.decant/data/decant.db "DELETE FROM migrations WHERE name = 'failed_migration_name';"

# Then restart to re-run
npm start
```

**Last resort - fresh start**:
```bash
# Backup current database
cp ~/.decant/data/decant.db ~/.decant/data/decant.db.backup

# Export data as JSON
curl http://localhost:3000/api/export > backup.json

# Remove database
rm ~/.decant/data/decant.db*

# Restart (creates fresh database)
npm start

# Re-import data
curl -X POST http://localhost:3000/api/import/json \
  -H "Content-Type: application/json" \
  -d @backup.json
```

---

### 6. "Validation failed"

**Symptom**: API requests fail with `VALIDATION_FAILED` or `SCHEMA_VALIDATION_FAILED`

**Cause**: Request body doesn't match expected schema

**Solution**:

**Read the error details**:
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_FAILED",
  "details": [
    {
      "field": "title",
      "message": "String must contain at least 1 character(s)"
    }
  ]
}
```

**Common validation issues**:

1. **Missing required fields**:
```bash
# Bad
POST /api/nodes { "nodeType": "item" }

# Good
POST /api/nodes { "title": "My Item", "nodeType": "item" }
```

2. **Invalid field types**:
```bash
# Bad
POST /api/nodes { "title": 123 }

# Good
POST /api/nodes { "title": "My Node" }
```

3. **Invalid enum values**:
```bash
# Bad
POST /api/nodes { "title": "Test", "nodeType": "invalid" }

# Good (valid nodeType values)
POST /api/nodes { "title": "Test", "nodeType": "segment" }
```

---

## Debugging Tools

### 1. Enable Debug Logging

**Set log level**:
```bash
export LOG_LEVEL=debug
npm start
```

**Available log levels** (from most to least verbose):
- `trace` - Everything, including SQL queries
- `debug` - Detailed application logs
- `info` - Normal operations (default)
- `warn` - Warning conditions
- `error` - Error conditions
- `fatal` - Critical failures

**Pretty vs JSON logging**:
```bash
# Pretty (human-readable, colorized)
export LOG_PRETTY=true
npm start

# JSON (machine-readable, for log aggregators)
export LOG_PRETTY=false
npm start
```

---

### 2. Health Endpoints

**Basic health check**:
```bash
curl http://localhost:3000/health
```

**Detailed health status**:
```bash
curl http://localhost:3000/health/full
```

**Example output**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-30T12:00:00.000Z",
  "uptime": 3600,
  "components": {
    "database": {
      "status": "healthy",
      "responseTime": 2
    },
    "llm": {
      "status": "healthy",
      "provider": "openai"
    },
    "queue": {
      "status": "healthy",
      "pending": 5,
      "processing": 1,
      "failed": 0
    }
  }
}
```

**Component-specific health**:
```bash
# Check database health
curl http://localhost:3000/health/component/database

# Check LLM health
curl http://localhost:3000/health/component/llm

# Check queue health
curl http://localhost:3000/health/component/queue
```

---

### 3. Queue Status

**Check processing queue**:
```bash
curl http://localhost:3000/api/queue/status
```

**Example output**:
```json
{
  "pending": 12,
  "processing": 2,
  "complete": 145,
  "failed": 3,
  "total": 162
}
```

**List recent jobs**:
```bash
# All jobs
curl http://localhost:3000/api/queue/jobs

# Failed jobs only
curl "http://localhost:3000/api/queue/jobs?status=failed"

# Jobs for specific node
curl http://localhost:3000/api/queue/jobs/<node-id>
```

**Retry failed jobs**:
```bash
# Retry specific job
curl -X POST http://localhost:3000/api/queue/retry/<job-id>

# Clear completed jobs
curl -X POST http://localhost:3000/api/queue/clear
```

---

### 4. Database Inspection

**Connect to database**:
```bash
sqlite3 ~/.decant/data/decant.db
```

**Useful queries**:
```sql
-- Check migrations
SELECT * FROM migrations ORDER BY applied_at DESC;

-- Count nodes by type
SELECT node_type, COUNT(*) as count FROM nodes
WHERE is_deleted = 0
GROUP BY node_type;

-- Find nodes without hierarchy codes
SELECT id, title FROM nodes
WHERE function_code IS NULL OR organization_code IS NULL;

-- Check recent imports
SELECT id, node_id, status, error_message
FROM processing_queue
ORDER BY created_at DESC LIMIT 10;

-- View audit log
SELECT * FROM audit_log
ORDER BY changed_at DESC LIMIT 20;

-- Check for orphaned nodes (no parent in hierarchy)
SELECT id, title, node_type FROM nodes
WHERE node_type NOT IN ('segment', 'organization')
AND function_parent_id IS NULL
AND organization_parent_id IS NULL
AND is_deleted = 0;
```

---

### 5. Metrics Endpoint

**View application metrics**:
```bash
curl http://localhost:3000/metrics
```

**Example output**:
```json
{
  "uptime": 3600,
  "memory": {
    "rss": 52428800,
    "heapTotal": 20971520,
    "heapUsed": 15728640,
    "external": 1048576
  },
  "requests": {
    "total": 1250,
    "success": 1200,
    "errors": 50,
    "rate": 0.35
  },
  "llm": {
    "totalCalls": 45,
    "successfulCalls": 42,
    "failedCalls": 3,
    "averageLatency": 2500,
    "totalTokens": 125000
  }
}
```

---

## Performance Issues

### 1. Slow Imports

**Symptom**: URL imports take a long time to complete

**Diagnosis**:

1. **Check LLM latency**:
```bash
# Look for "llm" metrics
curl http://localhost:3000/metrics

# Check logs for timing
# Look for: "LLM request completed" with durationMs
```

2. **Check network latency**:
```bash
# Test URL directly
time curl -I https://target-url.com
```

**Solutions**:

1. **Switch to faster model**:
```bash
export OPENAI_MODEL=gpt-4o-mini  # Faster than gpt-4
npm start
```

2. **Increase timeout for slow sites**:
```bash
export SCRAPER_TIMEOUT_MS=60000  # 60 seconds
npm start
```

3. **Process in background**: Imports automatically use background queue for Phase 2 enrichment

---

### 2. High Memory Usage

**Symptom**: Server memory usage grows over time

**Diagnosis**:

```bash
# Monitor memory
curl http://localhost:3000/metrics | jq '.memory'
```

**Solutions**:

1. **Clear cache periodically**:
```javascript
// Cache is auto-cleared every 5 minutes
// To adjust: src/backend/cache/index.ts
```

2. **Clear completed jobs**:
```bash
# Clear jobs older than 24 hours
curl -X POST http://localhost:3000/api/queue/clear
```

3. **Restart server periodically** (for long-running instances):
```bash
# Use process manager like PM2
pm2 restart decant
```

---

### 3. Slow Searches

**Symptom**: Search queries take too long

**Diagnosis**:

```bash
# Check search logs
grep "Search query" ~/.decant/logs/decant.log

# Check database size
ls -lh ~/.decant/data/decant.db
```

**Solutions**:

1. **Verify indexes exist**:
```sql
-- Check indexes
SELECT name FROM sqlite_master WHERE type='index';

-- Should include:
-- - idx_nodes_function_code
-- - idx_nodes_organization_code
-- - idx_nodes_content_type
-- - idx_search_content (FTS)
```

2. **Rebuild FTS index**:
```sql
-- Rebuild full-text search index
INSERT INTO nodes_fts(nodes_fts) VALUES('rebuild');
```

3. **Vacuum database**:
```bash
sqlite3 ~/.decant/data/decant.db "VACUUM;"
```

4. **Use pagination**:
```bash
# Bad: Fetching all results
GET /api/search?q=query

# Good: Use pagination
GET /api/search/advanced?q=query&limit=20&offset=0
```

---

## Recovery Procedures

### 1. Resetting Stuck Jobs

**Symptom**: Jobs stuck in "processing" status

**Solution**:

```bash
# Via API (preferred)
curl -X POST http://localhost:3000/api/queue/retry/<job-id>

# Via database (if API doesn't work)
sqlite3 ~/.decant/data/decant.db <<EOF
UPDATE processing_queue
SET status = 'pending', attempts = 0, error_message = NULL
WHERE status = 'processing' AND datetime(created_at, '+5 minutes') < datetime('now');
EOF

# Restart server
npm start
```

---

### 2. Rebuilding Hierarchy Codes

**Symptom**: Nodes have missing or incorrect hierarchy codes

**Solution**:

```javascript
// Run this in a Node.js console or create a script
import { getDatabase } from './backend/database/connection.js';
import { regenerateHierarchyCodes } from './backend/services/hierarchy/code_generator.js';

const db = getDatabase();
regenerateHierarchyCodes(db);
```

**Manual rebuild** (if above doesn't work):
```sql
-- Reset all hierarchy codes
UPDATE nodes SET function_code = NULL, organization_code = NULL;

-- Rebuild will happen automatically on next access
-- Or restart server to trigger full rebuild
```

---

### 3. Database Backup/Restore

**Create backup**:
```bash
# Via API (includes metadata)
curl -X POST http://localhost:3000/api/backup

# Manual copy
cp ~/.decant/data/decant.db ~/.decant/backups/manual-backup-$(date +%Y%m%d-%H%M%S).db
```

**List backups**:
```bash
curl http://localhost:3000/api/backups
```

**Restore from backup**:
```bash
# Via API
curl -X POST http://localhost:3000/api/restore \
  -H "Content-Type: application/json" \
  -d '{"filename": "decant-backup-20260130-120000.db"}'

# Manual restore
npm stop
cp ~/.decant/backups/decant-backup-20260130-120000.db ~/.decant/data/decant.db
npm start
```

---

### 4. Clearing Corrupted Cache

**Symptom**: Stale data appearing in UI or inconsistent responses

**Solution**:

```bash
# Cache is in-memory only, so restart clears it
npm stop
npm start

# Or use health endpoint to verify cache
curl http://localhost:3000/health/component/cache
```

---

### 5. Export/Import Data

**Export all data**:
```bash
# Export to JSON
curl http://localhost:3000/api/export > decant-export.json

# Verify export
cat decant-export.json | jq '.nodes | length'
```

**Import data**:
```bash
# Import from JSON
curl -X POST http://localhost:3000/api/import/json \
  -H "Content-Type: application/json" \
  -d @decant-export.json
```

---

## Database Issues

### Database Won't Open

**Symptom**: `Error: database disk image is malformed`

**Solution**:
```bash
# Try to recover
sqlite3 ~/.decant/data/decant.db ".recover" | sqlite3 recovered.db
mv ~/.decant/data/decant.db ~/.decant/data/decant.db.corrupt
mv recovered.db ~/.decant/data/decant.db
npm start
```

---

### Database Growing Too Large

**Symptom**: Database file is very large

**Solution**:
```bash
# Check size
ls -lh ~/.decant/data/decant.db

# Clear deleted nodes
sqlite3 ~/.decant/data/decant.db <<EOF
DELETE FROM nodes WHERE is_deleted = 1 AND datetime(updated_at, '+30 days') < datetime('now');
EOF

# Vacuum to reclaim space
sqlite3 ~/.decant/data/decant.db "VACUUM;"
```

---

## Import Pipeline Issues

### Scraping Fails

**Common causes and solutions**:

1. **Timeout**: Increase `SCRAPER_TIMEOUT_MS`
2. **Too large**: Increase `SCRAPER_MAX_SIZE_BYTES` or choose smaller content
3. **Authentication required**: Not supported, use authenticated URLs
4. **JavaScript-heavy site**: Scraper doesn't execute JS, may get incomplete content
5. **Blocked by robots.txt**: Scraper respects robots.txt (in production)

---

### Classification Confidence Low

**Symptom**: `aiConfidence` field is below 0.5

**Causes**:
- Content is ambiguous or multi-topic
- Content is in an unsupported language
- URL has minimal extractable content

**Solutions**:
1. Manually adjust classification in UI
2. Add more context to the source content
3. Use explicit category hints in prompts (advanced)

---

## LLM Integration Issues

### OpenAI API Errors

**Error: Invalid API Key**:
```bash
# Verify key format
echo $OPENAI_API_KEY | grep -E '^sk-[A-Za-z0-9]{48}$'

# Test key directly
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

**Error: Rate Limited**:
- Wait for rate limit window to reset
- Upgrade OpenAI tier
- Reduce import frequency

**Error: Quota Exceeded**:
- Check OpenAI usage dashboard
- Add payment method or increase quota
- Switch to cheaper model (gpt-4o-mini)

---

### Circuit Breaker Tripped

**Symptom**: Errors mentioning "circuit breaker open"

**Cause**: Too many consecutive LLM failures

**Solution**:
```bash
# Wait 60 seconds for circuit to half-open
# Or restart server to reset
npm stop
npm start
```

---

## Getting Help

If you encounter an issue not covered here:

1. **Check logs**: Look in console output or log files
2. **Check health status**: `curl http://localhost:3000/health/full`
3. **Export database**: Create a backup before making changes
4. **Search GitHub issues**: Check existing issues for solutions
5. **File a bug report**: Include logs, health status, and steps to reproduce

---

## Quick Reference

### Essential Commands

```bash
# View logs
npm start  # Watch console

# Check health
curl http://localhost:3000/health/full

# Backup database
curl -X POST http://localhost:3000/api/backup

# Check queue
curl http://localhost:3000/api/queue/status

# Inspect database
sqlite3 ~/.decant/data/decant.db

# View metrics
curl http://localhost:3000/metrics
```

### Log Locations

- **Development**: Console output
- **Production**: Can be piped to file: `npm start > app.log 2>&1`
- **Database**: `~/.decant/data/decant.db`
- **Backups**: `~/.decant/backups/`

### Important Files

- Database: `~/.decant/data/decant.db`
- Config: Environment variables or `.env` file
- Logs: Console/stdout (no persistent log files by default)
