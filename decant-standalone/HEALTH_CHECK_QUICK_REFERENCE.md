# Health Check Quick Reference

Quick reference for the Decant health check system.

## Endpoints at a Glance

| Endpoint | Purpose | Cache | Typical Response Time |
|----------|---------|-------|----------------------|
| `GET /health` | Quick database check | No | <10ms |
| `GET /health/live` | Liveness probe | No | <5ms |
| `GET /health/ready` | Readiness probe | 30s | <5ms (cached) |
| `GET /health/full` | Complete health report | 30s | <5ms (cached) |
| `GET /health/component/:name` | Individual component | No | 1-50ms |
| `GET /metrics` | Application metrics | No | <10ms |

## Component Names

- `database` - Database connectivity and latency
- `llm` - LLM provider configuration
- `queue` - Background job processing
- `cache` - In-memory cache
- `filesystem` - Disk space and writability

## Status Values

- **healthy** - All systems operational
- **degraded** - Some non-critical issues (still operational)
- **unhealthy** - Critical systems failing

## Critical vs Non-Critical

### Critical Components (unhealthy = system down)
- `database`
- `filesystem`
- `queue` (if backlog > 500)

### Non-Critical Components (degraded = system still works)
- `llm`
- `cache`

## Quick Test Commands

```bash
# Basic health
curl http://localhost:3000/health

# Full health report
curl http://localhost:3000/health/full | jq

# Check queue backlog
curl http://localhost:3000/health/component/queue | jq '.details.pendingJobs'

# Check disk space
curl http://localhost:3000/health/component/filesystem | jq '.details.diskSpaceBytes'

# Get all metrics
curl http://localhost:3000/metrics | jq
```

## Common Thresholds

| Component | Metric | Warning | Critical |
|-----------|--------|---------|----------|
| Database | Latency | 50ms | 100ms |
| Queue | Pending Jobs | 100 | 500 |
| Cache | Memory | 100MB | 200MB |
| Filesystem | Disk Space | 2GB | 1GB |

## Kubernetes Configuration

```yaml
# Minimal liveness probe
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  periodSeconds: 30
  failureThreshold: 3

# Minimal readiness probe
readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  periodSeconds: 10
  failureThreshold: 3
```

## Response Code Summary

| Code | Meaning |
|------|---------|
| 200 | Healthy or degraded (still operational) |
| 400 | Invalid component name |
| 503 | Unhealthy (critical failure) |

## Example Responses

### Healthy
```json
{
  "status": "healthy",
  "timestamp": "2026-01-30T12:00:00.000Z"
}
```

### Degraded
```json
{
  "status": "degraded",
  "checks": {
    "llmProvider": {
      "status": "degraded",
      "message": "OpenAI API key not configured"
    }
  }
}
```

### Unhealthy
```json
{
  "status": "unhealthy",
  "checks": {
    "database": {
      "status": "unhealthy",
      "message": "Database connection failed"
    }
  }
}
```

## Monitoring Script

```bash
#!/bin/bash
# Simple health monitoring

STATUS=$(curl -s http://localhost:3000/health | jq -r '.status')

if [ "$STATUS" = "healthy" ]; then
  echo "✓ System healthy"
  exit 0
elif [ "$STATUS" = "degraded" ]; then
  echo "⚠ System degraded"
  exit 1
else
  echo "✗ System unhealthy"
  exit 2
fi
```

## Files Location

```
src/backend/health/
├── types.ts          # Interfaces
├── database.ts       # DB health
├── llm.ts           # LLM health
├── queue.ts         # Queue health
├── cache.ts         # Cache health
├── filesystem.ts    # Filesystem health
└── index.ts         # Orchestrator
```

## Common Issues

| Issue | Component | Check |
|-------|-----------|-------|
| Slow responses | Database | `latencyMs` in database check |
| Import not working | LLM | Check `llmProvider.details.hasApiKey` |
| Jobs piling up | Queue | Check `queue.details.pendingJobs` |
| Out of disk | Filesystem | Check `filesystem.details.diskSpaceBytes` |
| High memory | Cache | Check `cache.details.memoryUsageBytes` |

## Testing

```bash
# Run all health tests
npm test health

# Run unit tests only
npm test src/backend/health/__tests__

# Run integration tests only
npm test src/backend/routes/__tests__/health
```

## Documentation

- **Full Docs**: `docs/HEALTH_CHECKS.md`
- **Implementation**: `HEALTH_CHECK_IMPLEMENTATION.md`
- **Summary**: `IMPLEMENTATION_SUMMARY.txt`
