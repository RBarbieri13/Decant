# Health Check System

Comprehensive health check system for monitoring the Decant application's critical components and overall system health.

## Overview

The health check system provides multiple endpoints for monitoring different aspects of the application:

- **Quick checks** - Fast liveness probes for basic monitoring
- **Readiness checks** - Comprehensive checks for Kubernetes readiness probes
- **Component checks** - Individual health checks for specific subsystems
- **Full health reports** - Detailed health information with metrics

## Health Endpoints

### GET /health

Quick health check that only verifies database connectivity. Suitable for basic monitoring and fast health checks.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-30T12:00:00.000Z",
  "latencyMs": 5
}
```

**Status Values:**
- `healthy` - Database is accessible
- `unhealthy` - Database is not accessible

**Response Codes:**
- `200` - Always returns 200 with status in body

---

### GET /health/live

Kubernetes liveness probe. Returns 200 if the process is running. Used to determine if the application needs to be restarted.

**Response:**
```json
{
  "status": "alive",
  "timestamp": "2026-01-30T12:00:00.000Z"
}
```

**Response Codes:**
- `200` - Process is running

---

### GET /health/ready

Kubernetes readiness probe. Comprehensive check of all critical components. Returns 200 only if the application is ready to serve traffic.

**Response (Ready):**
```json
{
  "status": "ready",
  "timestamp": "2026-01-30T12:00:00.000Z",
  "overallStatus": "healthy",
  "checks": {
    "database": {
      "status": "healthy",
      "latencyMs": 5,
      "message": "Database operational",
      "lastChecked": "2026-01-30T12:00:00.000Z"
    },
    "llmProvider": {
      "status": "healthy",
      "message": "LLM provider ready",
      "lastChecked": "2026-01-30T12:00:00.000Z",
      "latencyMs": 2,
      "details": {
        "providerName": "openai",
        "hasApiKey": true,
        "model": "gpt-4o-mini"
      }
    },
    "queue": {
      "status": "healthy",
      "message": "Queue processing normally",
      "lastChecked": "2026-01-30T12:00:00.000Z",
      "latencyMs": 3,
      "details": {
        "pendingJobs": 5,
        "processingJobs": 1,
        "completedLast24h": 150,
        "failedLast24h": 2,
        "avgProcessingTimeMs": 2500
      }
    },
    "cache": {
      "status": "healthy",
      "message": "Cache operational (42 entries, 0.04MB)",
      "lastChecked": "2026-01-30T12:00:00.000Z",
      "latencyMs": 1,
      "details": {
        "size": 42,
        "memoryUsageBytes": 43008
      }
    },
    "filesystem": {
      "status": "healthy",
      "message": "Filesystem healthy (45.23GB available)",
      "lastChecked": "2026-01-30T12:00:00.000Z",
      "latencyMs": 8,
      "details": {
        "dataDirectory": "/path/to/data",
        "isWritable": true,
        "diskSpaceBytes": 48584089600,
        "databaseSizeBytes": 1024000
      }
    }
  }
}
```

**Response (Not Ready):**
```json
{
  "status": "not_ready",
  "timestamp": "2026-01-30T12:00:00.000Z",
  "checks": {
    "database": {
      "status": "unhealthy",
      "message": "Database connection failed",
      "lastChecked": "2026-01-30T12:00:00.000Z"
    }
    // ... other checks
  }
}
```

**Response Codes:**
- `200` - Application is ready (healthy or degraded)
- `503` - Application is not ready (unhealthy)

---

### GET /health/full

Full health check with detailed information about all components. Returns comprehensive health data suitable for monitoring dashboards.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-30T12:00:00.000Z",
  "version": "0.1.0",
  "uptime": 3600,
  "checks": {
    // Same structure as /health/ready
  }
}
```

**Caching:** Results are cached for 30 seconds to avoid excessive checks.

**Response Codes:**
- `200` - Healthy or degraded
- `503` - Unhealthy

---

### GET /health/component/:name

Individual component health check. Useful for targeted monitoring of specific subsystems.

**Valid Component Names:**
- `database` - Database connectivity and performance
- `llm` - LLM provider configuration and availability
- `queue` - Background job queue status
- `cache` - In-memory cache health
- `filesystem` - Filesystem writability and disk space

**Response:**
```json
{
  "component": "database",
  "status": "healthy",
  "latencyMs": 5,
  "message": "Database operational",
  "lastChecked": "2026-01-30T12:00:00.000Z"
}
```

**Response Codes:**
- `200` - Component is healthy or degraded
- `400` - Invalid component name
- `500` - Component check failed
- `503` - Component is unhealthy

---

### GET /metrics

Application metrics and statistics. Not part of health checking but provides useful operational data.

**Response:**
```json
{
  "uptime": 3600,
  "uptimeHuman": "1h 0m 0s",
  "database": {
    "nodeCount": 1523,
    "deletedNodeCount": 42,
    "totalTags": 89,
    "tableSizes": {
      "nodes": 1565,
      "tags": 89,
      "node_tags": 456
    },
    "databaseSizeBytes": 1024000
  },
  "memoryUsage": {
    "heapUsed": 45678912,
    "heapTotal": 67108864,
    "rss": 89012345,
    "external": 1234567
  },
  "process": {
    "pid": 12345,
    "nodeVersion": "v20.10.6",
    "platform": "darwin",
    "arch": "arm64"
  },
  "timestamp": "2026-01-30T12:00:00.000Z"
}
```

**Response Codes:**
- `200` - Always returns metrics

---

## Health Status Levels

### healthy
All systems are operational and performing within normal parameters.

### degraded
Some non-critical systems are having issues, but the application can still function:
- LLM provider is unavailable (read-only operations still work)
- Cache memory usage is high but not critical
- Queue backlog is elevated but manageable
- Low disk space warning

### unhealthy
Critical systems are failing and the application cannot operate properly:
- Database is unreachable
- Filesystem is not writable
- Disk space is critically low
- Queue backlog is critically high

---

## Component Details

### Database
**Critical Component** - Required for all operations

**Checks:**
- Connection availability
- Query latency (warning if > 100ms)
- Response time

**Status Logic:**
- `healthy` - Connection successful, latency < 100ms
- `unhealthy` - Connection failed or timeout

---

### LLM Provider
**Non-Critical Component** - Required only for import/enrichment

**Checks:**
- API key configuration
- Provider initialization
- (Optional) API connectivity ping

**Status Logic:**
- `healthy` - API key configured and provider initialized
- `degraded` - API key not configured or provider not initialized
- `degraded` - API connectivity issues (if ping enabled)

**Details:**
- `providerName` - "openai"
- `hasApiKey` - Boolean indicating if API key is configured
- `model` - Configured model name

---

### Queue
**Important Component** - Required for background processing

**Checks:**
- Queue processor status
- Pending job count
- Processing metrics

**Status Logic:**
- `healthy` - Queue running, backlog < 100 jobs
- `degraded` - Queue not running or backlog 100-500 jobs
- `unhealthy` - Backlog > 500 jobs

**Details:**
- `pendingJobs` - Number of jobs waiting
- `processingJobs` - Number of jobs currently processing
- `completedLast24h` - Jobs completed in last 24 hours
- `failedLast24h` - Jobs failed in last 24 hours
- `avgProcessingTimeMs` - Average processing time

**Thresholds:**
- Warning: 100+ pending jobs
- Critical: 500+ pending jobs

---

### Cache
**Non-Critical Component** - Performance optimization

**Checks:**
- Cache size
- Memory usage estimation
- (Optional) Hit rate

**Status Logic:**
- `healthy` - Memory usage < 100MB
- `degraded` - Memory usage 100-200MB
- `unhealthy` - Memory usage > 200MB

**Details:**
- `size` - Number of cached entries
- `memoryUsageBytes` - Estimated memory usage
- `hitRate` - Cache hit rate (if tracked)

---

### Filesystem
**Critical Component** - Required for data persistence

**Checks:**
- Data directory writability
- Available disk space
- Database file size

**Status Logic:**
- `healthy` - Writable, > 2GB available
- `degraded` - Writable, 1-2GB available
- `unhealthy` - Not writable or < 1GB available

**Details:**
- `dataDirectory` - Path to data directory
- `isWritable` - Boolean indicating write access
- `diskSpaceBytes` - Available disk space in bytes
- `databaseSizeBytes` - Database file size in bytes

**Thresholds:**
- Minimum required: 1GB
- Warning threshold: 2GB

---

## Caching

To reduce overhead from frequent health checks, results are cached:

- **Full health check** - Cached for 30 seconds
- **Quick check** - Not cached (too fast)
- **Component checks** - Not cached individually

Cache can be bypassed by calling `fullHealthCheck(true)` in code.

---

## Usage Examples

### Kubernetes Liveness Probe
```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30
  timeoutSeconds: 5
  failureThreshold: 3
```

### Kubernetes Readiness Probe
```yaml
readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

### Monitoring Script
```bash
#!/bin/bash
# Simple monitoring script

STATUS=$(curl -s http://localhost:3000/health | jq -r '.status')

if [ "$STATUS" != "healthy" ]; then
  echo "WARNING: Application is $STATUS"
  # Send alert
fi
```

### Health Dashboard Query
```bash
# Get full health details
curl http://localhost:3000/health/full | jq

# Check specific component
curl http://localhost:3000/health/component/queue | jq

# Get metrics
curl http://localhost:3000/metrics | jq
```

---

## Implementation Details

### File Structure
```
src/backend/health/
├── types.ts              # TypeScript interfaces
├── database.ts           # Database health check
├── llm.ts               # LLM provider health check
├── queue.ts             # Queue health check
├── cache.ts             # Cache health check
├── filesystem.ts        # Filesystem health check
├── index.ts             # Orchestrator and caching
└── __tests__/
    └── health.spec.ts   # Unit tests
```

### Adding Custom Checks

To add a new health check component:

1. Create check function in `src/backend/health/your-component.ts`:
```typescript
import { ComponentHealth } from './types.js';

export function checkYourComponent(): ComponentHealth {
  const startTime = Date.now();
  const lastChecked = new Date().toISOString();

  try {
    // Perform your checks

    return {
      status: 'healthy',
      message: 'Component is healthy',
      lastChecked,
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error.message,
      lastChecked,
      latencyMs: Date.now() - startTime,
    };
  }
}
```

2. Add to `src/backend/health/index.ts`:
```typescript
import { checkYourComponent } from './your-component.js';

// Add to fullHealthCheck
const yourComponentResult = checkYourComponent();

// Add to checks object
checks: {
  // ... existing checks
  yourComponent: yourComponentResult,
}
```

3. Update TypeScript types in `types.ts`

---

## Troubleshooting

### High Latency on Database Checks
- Check database file size
- Check for long-running queries
- Consider database optimization

### Queue Backlog Growing
- Check LLM provider availability
- Review job failure rate
- Consider increasing `maxConcurrent` setting

### Filesystem Warnings
- Clean up old backups
- Archive completed jobs
- Check for large log files

### Cache Memory High
- Clear cache manually if needed
- Reduce cache TTL
- Review cache key patterns

---

## Performance Considerations

- Quick health check (`/health`) completes in < 10ms
- Full health check (`/health/full`) completes in < 100ms (first run)
- Cached full health check completes in < 5ms
- Individual component checks vary by component (1-50ms)

---

## Security Notes

- Health endpoints are **not rate limited** to allow monitoring systems to function
- Health endpoints are **publicly accessible** by design
- Sensitive information (API keys, passwords) is **never exposed**
- Only status indicators and metrics are returned

---

## Future Enhancements

Potential improvements for future versions:

- [ ] Active LLM provider ping (disabled to avoid costs)
- [ ] Cache hit rate tracking
- [ ] Historical health metrics
- [ ] Custom health check plugins
- [ ] Health check notifications
- [ ] Prometheus metrics export
- [ ] Grafana dashboard templates
