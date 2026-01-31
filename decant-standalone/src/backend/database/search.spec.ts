// ============================================================
// Search Operations Tests
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { searchNodesAdvanced, SearchFilters } from './search.js';
import { setDatabase } from './connection.js';
import { initializeDatabase } from './schema.js';
import { createNode, updateNodePhase2 } from './nodes.js';

describe('Search Operations', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    setDatabase(db);
    initializeDatabase();
  });

  afterEach(() => {
    db.close();
  });

  describe('searchNodesAdvanced', () => {
    beforeEach(() => {
      // Insert test data
      const node1 = createNode({
        title: 'Introduction to Machine Learning',
        url: 'https://example.com/ml-intro',
        source_domain: 'example.com',
        company: 'Anthropic',
        short_description: 'A comprehensive guide to machine learning fundamentals',
        ai_summary: 'This article covers the basics of ML algorithms and applications',
        key_concepts: ['machine learning', 'AI', 'algorithms'],
      });

      const node2 = createNode({
        title: 'Advanced Neural Networks',
        url: 'https://example.com/neural-nets',
        source_domain: 'example.com',
        company: 'OpenAI',
        short_description: 'Deep dive into neural network architectures',
        ai_summary: 'Explore advanced topics in deep learning and neural networks',
        key_concepts: ['neural networks', 'deep learning', 'AI'],
      });

      const node3 = createNode({
        title: 'Web Development Best Practices',
        url: 'https://example.com/webdev',
        source_domain: 'example.com',
        company: 'Google',
        short_description: 'Modern web development techniques and patterns',
        ai_summary: 'Learn about React, TypeScript, and modern web frameworks',
        key_concepts: ['web development', 'react', 'typescript'],
      });

      // Update nodes with Phase 2 enrichment and classification codes
      updateNodePhase2((node1 as any).id, {
        title: 'Introduction to Machine Learning',
        company: 'Anthropic',
        phrase_description: 'ML fundamentals guide',
        short_description: 'A comprehensive guide to machine learning fundamentals',
        key_concepts: ['machine learning', 'AI', 'algorithms'],
      });

      // Set classification codes manually via SQL
      db.prepare(`
        UPDATE nodes
        SET segment_code = ?,
            category_code = ?,
            content_type_code = ?
        WHERE id = ?
      `).run('A', 'LLM', 'T', (node1 as any).id);

      db.prepare(`
        UPDATE nodes
        SET segment_code = ?,
            category_code = ?,
            content_type_code = ?
        WHERE id = ?
      `).run('A', 'LLM', 'T', (node2 as any).id);

      db.prepare(`
        UPDATE nodes
        SET segment_code = ?,
            category_code = ?,
            content_type_code = ?
        WHERE id = ?
      `).run('E', 'WEB', 'T', (node3 as any).id);
    });

    it('should return search results with basic query', () => {
      const response = searchNodesAdvanced('machine learning');

      expect(response.results.length).toBeGreaterThan(0);
      expect(response.total).toBeGreaterThan(0);
      expect(response.page).toBe(1);
      expect(response.facets).toBeDefined();
    });

    it('should filter by segment code', () => {
      const filters: SearchFilters = {
        segment: 'A',
      };

      const response = searchNodesAdvanced('learning', filters);

      expect(response.results.length).toBeGreaterThan(0);
      expect(response.results.every(r => r.segment === 'A')).toBe(true);
    });

    it('should filter by category code', () => {
      const filters: SearchFilters = {
        category: 'LLM',
      };

      const response = searchNodesAdvanced('learning', filters);

      expect(response.results.length).toBeGreaterThan(0);
      expect(response.results.every(r => r.category === 'LLM')).toBe(true);
    });

    it('should filter by content type code', () => {
      const filters: SearchFilters = {
        contentType: 'T',
      };

      const response = searchNodesAdvanced('development', filters);

      expect(response.results.length).toBeGreaterThan(0);
      expect(response.results.every(r => r.contentType === 'T')).toBe(true);
    });

    it('should filter by organization', () => {
      const filters: SearchFilters = {
        organization: 'Anthropic',
      };

      const response = searchNodesAdvanced('machine', filters);

      expect(response.results.length).toBeGreaterThan(0);
      expect(response.results.every(r => r.company?.includes('Anthropic'))).toBe(true);
    });

    it('should filter by multiple criteria', () => {
      const filters: SearchFilters = {
        segment: 'A',
        category: 'LLM',
        contentType: 'T',
      };

      const response = searchNodesAdvanced('learning', filters);

      expect(response.results.length).toBeGreaterThan(0);
      expect(response.results.every(r =>
        r.segment === 'A' && r.category === 'LLM' && r.contentType === 'T'
      )).toBe(true);
    });

    it('should return facets with counts', () => {
      const response = searchNodesAdvanced('learning');

      expect(response.facets).toBeDefined();
      expect(response.facets.segments).toBeDefined();
      expect(response.facets.categories).toBeDefined();
      expect(response.facets.contentTypes).toBeDefined();
      expect(response.facets.organizations).toBeDefined();

      // Check segment facets
      expect(response.facets.segments['A']).toBeGreaterThan(0);

      // Check category facets
      expect(response.facets.categories['LLM']).toBeGreaterThan(0);
    });

    it('should include matched fields in results', () => {
      const response = searchNodesAdvanced('machine learning');

      const result = response.results[0];
      expect(result.matchedFields).toBeDefined();
      expect(result.matchedFields.length).toBeGreaterThan(0);
    });

    it('should include snippets in results', () => {
      const response = searchNodesAdvanced('machine learning');

      const result = response.results.find(r => r.snippet);
      expect(result).toBeDefined();
    });

    it('should paginate results', () => {
      const page1 = searchNodesAdvanced('development', undefined, { page: 1, limit: 1 });
      expect(page1.results.length).toBe(1);
      expect(page1.page).toBe(1);
      expect(page1.pageSize).toBe(1);
    });

    it('should return empty results for non-matching query', () => {
      const response = searchNodesAdvanced('nonexistent-term-xyz');

      expect(response.results.length).toBe(0);
      expect(response.total).toBe(0);
      expect(response.facets.segments).toEqual({});
      expect(response.facets.categories).toEqual({});
      expect(response.facets.contentTypes).toEqual({});
      expect(response.facets.organizations).toEqual([]);
    });

    it('should filter by hasMetadata flag', () => {
      const filters: SearchFilters = {
        hasMetadata: true,
      };

      const response = searchNodesAdvanced('machine', filters);

      // Only nodes with Phase 2 enrichment should be returned
      expect(response.results.every(r =>
        r.extracted_fields?.phase2Completed === true
      )).toBe(true);
    });

    it('should handle date range filters', () => {
      const filters: SearchFilters = {
        dateRange: {
          start: '2020-01-01',
          end: '2030-12-31',
        },
      };

      const response = searchNodesAdvanced('learning', filters);

      expect(response.results.length).toBeGreaterThan(0);
    });

    it('should return top organizations in facets', () => {
      const response = searchNodesAdvanced('learning');

      expect(response.facets.organizations).toBeDefined();
      expect(response.facets.organizations.length).toBeGreaterThan(0);
      expect(response.facets.organizations[0]).toHaveProperty('name');
      expect(response.facets.organizations[0]).toHaveProperty('count');
    });

    it('should include all node fields in results', () => {
      const response = searchNodesAdvanced('machine learning');

      const result = response.results[0];
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('segment');
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('contentType');
      expect(result).toHaveProperty('company');
      expect(result).toHaveProperty('source_domain');
      expect(result).toHaveProperty('key_concepts');
      expect(result.key_concepts).toBeInstanceOf(Array);
    });
  });
});
