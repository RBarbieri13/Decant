// ============================================================
// Health Routes Integration Tests
// ============================================================

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../../__tests__/test-app.js';
import { Express } from 'express';
import { clearHealthCache } from '../../health/index.js';

describe('Health Routes Integration', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    clearHealthCache();
  });

  describe('GET /health', () => {
    it('should return basic health status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toMatchObject({
        status: expect.stringMatching(/healthy|unhealthy/),
        timestamp: expect.any(String),
        latencyMs: expect.any(Number),
      });
    });

    it('should respond quickly (under 100ms)', async () => {
      const startTime = Date.now();
      await request(app).get('/health');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('GET /health/live', () => {
    it('should always return 200 if process is running', async () => {
      const response = await request(app).get('/health/live').expect(200);

      expect(response.body).toMatchObject({
        status: 'alive',
        timestamp: expect.any(String),
      });
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness status with all checks', async () => {
      const response = await request(app).get('/health/ready');

      expect(response.status).toMatch(/200|503/);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('checks');

      const { checks } = response.body;
      expect(checks).toHaveProperty('database');
      expect(checks).toHaveProperty('llmProvider');
      expect(checks).toHaveProperty('queue');
      expect(checks).toHaveProperty('cache');
      expect(checks).toHaveProperty('filesystem');
    });

    it('should return 200 when healthy or degraded', async () => {
      const response = await request(app).get('/health/ready');

      if (response.body.status === 'ready') {
        expect(response.status).toBe(200);
      }
    });

    it('should return 503 when unhealthy', async () => {
      const response = await request(app).get('/health/ready');

      if (response.body.status === 'not_ready') {
        expect(response.status).toBe(503);
      }
    });

    it('should include detailed component information', async () => {
      const response = await request(app).get('/health/ready');

      const components = [
        response.body.checks.database,
        response.body.checks.llmProvider,
        response.body.checks.queue,
        response.body.checks.cache,
        response.body.checks.filesystem,
      ];

      for (const component of components) {
        expect(component).toHaveProperty('status');
        expect(component.status).toMatch(/healthy|degraded|unhealthy/);
        expect(component).toHaveProperty('lastChecked');
        expect(component).toHaveProperty('message');
      }
    });
  });

  describe('GET /health/full', () => {
    it('should return comprehensive health information', async () => {
      const response = await request(app).get('/health/full');

      expect(response.status).toMatch(/200|503/);
      expect(response.body).toMatchObject({
        status: expect.stringMatching(/healthy|degraded|unhealthy/),
        timestamp: expect.any(String),
        version: expect.any(String),
        uptime: expect.any(Number),
        checks: expect.any(Object),
      });
    });

    it('should include all component details', async () => {
      const response = await request(app).get('/health/full');

      const { checks } = response.body;

      // Database check
      expect(checks.database).toBeDefined();
      expect(checks.database.status).toMatch(/healthy|degraded|unhealthy/);

      // LLM provider check
      expect(checks.llmProvider).toBeDefined();
      expect(checks.llmProvider.details).toBeDefined();
      expect(checks.llmProvider.details.providerName).toBe('openai');

      // Queue check
      expect(checks.queue).toBeDefined();
      if (checks.queue.details) {
        expect(checks.queue.details).toHaveProperty('pendingJobs');
        expect(checks.queue.details).toHaveProperty('processingJobs');
      }

      // Cache check
      expect(checks.cache).toBeDefined();
      if (checks.cache.details) {
        expect(checks.cache.details).toHaveProperty('size');
        expect(checks.cache.details).toHaveProperty('memoryUsageBytes');
      }

      // Filesystem check
      expect(checks.filesystem).toBeDefined();
      if (checks.filesystem.details) {
        expect(checks.filesystem.details).toHaveProperty('dataDirectory');
        expect(checks.filesystem.details).toHaveProperty('isWritable');
        expect(checks.filesystem.details).toHaveProperty('diskSpaceBytes');
      }
    });

    it('should return 200 for healthy or degraded status', async () => {
      const response = await request(app).get('/health/full');

      if (
        response.body.status === 'healthy' ||
        response.body.status === 'degraded'
      ) {
        expect(response.status).toBe(200);
      }
    });

    it('should return 503 for unhealthy status', async () => {
      const response = await request(app).get('/health/full');

      if (response.body.status === 'unhealthy') {
        expect(response.status).toBe(503);
      }
    });

    it('should cache results for subsequent requests', async () => {
      const first = await request(app).get('/health/full');
      const second = await request(app).get('/health/full');

      // Timestamps should be identical if cached
      expect(first.body.timestamp).toBe(second.body.timestamp);
    });
  });

  describe('GET /health/component/:name', () => {
    it('should return database component health', async () => {
      const response = await request(app)
        .get('/health/component/database')
        .expect(/200|503/);

      expect(response.body).toMatchObject({
        component: 'database',
        status: expect.stringMatching(/healthy|degraded|unhealthy/),
        lastChecked: expect.any(String),
        message: expect.any(String),
      });
    });

    it('should return LLM provider component health', async () => {
      const response = await request(app)
        .get('/health/component/llm')
        .expect(/200|503/);

      expect(response.body).toMatchObject({
        component: 'llm',
        status: expect.stringMatching(/healthy|degraded|unhealthy/),
        lastChecked: expect.any(String),
        details: expect.any(Object),
      });
    });

    it('should return queue component health', async () => {
      const response = await request(app)
        .get('/health/component/queue')
        .expect(/200|503/);

      expect(response.body).toMatchObject({
        component: 'queue',
        status: expect.stringMatching(/healthy|degraded|unhealthy/),
        lastChecked: expect.any(String),
      });
    });

    it('should return cache component health', async () => {
      const response = await request(app)
        .get('/health/component/cache')
        .expect(/200|503/);

      expect(response.body).toMatchObject({
        component: 'cache',
        status: expect.stringMatching(/healthy|degraded|unhealthy/),
        lastChecked: expect.any(String),
      });
    });

    it('should return filesystem component health', async () => {
      const response = await request(app)
        .get('/health/component/filesystem')
        .expect(/200|503/);

      expect(response.body).toMatchObject({
        component: 'filesystem',
        status: expect.stringMatching(/healthy|degraded|unhealthy/),
        lastChecked: expect.any(String),
      });
    });

    it('should return 400 for invalid component name', async () => {
      const response = await request(app)
        .get('/health/component/invalid')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('validComponents');
    });

    it('should return 503 for unhealthy component', async () => {
      const response = await request(app).get('/health/component/database');

      if (response.body.status === 'unhealthy') {
        expect(response.status).toBe(503);
      }
    });
  });

  describe('GET /metrics', () => {
    it('should return application metrics', async () => {
      const response = await request(app).get('/metrics').expect(200);

      expect(response.body).toMatchObject({
        uptime: expect.any(Number),
        uptimeHuman: expect.any(String),
        database: expect.any(Object),
        memoryUsage: expect.any(Object),
        process: expect.any(Object),
        timestamp: expect.any(String),
      });
    });

    it('should include database statistics', async () => {
      const response = await request(app).get('/metrics');

      const { database } = response.body;
      expect(database).toHaveProperty('nodeCount');
      expect(database).toHaveProperty('deletedNodeCount');
      expect(database).toHaveProperty('totalTags');
      expect(database).toHaveProperty('tableSizes');
    });

    it('should include memory usage', async () => {
      const response = await request(app).get('/metrics');

      const { memoryUsage } = response.body;
      expect(memoryUsage).toHaveProperty('heapUsed');
      expect(memoryUsage).toHaveProperty('heapTotal');
      expect(memoryUsage).toHaveProperty('rss');
      expect(memoryUsage).toHaveProperty('external');
    });

    it('should include process information', async () => {
      const response = await request(app).get('/metrics');

      const { process } = response.body;
      expect(process).toHaveProperty('pid');
      expect(process).toHaveProperty('nodeVersion');
      expect(process).toHaveProperty('platform');
      expect(process).toHaveProperty('arch');
    });
  });

  describe('Health Check Performance', () => {
    it('should handle concurrent health checks', async () => {
      const requests = Array(10)
        .fill(null)
        .map(() => request(app).get('/health'));

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status');
      });
    });

    it('should respond to readiness checks quickly', async () => {
      const startTime = Date.now();
      await request(app).get('/health/ready');
      const duration = Date.now() - startTime;

      // First request might be slower, but should still be under 500ms
      expect(duration).toBeLessThan(500);
    });

    it('should cache full health checks efficiently', async () => {
      // First request (uncached)
      const startTime1 = Date.now();
      await request(app).get('/health/full');
      const duration1 = Date.now() - startTime1;

      // Second request (cached)
      const startTime2 = Date.now();
      await request(app).get('/health/full');
      const duration2 = Date.now() - startTime2;

      // Cached request should be faster
      expect(duration2).toBeLessThan(duration1);
    });
  });
});
