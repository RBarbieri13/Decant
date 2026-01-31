// ============================================================
// Pagination Integration Tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../../__tests__/test-app.js';
import { createNode } from '../../database/nodes.js';
import { resetTestDatabase } from '../../__tests__/setup.js';
import { DEFAULT_LIMIT, MAX_LIMIT } from '../../types/pagination.js';

describe('Pagination Integration Tests', () => {
  const app = createTestApp();

  beforeEach(() => {
    resetTestDatabase();
  });

  // ============================================================
  // GET /api/nodes - Pagination Tests
  // ============================================================

  describe('GET /api/nodes - Pagination', () => {
    it('should return all nodes without pagination wrapper when no params provided (backward compatibility)', async () => {
      createNode({
        title: 'Node 1',
        url: 'https://example.com/1',
        source_domain: 'example.com',
      });
      createNode({
        title: 'Node 2',
        url: 'https://example.com/2',
        source_domain: 'example.com',
      });

      const response = await request(app).get('/api/nodes');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).not.toHaveProperty('pagination');
    });

    it('should return paginated response when page param is provided', async () => {
      createNode({
        title: 'Node 1',
        url: 'https://example.com/1',
        source_domain: 'example.com',
      });

      const response = await request(app).get('/api/nodes?page=1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return paginated response when limit param is provided', async () => {
      createNode({
        title: 'Node 1',
        url: 'https://example.com/1',
        source_domain: 'example.com',
      });

      const response = await request(app).get('/api/nodes?limit=10');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
    });

    it('should use default pagination values (page=1, limit=20)', async () => {
      for (let i = 0; i < 25; i++) {
        createNode({
          title: `Node ${i}`,
          url: `https://example.com/${i}`,
          source_domain: 'example.com',
        });
      }

      const response = await request(app).get('/api/nodes?page=1');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(DEFAULT_LIMIT);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(DEFAULT_LIMIT);
      expect(response.body.pagination.total).toBe(25);
      expect(response.body.pagination.hasMore).toBe(true);
    });

    it('should respect custom page and limit params', async () => {
      for (let i = 0; i < 30; i++) {
        createNode({
          title: `Node ${i}`,
          url: `https://example.com/${i}`,
          source_domain: 'example.com',
        });
      }

      const response = await request(app).get('/api/nodes?page=2&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(10);
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.total).toBe(30);
    });

    it('should enforce maximum limit of 100', async () => {
      for (let i = 0; i < 50; i++) {
        createNode({
          title: `Node ${i}`,
          url: `https://example.com/${i}`,
          source_domain: 'example.com',
        });
      }

      const response = await request(app).get('/api/nodes?limit=150');

      expect(response.status).toBe(200);
      expect(response.body.pagination.limit).toBe(MAX_LIMIT);
      expect(response.body.data.length).toBeLessThanOrEqual(MAX_LIMIT);
    });

    it('should enforce minimum limit of 1', async () => {
      createNode({
        title: 'Node 1',
        url: 'https://example.com/1',
        source_domain: 'example.com',
      });

      const response = await request(app).get('/api/nodes?limit=0');

      expect(response.status).toBe(200);
      expect(response.body.pagination.limit).toBe(1);
    });

    it('should handle invalid page number gracefully (default to 1)', async () => {
      createNode({
        title: 'Node 1',
        url: 'https://example.com/1',
        source_domain: 'example.com',
      });

      const response = await request(app).get('/api/nodes?page=-1');

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
    });

    it('should handle non-numeric page param gracefully', async () => {
      createNode({
        title: 'Node 1',
        url: 'https://example.com/1',
        source_domain: 'example.com',
      });

      const response = await request(app).get('/api/nodes?page=abc');

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
    });

    it('should handle non-numeric limit param gracefully', async () => {
      createNode({
        title: 'Node 1',
        url: 'https://example.com/1',
        source_domain: 'example.com',
      });

      const response = await request(app).get('/api/nodes?limit=invalid');

      expect(response.status).toBe(200);
      expect(response.body.pagination.limit).toBe(DEFAULT_LIMIT);
    });

    it('should calculate correct total count', async () => {
      for (let i = 0; i < 15; i++) {
        createNode({
          title: `Node ${i}`,
          url: `https://example.com/${i}`,
          source_domain: 'example.com',
        });
      }

      const response = await request(app).get('/api/nodes?page=1&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.pagination.total).toBe(15);
    });

    it('should calculate hasMore correctly when more pages exist', async () => {
      for (let i = 0; i < 25; i++) {
        createNode({
          title: `Node ${i}`,
          url: `https://example.com/${i}`,
          source_domain: 'example.com',
        });
      }

      const response = await request(app).get('/api/nodes?page=1&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.pagination.hasMore).toBe(true);
      expect(response.body.pagination.totalPages).toBe(3);
    });

    it('should calculate hasMore correctly on last page', async () => {
      for (let i = 0; i < 25; i++) {
        createNode({
          title: `Node ${i}`,
          url: `https://example.com/${i}`,
          source_domain: 'example.com',
        });
      }

      const response = await request(app).get('/api/nodes?page=3&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.pagination.hasMore).toBe(false);
      expect(response.body.data).toHaveLength(5);
    });

    it('should return empty data array for page beyond available data', async () => {
      createNode({
        title: 'Node 1',
        url: 'https://example.com/1',
        source_domain: 'example.com',
      });

      const response = await request(app).get('/api/nodes?page=10&limit=20');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.pagination.total).toBe(1);
      expect(response.body.pagination.hasMore).toBe(false);
    });

    it('should not overlap between consecutive pages', async () => {
      for (let i = 0; i < 30; i++) {
        createNode({
          title: `Node ${i}`,
          url: `https://example.com/${i}`,
          source_domain: 'example.com',
        });
      }

      const page1Response = await request(app).get('/api/nodes?page=1&limit=10');
      const page2Response = await request(app).get('/api/nodes?page=2&limit=10');

      expect(page1Response.status).toBe(200);
      expect(page2Response.status).toBe(200);

      const page1Ids = new Set(page1Response.body.data.map((n: any) => n.id));
      const hasOverlap = page2Response.body.data.some((n: any) => page1Ids.has(n.id));

      expect(hasOverlap).toBe(false);
    });

    it('should maintain proper ordering across pages', async () => {
      const nodes = [];
      for (let i = 0; i < 15; i++) {
        const node = createNode({
          title: `Node ${i}`,
          url: `https://example.com/${i}`,
          source_domain: 'example.com',
        });
        nodes.push(node);
      }

      const page1Response = await request(app).get('/api/nodes?page=1&limit=10');
      const page2Response = await request(app).get('/api/nodes?page=2&limit=10');

      expect(page1Response.status).toBe(200);
      expect(page2Response.status).toBe(200);

      // Nodes should be ordered by date_added DESC
      // First node on page 1 should be the most recent
      expect(page1Response.body.data[0].id).toBe(nodes[nodes.length - 1].id);
    });
  });

  // ============================================================
  // GET /api/search - Pagination Tests
  // ============================================================

  describe('GET /api/search - Pagination', () => {
    beforeEach(() => {
      // Create test data with searchable content
      for (let i = 0; i < 30; i++) {
        createNode({
          title: `Searchable Node ${i}`,
          url: `https://example.com/search${i}`,
          source_domain: 'example.com',
          short_description: 'This is a searchable description',
        });
      }
    });

    it('should return results without pagination wrapper when no pagination params provided', async () => {
      const response = await request(app).get('/api/search?q=Searchable');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).not.toHaveProperty('pagination');
    });

    it('should return paginated response when page param is provided', async () => {
      const response = await request(app).get('/api/search?q=Searchable&page=1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return paginated response when limit param is provided', async () => {
      const response = await request(app).get('/api/search?q=Searchable&limit=10');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
    });

    it('should use default pagination values (page=1, limit=20)', async () => {
      const response = await request(app).get('/api/search?q=Searchable&page=1');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(DEFAULT_LIMIT);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(DEFAULT_LIMIT);
      expect(response.body.pagination.total).toBe(30);
      expect(response.body.pagination.hasMore).toBe(true);
    });

    it('should respect custom page and limit params', async () => {
      const response = await request(app).get('/api/search?q=Searchable&page=2&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(10);
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.total).toBe(30);
    });

    it('should enforce maximum limit of 100', async () => {
      const response = await request(app).get('/api/search?q=Searchable&limit=150');

      expect(response.status).toBe(200);
      expect(response.body.pagination.limit).toBe(MAX_LIMIT);
    });

    it('should enforce minimum limit of 1', async () => {
      const response = await request(app).get('/api/search?q=Searchable&limit=0');

      expect(response.status).toBe(200);
      expect(response.body.pagination.limit).toBe(1);
    });

    it('should calculate correct total count for search results', async () => {
      const response = await request(app).get('/api/search?q=Searchable&page=1&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.pagination.total).toBe(30);
    });

    it('should calculate hasMore correctly for search results', async () => {
      const response = await request(app).get('/api/search?q=Searchable&page=1&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.pagination.hasMore).toBe(true);
      expect(response.body.pagination.totalPages).toBe(3);
    });

    it('should calculate hasMore correctly on last page of search results', async () => {
      const response = await request(app).get('/api/search?q=Searchable&page=3&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.pagination.hasMore).toBe(false);
      expect(response.body.data).toHaveLength(10);
    });

    it('should return empty data array for search page beyond available results', async () => {
      const response = await request(app).get('/api/search?q=Searchable&page=10&limit=20');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.pagination.total).toBe(30);
      expect(response.body.pagination.hasMore).toBe(false);
    });

    it('should not overlap between consecutive search result pages', async () => {
      const page1Response = await request(app).get('/api/search?q=Searchable&page=1&limit=10');
      const page2Response = await request(app).get('/api/search?q=Searchable&page=2&limit=10');

      expect(page1Response.status).toBe(200);
      expect(page2Response.status).toBe(200);

      const page1Ids = new Set(page1Response.body.data.map((n: any) => n.id));
      const hasOverlap = page2Response.body.data.some((n: any) => page1Ids.has(n.id));

      expect(hasOverlap).toBe(false);
    });

    it('should return correct count for queries with few results', async () => {
      // Create a unique node
      createNode({
        title: 'Unique Search Term XYZ',
        url: 'https://example.com/unique',
        source_domain: 'example.com',
      });

      const response = await request(app).get('/api/search?q=XYZ&page=1&limit=20');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination.total).toBe(1);
      expect(response.body.pagination.hasMore).toBe(false);
    });

    it('should return zero total for queries with no results', async () => {
      const response = await request(app).get('/api/search?q=NonexistentQuery&page=1&limit=20');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.pagination.total).toBe(0);
      expect(response.body.pagination.hasMore).toBe(false);
      expect(response.body.pagination.totalPages).toBe(0);
    });

    it('should require query parameter q', async () => {
      const response = await request(app).get('/api/search?page=1&limit=10');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle special characters in search query with pagination', async () => {
      createNode({
        title: 'C++ Programming',
        url: 'https://example.com/cpp',
        source_domain: 'example.com',
      });

      const response = await request(app).get('/api/search?q=C%2B%2B&page=1&limit=10');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination.total).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // Pagination Response Structure Tests
  // ============================================================

  describe('Pagination Response Structure', () => {
    beforeEach(() => {
      for (let i = 0; i < 10; i++) {
        createNode({
          title: `Node ${i}`,
          url: `https://example.com/${i}`,
          source_domain: 'example.com',
        });
      }
    });

    it('should have correct pagination metadata structure', async () => {
      const response = await request(app).get('/api/nodes?page=1&limit=5');

      expect(response.status).toBe(200);
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('totalPages');
      expect(response.body.pagination).toHaveProperty('hasMore');
    });

    it('should have correct data types in pagination metadata', async () => {
      const response = await request(app).get('/api/nodes?page=2&limit=3');

      expect(response.status).toBe(200);
      expect(typeof response.body.pagination.page).toBe('number');
      expect(typeof response.body.pagination.limit).toBe('number');
      expect(typeof response.body.pagination.total).toBe('number');
      expect(typeof response.body.pagination.totalPages).toBe('number');
      expect(typeof response.body.pagination.hasMore).toBe('boolean');
    });

    it('should calculate totalPages correctly', async () => {
      const response = await request(app).get('/api/nodes?page=1&limit=3');

      expect(response.status).toBe(200);
      expect(response.body.pagination.total).toBe(10);
      expect(response.body.pagination.totalPages).toBe(4); // Math.ceil(10/3) = 4
    });

    it('should handle exact page boundaries', async () => {
      const response = await request(app).get('/api/nodes?page=1&limit=5');

      expect(response.status).toBe(200);
      expect(response.body.pagination.total).toBe(10);
      expect(response.body.pagination.totalPages).toBe(2); // Math.ceil(10/5) = 2
    });
  });
});
