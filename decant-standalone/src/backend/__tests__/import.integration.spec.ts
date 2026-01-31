// ============================================================
// Import Pipeline Integration Tests
// Full flow: URL input -> extraction -> Phase 1 -> node creation -> Phase 2
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import express from 'express';
import { getTestDatabase, resetTestDatabase } from './setup.js';

// ============================================================
// Mock Setup - Must be before imports
// ============================================================

// Mock keystore
vi.mock('../services/keystore.js', () => ({
  setApiKey: vi.fn().mockResolvedValue(undefined),
  getApiKey: vi.fn().mockResolvedValue('sk-test-key-12345678901234567890'),
  deleteApiKey: vi.fn().mockResolvedValue(undefined),
  isConfigured: vi.fn().mockResolvedValue(true),
  listConfiguredKeys: vi.fn().mockResolvedValue(['openai']),
  clearAllKeys: vi.fn().mockResolvedValue(undefined),
}));

// Store mock import function at module level
let mockImportFn: any = vi.fn();

// Mock the import orchestrator
vi.mock('../services/import/orchestrator.js', () => ({
  getImportOrchestrator: () => ({
    import: (...args: any[]) => mockImportFn(...args),
    invalidateCache: vi.fn().mockReturnValue(true),
  }),
}));

// Mock the processing queue
vi.mock('../services/processing_queue.js', () => {
  return {
    getProcessingQueue: () => ({
      enqueue: vi.fn().mockReturnValue(uuidv4()),
      getStats: () => ({ pending: 0, processing: 0, complete: 0, failed: 0 }),
      isActive: () => false,
      getJob: () => null,
      getJobsForNode: () => [],
    }),
    enqueueForEnrichment: vi.fn(),
  };
});

// Mock rate limiters to avoid 429 errors in tests
vi.mock('../middleware/rateLimit.js', () => ({
  globalLimiter: (_req: any, _res: any, next: any) => next(),
  importLimiter: (_req: any, _res: any, next: any) => next(),
  settingsLimiter: (_req: any, _res: any, next: any) => next(),
  createCustomLimiter: () => (_req: any, _res: any, next: any) => next(),
  skipRateLimit: (_req: any, _res: any, next: any) => next(),
}));

import * as keystore from '../services/keystore.js';
import { registerAPIRoutes } from '../routes/index.js';

// Create test app without rate limiting
function createTestAppWithoutRateLimit(): express.Application {
  const app = express();
  app.use(express.json());
  registerAPIRoutes(app);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Test app error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  });
  return app;
}

describe('Import Pipeline Integration', () => {
  const app = createTestAppWithoutRateLimit();

  beforeEach(() => {
    resetTestDatabase();
    vi.clearAllMocks();

    // Reset mock import function
    mockImportFn = vi.fn();

    // Setup processing_queue table
    const db = getTestDatabase();
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS processing_queue (
          id TEXT PRIMARY KEY,
          node_id TEXT NOT NULL,
          phase TEXT NOT NULL DEFAULT 'phase2',
          status TEXT NOT NULL DEFAULT 'pending',
          priority INTEGER DEFAULT 0,
          attempts INTEGER DEFAULT 0,
          max_attempts INTEGER DEFAULT 3,
          error_message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          processed_at DATETIME,
          FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
        )
      `);
    } catch {
      // Table may already exist
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // Full Import Pipeline Tests
  // ============================================================

  describe('Full Import Pipeline', () => {
    it('should complete full import flow: URL -> extraction -> classification -> node', async () => {
      const nodeId = uuidv4();

      // Setup mock
      mockImportFn.mockResolvedValue({
        success: true,
        nodeId,
        cached: false,
        classification: {
          segment: 'Technology',
          category: 'AI & ML',
          contentType: 'Article',
          organization: 'Reference',
          confidence: 0.9,
        },
        hierarchyCodes: {
          function: 'T.AI.A',
          organization: 'REF.1',
        },
        metadata: {
          title: 'Test Article',
          domain: 'example.com',
        },
        phase2Queued: true,
        phase2JobId: uuidv4(),
      });

      // Create the node in database
      const db = getTestDatabase();
      db.prepare(`
        INSERT INTO nodes (id, title, url, source_domain)
        VALUES (?, 'Test Article', 'https://example.com/article', 'example.com')
      `).run(nodeId);

      const response = await request(app)
        .post('/api/import')
        .send({ url: 'https://example.com/article' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.nodeId).toBe(nodeId);
      expect(response.body.classification).toBeDefined();
      expect(response.body.phase2.queued).toBe(true);
    });

    it('should handle cached import (duplicate URL)', async () => {
      const nodeId = uuidv4();

      mockImportFn.mockResolvedValue({
        success: true,
        nodeId,
        cached: true,
        classification: {
          segment: 'Technology',
          category: 'AI & ML',
          contentType: 'Article',
          organization: 'Reference',
          confidence: 0.9,
        },
        hierarchyCodes: {},
        metadata: { title: 'Cached Article', domain: 'example.com' },
        phase2Queued: false,
      });

      const db = getTestDatabase();
      db.prepare(`
        INSERT INTO nodes (id, title, url, source_domain)
        VALUES (?, 'Cached Article', 'https://example.com/cached', 'example.com')
      `).run(nodeId);

      const response = await request(app)
        .post('/api/import')
        .send({ url: 'https://example.com/cached' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.cached).toBe(true);
    });

    it('should pass forceRefresh parameter to orchestrator', async () => {
      const nodeId = uuidv4();

      mockImportFn.mockResolvedValue({
        success: true,
        nodeId,
        cached: false,
        classification: {
          segment: 'Technology',
          category: 'Development',
          contentType: 'Documentation',
          organization: 'Work',
          confidence: 0.85,
        },
        hierarchyCodes: {},
        metadata: { title: 'Refreshed Article' },
        phase2Queued: true,
        phase2JobId: uuidv4(),
      });

      const db = getTestDatabase();
      db.prepare(`
        INSERT INTO nodes (id, title, url, source_domain)
        VALUES (?, 'Refreshed Article', 'https://example.com/refresh', 'example.com')
      `).run(nodeId);

      const response = await request(app)
        .post('/api/import')
        .send({ url: 'https://example.com/refresh', forceRefresh: true });

      expect(response.status).toBe(200);
      // Verify the orchestrator was called
      expect(mockImportFn).toHaveBeenCalled();
    });
  });

  // ============================================================
  // Different URL Types
  // ============================================================

  describe('Different URL Types', () => {
    it('should handle article URLs', async () => {
      const nodeId = uuidv4();
      mockImportFn.mockResolvedValue({
        success: true,
        nodeId,
        cached: false,
        classification: { segment: 'News', category: 'Tech News', contentType: 'Article' },
        hierarchyCodes: {},
        metadata: { title: 'News Article' },
        phase2Queued: true,
      });

      const db = getTestDatabase();
      db.prepare(`
        INSERT INTO nodes (id, title, url, source_domain)
        VALUES (?, 'News Article', 'https://techcrunch.com/article', 'techcrunch.com')
      `).run(nodeId);

      const response = await request(app)
        .post('/api/import')
        .send({ url: 'https://techcrunch.com/2024/01/article' });

      expect(response.status).toBe(200);
    });

    it('should handle documentation URLs', async () => {
      const nodeId = uuidv4();
      mockImportFn.mockResolvedValue({
        success: true,
        nodeId,
        cached: false,
        classification: { segment: 'Development', category: 'Documentation', contentType: 'Documentation' },
        hierarchyCodes: {},
        metadata: { title: 'API Docs' },
        phase2Queued: true,
      });

      const db = getTestDatabase();
      db.prepare(`
        INSERT INTO nodes (id, title, url, source_domain)
        VALUES (?, 'API Docs', 'https://docs.example.com/api', 'docs.example.com')
      `).run(nodeId);

      const response = await request(app)
        .post('/api/import')
        .send({ url: 'https://docs.example.com/api/reference' });

      expect(response.status).toBe(200);
    });

    it('should handle GitHub repository URLs', async () => {
      const nodeId = uuidv4();
      mockImportFn.mockResolvedValue({
        success: true,
        nodeId,
        cached: false,
        classification: { segment: 'Development', category: 'Open Source', contentType: 'Repository' },
        hierarchyCodes: {},
        metadata: { title: 'GitHub Repo' },
        phase2Queued: true,
      });

      const db = getTestDatabase();
      db.prepare(`
        INSERT INTO nodes (id, title, url, source_domain)
        VALUES (?, 'GitHub Repo', 'https://github.com/owner/repo', 'github.com')
      `).run(nodeId);

      const response = await request(app)
        .post('/api/import')
        .send({ url: 'https://github.com/owner/repo' });

      expect(response.status).toBe(200);
    });
  });

  // ============================================================
  // Error Handling
  // ============================================================

  describe('Error Handling', () => {
    it('should return error when URL is missing', async () => {
      const response = await request(app)
        .post('/api/import')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return error for invalid URL format', async () => {
      mockImportFn.mockResolvedValue({
        success: false,
        error: 'Invalid URL format',
        code: 'URL_INVALID',
      });

      const response = await request(app)
        .post('/api/import')
        .send({ url: 'not-a-valid-url' });

      expect(response.status).toBe(400);
    });

    it('should return error for non-HTTP protocols', async () => {
      mockImportFn.mockResolvedValue({
        success: false,
        error: 'URL must use http or https protocol',
        code: 'URL_INVALID_PROTOCOL',
      });

      const response = await request(app)
        .post('/api/import')
        .send({ url: 'ftp://example.com/file' });

      expect(response.status).toBe(400);
    });

    it('should handle fetch failures gracefully', async () => {
      mockImportFn.mockResolvedValue({
        success: false,
        error: 'Failed to fetch URL: Connection refused',
        code: 'FETCH_FAILED',
      });

      const response = await request(app)
        .post('/api/import')
        .send({ url: 'https://nonexistent.example.com/page' });

      expect(response.status).toBe(502);
      expect(response.body.success).toBe(false);
    });

    it('should handle API key not configured', async () => {
      mockImportFn.mockResolvedValue({
        success: false,
        error: 'API key not configured',
        code: 'API_KEY_MISSING',
      });

      const response = await request(app)
        .post('/api/import')
        .send({ url: 'https://example.com/no-key' });

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
    });

    it('should handle timeout errors', async () => {
      mockImportFn.mockResolvedValue({
        success: false,
        error: 'Request timed out',
        code: 'TIMEOUT',
      });

      const response = await request(app)
        .post('/api/import')
        .send({ url: 'https://slow-server.example.com/page' });

      expect(response.status).toBe(408);
    });
  });

  // ============================================================
  // API Key Management
  // ============================================================

  describe('API Key Management', () => {
    it('should set API key successfully', async () => {
      const response = await request(app)
        .post('/api/settings/api-key')
        .send({ apiKey: 'sk-test-valid-key-12345678901234' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(keystore.setApiKey).toHaveBeenCalledWith('openai', 'sk-test-valid-key-12345678901234');
    });

    it('should reject invalid API key format', async () => {
      const response = await request(app)
        .post('/api/settings/api-key')
        .send({ apiKey: 'invalid-key' });

      expect(response.status).toBe(400);
    });

    it('should check API key status', async () => {
      const response = await request(app).get('/api/settings/api-key/status');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('configured');
    });

    it('should delete API key', async () => {
      const response = await request(app).delete('/api/settings/api-key');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(keystore.deleteApiKey).toHaveBeenCalledWith('openai');
    });
  });

  // ============================================================
  // Phase 2 Queue Integration
  // ============================================================

  describe('Phase 2 Queue Integration', () => {
    it('should include phase2 info in response when queued', async () => {
      const nodeId = uuidv4();
      const phase2JobId = uuidv4();

      mockImportFn.mockResolvedValue({
        success: true,
        nodeId,
        cached: false,
        classification: { segment: 'Technology', category: 'AI', contentType: 'Article' },
        hierarchyCodes: {},
        metadata: { title: 'Queued Node' },
        phase2Queued: true,
        phase2JobId,
      });

      const db = getTestDatabase();
      db.prepare(`
        INSERT INTO nodes (id, title, url, source_domain)
        VALUES (?, 'Queued Node', 'https://example.com/queued', 'example.com')
      `).run(nodeId);

      const response = await request(app)
        .post('/api/import')
        .send({ url: 'https://example.com/queued' });

      expect(response.status).toBe(200);
      expect(response.body.phase2.queued).toBe(true);
      expect(response.body.phase2.jobId).toBe(phase2JobId);
    });

    it('should not include phase2 job when cached', async () => {
      const nodeId = uuidv4();

      mockImportFn.mockResolvedValue({
        success: true,
        nodeId,
        cached: true,
        classification: { segment: 'Technology', category: 'AI', contentType: 'Article' },
        hierarchyCodes: {},
        metadata: { title: 'Cached Node' },
        phase2Queued: false,
      });

      const db = getTestDatabase();
      db.prepare(`
        INSERT INTO nodes (id, title, url, source_domain)
        VALUES (?, 'Cached Node', 'https://example.com/cached-no-queue', 'example.com')
      `).run(nodeId);

      const response = await request(app)
        .post('/api/import')
        .send({ url: 'https://example.com/cached-no-queue' });

      expect(response.status).toBe(200);
      expect(response.body.phase2?.queued).toBeFalsy();
    });
  });

  // ============================================================
  // Concurrent Imports
  // ============================================================

  describe('Concurrent Imports', () => {
    it('should handle multiple simultaneous imports', async () => {
      const nodeIds = [uuidv4(), uuidv4(), uuidv4()];
      const urls = [
        'https://example.com/concurrent1',
        'https://example.com/concurrent2',
        'https://example.com/concurrent3',
      ];

      // Setup nodes in database
      const db = getTestDatabase();
      nodeIds.forEach((id, i) => {
        db.prepare(`
          INSERT INTO nodes (id, title, url, source_domain)
          VALUES (?, ?, ?, 'example.com')
        `).run(id, `Concurrent ${i}`, urls[i]);
      });

      // Setup mock to return different nodeIds
      let callIndex = 0;
      mockImportFn.mockImplementation(() => {
        const index = callIndex++;
        return Promise.resolve({
          success: true,
          nodeId: nodeIds[index % nodeIds.length],
          cached: false,
          classification: { segment: 'Technology', category: 'Test', contentType: 'Article' },
          hierarchyCodes: {},
          metadata: { title: `Concurrent ${index}` },
          phase2Queued: true,
        });
      });

      // Make concurrent requests
      const promises = urls.map(url =>
        request(app)
          .post('/api/import')
          .send({ url })
      );

      const responses = await Promise.all(promises);

      // All should succeed
      expect(responses.every(r => r.status === 200)).toBe(true);
      expect(responses.every(r => r.body.success === true)).toBe(true);
    });
  });

  // ============================================================
  // Import Validation
  // ============================================================

  describe('Import Validation', () => {
    it('should validate URL is not empty', async () => {
      const response = await request(app)
        .post('/api/import')
        .send({ url: '' });

      expect(response.status).toBe(400);
    });

    it('should accept valid HTTPS URL', async () => {
      const nodeId = uuidv4();
      mockImportFn.mockResolvedValue({
        success: true,
        nodeId,
        cached: false,
        classification: { segment: 'Technology', category: 'Test', contentType: 'Article' },
        hierarchyCodes: {},
        metadata: { title: 'Valid URL' },
        phase2Queued: true,
      });

      const db = getTestDatabase();
      db.prepare(`
        INSERT INTO nodes (id, title, url, source_domain)
        VALUES (?, 'Valid URL', 'https://example.com/valid', 'example.com')
      `).run(nodeId);

      const response = await request(app)
        .post('/api/import')
        .send({ url: 'https://example.com/valid' });

      expect(response.status).toBe(200);
    });

    it('should accept valid HTTP URL', async () => {
      const nodeId = uuidv4();
      mockImportFn.mockResolvedValue({
        success: true,
        nodeId,
        cached: false,
        classification: { segment: 'Technology', category: 'Test', contentType: 'Article' },
        hierarchyCodes: {},
        metadata: { title: 'HTTP URL' },
        phase2Queued: true,
      });

      const db = getTestDatabase();
      db.prepare(`
        INSERT INTO nodes (id, title, url, source_domain)
        VALUES (?, 'HTTP URL', 'http://example.com/http', 'example.com')
      `).run(nodeId);

      const response = await request(app)
        .post('/api/import')
        .send({ url: 'http://example.com/http' });

      expect(response.status).toBe(200);
    });
  });
});
