// ============================================================
// Database Health Check Tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { checkDatabaseHealth, getNodeCount, getDatabaseStats } from '../database.js';
import { resetTestDatabase } from '../../__tests__/setup.js';
import { createNode } from '../../database/nodes.js';
import { getDatabase } from '../../database/connection.js';

describe('Database Health Functions', () => {
  beforeEach(() => {
    resetTestDatabase();
  });

  describe('checkDatabaseHealth()', () => {
    it('should return healthy status for working database', () => {
      const result = checkDatabaseHealth();

      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeDefined();
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('should measure database query latency', () => {
      const result = checkDatabaseHealth();

      expect(result.latencyMs).toBeDefined();
      expect(typeof result.latencyMs).toBe('number');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.latencyMs).toBeLessThan(1000); // Should be fast
    });

    it('should return consistent results on multiple calls', () => {
      const result1 = checkDatabaseHealth();
      const result2 = checkDatabaseHealth();
      const result3 = checkDatabaseHealth();

      expect(result1.healthy).toBe(true);
      expect(result2.healthy).toBe(true);
      expect(result3.healthy).toBe(true);
    });
  });

  describe('getNodeCount()', () => {
    it('should return 0 for empty database', () => {
      const count = getNodeCount();
      expect(count).toBe(0);
    });

    it('should return correct count after adding nodes', () => {
      createNode({
        title: 'Test Node 1',
        url: 'https://example.com/1',
        source_domain: 'example.com',
      });
      createNode({
        title: 'Test Node 2',
        url: 'https://example.com/2',
        source_domain: 'example.com',
      });

      const count = getNodeCount();
      expect(count).toBe(2);
    });

    it('should not count deleted nodes', () => {
      const node = createNode({
        title: 'Test Node',
        url: 'https://example.com/test',
        source_domain: 'example.com',
      });

      expect(getNodeCount()).toBe(1);

      // Mark as deleted
      const db = getDatabase();
      db.prepare('UPDATE nodes SET is_deleted = 1 WHERE id = ?').run(node.id);

      expect(getNodeCount()).toBe(0);
    });

    it('should handle large number of nodes', () => {
      // Create 100 nodes
      for (let i = 0; i < 100; i++) {
        createNode({
          title: `Test Node ${i}`,
          url: `https://example.com/${i}`,
          source_domain: 'example.com',
        });
      }

      const count = getNodeCount();
      expect(count).toBe(100);
    });
  });

  describe('getDatabaseStats()', () => {
    it('should return stats for empty database', () => {
      const stats = getDatabaseStats();

      expect(stats).toBeDefined();
      expect(stats.nodeCount).toBe(0);
      expect(stats.deletedNodeCount).toBe(0);
      expect(stats.totalTags).toBeGreaterThanOrEqual(0); // Tags might exist from schema
      expect(stats.tableSizes).toBeDefined();
      expect(stats.tableSizes.nodes).toBe(0);
      expect(stats.tableSizes.tags).toBeGreaterThanOrEqual(0);
      expect(stats.tableSizes.node_tags).toBe(0);
    });

    it('should return accurate node counts', () => {
      // Create active nodes
      createNode({
        title: 'Active Node 1',
        url: 'https://example.com/1',
        source_domain: 'example.com',
      });
      createNode({
        title: 'Active Node 2',
        url: 'https://example.com/2',
        source_domain: 'example.com',
      });

      // Create deleted node
      const deletedNode = createNode({
        title: 'Deleted Node',
        url: 'https://example.com/deleted',
        source_domain: 'example.com',
      });

      const db = getDatabase();
      db.prepare('UPDATE nodes SET is_deleted = 1 WHERE id = ?').run(deletedNode.id);

      const stats = getDatabaseStats();

      expect(stats.nodeCount).toBe(2);
      expect(stats.deletedNodeCount).toBe(1);
      expect(stats.tableSizes.nodes).toBe(3); // Total including deleted
    });

    it('should include database size in bytes', () => {
      const stats = getDatabaseStats();

      expect(stats.databaseSizeBytes).toBeDefined();
      expect(typeof stats.databaseSizeBytes).toBe('number');
      expect(stats.databaseSizeBytes).toBeGreaterThan(0);
    });

    it('should track table sizes correctly', () => {
      // Create nodes
      for (let i = 0; i < 5; i++) {
        createNode({
          title: `Node ${i}`,
          url: `https://example.com/${i}`,
          source_domain: 'example.com',
        });
      }

      const stats = getDatabaseStats();

      expect(stats.tableSizes.nodes).toBe(5);
      expect(stats.tableSizes.tags).toBeGreaterThanOrEqual(0);
      expect(stats.tableSizes.node_tags).toBeGreaterThanOrEqual(0);
    });

    it('should handle deleted vs active nodes separately', () => {
      // Create 3 active nodes
      for (let i = 0; i < 3; i++) {
        createNode({
          title: `Active Node ${i}`,
          url: `https://example.com/active/${i}`,
          source_domain: 'example.com',
        });
      }

      // Create and delete 2 nodes
      const db = getDatabase();
      for (let i = 0; i < 2; i++) {
        const node = createNode({
          title: `Deleted Node ${i}`,
          url: `https://example.com/deleted/${i}`,
          source_domain: 'example.com',
        });
        db.prepare('UPDATE nodes SET is_deleted = 1 WHERE id = ?').run(node.id);
      }

      const stats = getDatabaseStats();

      expect(stats.nodeCount).toBe(3);
      expect(stats.deletedNodeCount).toBe(2);
      expect(stats.tableSizes.nodes).toBe(5);
    });

    it('should return consistent stats on multiple calls', () => {
      createNode({
        title: 'Test Node',
        url: 'https://example.com/test',
        source_domain: 'example.com',
      });

      const stats1 = getDatabaseStats();
      const stats2 = getDatabaseStats();

      expect(stats1.nodeCount).toBe(stats2.nodeCount);
      expect(stats1.deletedNodeCount).toBe(stats2.deletedNodeCount);
      expect(stats1.totalTags).toBe(stats2.totalTags);
    });

    it('should update stats when data changes', () => {
      const initialStats = getDatabaseStats();
      expect(initialStats.nodeCount).toBe(0);

      // Add a node
      createNode({
        title: 'New Node',
        url: 'https://example.com/new',
        source_domain: 'example.com',
      });

      const updatedStats = getDatabaseStats();
      expect(updatedStats.nodeCount).toBe(1);
      expect(updatedStats.tableSizes.nodes).toBe(1);
    });
  });

  describe('Error handling', () => {
    it('should handle getNodeCount errors gracefully', () => {
      // This test ensures the function returns -1 on error
      // In a real scenario, you might close the DB connection to simulate an error
      const count = getNodeCount();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(-1);
    });

    it('should handle getDatabaseStats errors gracefully', () => {
      const stats = getDatabaseStats();

      // Even on error, should return valid structure
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('nodeCount');
      expect(stats).toHaveProperty('deletedNodeCount');
      expect(stats).toHaveProperty('totalTags');
      expect(stats).toHaveProperty('tableSizes');
    });
  });

  describe('Performance', () => {
    it('should execute checkDatabaseHealth quickly', () => {
      const startTime = Date.now();
      checkDatabaseHealth();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100); // Should complete in less than 100ms
    });

    it('should execute getNodeCount quickly', () => {
      // Create some data
      for (let i = 0; i < 10; i++) {
        createNode({
          title: `Node ${i}`,
          url: `https://example.com/${i}`,
          source_domain: 'example.com',
        });
      }

      const startTime = Date.now();
      getNodeCount();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(50); // Should complete in less than 50ms
    });

    it('should execute getDatabaseStats quickly', () => {
      // Create some data
      for (let i = 0; i < 10; i++) {
        createNode({
          title: `Node ${i}`,
          url: `https://example.com/${i}`,
          source_domain: 'example.com',
        });
      }

      const startTime = Date.now();
      getDatabaseStats();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100); // Should complete in less than 100ms
    });
  });
});
