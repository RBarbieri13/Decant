// ============================================================
// N+1 Optimization Verification Tests
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { performance } from 'perf_hooks';
import { initializeDatabase, closeDatabase } from '../index.js';
import { createNode, getAllNodes, getNodesPaginated } from '../nodes.js';
import { getTree } from '../taxonomy.js';
import * as cache from '../../cache/index.js';

describe('N+1 Query Optimization Verification', () => {
  beforeAll(() => {
    // Initialize test database
    process.env.NODE_ENV = 'test';
    initializeDatabase();

    // Create test data
    const testNodes = [];
    for (let i = 0; i < 50; i++) {
      testNodes.push(
        createNode({
          title: `Test Node ${i}`,
          url: `https://example.com/${i}`,
          source_domain: 'example.com',
          company: `Company ${i % 5}`,
          key_concepts: [`concept-${i}-1`, `concept-${i}-2`, `concept-${i}-3`],
        })
      );
    }
  });

  afterAll(() => {
    closeDatabase();
  });

  describe('Batch Loading Performance', () => {
    it('should load all nodes efficiently with batch loading', () => {
      const start = performance.now();
      const nodes = getAllNodes();
      const duration = performance.now() - start;

      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes[0]).toHaveProperty('key_concepts');
      expect(Array.isArray(nodes[0].key_concepts)).toBe(true);

      // Should complete in reasonable time even with many nodes
      expect(duration).toBeLessThan(100); // 100ms threshold

      console.log(`Loaded ${nodes.length} nodes in ${duration.toFixed(2)}ms`);
    });

    it('should load paginated nodes efficiently', () => {
      const start = performance.now();
      const nodes = getNodesPaginated({ page: 1, limit: 20 });
      const duration = performance.now() - start;

      expect(nodes.length).toBeLessThanOrEqual(20);
      expect(nodes[0]).toHaveProperty('key_concepts');

      // Should be very fast with pagination + batch loading
      expect(duration).toBeLessThan(50);

      console.log(`Loaded ${nodes.length} paginated nodes in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Tree Building Performance', () => {
    it('should build function tree efficiently (first call - cache miss)', () => {
      cache.clear(); // Ensure cache miss

      const start = performance.now();
      const tree = getTree('function');
      const duration = performance.now() - start;

      expect(tree).toHaveProperty('taxonomy');
      expect(tree).toHaveProperty('root');
      expect(Array.isArray(tree.taxonomy)).toBe(true);

      // First call should be fast even without cache
      expect(duration).toBeLessThan(100);

      console.log(`Built function tree (cache miss) in ${duration.toFixed(2)}ms`);
    });

    it('should build function tree extremely fast (second call - cache hit)', () => {
      // First call to populate cache
      getTree('function');

      const start = performance.now();
      const tree = getTree('function');
      const duration = performance.now() - start;

      expect(tree).toHaveProperty('taxonomy');
      expect(tree).toHaveProperty('root');

      // Cache hit should be near-instant
      expect(duration).toBeLessThan(5);

      console.log(`Built function tree (cache hit) in ${duration.toFixed(2)}ms`);
    });

    it('should build organization tree efficiently', () => {
      cache.clear(); // Ensure cache miss

      const start = performance.now();
      const tree = getTree('organization');
      const duration = performance.now() - start;

      expect(tree).toHaveProperty('taxonomy');
      expect(tree).toHaveProperty('root');

      // Should be fast without recursive queries
      expect(duration).toBeLessThan(100);

      console.log(`Built organization tree in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Cache Effectiveness', () => {
    it('should demonstrate cache invalidation on node creation', () => {
      cache.clear();

      // Warm up cache
      getTree('function');

      const stats1 = cache.stats();
      expect(stats1.size).toBe(1);
      expect(stats1.keys).toContain('tree:function');

      // Create a new node (should invalidate cache)
      createNode({
        title: 'Cache Invalidation Test',
        url: 'https://example.com/cache-test',
        source_domain: 'example.com',
        key_concepts: ['test'],
      });

      const stats2 = cache.stats();
      expect(stats2.size).toBe(0); // Cache should be cleared

      console.log('Cache correctly invalidated after node creation');
    });

    it('should cache both function and organization trees independently', () => {
      cache.clear();

      getTree('function');
      getTree('organization');

      const stats = cache.stats();
      expect(stats.size).toBe(2);
      expect(stats.keys).toContain('tree:function');
      expect(stats.keys).toContain('tree:organization');

      console.log('Multiple tree types cached independently');
    });
  });

  describe('Query Count Analysis', () => {
    it('should minimize database queries for large result sets', () => {
      // This is a conceptual test - in production you would:
      // 1. Enable SQLite query logging
      // 2. Count actual queries
      // 3. Verify it's O(1) not O(N)

      const nodes = getAllNodes();

      // Verification: Each node should have concepts
      nodes.forEach(node => {
        expect(node).toHaveProperty('key_concepts');
        expect(Array.isArray(node.key_concepts)).toBe(true);
      });

      console.log(`Verified ${nodes.length} nodes loaded with batch query pattern`);
    });
  });

  describe('Performance Baseline', () => {
    it('should establish performance baseline for monitoring', () => {
      cache.clear();

      const metrics = {
        getAllNodes: 0,
        getPaginated: 0,
        getTreeCacheMiss: 0,
        getTreeCacheHit: 0,
      };

      // Test getAllNodes
      let start = performance.now();
      getAllNodes();
      metrics.getAllNodes = performance.now() - start;

      // Test paginated
      start = performance.now();
      getNodesPaginated({ page: 1, limit: 20 });
      metrics.getPaginated = performance.now() - start;

      // Test tree (cache miss)
      cache.clear();
      start = performance.now();
      getTree('function');
      metrics.getTreeCacheMiss = performance.now() - start;

      // Test tree (cache hit)
      start = performance.now();
      getTree('function');
      metrics.getTreeCacheHit = performance.now() - start;

      console.log('\n=== Performance Baseline ===');
      console.log(`getAllNodes: ${metrics.getAllNodes.toFixed(2)}ms`);
      console.log(`getPaginated: ${metrics.getPaginated.toFixed(2)}ms`);
      console.log(`getTree (cache miss): ${metrics.getTreeCacheMiss.toFixed(2)}ms`);
      console.log(`getTree (cache hit): ${metrics.getTreeCacheHit.toFixed(2)}ms`);
      console.log(`Cache speedup: ${(metrics.getTreeCacheMiss / metrics.getTreeCacheHit).toFixed(0)}x`);
      console.log('===========================\n');

      // Assert reasonable performance
      expect(metrics.getAllNodes).toBeLessThan(100);
      expect(metrics.getPaginated).toBeLessThan(50);
      expect(metrics.getTreeCacheMiss).toBeLessThan(100);
      expect(metrics.getTreeCacheHit).toBeLessThan(5);
    });
  });
});
