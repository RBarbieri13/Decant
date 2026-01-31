# Metrics Integration Example

This document shows how to integrate metrics tracking into the Decant import orchestrator.

## Import Orchestrator Integration

### Before (Without Metrics)

```typescript
// src/backend/services/import/orchestrator.ts
export async function import(options: ImportOptions): Promise<ImportResult> {
  // Validate URL
  const validation = validateUrl(options.url);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      code: validation.code,
    };
  }

  // Perform import
  try {
    const result = await performImport(options.url);
    return {
      success: true,
      nodeId: result.nodeId,
      classification: result.classification,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: 'IMPORT_FAILED',
    };
  }
}
```

### After (With Metrics)

```typescript
// src/backend/services/import/orchestrator.ts
import {
  trackImport,
  trackImportDuration,
  trackError,
} from '../metrics/index.js';

export async function import(options: ImportOptions): Promise<ImportResult> {
  const startTime = Date.now();

  // Validate URL
  const validation = validateUrl(options.url);
  if (!validation.valid) {
    // Track validation error
    trackError('validation', validation.code);
    trackImport('failed', 'url');
    trackImportDuration((Date.now() - startTime) / 1000, 'failed');

    return {
      success: false,
      error: validation.error,
      code: validation.code,
    };
  }

  // Perform import
  try {
    const result = await performImport(options.url);

    // Track success
    trackImport('success', 'url');
    trackImportDuration((Date.now() - startTime) / 1000, 'success');

    return {
      success: true,
      nodeId: result.nodeId,
      classification: result.classification,
    };
  } catch (error) {
    // Track failure
    trackError('import', 'IMPORT_FAILED');
    trackImport('failed', 'url');
    trackImportDuration((Date.now() - startTime) / 1000, 'failed');

    return {
      success: false,
      error: error.message,
      code: 'IMPORT_FAILED',
    };
  }
}
```

## LLM Provider Integration

### Wrap Provider with Metrics

```typescript
// src/backend/services/llm/provider.ts
import { OpenAIProvider } from './openai_provider.js';
import { withMetrics } from '../metrics/llm_tracker.js';

// Initialize provider with metrics
export function initializeProvider(config: ProviderConfig): LLMProvider {
  const baseProvider = new OpenAIProvider(config);

  // Wrap with metrics tracking
  return withMetrics(baseProvider);
}
```

Now all LLM calls are automatically tracked:
- Request count by status
- Token usage (prompt/completion)
- Estimated cost
- Request duration

## Processing Queue Integration

### Track Queue Depth

```typescript
// src/backend/services/processing_queue.ts
import { updateQueueDepth } from '../metrics/index.js';

export class ProcessingQueue {
  private async poll(): Promise<void> {
    // Fetch jobs
    const jobs = this.fetchPendingJobs();

    // Update metrics
    const stats = this.getStats();
    updateQueueDepth('pending', stats.pending);
    updateQueueDepth('processing', stats.processing);

    // Process jobs
    await Promise.all(jobs.map(job => this.processJob(job)));
  }
}
```

## Search Service Integration

### Track Search Queries

```typescript
// src/backend/database/search.ts
import { trackSearchQuery } from '../services/metrics/index.js';

export function searchNodes(query: string, options?: SearchOptions): SearchResult[] {
  // Track search query
  trackSearchQuery('basic');

  // Perform search
  const results = performSearch(query, options);

  return results;
}

export function searchAdvanced(filters: SearchFilters): SearchResult[] {
  // Track advanced search
  trackSearchQuery('advanced');

  // Perform search
  const results = performAdvancedSearch(filters);

  return results;
}

export function findSimilarNodes(nodeId: string, limit: number): SearchResult[] {
  // Track similarity search
  trackSearchQuery('similar');

  // Track computation
  import { trackSimilarityComputation } from '../services/metrics/index.js';

  const results = computeSimilarity(nodeId);
  trackSimilarityComputation(); // Called for each similarity calculation

  return results;
}
```

## Error Handler Integration

### Track All Errors

```typescript
// src/backend/middleware/errorHandler.ts
import { trackError } from '../services/metrics/index.js';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Determine error category and code
  const statusCode = res.statusCode || 500;
  const category = statusCode >= 500 ? 'internal' : 'validation';

  // Track error
  trackError(category, statusCode.toString());

  // Log and respond
  log.error('Request error', { error: error.message, statusCode });
  res.status(statusCode).json({
    error: error.message,
  });
}
```

## SSE Connection Tracking

### Track Active Connections

```typescript
// src/backend/routes/index.ts
import { updateActiveConnections } from '../services/metrics/index.js';

function handleSSEConnection(req: Request, res: Response): void {
  // Increment connection count
  updateActiveConnections(1);

  // Subscribe to events
  const unsubscribe = notificationService.subscribeAll((event) => {
    sendSSEEvent(res, event.type, event);
  });

  // Clean up on disconnect
  req.on('close', () => {
    updateActiveConnections(-1); // Decrement
    unsubscribe();
  });
}
```

## Complete Example: Import with All Metrics

Here's a complete example showing all metrics integration points:

```typescript
// src/backend/services/import/orchestrator.ts
import {
  trackImport,
  trackImportDuration,
  trackError,
  updateNodesTotal,
  updateNodesEnriched,
} from '../metrics/index.js';
import { countNodes } from '../../database/nodes.js';

export class ImportOrchestrator {
  async import(options: ImportOptions): Promise<ImportResult> {
    const startTime = Date.now();

    try {
      // 1. Validate input
      const validation = this.validateInput(options);
      if (!validation.valid) {
        trackError('validation', validation.code);
        trackImport('failed', 'url');
        trackImportDuration((Date.now() - startTime) / 1000, 'failed');

        return {
          success: false,
          error: validation.error,
          code: validation.code,
        };
      }

      // 2. Check cache
      const cached = this.cache.get(options.url);
      if (cached && !options.forceRefresh) {
        trackImport('success', 'url');
        trackImportDuration((Date.now() - startTime) / 1000, 'success');

        return {
          success: true,
          cached: true,
          ...cached,
        };
      }

      // 3. Extract content
      const extraction = await this.extract(options.url);
      if (!extraction.success) {
        trackError('import', 'EXTRACTION_FAILED');
        trackImport('failed', 'url');
        trackImportDuration((Date.now() - startTime) / 1000, 'failed');

        return {
          success: false,
          error: extraction.error,
          code: 'EXTRACTION_FAILED',
        };
      }

      // 4. Classify with LLM (automatically tracked via withMetrics wrapper)
      const classification = await this.classifier.classify(extraction.content);

      // 5. Create node
      const node = await this.createNode(extraction, classification);

      // 6. Enqueue for Phase 2
      const jobId = this.queue.enqueue(node.id);

      // 7. Update business metrics
      const totalNodes = countNodes();
      updateNodesTotal(totalNodes);

      // 8. Track success
      trackImport('success', 'url');
      trackImportDuration((Date.now() - startTime) / 1000, 'success');

      return {
        success: true,
        nodeId: node.id,
        classification,
        phase2JobId: jobId,
        cached: false,
      };

    } catch (error) {
      // Track unexpected errors
      trackError('internal', 'UNEXPECTED_ERROR');
      trackImport('failed', 'url');
      trackImportDuration((Date.now() - startTime) / 1000, 'failed');

      return {
        success: false,
        error: error.message,
        code: 'INTERNAL_ERROR',
      };
    }
  }

  private async extract(url: string): Promise<ExtractionResult> {
    try {
      // Extraction logic
      return await performExtraction(url);
    } catch (error) {
      // Track extraction errors
      trackError('import', 'EXTRACTION_FAILED');
      throw error;
    }
  }
}
```

## Phase 2 Enrichment with Metrics

```typescript
// src/backend/services/phase2_enricher.ts
import {
  updateNodesEnriched,
  trackError,
} from '../services/metrics/index.js';

export async function enrichNode(nodeId: string): Promise<EnrichmentResult> {
  try {
    // Perform enrichment (LLM calls are auto-tracked)
    const enrichment = await performEnrichment(nodeId);

    // Update node
    await updateNodePhase2(nodeId, enrichment);

    // Update business metric
    const db = getDatabase();
    const enrichedCount = db.prepare(`
      SELECT COUNT(*) as count FROM nodes
      WHERE json_extract(extracted_fields, '$.phase2Completed') = 1
    `).get() as { count: number };

    updateNodesEnriched(enrichedCount.count);

    return {
      success: true,
      nodeId,
      durationMs: Date.now() - startTime,
    };

  } catch (error) {
    trackError('llm', 'ENRICHMENT_FAILED');

    return {
      success: false,
      nodeId,
      error: error.message,
      durationMs: Date.now() - startTime,
    };
  }
}
```

## Monitoring Dashboard Queries

Once integrated, you can monitor with these PromQL queries:

```promql
# Import success rate
sum(rate(decant_import_total{status="success"}[5m])) /
sum(rate(decant_import_total[5m]))

# Average import duration
rate(decant_import_duration_seconds_sum[5m]) /
rate(decant_import_duration_seconds_count[5m])

# LLM cost per hour
rate(decant_llm_cost_total[1h]) * 3600

# Error rate by category
sum by (category) (rate(decant_errors_total[5m]))

# Queue processing rate
rate(decant_queue_depth{status="processing"}[5m])

# Enrichment completion percentage
decant_nodes_enriched_total / decant_nodes_total * 100
```

## Alerting Rules

Example Prometheus alerting rules:

```yaml
groups:
  - name: decant_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(decant_errors_total[5m])) > 0.1
        for: 5m
        annotations:
          summary: "High error rate detected"

      - alert: LLMCostSpike
        expr: |
          rate(decant_llm_cost_total[1h]) * 3600 > 10
        for: 10m
        annotations:
          summary: "LLM costs exceeding $10/hour"

      - alert: QueueBacklog
        expr: |
          decant_queue_depth{status="pending"} > 100
        for: 15m
        annotations:
          summary: "Queue backlog growing"

      - alert: SlowImports
        expr: |
          histogram_quantile(0.95,
            rate(decant_import_duration_seconds_bucket[5m])
          ) > 30
        for: 10m
        annotations:
          summary: "P95 import duration exceeds 30 seconds"
```

## Benefits

With metrics integration, you get:

1. **Visibility**: See exactly what's happening in production
2. **Debugging**: Identify bottlenecks and failures quickly
3. **Cost Tracking**: Monitor LLM usage and costs in real-time
4. **Alerting**: Get notified of issues before users complain
5. **Capacity Planning**: Understand usage patterns and plan scaling
6. **SLO Monitoring**: Track service-level objectives and SLAs
