// ============================================================
// Metrics System Tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetMetrics,
  exportPrometheusMetrics,
  exportMetricsJSON,
  trackImport,
  trackImportDuration,
  trackLLMRequest,
  trackAPIRequest,
  trackError,
  updateQueueDepth,
  updateNodesTotal,
  updateNodesEnriched,
  trackSimilarityComputation,
  trackSearchQuery,
} from '../index.js';

describe('Metrics System', () => {
  beforeEach(() => {
    resetMetrics();
  });

  describe('Counter Metrics', () => {
    it('should track import operations', () => {
      trackImport('success', 'url');
      trackImport('success', 'url');
      trackImport('failed', 'url');
      trackImport('success', 'file');

      const prometheus = exportPrometheusMetrics();
      expect(prometheus).toContain('decant_import_total{status="success",type="url"} 2');
      expect(prometheus).toContain('decant_import_total{status="failed",type="url"} 1');
      expect(prometheus).toContain('decant_import_total{status="success",type="file"} 1');
    });

    it('should track LLM requests', () => {
      trackLLMRequest('openai', 'success', 1.5);
      trackLLMRequest('openai', 'success', 2.0);
      trackLLMRequest('openai', 'failed', 0.5);

      const prometheus = exportPrometheusMetrics();
      expect(prometheus).toContain('decant_llm_requests_total{provider="openai",status="success"} 2');
      expect(prometheus).toContain('decant_llm_requests_total{provider="openai",status="failed"} 1');
    });

    it('should track LLM token usage', () => {
      trackLLMRequest('openai', 'success', 1.0, {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        estimatedCost: 0.001,
      });

      trackLLMRequest('openai', 'success', 1.0, {
        promptTokens: 200,
        completionTokens: 100,
        totalTokens: 300,
        estimatedCost: 0.002,
      });

      const prometheus = exportPrometheusMetrics();
      expect(prometheus).toContain('decant_llm_tokens_total{provider="openai",type="prompt"} 300');
      expect(prometheus).toContain('decant_llm_tokens_total{provider="openai",type="completion"} 150');
      expect(prometheus).toContain('decant_llm_cost_total{provider="openai"} 0.003');
    });

    it('should track API requests', () => {
      trackAPIRequest('GET', '/api/nodes', 200, 0.05);
      trackAPIRequest('GET', '/api/nodes', 200, 0.03);
      trackAPIRequest('POST', '/api/nodes', 201, 0.15);
      trackAPIRequest('GET', '/api/nodes', 500, 0.10);

      const prometheus = exportPrometheusMetrics();
      expect(prometheus).toContain('decant_api_requests_total{method="GET",path="/api/nodes",status_code="200"} 2');
      expect(prometheus).toContain('decant_api_requests_total{method="POST",path="/api/nodes",status_code="201"} 1');
      expect(prometheus).toContain('decant_api_requests_total{method="GET",path="/api/nodes",status_code="500"} 1');
    });

    it('should track errors by category', () => {
      trackError('validation', '400');
      trackError('validation', '400');
      trackError('database', 'QUERY_FAILED');
      trackError('llm', 'RATE_LIMIT');
      trackError('internal', '500');

      const prometheus = exportPrometheusMetrics();
      expect(prometheus).toContain('decant_errors_total{category="validation",code="400"} 2');
      expect(prometheus).toContain('decant_errors_total{category="database",code="QUERY_FAILED"} 1');
      expect(prometheus).toContain('decant_errors_total{category="llm",code="RATE_LIMIT"} 1');
      expect(prometheus).toContain('decant_errors_total{category="internal",code="500"} 1');
    });

    it('should track business metrics', () => {
      trackSimilarityComputation();
      trackSimilarityComputation();
      trackSimilarityComputation();

      trackSearchQuery('basic');
      trackSearchQuery('advanced');
      trackSearchQuery('similar');

      const prometheus = exportPrometheusMetrics();
      expect(prometheus).toContain('decant_similarity_computations_total');
      expect(prometheus).toContain('3');
      expect(prometheus).toContain('decant_search_queries_total{type="basic"} 1');
      expect(prometheus).toContain('decant_search_queries_total{type="advanced"} 1');
      expect(prometheus).toContain('decant_search_queries_total{type="similar"} 1');
    });
  });

  describe('Gauge Metrics', () => {
    it('should track queue depth', () => {
      updateQueueDepth('pending', 5);
      updateQueueDepth('processing', 2);

      const prometheus = exportPrometheusMetrics();
      expect(prometheus).toContain('decant_queue_depth{status="pending"} 5');
      expect(prometheus).toContain('decant_queue_depth{status="processing"} 2');
    });

    it('should update queue depth', () => {
      updateQueueDepth('pending', 5);
      updateQueueDepth('pending', 3); // Set to 3
      updateQueueDepth('pending', 7); // Set to 7

      const prometheus = exportPrometheusMetrics();
      expect(prometheus).toContain('decant_queue_depth{status="pending"} 7');
    });

    it('should track node counts', () => {
      updateNodesTotal(100);
      updateNodesEnriched(75);

      const prometheus = exportPrometheusMetrics();
      expect(prometheus).toContain('decant_nodes_total 100');
      expect(prometheus).toContain('decant_nodes_enriched_total 75');
    });
  });

  describe('Histogram Metrics', () => {
    it('should track import duration distribution', () => {
      trackImportDuration(0.5, 'success');
      trackImportDuration(1.5, 'success');
      trackImportDuration(3.0, 'success');
      trackImportDuration(10.5, 'success');

      const prometheus = exportPrometheusMetrics();

      // Check buckets
      expect(prometheus).toContain('decant_import_duration_seconds_bucket{status="success",le="0.1"} 0');
      expect(prometheus).toContain('decant_import_duration_seconds_bucket{status="success",le="1"} 1');
      expect(prometheus).toContain('decant_import_duration_seconds_bucket{status="success",le="2"} 2');
      expect(prometheus).toContain('decant_import_duration_seconds_bucket{status="success",le="5"} 3');
      expect(prometheus).toContain('decant_import_duration_seconds_bucket{status="success",le="+Inf"} 4');

      // Check sum and count
      expect(prometheus).toContain('decant_import_duration_seconds_sum{status="success"} 15.5');
      expect(prometheus).toContain('decant_import_duration_seconds_count{status="success"} 4');
    });

    it('should track LLM request duration', () => {
      trackLLMRequest('openai', 'success', 0.5);
      trackLLMRequest('openai', 'success', 1.5);
      trackLLMRequest('openai', 'success', 2.5);

      const prometheus = exportPrometheusMetrics();

      // Check that histogram is tracked
      expect(prometheus).toContain('decant_llm_request_duration_seconds_bucket');
      expect(prometheus).toContain('decant_llm_request_duration_seconds_sum{provider="openai",status="success"} 4.5');
      expect(prometheus).toContain('decant_llm_request_duration_seconds_count{provider="openai",status="success"} 3');
    });

    it('should track API request duration', () => {
      trackAPIRequest('GET', '/api/nodes', 200, 0.05);
      trackAPIRequest('GET', '/api/nodes', 200, 0.15);
      trackAPIRequest('GET', '/api/nodes', 200, 0.25);

      const prometheus = exportPrometheusMetrics();

      // Check sum and count
      expect(prometheus).toContain('decant_api_request_duration_seconds_sum{method="GET",path="/api/nodes"} 0.45');
      expect(prometheus).toContain('decant_api_request_duration_seconds_count{method="GET",path="/api/nodes"} 3');
    });
  });

  describe('Prometheus Format', () => {
    it('should export valid Prometheus text format', () => {
      trackImport('success', 'url');
      updateNodesTotal(100);
      trackImportDuration(1.5, 'success');

      const prometheus = exportPrometheusMetrics();

      // Check HELP and TYPE declarations
      expect(prometheus).toContain('# HELP decant_import_total');
      expect(prometheus).toContain('# TYPE decant_import_total counter');
      expect(prometheus).toContain('# HELP decant_nodes_total');
      expect(prometheus).toContain('# TYPE decant_nodes_total gauge');
      expect(prometheus).toContain('# HELP decant_import_duration_seconds');
      expect(prometheus).toContain('# TYPE decant_import_duration_seconds histogram');
    });

    it('should handle metrics without labels', () => {
      trackSimilarityComputation();
      updateNodesTotal(50);

      const prometheus = exportPrometheusMetrics();

      expect(prometheus).toContain('decant_similarity_computations_total 1');
      expect(prometheus).toContain('decant_nodes_total 50');
    });

    it('should escape label values correctly', () => {
      trackAPIRequest('GET', '/api/nodes/:id', 200, 0.1);

      const prometheus = exportPrometheusMetrics();
      expect(prometheus).toContain('path="/api/nodes/:id"');
    });
  });

  describe('JSON Export', () => {
    it('should export metrics as JSON', () => {
      trackImport('success', 'url');
      updateNodesTotal(100);

      const json = exportMetricsJSON();

      expect(json).toHaveProperty('decant_import_total');
      expect(json).toHaveProperty('decant_nodes_total');

      const importMetric = json['decant_import_total'] as {
        type: string;
        help: string;
        values: Record<string, number>;
      };
      expect(importMetric.type).toBe('counter');
      expect(importMetric.values).toHaveProperty('status="success",type="url"');
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all metrics', () => {
      trackImport('success', 'url');
      updateNodesTotal(100);
      trackImportDuration(1.5, 'success');

      resetMetrics();

      const prometheus = exportPrometheusMetrics();

      // Metrics should still be registered but have no values
      expect(prometheus).toContain('# HELP decant_import_total');
      expect(prometheus).not.toContain('decant_import_total{');
    });
  });

  describe('Path Normalization', () => {
    it('should normalize UUID paths', () => {
      trackAPIRequest('GET', '/api/nodes/abc-123-def-456', 200, 0.1);
      trackAPIRequest('GET', '/api/nodes/xyz-789-ghi-012', 200, 0.1);

      const prometheus = exportPrometheusMetrics();

      // Both should be normalized to :id
      expect(prometheus).toContain('path="/api/nodes/:id"');
      expect(prometheus).toContain('status_code="200"} 2');
    });

    it('should normalize numeric ID paths', () => {
      trackAPIRequest('GET', '/api/items/123', 200, 0.1);
      trackAPIRequest('GET', '/api/items/456', 200, 0.1);

      const prometheus = exportPrometheusMetrics();
      expect(prometheus).toContain('path="/api/items/:id"');
      expect(prometheus).toContain('status_code="200"} 2');
    });

    it('should remove query strings', () => {
      trackAPIRequest('GET', '/api/search?q=test&limit=10', 200, 0.1);
      trackAPIRequest('GET', '/api/search?q=other', 200, 0.1);

      const prometheus = exportPrometheusMetrics();
      expect(prometheus).toContain('path="/api/search"');
      expect(prometheus).toContain('status_code="200"} 2');
    });
  });

  describe('Multiple Labels', () => {
    it('should handle multiple label combinations', () => {
      trackAPIRequest('GET', '/api/nodes', 200, 0.1);
      trackAPIRequest('GET', '/api/nodes', 404, 0.1);
      trackAPIRequest('POST', '/api/nodes', 201, 0.2);
      trackAPIRequest('POST', '/api/nodes', 400, 0.1);

      const prometheus = exportPrometheusMetrics();

      expect(prometheus).toContain('method="GET",path="/api/nodes",status_code="200"');
      expect(prometheus).toContain('method="GET",path="/api/nodes",status_code="404"');
      expect(prometheus).toContain('method="POST",path="/api/nodes",status_code="201"');
      expect(prometheus).toContain('method="POST",path="/api/nodes",status_code="400"');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero values', () => {
      updateQueueDepth('pending', 0);

      const prometheus = exportPrometheusMetrics();
      expect(prometheus).toContain('decant_queue_depth{status="pending"} 0');
    });

    it('should handle negative gauge values', () => {
      updateQueueDepth('pending', 5);
      updateQueueDepth('pending', -2);

      const prometheus = exportPrometheusMetrics();
      expect(prometheus).toContain('decant_queue_depth{status="pending"} -2');
    });

    it('should handle very large numbers', () => {
      trackLLMRequest('openai', 'success', 1.0, {
        promptTokens: 1000000,
        completionTokens: 500000,
        totalTokens: 1500000,
        estimatedCost: 15.0,
      });

      const prometheus = exportPrometheusMetrics();
      expect(prometheus).toContain('decant_llm_tokens_total{provider="openai",type="prompt"} 1000000');
      expect(prometheus).toContain('decant_llm_cost_total{provider="openai"} 15');
    });

    it('should handle histogram infinity bucket', () => {
      trackImportDuration(1000, 'success'); // Very large value

      const prometheus = exportPrometheusMetrics();
      expect(prometheus).toContain('le="+Inf"} 1');
    });
  });
});
