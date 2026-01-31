// ============================================================
// Import Routes Integration Tests
// ============================================================

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../../__tests__/test-app.js';
import { resetTestDatabase } from '../../__tests__/setup.js';
import * as keystore from '../../services/keystore.js';

// Mock the keystore service
vi.mock('../../services/keystore.js', () => ({
  setApiKey: vi.fn().mockResolvedValue(undefined),
  getApiKey: vi.fn().mockResolvedValue(null),
  deleteApiKey: vi.fn().mockResolvedValue(undefined),
  isConfigured: vi.fn().mockResolvedValue(false),
  listConfiguredKeys: vi.fn().mockResolvedValue([]),
  clearAllKeys: vi.fn().mockResolvedValue(undefined),
}));

// Mock the scraper and classifier services
vi.mock('../../services/scraper.js', () => ({
  scrapeUrl: vi.fn(),
}));

vi.mock('../../services/classifier.js', () => ({
  classifyContent: vi.fn(),
  getSegmentName: vi.fn().mockReturnValue('Technology'),
  getContentTypeName: vi.fn().mockReturnValue('Article'),
}));

import { scrapeUrl } from '../../services/scraper.js';
import { classifyContent } from '../../services/classifier.js';

describe('Import API Routes', () => {
  const app = createTestApp();

  beforeEach(() => {
    resetTestDatabase();
    vi.clearAllMocks();
    // Reset API key mock to return null (not configured)
    vi.mocked(keystore.getApiKey).mockResolvedValue(null);
    vi.mocked(keystore.isConfigured).mockResolvedValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/import', () => {
    it('should return 400 when URL is missing', async () => {
      const response = await request(app)
        .post('/api/import')
        .send({});

      expect(response.status).toBe(400);
      // Validation middleware returns "Validation failed"
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid URL format', async () => {
      const response = await request(app)
        .post('/api/import')
        .send({ url: 'not-a-valid-url' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for non-HTTP protocol', async () => {
      const response = await request(app)
        .post('/api/import')
        .send({ url: 'ftp://example.com/file' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 when API key is not configured', async () => {
      const response = await request(app)
        .post('/api/import')
        .send({ url: 'https://example.com/test' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('API key not configured');
    });

    it('should import URL successfully when configured', async () => {
      // Set up API key mock to return a valid key
      vi.mocked(keystore.getApiKey).mockResolvedValue('sk-test-key-12345678901234567890');
      vi.mocked(keystore.isConfigured).mockResolvedValue(true);

      // Mock scraper response
      vi.mocked(scrapeUrl).mockResolvedValue({
        url: 'https://example.com/article',
        title: 'Example Article',
        description: 'An example article',
        author: 'John Doe',
        siteName: 'Example Site',
        favicon: 'https://example.com/favicon.ico',
        image: 'https://example.com/image.jpg',
        content: 'This is the article content...',
        domain: 'example.com',
      });

      // Mock classifier response
      vi.mocked(classifyContent).mockResolvedValue({
        title: 'Example Article - Classified',
        company: 'Example Inc',
        phraseDescription: 'A great article about examples',
        shortDescription: 'This article discusses examples in detail.',
        keyConcepts: ['examples', 'articles', 'testing'],
        segment: 'T',
        contentType: 'A',
        functionParentId: null,
        organizationParentId: null,
      });

      const response = await request(app)
        .post('/api/import')
        .send({ url: 'https://example.com/article' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('nodeId');
      expect(response.body).toHaveProperty('node');
      expect(response.body.node.title).toBe('Example Article - Classified');
    });

    it('should return error when scraping fails', async () => {
      vi.mocked(keystore.getApiKey).mockResolvedValue('sk-test-key-12345678901234567890');
      vi.mocked(keystore.isConfigured).mockResolvedValue(true);

      vi.mocked(scrapeUrl).mockRejectedValue(new Error('Failed to fetch URL: 404'));

      const response = await request(app)
        .post('/api/import')
        .send({ url: 'https://example.com/not-found' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Could not fetch the URL');
    });

    it('should return error when classification fails', async () => {
      vi.mocked(keystore.getApiKey).mockResolvedValue('sk-test-key-12345678901234567890');
      vi.mocked(keystore.isConfigured).mockResolvedValue(true);

      vi.mocked(scrapeUrl).mockResolvedValue({
        url: 'https://example.com/test',
        title: 'Test',
        description: null,
        author: null,
        siteName: null,
        favicon: null,
        image: null,
        content: 'Test content',
        domain: 'example.com',
      });

      vi.mocked(classifyContent).mockRejectedValue(new Error('Classification failed'));

      const response = await request(app)
        .post('/api/import')
        .send({ url: 'https://example.com/test' });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Import failed');
    });
  });

  describe('POST /api/settings/api-key', () => {
    it('should set the API key', async () => {
      const response = await request(app)
        .post('/api/settings/api-key')
        .send({ apiKey: 'sk-test-key-12345678901234567890' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(keystore.setApiKey).toHaveBeenCalledWith('openai', 'sk-test-key-12345678901234567890');
    });

    it('should return 400 when API key is missing', async () => {
      const response = await request(app)
        .post('/api/settings/api-key')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 when API key is too short', async () => {
      const response = await request(app)
        .post('/api/settings/api-key')
        .send({ apiKey: 'short' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 when API key does not start with sk-', async () => {
      const response = await request(app)
        .post('/api/settings/api-key')
        .send({ apiKey: 'invalid-key-12345678901234567890' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/settings/api-key/status', () => {
    it('should return configured: false when no key is set', async () => {
      vi.mocked(keystore.isConfigured).mockResolvedValue(false);

      const response = await request(app).get('/api/settings/api-key/status');

      expect(response.status).toBe(200);
      expect(response.body.configured).toBe(false);
    });

    it('should return configured: true when key is set', async () => {
      vi.mocked(keystore.isConfigured).mockResolvedValue(true);

      const response = await request(app).get('/api/settings/api-key/status');

      expect(response.status).toBe(200);
      expect(response.body.configured).toBe(true);
    });
  });

  describe('DELETE /api/settings/api-key', () => {
    it('should delete the API key', async () => {
      const response = await request(app).delete('/api/settings/api-key');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(keystore.deleteApiKey).toHaveBeenCalledWith('openai');
    });
  });
});
