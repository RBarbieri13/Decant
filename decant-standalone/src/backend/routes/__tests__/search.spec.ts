// ============================================================
// Search Routes Tests
// ============================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, startServer, stopServer } from '../../__tests__/test-app.js';
import { getDatabase } from '../../database/connection.js';
import { createNode } from '../../database/nodes.js';

describe('Search Routes', () => {
  beforeAll(async () => {
    await startServer();
  });

  afterAll(async () => {
    await stopServer();
  });

  beforeEach(() => {
    // Clean up test data
    const db = getDatabase();
    db.prepare('DELETE FROM nodes WHERE url LIKE ?').run('%test-search%');
  });

  describe('POST /api/search/filtered', () => {
    it('should search with no filters', async () => {
      // Create test nodes
      await createNode({
        title: 'Test AI Article',
        url: 'https://test-search.com/ai-article',
        source_domain: 'test-search.com',
        company: 'Anthropic',
        short_description: 'An article about artificial intelligence',
      });

      const response = await request(app)
        .post('/api/search/filtered')
        .send({
          query: 'artificial intelligence',
        })
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('facets');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('pageSize');
      expect(response.body.results.length).toBeGreaterThan(0);
    });

    it('should filter by segments', async () => {
      // Create test nodes with different segments
      const node1 = await createNode({
        title: 'AI Tool',
        url: 'https://test-search.com/ai-tool',
        source_domain: 'test-search.com',
        segment_code: 'A',
      });

      const node2 = await createNode({
        title: 'Tech Tool',
        url: 'https://test-search.com/tech-tool',
        source_domain: 'test-search.com',
        segment_code: 'T',
      });

      const response = await request(app)
        .post('/api/search/filtered')
        .send({
          query: 'Tool',
          filters: {
            segments: ['A'],
          },
        })
        .expect(200);

      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].segment).toBe('A');
      expect(response.body.results[0].id).toBe(node1.id);
    });

    it('should filter by multiple segments', async () => {
      // Create test nodes with different segments
      await createNode({
        title: 'AI Article',
        url: 'https://test-search.com/ai-article-1',
        source_domain: 'test-search.com',
        segment_code: 'A',
      });

      await createNode({
        title: 'Tech Article',
        url: 'https://test-search.com/tech-article-1',
        source_domain: 'test-search.com',
        segment_code: 'T',
      });

      await createNode({
        title: 'Finance Article',
        url: 'https://test-search.com/finance-article-1',
        source_domain: 'test-search.com',
        segment_code: 'F',
      });

      const response = await request(app)
        .post('/api/search/filtered')
        .send({
          query: 'Article',
          filters: {
            segments: ['A', 'T'],
          },
        })
        .expect(200);

      expect(response.body.results).toHaveLength(2);
      const segments = response.body.results.map((r: any) => r.segment);
      expect(segments).toContain('A');
      expect(segments).toContain('T');
      expect(segments).not.toContain('F');
    });

    it('should filter by content types', async () => {
      // Create test nodes with different content types
      const videoNode = await createNode({
        title: 'Test Video',
        url: 'https://test-search.com/video',
        source_domain: 'test-search.com',
        content_type_code: 'V',
      });

      await createNode({
        title: 'Test Article',
        url: 'https://test-search.com/article',
        source_domain: 'test-search.com',
        content_type_code: 'A',
      });

      const response = await request(app)
        .post('/api/search/filtered')
        .send({
          query: 'Test',
          filters: {
            contentTypes: ['V'],
          },
        })
        .expect(200);

      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].contentType).toBe('V');
      expect(response.body.results[0].id).toBe(videoNode.id);
    });

    it('should filter by multiple content types', async () => {
      await createNode({
        title: 'Test Video',
        url: 'https://test-search.com/video-2',
        source_domain: 'test-search.com',
        content_type_code: 'V',
      });

      await createNode({
        title: 'Test Tool',
        url: 'https://test-search.com/tool-2',
        source_domain: 'test-search.com',
        content_type_code: 'T',
      });

      await createNode({
        title: 'Test Article',
        url: 'https://test-search.com/article-2',
        source_domain: 'test-search.com',
        content_type_code: 'A',
      });

      const response = await request(app)
        .post('/api/search/filtered')
        .send({
          query: 'Test',
          filters: {
            contentTypes: ['V', 'T'],
          },
        })
        .expect(200);

      expect(response.body.results).toHaveLength(2);
      const contentTypes = response.body.results.map((r: any) => r.contentType);
      expect(contentTypes).toContain('V');
      expect(contentTypes).toContain('T');
      expect(contentTypes).not.toContain('A');
    });

    it('should filter by organizations', async () => {
      const anthropicNode = await createNode({
        title: 'Claude AI',
        url: 'https://test-search.com/claude',
        source_domain: 'test-search.com',
        company: 'Anthropic',
      });

      await createNode({
        title: 'GPT Tool',
        url: 'https://test-search.com/gpt',
        source_domain: 'test-search.com',
        company: 'OpenAI',
      });

      const response = await request(app)
        .post('/api/search/filtered')
        .send({
          query: 'AI',
          filters: {
            organizations: ['Anthropic'],
          },
        })
        .expect(200);

      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].company).toBe('Anthropic');
      expect(response.body.results[0].id).toBe(anthropicNode.id);
    });

    it('should filter by date range', async () => {
      // Create nodes with different dates
      const db = getDatabase();

      const oldNode = await createNode({
        title: 'Old Article',
        url: 'https://test-search.com/old',
        source_domain: 'test-search.com',
      });
      db.prepare('UPDATE nodes SET date_added = ? WHERE id = ?')
        .run('2023-01-01T00:00:00Z', oldNode.id);

      const newNode = await createNode({
        title: 'New Article',
        url: 'https://test-search.com/new',
        source_domain: 'test-search.com',
      });
      db.prepare('UPDATE nodes SET date_added = ? WHERE id = ?')
        .run('2024-06-01T00:00:00Z', newNode.id);

      const response = await request(app)
        .post('/api/search/filtered')
        .send({
          query: 'Article',
          filters: {
            dateRange: {
              start: '2024-01-01T00:00:00Z',
              end: '2024-12-31T23:59:59Z',
            },
          },
        })
        .expect(200);

      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].id).toBe(newNode.id);
    });

    it('should filter by hasCompleteMetadata', async () => {
      // Create node with complete metadata
      await createNode({
        title: 'Complete Article',
        url: 'https://test-search.com/complete',
        source_domain: 'test-search.com',
        extracted_fields: { phase2Completed: true },
      });

      // Create node without complete metadata
      await createNode({
        title: 'Incomplete Article',
        url: 'https://test-search.com/incomplete',
        source_domain: 'test-search.com',
        extracted_fields: {},
      });

      const response = await request(app)
        .post('/api/search/filtered')
        .send({
          query: 'Article',
          filters: {
            hasCompleteMetadata: true,
          },
        })
        .expect(200);

      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].title).toBe('Complete Article');
    });

    it('should combine multiple filters', async () => {
      // Create various test nodes
      const matchingNode = await createNode({
        title: 'AI Video Tutorial',
        url: 'https://test-search.com/ai-video',
        source_domain: 'test-search.com',
        company: 'Anthropic',
        segment_code: 'A',
        content_type_code: 'V',
        extracted_fields: { phase2Completed: true },
      });

      await createNode({
        title: 'AI Article Tutorial',
        url: 'https://test-search.com/ai-article-2',
        source_domain: 'test-search.com',
        company: 'Anthropic',
        segment_code: 'A',
        content_type_code: 'A', // Different content type
        extracted_fields: { phase2Completed: true },
      });

      await createNode({
        title: 'Tech Video Tutorial',
        url: 'https://test-search.com/tech-video',
        source_domain: 'test-search.com',
        company: 'Anthropic',
        segment_code: 'T', // Different segment
        content_type_code: 'V',
        extracted_fields: { phase2Completed: true },
      });

      const response = await request(app)
        .post('/api/search/filtered')
        .send({
          query: 'Tutorial',
          filters: {
            segments: ['A'],
            contentTypes: ['V'],
            organizations: ['Anthropic'],
            hasCompleteMetadata: true,
          },
        })
        .expect(200);

      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].id).toBe(matchingNode.id);
    });

    it('should support pagination', async () => {
      // Create multiple test nodes
      for (let i = 0; i < 25; i++) {
        await createNode({
          title: `Test Node ${i}`,
          url: `https://test-search.com/node-${i}`,
          source_domain: 'test-search.com',
        });
      }

      // Get first page
      const page1 = await request(app)
        .post('/api/search/filtered')
        .send({
          query: 'Test Node',
          page: 1,
          limit: 10,
        })
        .expect(200);

      expect(page1.body.results).toHaveLength(10);
      expect(page1.body.page).toBe(1);
      expect(page1.body.pageSize).toBe(10);
      expect(page1.body.total).toBe(25);

      // Get second page
      const page2 = await request(app)
        .post('/api/search/filtered')
        .send({
          query: 'Test Node',
          page: 2,
          limit: 10,
        })
        .expect(200);

      expect(page2.body.results).toHaveLength(10);
      expect(page2.body.page).toBe(2);

      // Ensure different results on different pages
      const page1Ids = page1.body.results.map((r: any) => r.id);
      const page2Ids = page2.body.results.map((r: any) => r.id);
      expect(page1Ids).not.toEqual(page2Ids);
    });

    it('should return facets for available filters', async () => {
      // Create diverse test nodes
      await createNode({
        title: 'AI Tool',
        url: 'https://test-search.com/facet-1',
        source_domain: 'test-search.com',
        segment_code: 'A',
        category_code: 'LLM',
        content_type_code: 'T',
        company: 'Anthropic',
      });

      await createNode({
        title: 'Tech Video',
        url: 'https://test-search.com/facet-2',
        source_domain: 'test-search.com',
        segment_code: 'T',
        category_code: 'FND',
        content_type_code: 'V',
        company: 'OpenAI',
      });

      const response = await request(app)
        .post('/api/search/filtered')
        .send({
          query: 'Tool Video',
        })
        .expect(200);

      expect(response.body.facets).toHaveProperty('segments');
      expect(response.body.facets).toHaveProperty('categories');
      expect(response.body.facets).toHaveProperty('contentTypes');
      expect(response.body.facets).toHaveProperty('organizations');

      expect(response.body.facets.segments).toHaveProperty('A');
      expect(response.body.facets.segments).toHaveProperty('T');
      expect(response.body.facets.categories).toHaveProperty('LLM');
      expect(response.body.facets.categories).toHaveProperty('FND');
      expect(response.body.facets.contentTypes).toHaveProperty('T');
      expect(response.body.facets.contentTypes).toHaveProperty('V');
    });

    it('should reject invalid request body', async () => {
      await request(app)
        .post('/api/search/filtered')
        .send({
          // Missing query
          filters: {},
        })
        .expect(400);
    });

    it('should reject query that is too long', async () => {
      await request(app)
        .post('/api/search/filtered')
        .send({
          query: 'a'.repeat(501), // Exceeds 500 character limit
        })
        .expect(400);
    });

    it('should handle empty filters object', async () => {
      await createNode({
        title: 'Test Node',
        url: 'https://test-search.com/empty-filters',
        source_domain: 'test-search.com',
      });

      const response = await request(app)
        .post('/api/search/filtered')
        .send({
          query: 'Test Node',
          filters: {},
        })
        .expect(200);

      expect(response.body.results.length).toBeGreaterThan(0);
    });
  });
});
