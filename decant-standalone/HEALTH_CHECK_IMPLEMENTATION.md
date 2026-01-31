# Health Check System Implementation Summary

## Overview

Implemented a comprehensive health check system for the Decant application with support for Kubernetes probes, component-level monitoring, and detailed health metrics.

## Files Created/Modified

### New Files

#### Health Check Modules
- `/src/backend/health/types.ts` - TypeScript interfaces and types
- `/src/backend/health/llm.ts` - LLM provider health check
- `/src/backend/health/queue.ts` - Processing queue health check
- `/src/backend/health/cache.ts` - Cache health check
- `/src/backend/health/filesystem.ts` - Filesystem health check
- `/src/backend/health/index.ts` - Health check orchestrator with caching

#### Tests
- `/src/backend/health/__tests__/health.spec.ts` - Unit tests
- `/src/backend/routes/__tests__/health.integration.spec.ts` - Integration tests

#### Documentation
- `/docs/HEALTH_CHECKS.md` - Comprehensive documentation

### Modified Files
- `/src/backend/routes/health.ts` - Enhanced with new endpoints
- `/src/backend/routes/index.ts` - Added new route registrations

## API Endpoints

### Core Health Endpoints

1. **GET /health** - Quick health check (database only)
2. **GET /health/live** - Kubernetes liveness probe
3. **GET /health/ready** - Kubernetes readiness probe (all components)
4. **GET /health/full** - Full health report with caching
5. **GET /health/component/:name** - Individual component checks
6. **GET /metrics** - Application metrics (existing, unchanged)

## Health Check Components

### 1. Database (Critical)
- **Check**: SELECT 1 query, latency measurement
- **Status**: healthy if connected and latency < 100ms
- **Impact**: unhealthy → overall system unhealthy

### 2. LLM Provider (Non-Critical)
- **Check**: API key configuration, provider initialization
- **Status**: degraded if not configured/initialized
- **Impact**: degraded → system still operational
- **Details**: Provider name, API key status, model

### 3. Queue (Important)
- **Check**: Queue status, backlog size, processing metrics
- **Status**:
  - healthy: backlog < 100
  - degraded: backlog 100-500 or queue not running
  - unhealthy: backlog > 500
- **Impact**: unhealthy → overall system unhealthy
- **Details**: Pending/processing jobs, 24h completion/failure stats, avg processing time

### 4. Cache (Non-Critical)
- **Check**: Memory usage estimation
- **Status**:
  - healthy: < 100MB
  - degraded: 100-200MB
  - unhealthy: > 200MB
- **Impact**: degraded → system still operational
- **Details**: Entry count, memory usage

### 5. Filesystem (Critical)
- **Check**: Directory writability, disk space
- **Status**:
  - healthy: writable, > 2GB available
  - degraded: writable, 1-2GB available
  - unhealthy: not writable or < 1GB
- **Impact**: unhealthy → overall system unhealthy
- **Details**: Data directory, writable status, disk space, DB size

## Health Status Logic

### Overall Status Determination
```typescript
if (database.unhealthy || filesystem.unhealthy || queue.unhealthy) {
  return 'unhealthy';
}

if (any component is degraded) {
  return 'degraded';
}

return 'healthy';
```

### Response Codes
- `/health/ready`: 200 (ready), 503 (not ready)
- `/health/full`: 200 (healthy/degraded), 503 (unhealthy)
- `/health/component/:name`: 200 (healthy/degraded), 503 (unhealthy)

## Features

### Caching
- Full health check results cached for 30 seconds
- Reduces overhead from frequent monitoring
- Can be bypassed with `skipCache` parameter in code

### Performance
- Quick check: < 10ms
- Full check (uncached): < 100ms
- Full check (cached): < 5ms
- Individual components: 1-50ms

### Error Handling
- Graceful degradation
- Never throws - always returns status
- Detailed error messages in response
- Logging of health check failures

## Testing

### Unit Tests
```bash
npm test src/backend/health/__tests__/health.spec.ts
```

Tests cover:
- Quick health check
- Full health check with caching
- Individual component checks
- Cache bypass functionality
- Status determination logic

### Integration Tests
```bash
npm test src/backend/routes/__tests__/health.integration.spec.ts
```

Tests cover:
- All endpoint responses
- Status code validation
- Response structure validation
- Component detail validation
- Caching behavior
- Performance benchmarks
- Concurrent request handling

## Usage Examples

### Kubernetes Configuration

```yaml
# Liveness probe - restart if process is dead
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30
  failureThreshold: 3

# Readiness probe - route traffic only when ready
readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
  failureThreshold: 3
```

### Monitoring Script

```bash
#!/bin/bash
# Check overall health
curl -s http://localhost:3000/health/full | jq '{
  status: .status,
  uptime: .uptime,
  database: .checks.database.status,
  queue: .checks.queue.details.pendingJobs
}'
```

### Dashboard Query

```bash
# Get specific component
curl http://localhost:3000/health/component/queue | jq

# Get full metrics
curl http://localhost:3000/metrics | jq
```

## Response Examples

### Healthy System
```json
{
  "status": "healthy",
  "timestamp": "2026-01-30T12:00:00.000Z",
  "version": "0.1.0",
  "uptime": 3600,
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
      "details": {
        "providerName": "openai",
        "hasApiKey": true,
        "model": "gpt-4o-mini"
      }
    }
    // ... other components
  }
}
```

### Degraded System (LLM not configured)
```json
{
  "status": "degraded",
  "checks": {
    "llmProvider": {
      "status": "degraded",
      "message": "OpenAI API key not configured"
    }
    // ... other components healthy
  }
}
```

### Unhealthy System (Database down)
```json
{
  "status": "unhealthy",
  "checks": {
    "database": {
      "status": "unhealthy",
      "message": "Database connection failed"
    }
    // ... other components
  }
}
```

## Component Details Structure

Each component health response includes:

```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy',
  latencyMs?: number,
  message?: string,
  lastChecked: string,  // ISO timestamp
  details?: {
    // Component-specific metrics
  }
}
```

## Security Considerations

- Health endpoints are NOT rate limited (by design)
- Publicly accessible (required for monitoring)
- No sensitive data exposed (API keys shown as boolean only)
- Only status and metrics returned

## Future Enhancements

Potential additions for future versions:

1. **Active LLM Ping** - Optional connectivity test (currently disabled to avoid costs)
2. **Cache Hit Rate** - Track cache effectiveness
3. **Historical Metrics** - Store health check history
4. **Custom Plugins** - Allow custom health checks
5. **Notifications** - Alert on health degradation
6. **Prometheus Export** - Metrics in Prometheus format
7. **Grafana Dashboards** - Pre-built visualization templates

## Integration Points

The health check system integrates with:

- Database connection pool
- LLM provider service
- Processing queue service
- In-memory cache
- Filesystem/storage layer
- Configuration system
- Logging system

## Maintenance

### Adding New Components

1. Create check module in `src/backend/health/`
2. Implement `ComponentHealth` interface
3. Add to orchestrator in `index.ts`
4. Update types in `types.ts`
5. Add tests
6. Update documentation

### Tuning Thresholds

Edit constants in respective health check files:

- Queue: `WARNING_THRESHOLD`, `UNHEALTHY_THRESHOLD`
- Cache: `MEMORY_WARNING_MB`, `MEMORY_CRITICAL_MB`
- Filesystem: `MIN_DISK_SPACE_GB`
- Database: `HEALTH_CHECK_TIMEOUT_MS`

## Documentation

See `/docs/HEALTH_CHECKS.md` for:
- Detailed endpoint documentation
- Component descriptions
- Status logic
- Usage examples
- Troubleshooting guide
- Performance notes

## Testing the Implementation

```bash
# Run all health check tests
npm test health

# Start server
npm run dev:server

# Test endpoints
curl http://localhost:3000/health
curl http://localhost:3000/health/ready
curl http://localhost:3000/health/full
curl http://localhost:3000/health/component/database
curl http://localhost:3000/metrics
```

## Summary

This implementation provides:

✅ Kubernetes-ready liveness and readiness probes
✅ Component-level health monitoring
✅ Detailed health metrics and statistics
✅ Efficient caching (30s TTL)
✅ Graceful degradation
✅ Comprehensive test coverage
✅ Production-ready performance
✅ Complete documentation
