# Health Check and Monitoring System

## Overview

The Decant standalone application includes a comprehensive health check and monitoring system designed for production deployments, especially in containerized environments like Kubernetes.

## Endpoints

### Basic Health Check
**GET /health**

Returns a simple health status to verify the application is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-28T12:00:00.000Z"
}
```

**Use case:** Quick availability check, suitable for uptime monitoring tools.

---

### Liveness Probe
**GET /health/live**

Kubernetes liveness probe endpoint. Returns 200 if the process is alive.

**Response:**
```json
{
  "status": "alive",
  "timestamp": "2026-01-28T12:00:00.000Z"
}
```

**Use case:** Kubernetes uses this to determine if the pod needs to be restarted. If this endpoint fails, the container will be killed and restarted.

---

### Readiness Probe
**GET /health/ready**

Kubernetes readiness probe endpoint. Checks database connectivity.

**Success Response (200):**
```json
{
  "status": "ready",
  "timestamp": "2026-01-28T12:00:00.000Z",
  "checks": {
    "database": {
      "status": "healthy",
      "latencyMs": 2
    }
  }
}
```

**Failure Response (503):**
```json
{
  "status": "not_ready",
  "timestamp": "2026-01-28T12:00:00.000Z",
  "checks": {
    "database": {
      "status": "unhealthy",
      "latencyMs": 5001,
      "error": "Query exceeded timeout threshold (5000ms)"
    }
  }
}
```

**Use case:** Kubernetes uses this to determine if the pod should receive traffic. If this endpoint fails, the pod will be removed from the load balancer until it becomes ready again.

---

### Application Metrics
**GET /metrics**

Returns comprehensive application metrics including database statistics, memory usage, and process information.

**Response:**
```json
{
  "uptime": 3661,
  "uptimeHuman": "1h 1m 1s",
  "database": {
    "nodeCount": 42,
    "deletedNodeCount": 3,
    "totalTags": 15,
    "tableSizes": {
      "nodes": 45,
      "tags": 15,
      "node_tags": 87
    },
    "databaseSizeBytes": 524288
  },
  "memoryUsage": {
    "heapUsed": 23456789,
    "heapTotal": 45678901,
    "rss": 67890123,
    "external": 1234567
  },
  "process": {
    "pid": 12345,
    "nodeVersion": "v20.10.0",
    "platform": "linux",
    "arch": "x64"
  },
  "timestamp": "2026-01-28T12:00:00.000Z"
}
```

**Use case:** Monitoring dashboards, alerting systems, and performance analysis.

---

## Database Health Checks

### Features

1. **Connection Verification**: Executes `SELECT 1` to verify database connectivity
2. **Latency Measurement**: Tracks query execution time
3. **Timeout Detection**: Flags queries that exceed 5 seconds
4. **Error Handling**: Gracefully handles connection errors

### Health Check Functions

#### `checkDatabaseHealth()`
Performs a simple health check query and returns status with latency.

```typescript
interface DatabaseHealthResult {
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}
```

#### `getDatabaseStats()`
Returns comprehensive database statistics.

```typescript
interface DatabaseStats {
  nodeCount: number;
  deletedNodeCount: number;
  totalTags: number;
  tableSizes: {
    nodes: number;
    tags: number;
    node_tags: number;
  };
  databaseSizeBytes?: number;
}
```

---

## Graceful Shutdown

The server implements graceful shutdown handling for both `SIGTERM` and `SIGINT` signals.

### Shutdown Process

1. **Signal Received**: Server receives SIGTERM or SIGINT
2. **Stop Accepting Connections**: HTTP server stops accepting new requests
3. **Close Existing Connections**: Waits for in-flight requests to complete
4. **Close Database**: Database connection is closed cleanly
5. **Exit Process**: Process exits with appropriate status code

### Timeout Protection

If graceful shutdown takes longer than 10 seconds, the process will force exit to prevent hanging.

### Example Log Output

```
[INFO] Received SIGTERM. Starting graceful shutdown...
[INFO] Server stopped accepting new connections
[INFO] Database connection closed
[INFO] Graceful shutdown complete
```

---

## Kubernetes Integration

### Example Deployment Configuration

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: decant-standalone
spec:
  replicas: 3
  selector:
    matchLabels:
      app: decant-standalone
  template:
    metadata:
      labels:
        app: decant-standalone
    spec:
      containers:
      - name: decant
        image: decant-standalone:latest
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 2
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 5"]
```

### Probe Configuration Guidelines

**Liveness Probe:**
- `initialDelaySeconds: 10` - Wait 10 seconds after startup
- `periodSeconds: 30` - Check every 30 seconds
- `timeoutSeconds: 5` - Fail if no response in 5 seconds
- `failureThreshold: 3` - Restart after 3 consecutive failures

**Readiness Probe:**
- `initialDelaySeconds: 5` - Start checking after 5 seconds
- `periodSeconds: 10` - Check every 10 seconds
- `timeoutSeconds: 3` - Fail if no response in 3 seconds
- `failureThreshold: 2` - Remove from service after 2 consecutive failures

---

## Monitoring and Alerting

### Recommended Alerts

1. **High Database Latency**
   - Alert when `/health/ready` latency exceeds 100ms
   - Action: Investigate database performance

2. **Pod Not Ready**
   - Alert when readiness probe fails for more than 1 minute
   - Action: Check database connectivity

3. **High Memory Usage**
   - Alert when `heapUsed / heapTotal` exceeds 90%
   - Action: Investigate memory leaks or increase pod resources

4. **Database Size Growth**
   - Alert when `databaseSizeBytes` grows unexpectedly fast
   - Action: Review data retention policies

### Example Prometheus Queries

```promql
# Database latency
http_request_duration_seconds{endpoint="/health/ready"}

# Memory usage percentage
(nodejs_heap_used_bytes / nodejs_heap_total_bytes) * 100

# Pod ready status
kube_pod_status_ready{pod=~"decant-standalone-.*"}
```

---

## Performance Considerations

### Response Times

All health check endpoints are optimized for fast responses:

- `/health`: < 10ms (no database queries)
- `/health/live`: < 10ms (no database queries)
- `/health/ready`: < 50ms (includes simple DB query)
- `/metrics`: < 100ms (includes multiple DB queries)

### Rate Limiting

Health check endpoints are **NOT** rate limited to ensure:
- Kubernetes probes can function properly
- Monitoring systems can poll frequently
- Emergency health checks always work

API routes (`/api/*`) are rate limited, but health endpoints are registered before the rate limiter middleware.

---

## Testing

### Manual Testing

```bash
# Basic health check
curl http://localhost:3000/health

# Liveness probe
curl http://localhost:3000/health/live

# Readiness probe
curl http://localhost:3000/health/ready

# Full metrics
curl http://localhost:3000/metrics | jq
```

### Automated Testing

Run the test suite:

```bash
# Run all health check tests
npm test src/backend/health
npm test src/backend/routes/__tests__/health.spec.ts

# Run with coverage
npm run coverage
```

---

## Troubleshooting

### Readiness Probe Failing

**Symptoms:** Pod stuck in "Not Ready" state

**Possible Causes:**
1. Database connection issues
2. Database query timeout (> 5 seconds)
3. Database file locked or corrupted

**Solutions:**
1. Check database file permissions
2. Verify database file exists at `~/.decant/data/decant.db`
3. Check database logs for errors
4. Verify disk space is available

### Liveness Probe Failing

**Symptoms:** Pod constantly restarting

**Possible Causes:**
1. Application crash or deadlock
2. Node.js event loop blocked
3. Memory exhaustion

**Solutions:**
1. Check application logs before restart
2. Review memory metrics
3. Investigate long-running operations
4. Check for infinite loops or blocking code

### High Memory Usage

**Symptoms:** Memory usage continuously increasing

**Possible Causes:**
1. Memory leak in application code
2. Large database queries
3. Too many nodes in memory

**Solutions:**
1. Monitor `/metrics` endpoint over time
2. Enable Node.js heap snapshots
3. Review code for memory leaks
4. Implement pagination for large queries

---

## Security Considerations

### Public Exposure

Health check endpoints are safe to expose publicly as they:
- Do not reveal sensitive information
- Do not perform destructive operations
- Are not authenticated (by design)
- Are not rate limited (by design)

### Information Disclosure

The `/metrics` endpoint reveals:
- Node count (non-sensitive)
- Memory usage (operational data)
- Process information (non-sensitive)
- Database size (operational data)

If this information is considered sensitive in your environment, consider:
1. Restricting `/metrics` to internal networks only
2. Adding authentication to the metrics endpoint
3. Using a separate metrics port

---

## Future Enhancements

Potential improvements to the health check system:

1. **Prometheus Export**: Add `/metrics` endpoint in Prometheus format
2. **Custom Health Checks**: Allow plugins to register custom health checks
3. **Detailed Database Metrics**: Add query performance statistics
4. **Cache Health**: Monitor cache hit rates and effectiveness
5. **External Service Checks**: Health checks for OpenAI API and other external services
6. **Historical Metrics**: Store and expose historical performance data

---

## References

- [Kubernetes Liveness, Readiness, and Startup Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Node.js Graceful Shutdown](https://expressjs.com/en/advanced/healthcheck-graceful-shutdown.html)
- [Better SQLite3 Documentation](https://github.com/WiseLibs/better-sqlite3/wiki)
