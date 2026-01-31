// ============================================================
// Security Middleware Tests
// Tests for CORS, security headers, and request limits
// ============================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import type { Server } from 'http';
import {
  createCorsMiddleware,
  securityHeaders,
  contentSecurityPolicy,
  applySecurityMiddleware,
  REQUEST_BODY_LIMIT,
} from '../security.js';

// ============================================================
// Security Headers Tests
// ============================================================

describe('Security Headers Middleware', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(securityHeaders());
    app.get('/test', (_req, res) => {
      res.json({ success: true });
    });
  });

  describe('X-Content-Type-Options', () => {
    it('should set X-Content-Type-Options to nosniff', async () => {
      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('X-Frame-Options', () => {
    it('should set X-Frame-Options to DENY', async () => {
      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.headers['x-frame-options']).toBe('DENY');
    });
  });

  describe('X-XSS-Protection', () => {
    it('should set X-XSS-Protection with mode=block', async () => {
      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });

  describe('Referrer-Policy', () => {
    it('should set Referrer-Policy to strict-origin-when-cross-origin', async () => {
      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });
  });

  describe('X-Powered-By', () => {
    it('should remove X-Powered-By header', async () => {
      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('All headers together', () => {
    it('should include all security headers in response', async () => {
      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });
});

// ============================================================
// CORS Middleware Tests
// ============================================================

describe('CORS Middleware', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(createCorsMiddleware());
    app.get('/test', (_req, res) => {
      res.json({ success: true });
    });
    app.post('/test', (_req, res) => {
      res.json({ success: true });
    });
    app.options('/test', (_req, res) => {
      res.status(204).end();
    });
  });

  describe('Allowed Origins', () => {
    it('should allow requests from localhost:3000', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('should allow requests from localhost:5173', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:5173');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });

    it('should allow requests with no origin (mobile apps, curl)', async () => {
      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
    });
  });

  describe('CORS Headers', () => {
    it('should include credentials header', async () => {
      const response = await request(app)
        .get('/test')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should expose rate limit headers', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      // Exposed headers should be listed
      const exposedHeaders = response.headers['access-control-expose-headers'];
      expect(exposedHeaders).toContain('RateLimit-Limit');
      expect(exposedHeaders).toContain('RateLimit-Remaining');
      expect(exposedHeaders).toContain('RateLimit-Reset');
    });
  });

  describe('Preflight Requests', () => {
    it('should handle OPTIONS preflight requests', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      expect(response.status).toBe(204);
    });

    it('should allow common HTTP methods', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      const allowedMethods = response.headers['access-control-allow-methods'];
      expect(allowedMethods).toContain('GET');
      expect(allowedMethods).toContain('POST');
      expect(allowedMethods).toContain('PUT');
      expect(allowedMethods).toContain('DELETE');
    });

    it('should allow required headers', async () => {
      const response = await request(app)
        .options('/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');

      const allowedHeaders = response.headers['access-control-allow-headers'];
      expect(allowedHeaders).toContain('Content-Type');
    });
  });
});

// ============================================================
// Request Size Limits Tests
// ============================================================

describe('Request Size Limits', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
    app.post('/test', (_req, res) => {
      res.json({ success: true, receivedSize: JSON.stringify(_req.body).length });
    });

    // Error handler for payload too large
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (err.type === 'entity.too.large') {
        res.status(413).json({ error: 'Payload too large' });
      } else {
        res.status(500).json({ error: 'Server error' });
      }
    });
  });

  describe('REQUEST_BODY_LIMIT constant', () => {
    it('should be set to 1mb', () => {
      expect(REQUEST_BODY_LIMIT).toBe('1mb');
    });
  });

  describe('Small payloads', () => {
    it('should accept small JSON payloads', async () => {
      const response = await request(app)
        .post('/test')
        .send({ message: 'Hello, World!' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should accept moderately sized JSON payloads', async () => {
      // Create a ~50KB payload
      const payload = { data: 'x'.repeat(50000) };

      const response = await request(app)
        .post('/test')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Large payloads', () => {
    it('should reject payloads exceeding the limit', async () => {
      // Create a payload larger than 1MB
      const largePayload = { data: 'x'.repeat(1500000) }; // ~1.5MB

      const response = await request(app)
        .post('/test')
        .send(largePayload);

      expect(response.status).toBe(413);
    });
  });
});

// ============================================================
// Content Security Policy Tests
// ============================================================

describe('Content Security Policy Middleware', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(contentSecurityPolicy());

    // HTML endpoint
    app.get('/html', (_req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.send('<html><body>Test</body></html>');
    });

    // JSON endpoint
    app.get('/json', (_req, res) => {
      res.json({ test: true });
    });
  });

  it('should apply CSP header to HTML responses', async () => {
    const response = await request(app).get('/html');

    expect(response.status).toBe(200);
    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
  });

  it('should not apply CSP header to JSON responses', async () => {
    const response = await request(app).get('/json');

    expect(response.status).toBe(200);
    // CSP should not be set for JSON
    expect(response.headers['content-security-policy']).toBeUndefined();
  });

  it('should include script-src directive', async () => {
    const response = await request(app).get('/html');

    expect(response.status).toBe(200);
    expect(response.headers['content-security-policy']).toContain("script-src 'self'");
  });

  it('should include style-src directive', async () => {
    const response = await request(app).get('/html');

    expect(response.status).toBe(200);
    expect(response.headers['content-security-policy']).toContain("style-src 'self'");
  });
});

// ============================================================
// Combined Security Middleware Tests
// ============================================================

describe('Combined Security Middleware (applySecurityMiddleware)', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    applySecurityMiddleware(app);
    app.get('/test', (_req, res) => {
      res.json({ success: true });
    });
  });

  it('should apply all security measures at once', async () => {
    const response = await request(app)
      .get('/test')
      .set('Origin', 'http://localhost:3000');

    expect(response.status).toBe(200);

    // Check security headers
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-xss-protection']).toBe('1; mode=block');

    // Check CORS
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});

// ============================================================
// Rate Limiting Integration with Security
// ============================================================

describe('Rate Limiting Integration', () => {
  // Note: Detailed rate limiting tests are in rateLimit.integration.spec.ts
  // These tests verify basic integration with security headers

  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(securityHeaders());
    app.use(express.json());

    // Simple endpoint to test security + response behavior
    app.get('/api/test', (_req, res) => {
      res.json({ success: true });
    });
  });

  it('should maintain security headers alongside other middleware', async () => {
    const response = await request(app).get('/api/test');

    expect(response.status).toBe(200);
    // Security headers should still be present
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
  });
});

// ============================================================
// Environment-Specific Behavior Tests
// ============================================================

describe('Environment-Specific Security', () => {
  // Note: HSTS is only applied in production

  it('should not set HSTS in development', async () => {
    const app = express();
    app.use(securityHeaders());
    app.get('/test', (_req, res) => res.json({ ok: true }));

    const response = await request(app).get('/test');

    // In development (default), HSTS should not be set
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  // Production HSTS test would require modifying NODE_ENV
  // which is tested differently in environment-aware tests
});

// ============================================================
// Edge Cases
// ============================================================

describe('Security Edge Cases', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(securityHeaders());
    app.use(express.json());

    app.get('/error', (_req, res) => {
      res.status(500).json({ error: 'Internal error' });
    });

    app.get('/redirect', (_req, res) => {
      res.redirect(302, '/test');
    });

    app.get('/test', (_req, res) => {
      res.json({ success: true });
    });
  });

  it('should include security headers on error responses', async () => {
    const response = await request(app).get('/error');

    expect(response.status).toBe(500);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
  });

  it('should include security headers on redirect responses', async () => {
    const response = await request(app)
      .get('/redirect')
      .redirects(0); // Don't follow redirect

    expect(response.status).toBe(302);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
  });

  it('should handle multiple sequential requests correctly', async () => {
    for (let i = 0; i < 5; i++) {
      const response = await request(app).get('/test');

      expect(response.status).toBe(200);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    }
  });
});
