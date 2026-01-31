// ============================================================
// Search Operations Unit Tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { searchNodes } from '../search.js';
import { createNode } from '../nodes.js';
import { getTestDatabase, resetTestDatabase } from '../../__tests__/setup.js';

describe('Search Operations', () => {
  beforeEach(() => {
    resetTestDatabase();
  });

  describe('searchNodes', () => {
    it('should find nodes by title', () => {
      createNode({
        title: 'Machine Learning Guide',
        url: 'https://example.com/ml',
        source_domain: 'example.com',
      });
      createNode({
        title: 'Web Development Tutorial',
        url: 'https://example.com/web',
        source_domain: 'example.com',
      });

      const results = searchNodes('Machine Learning');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Machine Learning Guide');
    });

    it('should find nodes by source_domain', () => {
      createNode({
        title: 'GitHub Repo',
        url: 'https://github.com/test/repo',
        source_domain: 'github.com',
      });
      createNode({
        title: 'Regular Site',
        url: 'https://example.com/page',
        source_domain: 'example.com',
      });

      const results = searchNodes('github');

      expect(results).toHaveLength(1);
      expect(results[0].source_domain).toBe('github.com');
    });

    it('should find nodes by company', () => {
      createNode({
        title: 'Product Page',
        url: 'https://example.com/product',
        source_domain: 'example.com',
        company: 'Anthropic',
      });
      createNode({
        title: 'Other Product',
        url: 'https://example.com/other',
        source_domain: 'example.com',
        company: 'OpenAI',
      });

      const results = searchNodes('Anthropic');

      expect(results).toHaveLength(1);
      expect(results[0].company).toBe('Anthropic');
    });

    it('should find nodes by short_description', () => {
      createNode({
        title: 'Some Tool',
        url: 'https://example.com/tool',
        source_domain: 'example.com',
        short_description: 'A powerful code editor for developers',
      });
      createNode({
        title: 'Another Tool',
        url: 'https://example.com/another',
        source_domain: 'example.com',
        short_description: 'A simple note-taking app',
      });

      const results = searchNodes('code editor');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Some Tool');
    });

    it('should find nodes by ai_summary', () => {
      createNode({
        title: 'AI Article',
        url: 'https://example.com/ai-article',
        source_domain: 'example.com',
        ai_summary: 'This article discusses neural networks and deep learning',
      });

      const results = searchNodes('neural networks');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('AI Article');
    });

    it('should be case insensitive', () => {
      createNode({
        title: 'TypeScript Tutorial',
        url: 'https://example.com/ts',
        source_domain: 'example.com',
      });

      const lowerResults = searchNodes('typescript');
      const upperResults = searchNodes('TYPESCRIPT');
      const mixedResults = searchNodes('TypeScript');

      expect(lowerResults).toHaveLength(1);
      expect(upperResults).toHaveLength(1);
      expect(mixedResults).toHaveLength(1);
    });

    it('should perform partial matching', () => {
      createNode({
        title: 'JavaScript Programming',
        url: 'https://example.com/js',
        source_domain: 'example.com',
      });

      const results = searchNodes('Script');

      expect(results).toHaveLength(1);
    });

    it('should return multiple matching nodes', () => {
      createNode({
        title: 'React Tutorial',
        url: 'https://example.com/react',
        source_domain: 'example.com',
        short_description: 'Learn React fundamentals',
      });
      createNode({
        title: 'React Advanced',
        url: 'https://example.com/react-adv',
        source_domain: 'example.com',
        ai_summary: 'Advanced React patterns',
      });
      createNode({
        title: 'Vue Guide',
        url: 'https://example.com/vue',
        source_domain: 'example.com',
      });

      const results = searchNodes('React');

      expect(results).toHaveLength(2);
    });

    it('should not include deleted nodes', () => {
      const node = createNode({
        title: 'Searchable Node',
        url: 'https://example.com/searchable',
        source_domain: 'example.com',
      });

      // Soft delete the node using the test database
      const db = getTestDatabase();
      db.prepare('UPDATE nodes SET is_deleted = 1 WHERE id = ?').run(node.id);

      const results = searchNodes('Searchable');

      expect(results).toHaveLength(0);
    });

    it('should return empty array for no matches', () => {
      createNode({
        title: 'Some Node',
        url: 'https://example.com/some',
        source_domain: 'example.com',
      });

      const results = searchNodes('nonexistent query');

      expect(results).toEqual([]);
    });

    it('should respect default limit of 20', () => {
      // Create more than 20 nodes
      for (let i = 0; i < 30; i++) {
        createNode({
          title: `Test Node ${i}`,
          url: `https://example.com/test${i}`,
          source_domain: 'example.com',
        });
      }

      const results = searchNodes('Test Node');

      // Default limit is 20
      expect(results).toHaveLength(20);
    });

    it('should support custom pagination limit', () => {
      // Create 15 nodes
      for (let i = 0; i < 15; i++) {
        createNode({
          title: `Paginated Node ${i}`,
          url: `https://example.com/page${i}`,
          source_domain: 'example.com',
        });
      }

      const results = searchNodes('Paginated Node', undefined, { limit: 10 });

      expect(results).toHaveLength(10);
    });

    it('should support pagination offset', () => {
      // Create 10 nodes
      for (let i = 0; i < 10; i++) {
        createNode({
          title: `Offset Node ${i}`,
          url: `https://example.com/offset${i}`,
          source_domain: 'example.com',
        });
      }

      const page1 = searchNodes('Offset Node', undefined, { page: 1, limit: 5 });
      const page2 = searchNodes('Offset Node', undefined, { page: 2, limit: 5 });

      expect(page1).toHaveLength(5);
      expect(page2).toHaveLength(5);
      // Pages should not overlap
      const page1Ids = new Set(page1.map(n => n.id));
      const hasOverlap = page2.some(n => page1Ids.has(n.id));
      expect(hasOverlap).toBe(false);
    });

    it('should parse JSON fields in results', () => {
      createNode({
        title: 'JSON Search Test',
        url: 'https://example.com/json-search',
        source_domain: 'example.com',
        extracted_fields: { author: 'Test Author' },
        metadata_tags: ['search-tag'],
        key_concepts: ['search-concept'],
      });

      const results = searchNodes('JSON Search');

      expect(results[0].extracted_fields).toEqual({ author: 'Test Author' });
      expect(results[0].metadata_tags).toEqual(['search-tag']);
      expect(results[0].key_concepts).toEqual(['search-concept']);
    });

    it('should handle special characters in query', () => {
      createNode({
        title: 'C++ Programming Guide',
        url: 'https://example.com/cpp',
        source_domain: 'example.com',
      });

      // SQL LIKE should handle basic special chars
      const results = searchNodes('C++');

      expect(results).toHaveLength(1);
    });

    it('should search across multiple fields simultaneously', () => {
      createNode({
        title: 'Unique Title Only',
        url: 'https://example.com/unique',
        source_domain: 'example.com',
        company: 'CommonCompany',
        short_description: 'Common description',
      });
      createNode({
        title: 'Another Title',
        url: 'https://commoncompany.com/product',
        source_domain: 'commoncompany.com',
        short_description: 'Product page for CommonCompany',
      });

      const results = searchNodes('CommonCompany');

      expect(results).toHaveLength(2);
    });

    it('should handle empty query', () => {
      createNode({
        title: 'Test Node',
        url: 'https://example.com/test',
        source_domain: 'example.com',
      });

      // Empty query should match everything (due to %% LIKE pattern)
      const results = searchNodes('');

      expect(results.length).toBeGreaterThan(0);
    });
  });
});
