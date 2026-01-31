// ============================================================
// Health Check Routes Integration Tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../../__tests__/test-app.js';
import { resetTestDatabase } from '../../__tests__/setup.js';
import { createNode } from '../../database/nodes.js';

describe('Health Check Routes', () => {
  const app = createTestApp();

  beforeEach(() => {
    resetTestDatabase();
  });

  describe('GET /health', () => {
    it('should return basic health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'ok',
      });
      expect(response.body.timestamp).toBeDefined();
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('GET /health/live', () => {
    it('should return liveness status', async () => {
      const response = await request(app).get('/health/live');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'alive',
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /health/ready', () => {
    it('should return ready status when database is connected', async () => {
      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'ready',
      });
      expect(response.body.checks).toBeDefined();
      expect(response.body.checks.database).toMatchObject({
        status: 'healthy',
      });
      expect(response.body.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should include database latency in response', async () => {
      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body.checks.database.latencyMs).toBeDefined();
      expect(typeof response.body.checks.database.latencyMs).toBe('number');
    });
  });

  describe('GET /metrics', () => {
    it('should return comprehensive application metrics', async () => {
      const response = await request(app).get('/metrics');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('uptimeHuman');
      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('memoryUsage');
      expect(response.body).toHaveProperty('process');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should include database statistics', async () => {
      // Create some test data
      createNode({
        title: 'Test Node',
        url: 'https://example.com/test',
        source_domain: 'example.com',
      });

      const response = await request(app).get('/metrics');

      expect(response.status).toBe(200);
      expect(response.body.database).toBeDefined();
      expect(response.body.database).toHaveProperty('nodeCount');
      expect(response.body.database).toHaveProperty('deletedNodeCount');
      expect(response.body.database).toHaveProperty('totalTags');
      expect(response.body.database).toHaveProperty('tableSizes');
      expect(response.body.database).toHaveProperty('databaseSizeBytes');

      // Verify node count is accurate
      expect(response.body.database.nodeCount).toBeGreaterThanOrEqual(1);
    });

    it('should include memory usage metrics', async () => {
      const response = await request(app).get('/metrics');

      expect(response.status).toBe(200);
      expect(response.body.memoryUsage).toBeDefined();
      expect(response.body.memoryUsage).toHaveProperty('heapUsed');
      expect(response.body.memoryUsage).toHaveProperty('heapTotal');
      expect(response.body.memoryUsage).toHaveProperty('rss');
      expect(response.body.memoryUsage).toHaveProperty('external');

      // All values should be positive numbers
      expect(response.body.memoryUsage.heapUsed).toBeGreaterThan(0);
      expect(response.body.memoryUsage.heapTotal).toBeGreaterThan(0);
      expect(response.body.memoryUsage.rss).toBeGreaterThan(0);
    });

    it('should include process information', async () => {
      const response = await request(app).get('/metrics');

      expect(response.status).toBe(200);
      expect(response.body.process).toBeDefined();
      expect(response.body.process).toHaveProperty('pid');
      expect(response.body.process).toHaveProperty('nodeVersion');
      expect(response.body.process).toHaveProperty('platform');
      expect(response.body.process).toHaveProperty('arch');

      expect(response.body.process.pid).toBeGreaterThan(0);
      expect(response.body.process.nodeVersion).toMatch(/^v\d+\.\d+\.\d+/);
    });

    it('should include table size statistics', async () => {
      const response = await request(app).get('/metrics');

      expect(response.status).toBe(200);
      expect(response.body.database.tableSizes).toBeDefined();
      expect(response.body.database.tableSizes).toHaveProperty('nodes');
      expect(response.body.database.tableSizes).toHaveProperty('tags');
      expect(response.body.database.tableSizes).toHaveProperty('node_tags');

      // All values should be non-negative
      expect(response.body.database.tableSizes.nodes).toBeGreaterThanOrEqual(0);
      expect(response.body.database.tableSizes.tags).toBeGreaterThanOrEqual(0);
      expect(response.body.database.tableSizes.node_tags).toBeGreaterThanOrEqual(0);
    });

    it('should format uptime in human-readable format', async () => {
      const response = await request(app).get('/metrics');

      expect(response.status).toBe(200);
      expect(response.body.uptimeHuman).toBeDefined();
      expect(typeof response.body.uptimeHuman).toBe('string');
      expect(response.body.uptimeHuman).toMatch(/\d+[hms]/);
    });

    it('should track multiple nodes correctly', async () => {
      // Create multiple nodes
      for (let i = 0; i < 5; i++) {
        createNode({
          title: `Test Node ${i}`,
          url: `https://example.com/test${i}`,
          source_domain: 'example.com',
        });
      }

      const response = await request(app).get('/metrics');

      expect(response.status).toBe(200);
      expect(response.body.database.nodeCount).toBe(5);
      expect(response.body.database.tableSizes.nodes).toBe(5);
    });
  });

  describe('Health endpoints performance', () => {
    it('should respond quickly to health checks', async () => {
      const startTime = Date.now();
      const response = await request(app).get('/health');
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(100); // Should respond in less than 100ms
    });

    it('should respond quickly to readiness checks', async () => {
      const startTime = Date.now();
      const response = await request(app).get('/health/ready');
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(200); // Should respond in less than 200ms (includes DB check)
    });
  });
});
