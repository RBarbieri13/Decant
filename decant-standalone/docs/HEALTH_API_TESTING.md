# Health Check API Testing Guide

Quick reference for testing health check and monitoring endpoints.

## Prerequisites

```bash
# Start the Decant server
cd decant-standalone
npm run dev

# Server should be running on http://localhost:3000
```

## Basic Health Check

### Simple Check
```bash
curl http://localhost:3000/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-28T12:00:00.000Z"
}
```

### Pretty Print with jq
```bash
curl -s http://localhost:3000/health | jq
```

---

## Liveness Probe

### Check if Process is Alive
```bash
curl http://localhost:3000/health/live
```

**Expected Response:**
```json
{
  "status": "alive",
  "timestamp": "2026-01-28T12:00:00.000Z"
}
```

### Check Status Code
```bash
curl -w "\nHTTP Status: %{http_code}\n" http://localhost:3000/health/live
```

**Expected Output:**
```
{"status":"alive","timestamp":"2026-01-28T12:00:00.000Z"}
HTTP Status: 200
```

---

## Readiness Probe

### Check Database Health
```bash
curl http://localhost:3000/health/ready
```

**Expected Response (Healthy):**
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

### Check with Status Code
```bash
curl -w "\nHTTP Status: %{http_code}\n" http://localhost:3000/health/ready
```

**Expected:**
- HTTP 200 if database is healthy
- HTTP 503 if database is unhealthy

### Pretty Print
```bash
curl -s http://localhost:3000/health/ready | jq
```

### Extract Database Latency
```bash
curl -s http://localhost:3000/health/ready | jq '.checks.database.latencyMs'
```

---

## Metrics Endpoint

### Get All Metrics
```bash
curl http://localhost:3000/metrics
```

### Pretty Print All Metrics
```bash
curl -s http://localhost:3000/metrics | jq
```

### Extract Specific Metrics

#### Uptime
```bash
curl -s http://localhost:3000/metrics | jq '.uptime'
curl -s http://localhost:3000/metrics | jq '.uptimeHuman'
```

#### Node Count
```bash
curl -s http://localhost:3000/metrics | jq '.database.nodeCount'
```

#### Memory Usage
```bash
curl -s http://localhost:3000/metrics | jq '.memoryUsage'
```

#### Process Info
```bash
curl -s http://localhost:3000/metrics | jq '.process'
```

#### Database Stats
```bash
curl -s http://localhost:3000/metrics | jq '.database'
```

#### Database Size (in MB)
```bash
curl -s http://localhost:3000/metrics | \
  jq '.database.databaseSizeBytes / 1024 / 1024 | floor'
```

#### Memory Usage Percentage
```bash
curl -s http://localhost:3000/metrics | \
  jq '(.memoryUsage.heapUsed / .memoryUsage.heapTotal) * 100 | floor'
```

---

## Continuous Monitoring

### Watch Health Status (Every 2 seconds)
```bash
watch -n 2 'curl -s http://localhost:3000/health | jq'
```

### Watch Database Latency
```bash
watch -n 1 'curl -s http://localhost:3000/health/ready | jq .checks.database.latencyMs'
```

### Watch Node Count
```bash
watch -n 5 'curl -s http://localhost:3000/metrics | jq .database.nodeCount'
```

### Watch Memory Usage
```bash
watch -n 1 'curl -s http://localhost:3000/metrics | jq ".memoryUsage | {heapUsedMB: (.heapUsed/1024/1024|floor), heapTotalMB: (.heapTotal/1024/1024|floor), rssMB: (.rss/1024/1024|floor)}"'
```

---

## Performance Testing

### Measure Response Time
```bash
curl -w "\nTime Total: %{time_total}s\n" -o /dev/null -s http://localhost:3000/health
```

### Test All Endpoints
```bash
echo "=== Basic Health ==="
curl -w "Time: %{time_total}s\n" -o /dev/null -s http://localhost:3000/health

echo "=== Liveness ==="
curl -w "Time: %{time_total}s\n" -o /dev/null -s http://localhost:3000/health/live

echo "=== Readiness ==="
curl -w "Time: %{time_total}s\n" -o /dev/null -s http://localhost:3000/health/ready

echo "=== Metrics ==="
curl -w "Time: %{time_total}s\n" -o /dev/null -s http://localhost:3000/metrics
```

### Load Test (100 requests)
```bash
for i in {1..100}; do
  curl -s http://localhost:3000/health/ready > /dev/null
done
echo "Completed 100 requests"
```

### Concurrent Requests Test
```bash
# Requires GNU parallel
seq 100 | parallel -j 10 'curl -s http://localhost:3000/health > /dev/null'
```

---

## Error Scenarios

### Simulate Database Failure
```bash
# Stop the database (if running separately)
# Or move the database file temporarily
mv ~/.decant/data/decant.db ~/.decant/data/decant.db.backup

# Check readiness - should return 503
curl -w "\nHTTP Status: %{http_code}\n" http://localhost:3000/health/ready

# Restore database
mv ~/.decant/data/decant.db.backup ~/.decant/data/decant.db
```

### Check for Expected Error Response
```bash
# With database unavailable, should see:
{
  "status": "not_ready",
  "timestamp": "2026-01-28T12:00:00.000Z",
  "checks": {
    "database": {
      "status": "unhealthy",
      "latencyMs": 5,
      "error": "SQLITE_CANTOPEN: unable to open database file"
    }
  }
}
```

---

## Integration with Monitoring Tools

### Prometheus Node Exporter Format
```bash
# Current implementation returns JSON
# For Prometheus format, you would typically use a library
# Example custom conversion:
curl -s http://localhost:3000/metrics | jq -r '
  "# HELP decant_uptime_seconds Application uptime in seconds",
  "# TYPE decant_uptime_seconds gauge",
  "decant_uptime_seconds \(.uptime)",
  "# HELP decant_node_count Number of nodes in database",
  "# TYPE decant_node_count gauge",
  "decant_node_count \(.database.nodeCount)",
  "# HELP decant_memory_heap_used_bytes Heap memory used",
  "# TYPE decant_memory_heap_used_bytes gauge",
  "decant_memory_heap_used_bytes \(.memoryUsage.heapUsed)"
'
```

### Grafana Datasource Test
```bash
# Test if metrics are accessible for Grafana
curl -H "Accept: application/json" http://localhost:3000/metrics
```

### Nagios/Icinga Check
```bash
#!/bin/bash
# Example Nagios plugin

RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:3000/health/ready)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "OK - Application is ready"
  exit 0
else
  echo "CRITICAL - Application not ready: $BODY"
  exit 2
fi
```

---

## Kubernetes Testing

### Test from Inside Cluster
```bash
kubectl exec -it <pod-name> -- curl http://localhost:3000/health/ready
```

### Test Liveness Probe
```bash
kubectl exec -it <pod-name> -- curl http://localhost:3000/health/live
```

### Check Probe Logs
```bash
kubectl describe pod <pod-name> | grep -A 10 "Liveness\|Readiness"
```

### View Events
```bash
kubectl get events --field-selector involvedObject.name=<pod-name>
```

---

## Automation Scripts

### Health Check Script
```bash
#!/bin/bash
# health-check.sh

BASE_URL="${1:-http://localhost:3000}"

echo "Checking Decant Health Endpoints..."
echo

# Basic health
echo "1. Basic Health:"
curl -s "$BASE_URL/health" | jq -r '.status'

# Liveness
echo "2. Liveness:"
curl -s "$BASE_URL/health/live" | jq -r '.status'

# Readiness
echo "3. Readiness:"
READY=$(curl -s "$BASE_URL/health/ready")
echo $READY | jq -r '.status'
echo "   DB Latency: $(echo $READY | jq -r '.checks.database.latencyMs')ms"

# Metrics
echo "4. Metrics:"
METRICS=$(curl -s "$BASE_URL/metrics")
echo "   Uptime: $(echo $METRICS | jq -r '.uptimeHuman')"
echo "   Nodes: $(echo $METRICS | jq -r '.database.nodeCount')"
echo "   Heap: $(echo $METRICS | jq -r '.memoryUsage.heapUsed/1024/1024|floor')MB / $(echo $METRICS | jq -r '.memoryUsage.heapTotal/1024/1024|floor')MB"

echo
echo "All checks complete!"
```

### Dashboard Script
```bash
#!/bin/bash
# dashboard.sh

while true; do
  clear
  echo "==================================="
  echo "Decant Health Dashboard"
  echo "==================================="
  echo

  METRICS=$(curl -s http://localhost:3000/metrics)
  READY=$(curl -s http://localhost:3000/health/ready)

  echo "Status: $(echo $READY | jq -r '.checks.database.status')"
  echo "Uptime: $(echo $METRICS | jq -r '.uptimeHuman')"
  echo
  echo "Database:"
  echo "  Nodes: $(echo $METRICS | jq -r '.database.nodeCount')"
  echo "  Tags: $(echo $METRICS | jq -r '.database.totalTags')"
  echo "  Size: $(echo $METRICS | jq -r '.database.databaseSizeBytes/1024/1024|floor')MB"
  echo "  Latency: $(echo $READY | jq -r '.checks.database.latencyMs')ms"
  echo
  echo "Memory:"
  echo "  Heap: $(echo $METRICS | jq -r '.memoryUsage.heapUsed/1024/1024|floor')MB / $(echo $METRICS | jq -r '.memoryUsage.heapTotal/1024/1024|floor')MB"
  echo "  RSS: $(echo $METRICS | jq -r '.memoryUsage.rss/1024/1024|floor')MB"
  echo
  echo "Process:"
  echo "  PID: $(echo $METRICS | jq -r '.process.pid')"
  echo "  Node: $(echo $METRICS | jq -r '.process.nodeVersion')"
  echo
  echo "Last updated: $(date)"
  echo "Press Ctrl+C to exit"

  sleep 2
done
```

Make executable:
```bash
chmod +x health-check.sh dashboard.sh
```

---

## Common Issues

### Issue: Connection Refused
```bash
curl: (7) Failed to connect to localhost port 3000: Connection refused
```

**Solution:**
- Ensure server is running: `npm run dev`
- Check correct port is being used
- Verify no firewall blocking

### Issue: jq Command Not Found
```bash
-bash: jq: command not found
```

**Solution:**
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# CentOS/RHEL
sudo yum install jq
```

### Issue: Slow Response Times
```bash
# If response times are > 100ms
```

**Debug:**
```bash
# Check database latency
curl -s http://localhost:3000/health/ready | jq '.checks.database.latencyMs'

# Check if database file is on slow storage
ls -lh ~/.decant/data/decant.db

# Check memory usage
curl -s http://localhost:3000/metrics | jq '.memoryUsage'
```

---

## Summary

### Quick Commands
```bash
# Basic health
curl http://localhost:3000/health

# Database health
curl http://localhost:3000/health/ready

# Full metrics
curl http://localhost:3000/metrics | jq

# Watch node count
watch -n 5 'curl -s http://localhost:3000/metrics | jq .database.nodeCount'
```

### Files
- All endpoints: See `/docs/HEALTH_MONITORING.md`
- Implementation: See `/docs/IMPLEMENTATION_SUMMARY_HEALTH_CHECKS.md`
