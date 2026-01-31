// ============================================================
// Prometheus-Compatible Metrics Collection
// In-memory metrics store with Prometheus text format export
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { log } from '../../logger/index.js';

// ============================================================
// Types and Interfaces
// ============================================================

/**
 * Metric labels as key-value pairs
 */
export type MetricLabels = Record<string, string>;

/**
 * Base metric interface
 */
interface BaseMetric {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram';
}

/**
 * Counter metric - monotonically increasing value
 */
interface CounterMetric extends BaseMetric {
  type: 'counter';
  values: Map<string, number>;
}

/**
 * Gauge metric - value that can go up or down
 */
interface GaugeMetric extends BaseMetric {
  type: 'gauge';
  values: Map<string, number>;
}

/**
 * Histogram bucket configuration
 */
interface HistogramBucket {
  le: number; // less than or equal
  count: number;
}

/**
 * Histogram metric - distribution of values
 */
interface HistogramMetric extends BaseMetric {
  type: 'histogram';
  buckets: number[];
  values: Map<string, {
    buckets: HistogramBucket[];
    sum: number;
    count: number;
  }>;
}

/**
 * Union type for all metrics
 */
type Metric = CounterMetric | GaugeMetric | HistogramMetric;

/**
 * Token usage tracking
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

// ============================================================
// Metrics Registry
// ============================================================

/**
 * In-memory metrics registry
 */
class MetricsRegistry {
  private metrics: Map<string, Metric> = new Map();

  /**
   * Register a counter metric
   */
  registerCounter(name: string, help: string): void {
    if (this.metrics.has(name)) {
      return; // Already registered
    }

    this.metrics.set(name, {
      name,
      help,
      type: 'counter',
      values: new Map(),
    });
  }

  /**
   * Register a gauge metric
   */
  registerGauge(name: string, help: string): void {
    if (this.metrics.has(name)) {
      return; // Already registered
    }

    this.metrics.set(name, {
      name,
      help,
      type: 'gauge',
      values: new Map(),
    });
  }

  /**
   * Register a histogram metric
   */
  registerHistogram(name: string, help: string, buckets: number[]): void {
    if (this.metrics.has(name)) {
      return; // Already registered
    }

    this.metrics.set(name, {
      name,
      help,
      type: 'histogram',
      buckets: [...buckets].sort((a, b) => a - b),
      values: new Map(),
    });
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, labels: MetricLabels = {}, value: number = 1): void {
    const metric = this.metrics.get(name) as CounterMetric | undefined;
    if (!metric || metric.type !== 'counter') {
      log.warn(`Counter metric not found: ${name}`, { module: 'metrics' });
      return;
    }

    const key = this.serializeLabels(labels);
    const current = metric.values.get(key) || 0;
    metric.values.set(key, current + value);
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, labels: MetricLabels = {}, value: number): void {
    const metric = this.metrics.get(name) as GaugeMetric | undefined;
    if (!metric || metric.type !== 'gauge') {
      log.warn(`Gauge metric not found: ${name}`, { module: 'metrics' });
      return;
    }

    const key = this.serializeLabels(labels);
    metric.values.set(key, value);
  }

  /**
   * Increment a gauge
   */
  incrementGauge(name: string, labels: MetricLabels = {}, value: number = 1): void {
    const metric = this.metrics.get(name) as GaugeMetric | undefined;
    if (!metric || metric.type !== 'gauge') {
      log.warn(`Gauge metric not found: ${name}`, { module: 'metrics' });
      return;
    }

    const key = this.serializeLabels(labels);
    const current = metric.values.get(key) || 0;
    metric.values.set(key, current + value);
  }

  /**
   * Decrement a gauge
   */
  decrementGauge(name: string, labels: MetricLabels = {}, value: number = 1): void {
    this.incrementGauge(name, labels, -value);
  }

  /**
   * Observe a value in a histogram
   */
  observeHistogram(name: string, labels: MetricLabels = {}, value: number): void {
    const metric = this.metrics.get(name) as HistogramMetric | undefined;
    if (!metric || metric.type !== 'histogram') {
      log.warn(`Histogram metric not found: ${name}`, { module: 'metrics' });
      return;
    }

    const key = this.serializeLabels(labels);
    let histData = metric.values.get(key);

    if (!histData) {
      // Initialize histogram data
      histData = {
        buckets: metric.buckets.map(le => ({ le, count: 0 })),
        sum: 0,
        count: 0,
      };
      metric.values.set(key, histData);
    }

    // Update buckets
    for (const bucket of histData.buckets) {
      if (value <= bucket.le) {
        bucket.count++;
      }
    }

    // Update sum and count
    histData.sum += value;
    histData.count++;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    for (const metric of this.metrics.values()) {
      metric.values.clear();
    }
  }

  /**
   * Export metrics in Prometheus text format
   */
  exportPrometheus(): string {
    const lines: string[] = [];

    for (const metric of this.metrics.values()) {
      // Add HELP line
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      if (metric.type === 'counter' || metric.type === 'gauge') {
        // Simple counter/gauge metrics
        for (const [labelsStr, value] of metric.values.entries()) {
          const labelsPart = labelsStr ? `{${labelsStr}}` : '';
          lines.push(`${metric.name}${labelsPart} ${value}`);
        }
      } else if (metric.type === 'histogram') {
        // Histogram metrics
        for (const [labelsStr, histData] of metric.values.entries()) {
          const baseLabels = labelsStr ? `${labelsStr},` : '';

          // Export buckets
          for (const bucket of histData.buckets) {
            const leLabel = bucket.le === Infinity ? '+Inf' : bucket.le.toString();
            lines.push(`${metric.name}_bucket{${baseLabels}le="${leLabel}"} ${bucket.count}`);
          }

          // Export sum and count
          const labelsPart = labelsStr ? `{${labelsStr}}` : '';
          lines.push(`${metric.name}_sum${labelsPart} ${histData.sum}`);
          lines.push(`${metric.name}_count${labelsPart} ${histData.count}`);
        }
      }

      lines.push(''); // Empty line between metrics
    }

    return lines.join('\n');
  }

  /**
   * Get all metrics as JSON (for debugging)
   */
  exportJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [name, metric] of this.metrics.entries()) {
      const values: Record<string, unknown> = {};

      for (const [labelsStr, value] of metric.values.entries()) {
        values[labelsStr || 'default'] = value;
      }

      result[name] = {
        type: metric.type,
        help: metric.help,
        values,
      };
    }

    return result;
  }

  /**
   * Serialize labels to a consistent string format
   */
  private serializeLabels(labels: MetricLabels): string {
    const keys = Object.keys(labels).sort();
    if (keys.length === 0) return '';

    return keys
      .map(key => `${key}="${labels[key]}"`)
      .join(',');
  }
}

// ============================================================
// Global Registry Instance
// ============================================================

const registry = new MetricsRegistry();

// ============================================================
// Metric Definitions
// ============================================================

/**
 * Initialize all application metrics
 */
export function initializeMetrics(): void {
  // ============================================================
  // Counter Metrics
  // ============================================================

  // Import metrics
  registry.registerCounter(
    'decant_import_total',
    'Total number of import operations'
  );

  // LLM request metrics
  registry.registerCounter(
    'decant_llm_requests_total',
    'Total number of LLM API requests'
  );

  registry.registerCounter(
    'decant_llm_tokens_total',
    'Total number of LLM tokens consumed'
  );

  registry.registerCounter(
    'decant_llm_cost_total',
    'Total estimated cost of LLM usage in USD'
  );

  // API request metrics
  registry.registerCounter(
    'decant_api_requests_total',
    'Total number of API requests'
  );

  // Error metrics
  registry.registerCounter(
    'decant_errors_total',
    'Total number of errors by category'
  );

  // Business metrics
  registry.registerCounter(
    'decant_similarity_computations_total',
    'Total number of similarity computations'
  );

  registry.registerCounter(
    'decant_search_queries_total',
    'Total number of search queries executed'
  );

  // ============================================================
  // Gauge Metrics
  // ============================================================

  // Queue metrics
  registry.registerGauge(
    'decant_queue_depth',
    'Current depth of processing queue by status'
  );

  // Connection metrics
  registry.registerGauge(
    'decant_active_connections',
    'Number of active SSE connections'
  );

  // Cache metrics
  registry.registerGauge(
    'decant_cache_size_bytes',
    'Size of cache in bytes'
  );

  // Business metrics
  registry.registerGauge(
    'decant_nodes_total',
    'Total number of nodes in the system'
  );

  registry.registerGauge(
    'decant_nodes_enriched_total',
    'Total number of nodes enriched with Phase 2'
  );

  // ============================================================
  // Histogram Metrics
  // ============================================================

  // Default histogram buckets: 0.1s, 0.5s, 1s, 2s, 5s, 10s, 30s, 60s, +Inf
  const defaultBuckets = [0.1, 0.5, 1, 2, 5, 10, 30, 60, Infinity];

  // Import duration
  registry.registerHistogram(
    'decant_import_duration_seconds',
    'Duration of import operations in seconds',
    defaultBuckets
  );

  // LLM request duration
  registry.registerHistogram(
    'decant_llm_request_duration_seconds',
    'Duration of LLM API requests in seconds',
    defaultBuckets
  );

  // API request duration
  registry.registerHistogram(
    'decant_api_request_duration_seconds',
    'Duration of API requests in seconds',
    [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, Infinity]
  );

  log.info('Metrics initialized', { module: 'metrics' });
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Track an import operation
 */
export function trackImport(status: 'success' | 'failed', type: 'url' | 'file'): void {
  registry.incrementCounter('decant_import_total', { status, type });
}

/**
 * Track import duration
 */
export function trackImportDuration(durationSeconds: number, status: 'success' | 'failed'): void {
  registry.observeHistogram('decant_import_duration_seconds', { status }, durationSeconds);
}

/**
 * Track LLM request
 */
export function trackLLMRequest(
  provider: string,
  status: 'success' | 'failed',
  durationSeconds: number,
  tokenUsage?: TokenUsage
): void {
  // Increment request counter
  registry.incrementCounter('decant_llm_requests_total', { provider, status });

  // Track duration
  registry.observeHistogram('decant_llm_request_duration_seconds', { provider, status }, durationSeconds);

  // Track token usage if provided
  if (tokenUsage) {
    registry.incrementCounter('decant_llm_tokens_total', {
      provider,
      type: 'prompt',
    }, tokenUsage.promptTokens);

    registry.incrementCounter('decant_llm_tokens_total', {
      provider,
      type: 'completion',
    }, tokenUsage.completionTokens);

    registry.incrementCounter('decant_llm_cost_total', {
      provider,
    }, tokenUsage.estimatedCost);
  }
}

/**
 * Track API request
 */
export function trackAPIRequest(
  method: string,
  path: string,
  statusCode: number,
  durationSeconds: number
): void {
  // Normalize path to avoid high cardinality
  const normalizedPath = normalizePath(path);

  registry.incrementCounter('decant_api_requests_total', {
    method,
    path: normalizedPath,
    status_code: statusCode.toString(),
  });

  registry.observeHistogram('decant_api_request_duration_seconds', {
    method,
    path: normalizedPath,
  }, durationSeconds);
}

/**
 * Track error
 */
export function trackError(category: string, code: string): void {
  registry.incrementCounter('decant_errors_total', { category, code });
}

/**
 * Update queue depth gauge
 */
export function updateQueueDepth(status: 'pending' | 'processing', depth: number): void {
  registry.setGauge('decant_queue_depth', { status }, depth);
}

/**
 * Update active connections gauge
 */
export function updateActiveConnections(delta: number): void {
  registry.incrementGauge('decant_active_connections', {}, delta);
}

/**
 * Update cache size gauge
 */
export function updateCacheSize(sizeBytes: number): void {
  registry.setGauge('decant_cache_size_bytes', {}, sizeBytes);
}

/**
 * Update nodes total gauge
 */
export function updateNodesTotal(count: number): void {
  registry.setGauge('decant_nodes_total', {}, count);
}

/**
 * Update enriched nodes gauge
 */
export function updateNodesEnriched(count: number): void {
  registry.setGauge('decant_nodes_enriched_total', {}, count);
}

/**
 * Track similarity computation
 */
export function trackSimilarityComputation(): void {
  registry.incrementCounter('decant_similarity_computations_total', {});
}

/**
 * Track search query
 */
export function trackSearchQuery(type: 'basic' | 'advanced' | 'similar'): void {
  registry.incrementCounter('decant_search_queries_total', { type });
}

/**
 * Normalize URL path to prevent high cardinality
 * Replaces UUIDs and numeric IDs with placeholders
 */
function normalizePath(path: string): string {
  return path
    // Replace UUIDs with :id
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    // Replace numeric IDs with :id
    .replace(/\/\d+/g, '/:id')
    // Truncate query strings
    .split('?')[0];
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  registry.reset();
}

/**
 * Export metrics in Prometheus text format
 */
export function exportPrometheusMetrics(): string {
  return registry.exportPrometheus();
}

/**
 * Export metrics as JSON (for debugging)
 */
export function exportMetricsJSON(): Record<string, unknown> {
  return registry.exportJSON();
}

// ============================================================
// Express Middleware
// ============================================================

/**
 * Metrics collection middleware
 * Tracks request count, duration, and status codes
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip metrics for the metrics endpoint itself
  if (req.path === '/metrics' || req.path === '/health') {
    return next();
  }

  const startTime = Date.now();

  // Capture the original end function
  const originalEnd = res.end;

  // Override res.end to capture metrics after response is sent
  res.end = function (this: Response, ...args: unknown[]): Response {
    // Calculate duration in seconds
    const durationMs = Date.now() - startTime;
    const durationSeconds = durationMs / 1000;

    // Track the request
    trackAPIRequest(
      req.method,
      req.path,
      res.statusCode,
      durationSeconds
    );

    // Track errors
    if (res.statusCode >= 400) {
      const category = res.statusCode >= 500 ? 'internal' : 'validation';
      const code = res.statusCode.toString();
      trackError(category, code);
    }

    // Call the original end function
    return originalEnd.apply(this, args as Parameters<typeof originalEnd>);
  } as typeof res.end;

  next();
}

/**
 * GET /metrics endpoint handler
 * Returns metrics in Prometheus text format
 */
export function metricsEndpoint(_req: Request, res: Response): void {
  try {
    const metrics = exportPrometheusMetrics();
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  } catch (error) {
    log.error('Failed to export metrics', {
      error: error instanceof Error ? error.message : String(error),
      module: 'metrics',
    });
    res.status(500).send('Failed to export metrics');
  }
}

// ============================================================
// Periodic Stats Collection
// ============================================================

let statsInterval: NodeJS.Timeout | null = null;

/**
 * Start periodic stats collection
 * Updates gauge metrics at regular intervals
 */
export function startStatsCollection(intervalMs: number = 60000): void {
  if (statsInterval) {
    log.warn('Stats collection already running', { module: 'metrics' });
    return;
  }

  // Import dependencies only when needed to avoid circular dependencies
  const updateStats = async () => {
    try {
      // Import database functions dynamically
      const { countNodes } = await import('../../database/nodes.js');
      const { getDatabase } = await import('../../database/connection.js');
      const { getProcessingQueue } = await import('../processing_queue.js');

      // Update nodes total
      const totalNodes = countNodes();
      updateNodesTotal(totalNodes);

      // Update enriched nodes count
      const db = getDatabase();
      const enrichedResult = db.prepare(`
        SELECT COUNT(*) as count FROM nodes
        WHERE is_deleted = 0
          AND json_extract(extracted_fields, '$.phase2Completed') = 1
      `).get() as { count: number };
      updateNodesEnriched(enrichedResult.count);

      // Update queue depth
      const queue = getProcessingQueue();
      const stats = queue.getStats();
      updateQueueDepth('pending', stats.pending);
      updateQueueDepth('processing', stats.processing);

    } catch (error) {
      log.error('Failed to update stats', {
        error: error instanceof Error ? error.message : String(error),
        module: 'metrics',
      });
    }
  };

  // Initial update
  updateStats();

  // Schedule periodic updates
  statsInterval = setInterval(updateStats, intervalMs);

  log.info('Stats collection started', {
    intervalMs,
    module: 'metrics',
  });
}

/**
 * Stop periodic stats collection
 */
export function stopStatsCollection(): void {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
    log.info('Stats collection stopped', { module: 'metrics' });
  }
}

// ============================================================
// Initialization
// ============================================================

// Auto-initialize metrics on module load
initializeMetrics();
