# Metrics Collection System

Prometheus-compatible metrics collection for the Decant application.

## Overview

The metrics system provides:
- **Prometheus text format** endpoint at `GET /metrics`
- **In-memory metrics store** with no external dependencies
- **Automatic tracking** via middleware
- **Business metrics** for monitoring application health

## Metrics Categories

### 1. Counters (Monotonically Increasing)

```typescript
// Import operations
decant_import_total{status="success|failed", type="url|file"}

// LLM requests
decant_llm_requests_total{provider="openai", status="success|failed"}
decant_llm_tokens_total{provider="openai", type="prompt|completion"}
decant_llm_cost_total{provider="openai"}  // in USD

// API requests
decant_api_requests_total{method="GET|POST|...", path="/api/nodes", status_code="200"}

// Errors
decant_errors_total{category="validation|llm|database|import|internal", code="400"}

// Business metrics
decant_similarity_computations_total
decant_search_queries_total{type="basic|advanced|similar"}
```

### 2. Gauges (Can Go Up or Down)

```typescript
// Queue metrics
decant_queue_depth{status="pending|processing"}

// Connection metrics
decant_active_connections

// Cache metrics
decant_cache_size_bytes

// Business metrics
decant_nodes_total
decant_nodes_enriched_total
```

### 3. Histograms (Distribution of Values)

```typescript
// Import duration
decant_import_duration_seconds{status="success|failed"}
decant_import_duration_seconds_bucket{status="...", le="0.1|0.5|1|2|5|10|30|60|+Inf"}
decant_import_duration_seconds_sum{status="..."}
decant_import_duration_seconds_count{status="..."}

// LLM request duration
decant_llm_request_duration_seconds{provider="openai", status="success|failed"}

// API request duration
decant_api_request_duration_seconds{method="GET", path="/api/nodes"}
```

## Usage Examples

### Automatic Tracking (Middleware)

The metrics middleware automatically tracks all HTTP requests:

```typescript
// In server.ts
import { metricsMiddleware } from './backend/services/metrics/index.js';

app.use(metricsMiddleware);
```

### Manual Tracking

#### Track Import Operations

```typescript
import { trackImport, trackImportDuration } from './backend/services/metrics/index.js';

async function importUrl(url: string) {
  const startTime = Date.now();

  try {
    const result = await performImport(url);

    // Track success
    trackImport('success', 'url');
    trackImportDuration((Date.now() - startTime) / 1000, 'success');

    return result;
  } catch (error) {
    // Track failure
    trackImport('failed', 'url');
    trackImportDuration((Date.now() - startTime) / 1000, 'failed');

    throw error;
  }
}
```

#### Track LLM Requests

```typescript
import { trackLLMRequest } from './backend/services/metrics/index.js';

async function callLLM() {
  const startTime = Date.now();

  try {
    const result = await provider.complete(messages);
    const durationSeconds = (Date.now() - startTime) / 1000;

    trackLLMRequest('openai', 'success', durationSeconds, {
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
      estimatedCost: 0.0015, // Calculate based on model pricing
    });

    return result;
  } catch (error) {
    trackLLMRequest('openai', 'failed', (Date.now() - startTime) / 1000);
    throw error;
  }
}
```

#### LLM Provider with Automatic Metrics

Use the metrics wrapper for automatic LLM tracking:

```typescript
import { OpenAIProvider } from './backend/services/llm/provider.js';
import { withMetrics } from './backend/services/metrics/llm_tracker.js';

// Wrap provider with metrics
const baseProvider = new OpenAIProvider({ apiKey: 'sk-...' });
const provider = withMetrics(baseProvider);

// All calls are now automatically tracked
const result = await provider.complete(messages);
```

#### Track Errors

```typescript
import { trackError } from './backend/services/metrics/index.js';

try {
  validateInput(data);
} catch (error) {
  trackError('validation', 'INVALID_INPUT');
  throw error;
}

try {
  await database.query(sql);
} catch (error) {
  trackError('database', 'QUERY_FAILED');
  throw error;
}
```

#### Update Gauges

```typescript
import {
  updateQueueDepth,
  updateNodesTotal,
  updateNodesEnriched,
  updateActiveConnections
} from './backend/services/metrics/index.js';

// Update queue depth
const stats = queue.getStats();
updateQueueDepth('pending', stats.pending);
updateQueueDepth('processing', stats.processing);

// Update node counts
updateNodesTotal(countNodes());
updateNodesEnriched(countEnrichedNodes());

// Track SSE connections
app.get('/api/events', (req, res) => {
  updateActiveConnections(1); // Increment

  req.on('close', () => {
    updateActiveConnections(-1); // Decrement
  });
});
```

#### Track Business Metrics

```typescript
import { trackSimilarityComputation, trackSearchQuery } from './backend/services/metrics/index.js';

// Track similarity computations
function computeSimilarity(nodeA, nodeB) {
  trackSimilarityComputation();
  return calculateCosineSimilarity(nodeA.embedding, nodeB.embedding);
}

// Track search queries
async function searchNodes(query: string, type: 'basic' | 'advanced') {
  trackSearchQuery(type);
  return performSearch(query);
}
```

## Querying Metrics

### View Metrics Endpoint

```bash
curl http://localhost:8080/metrics
```

### Example Prometheus Scrape Config

```yaml
scrape_configs:
  - job_name: 'decant'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: '/metrics'
```

### Useful PromQL Queries

```promql
# Request rate by status code
rate(decant_api_requests_total[5m])

# Error rate
rate(decant_errors_total[5m])

# LLM cost per hour
rate(decant_llm_cost_total[1h]) * 3600

# Average import duration
rate(decant_import_duration_seconds_sum[5m]) / rate(decant_import_duration_seconds_count[5m])

# P95 API response time
histogram_quantile(0.95, rate(decant_api_request_duration_seconds_bucket[5m]))

# Queue depth
decant_queue_depth{status="pending"}

# Total nodes
decant_nodes_total

# Enrichment rate
decant_nodes_enriched_total / decant_nodes_total
```

## Architecture

### Path Normalization

To prevent high cardinality, the metrics system normalizes API paths:
- UUIDs are replaced with `:id`
- Numeric IDs are replaced with `:id`
- Query strings are removed

Examples:
- `/api/nodes/abc-123-def-456` → `/api/nodes/:id`
- `/api/search?q=test` → `/api/search`

### Histogram Buckets

Default buckets for different metric types:

**Import/LLM Duration:**
```
0.1s, 0.5s, 1s, 2s, 5s, 10s, 30s, 60s, +Inf
```

**API Request Duration:**
```
10ms, 50ms, 100ms, 250ms, 500ms, 1s, 2.5s, 5s, 10s, +Inf
```

### Stats Collection

The system periodically updates gauge metrics (every 60 seconds by default):

```typescript
import { startStatsCollection, stopStatsCollection } from './backend/services/metrics/index.js';

// Start periodic updates
startStatsCollection(60000); // 60 seconds

// Stop on shutdown
stopStatsCollection();
```

## Integration Points

### Server Startup

```typescript
// In server.ts
import { metricsMiddleware, startStatsCollection } from './backend/services/metrics/index.js';

// Add middleware
app.use(metricsMiddleware);

// Start stats collection
startStatsCollection(60000);

// Register metrics endpoint (in routes/index.ts)
import { metricsEndpoint } from './backend/services/metrics/index.js';
app.get('/metrics', metricsEndpoint);
```

### Graceful Shutdown

```typescript
import { stopStatsCollection } from './backend/services/metrics/index.js';

async function gracefulShutdown() {
  stopStatsCollection();
  // ... other cleanup
}
```

## Testing

### Reset Metrics

```typescript
import { resetMetrics } from './backend/services/metrics/index.js';

beforeEach(() => {
  resetMetrics();
});
```

### Export as JSON

For debugging or testing:

```typescript
import { exportMetricsJSON } from './backend/services/metrics/index.js';

const metrics = exportMetricsJSON();
console.log(JSON.stringify(metrics, null, 2));
```

## Performance Considerations

- **In-memory storage**: Metrics are stored in memory, no disk I/O
- **Low overhead**: Label serialization is cached, minimal CPU usage
- **No external dependencies**: Self-contained implementation
- **Async updates**: Gauge updates happen asynchronously

## Monitoring Dashboards

### Grafana Dashboard Example

```json
{
  "dashboard": {
    "title": "Decant Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(decant_api_requests_total[5m])"
          }
        ]
      },
      {
        "title": "LLM Cost (Hourly)",
        "targets": [
          {
            "expr": "rate(decant_llm_cost_total[1h]) * 3600"
          }
        ]
      },
      {
        "title": "Queue Depth",
        "targets": [
          {
            "expr": "decant_queue_depth"
          }
        ]
      }
    ]
  }
}
```

## Error Categories

The system tracks errors by category:

- **validation**: Input validation failures (400-level)
- **llm**: LLM provider errors
- **database**: Database query failures
- **import**: Import/extraction failures
- **internal**: Server errors (500-level)

## Cost Tracking

LLM costs are estimated using current pricing (as of 2025):

| Model | Prompt (per 1M tokens) | Completion (per 1M tokens) |
|-------|------------------------|----------------------------|
| gpt-4o | $2.50 | $10.00 |
| gpt-4o-mini | $0.15 | $0.60 |
| gpt-4-turbo | $10.00 | $30.00 |
| gpt-4 | $30.00 | $60.00 |
| gpt-3.5-turbo | $0.50 | $1.50 |

Costs are tracked in the `decant_llm_cost_total` counter.
