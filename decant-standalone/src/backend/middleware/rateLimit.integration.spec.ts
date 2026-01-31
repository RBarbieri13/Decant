// ============================================================
// Rate Limiting Integration Tests
// ============================================================
// Tests rate limiting behavior with actual Express server

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { createCustomLimiter } from './rateLimit.js';
import type { Server } from 'http';

describe('Rate Limiting Integration', () => {
  let app: Express;
  let server: Server;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Test endpoint with custom rate limiter (5 requests per minute)
    const testLimiter = createCustomLimiter('test', {
      windowMs: 60000,
      max: 5,
      message: 'Test rate limit exceeded',
    });

    app.get('/test', testLimiter, (_req, res) => {
      res.json({ success: true });
    });

    // Test endpoint with very strict limit (2 requests per minute)
    const strictLimiter = createCustomLimiter('strict', {
      windowMs: 60000,
      max: 2,
      message: 'Strict rate limit exceeded',
    });

    app.get('/strict', strictLimiter, (_req, res) => {
      res.json({ success: true });
    });

    // Test endpoint with no rate limiting
    app.get('/unlimited', (_req, res) => {
      res.json({ success: true });
    });

    server = app.listen(0); // Random port
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('Rate limit headers', () => {
    it('should include rate limit headers in response', async () => {
      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.headers).toHaveProperty('ratelimit-limit');
      expect(response.headers).toHaveProperty('ratelimit-remaining');
      expect(response.headers).toHaveProperty('ratelimit-reset');
    });

    it('should show decreasing remaining count', async () => {
      const response1 = await request(app).get('/test');
      const remaining1 = parseInt(response1.headers['ratelimit-remaining'] || '0', 10);

      const response2 = await request(app).get('/test');
      const remaining2 = parseInt(response2.headers['ratelimit-remaining'] || '0', 10);

      expect(remaining2).toBeLessThan(remaining1);
    });
  });

  describe('Rate limit enforcement', () => {
    it('should allow requests within limit', async () => {
      const responses = [];

      // Make 2 requests (under the 5 request limit)
      for (let i = 0; i < 2; i++) {
        const response = await request(app).get('/test');
        responses.push(response);
      }

      // All should succeed
      expect(responses.every((r) => r.status === 200)).toBe(true);
    });

    it('should block requests exceeding limit', async () => {
      // Use strict endpoint (max 2 requests)
      const responses = [];

      for (let i = 0; i < 4; i++) {
        const response = await request(app).get('/strict');
        responses.push(response);
      }

      // First 2 should succeed
      expect(responses[0].status).toBe(200);
      expect(responses[1].status).toBe(200);

      // Remaining should be rate limited
      expect(responses[2].status).toBe(429);
      expect(responses[3].status).toBe(429);
    });

    it('should return appropriate error for rate limited requests', async () => {
      // Exceed strict limit
      await request(app).get('/strict');
      await request(app).get('/strict');

      const response = await request(app).get('/strict');

      expect(response.status).toBe(429);
      expect(response.body).toHaveProperty('error', 'Too many requests');
      expect(response.body).toHaveProperty('message', 'Strict rate limit exceeded');
      expect(response.body).toHaveProperty('retryAfter');
    });
  });

  describe('Different IPs', () => {
    it('should track rate limits per IP', async () => {
      // Request from IP 1
      const response1 = await request(app)
        .get('/test')
        .set('X-Forwarded-For', '192.168.1.1');

      // Request from IP 2
      const response2 = await request(app)
        .get('/test')
        .set('X-Forwarded-For', '192.168.1.2');

      // Both should have full rate limit remaining (different IPs)
      const remaining1 = parseInt(response1.headers['ratelimit-remaining'] || '0', 10);
      const remaining2 = parseInt(response2.headers['ratelimit-remaining'] || '0', 10);

      expect(remaining1).toBeGreaterThan(0);
      expect(remaining2).toBeGreaterThan(0);
    });
  });

  describe('No rate limit endpoint', () => {
    it('should allow unlimited requests', async () => {
      const responses = [];

      // Make many requests
      for (let i = 0; i < 10; i++) {
        const response = await request(app).get('/unlimited');
        responses.push(response);
      }

      // All should succeed
      expect(responses.every((r) => r.status === 200)).toBe(true);

      // Should not have rate limit headers
      expect(responses[0].headers).not.toHaveProperty('ratelimit-limit');
    });
  });

  describe('Retry-After header', () => {
    it('should include retry-after in rate limited response', async () => {
      // Exceed strict limit
      await request(app).get('/strict');
      await request(app).get('/strict');

      const response = await request(app).get('/strict');

      expect(response.status).toBe(429);
      expect(response.body.retryAfter).toBeGreaterThan(0);
      expect(response.body.retryAfter).toBeLessThanOrEqual(60);
    });
  });
});

describe('Global Rate Limiter Simulation', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Simulate global rate limiter on /api routes
    const globalLimiter = createCustomLimiter('global', {
      windowMs: 60000,
      max: 10,
      message: 'Too many API requests',
    });

    app.use('/api', globalLimiter);

    // API endpoints
    app.get('/api/nodes', (_req, res) => {
      res.json({ nodes: [] });
    });

    app.get('/api/search', (_req, res) => {
      res.json({ results: [] });
    });

    // Non-API endpoint (no rate limit)
    app.get('/health', (_req, res) => {
      res.json({ status: 'ok' });
    });
  });

  it('should apply global limiter to all /api routes', async () => {
    const responses = [];

    // Make requests to different API endpoints
    for (let i = 0; i < 12; i++) {
      const endpoint = i % 2 === 0 ? '/api/nodes' : '/api/search';
      const response = await request(app).get(endpoint);
      responses.push(response);
    }

    // First 10 should succeed
    expect(responses.slice(0, 10).every((r) => r.status === 200)).toBe(true);

    // 11th and 12th should be rate limited
    expect(responses[10].status).toBe(429);
    expect(responses[11].status).toBe(429);
  });

  it('should not rate limit health check endpoint', async () => {
    const responses = [];

    // Make many requests to health check
    for (let i = 0; i < 15; i++) {
      const response = await request(app).get('/health');
      responses.push(response);
    }

    // All should succeed (no rate limit)
    expect(responses.every((r) => r.status === 200)).toBe(true);
  });
});

describe('Specific Endpoint Rate Limiters', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Global limiter (100 req/min)
    const globalLimiter = createCustomLimiter('global', {
      windowMs: 60000,
      max: 100,
    });

    // Import limiter (10 req/min)
    const importLimiter = createCustomLimiter('import', {
      windowMs: 60000,
      max: 10,
      message: 'Too many import requests. AI classification is resource-intensive.',
    });

    // Settings limiter (5 req/min)
    const settingsLimiter = createCustomLimiter('settings', {
      windowMs: 60000,
      max: 5,
      message: 'Too many settings requests.',
    });

    app.use('/api', globalLimiter);

    app.post('/api/import', importLimiter, (_req, res) => {
      res.json({ success: true });
    });

    app.post('/api/settings/api-key', settingsLimiter, (_req, res) => {
      res.json({ success: true });
    });

    app.get('/api/nodes', (_req, res) => {
      res.json({ nodes: [] });
    });
  });

  it('should enforce stricter limit on import endpoint', async () => {
    const responses = [];

    for (let i = 0; i < 12; i++) {
      const response = await request(app).post('/api/import').send({});
      responses.push(response);
    }

    // First 10 should succeed (import limit)
    expect(responses.slice(0, 10).every((r) => r.status === 200)).toBe(true);

    // 11th and 12th should be rate limited
    expect(responses[10].status).toBe(429);
    expect(responses[10].body.message).toContain('resource-intensive');
  });

  it('should enforce strictest limit on settings endpoint', async () => {
    const responses = [];

    for (let i = 0; i < 7; i++) {
      const response = await request(app).post('/api/settings/api-key').send({});
      responses.push(response);
    }

    // First 5 should succeed (settings limit)
    expect(responses.slice(0, 5).every((r) => r.status === 200)).toBe(true);

    // 6th and 7th should be rate limited
    expect(responses[5].status).toBe(429);
    expect(responses[6].status).toBe(429);
  });

  it('should allow more requests to general endpoints', async () => {
    const responses = [];

    // Make 20 requests (more than import/settings limits, but under global)
    for (let i = 0; i < 20; i++) {
      const response = await request(app).get('/api/nodes');
      responses.push(response);
    }

    // All should succeed (under global 100 limit)
    expect(responses.every((r) => r.status === 200)).toBe(true);
  });
});
