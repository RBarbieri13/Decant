// ============================================================
// Similarity Operations Tests
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrations } from './migrations/runner.js';
import {
  normalizeNodePair,
  getSimilarNodes,
  setSimilarity,
  deleteSimilarityForNode,
  getAverageSimilarity,
  getSimilarity,
  batchSetSimilarity,
  getAllSimilarities,
  countSimilarities,
  getSimilarityStats,
  findCommonSimilarNodes,
} from './similarity.js';

describe('Similarity Operations', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Create in-memory database for tests
    db = new Database(':memory:');

    // Run migrations to set up schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Apply all migrations
    for (const migration of migrations) {
      migration.up(db);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migration.name);
    }

    // Create test nodes
    db.prepare(`
      INSERT INTO nodes (id, title, url, source_domain)
      VALUES
        ('node-1', 'Test Node 1', 'https://example.com/1', 'example.com'),
        ('node-2', 'Test Node 2', 'https://example.com/2', 'example.com'),
        ('node-3', 'Test Node 3', 'https://example.com/3', 'example.com'),
        ('node-4', 'Test Node 4', 'https://example.com/4', 'example.com'),
        ('node-5', 'Test Node 5', 'https://example.com/5', 'example.com')
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  describe('normalizeNodePair', () => {
    it('should return nodes in sorted order', () => {
      const [a, b] = normalizeNodePair('node-2', 'node-1');
      expect(a).toBe('node-1');
      expect(b).toBe('node-2');
    });

    it('should maintain order if already sorted', () => {
      const [a, b] = normalizeNodePair('node-1', 'node-2');
      expect(a).toBe('node-1');
      expect(b).toBe('node-2');
    });
  });

  describe('setSimilarity', () => {
    it('should create a new similarity record', () => {
      const result = setSimilarity('node-1', 'node-2', 0.85, 'cosine');

      expect(result.node_a_id).toBe('node-1');
      expect(result.node_b_id).toBe('node-2');
      expect(result.similarity_score).toBe(0.85);
      expect(result.computation_method).toBe('cosine');
    });

    it('should normalize node order', () => {
      const result = setSimilarity('node-2', 'node-1', 0.85);

      expect(result.node_a_id).toBe('node-1');
      expect(result.node_b_id).toBe('node-2');
    });

    it('should update existing similarity record', () => {
      setSimilarity('node-1', 'node-2', 0.5);
      const updated = setSimilarity('node-1', 'node-2', 0.9);

      expect(updated.similarity_score).toBe(0.9);
    });

    it('should throw error for invalid score', () => {
      expect(() => setSimilarity('node-1', 'node-2', 1.5)).toThrow();
      expect(() => setSimilarity('node-1', 'node-2', -0.1)).toThrow();
    });

    it('should throw error for self-similarity', () => {
      expect(() => setSimilarity('node-1', 'node-1', 0.5)).toThrow();
    });
  });

  describe('getSimilarNodes', () => {
    beforeEach(() => {
      // Set up test similarities
      setSimilarity('node-1', 'node-2', 0.9);
      setSimilarity('node-1', 'node-3', 0.7);
      setSimilarity('node-1', 'node-4', 0.5);
      setSimilarity('node-2', 'node-3', 0.8);
    });

    it('should get similar nodes sorted by score', () => {
      const similar = getSimilarNodes('node-1');

      expect(similar).toHaveLength(3);
      expect(similar[0].node_id).toBe('node-2');
      expect(similar[0].similarity_score).toBe(0.9);
      expect(similar[1].node_id).toBe('node-3');
      expect(similar[1].similarity_score).toBe(0.7);
    });

    it('should respect limit parameter', () => {
      const similar = getSimilarNodes('node-1', 2);
      expect(similar).toHaveLength(2);
    });

    it('should work for both sides of relationship', () => {
      const similar = getSimilarNodes('node-2');

      const nodeIds = similar.map(s => s.node_id);
      expect(nodeIds).toContain('node-1');
      expect(nodeIds).toContain('node-3');
    });

    it('should return empty array if no similarities exist', () => {
      const similar = getSimilarNodes('node-5');
      expect(similar).toHaveLength(0);
    });
  });

  describe('getSimilarity', () => {
    it('should retrieve specific similarity record', () => {
      setSimilarity('node-1', 'node-2', 0.85);
      const record = getSimilarity('node-1', 'node-2');

      expect(record).not.toBeNull();
      expect(record?.similarity_score).toBe(0.85);
    });

    it('should work regardless of node order', () => {
      setSimilarity('node-1', 'node-2', 0.85);
      const record = getSimilarity('node-2', 'node-1');

      expect(record).not.toBeNull();
      expect(record?.similarity_score).toBe(0.85);
    });

    it('should return null if no record exists', () => {
      const record = getSimilarity('node-1', 'node-5');
      expect(record).toBeNull();
    });
  });

  describe('deleteSimilarityForNode', () => {
    beforeEach(() => {
      setSimilarity('node-1', 'node-2', 0.9);
      setSimilarity('node-1', 'node-3', 0.8);
      setSimilarity('node-2', 'node-3', 0.7);
    });

    it('should delete all similarities for a node', () => {
      const deleted = deleteSimilarityForNode('node-1');
      expect(deleted).toBe(2); // node-1 appears in 2 relationships

      const similar = getSimilarNodes('node-1');
      expect(similar).toHaveLength(0);
    });

    it('should preserve other similarities', () => {
      deleteSimilarityForNode('node-1');

      // node-2 <-> node-3 should still exist
      const record = getSimilarity('node-2', 'node-3');
      expect(record).not.toBeNull();
    });
  });

  describe('getAverageSimilarity', () => {
    beforeEach(() => {
      setSimilarity('node-1', 'node-2', 0.9);
      setSimilarity('node-1', 'node-3', 0.7);
      setSimilarity('node-1', 'node-4', 0.8);
    });

    it('should calculate average similarity score', () => {
      const avg = getAverageSimilarity('node-1');
      expect(avg).toBeCloseTo(0.8, 2); // (0.9 + 0.7 + 0.8) / 3 = 0.8
    });

    it('should return null if no similarities exist', () => {
      const avg = getAverageSimilarity('node-5');
      expect(avg).toBeNull();
    });
  });

  describe('batchSetSimilarity', () => {
    it('should insert multiple similarities in one transaction', () => {
      const count = batchSetSimilarity([
        { nodeAId: 'node-1', nodeBId: 'node-2', score: 0.9 },
        { nodeAId: 'node-1', nodeBId: 'node-3', score: 0.8 },
        { nodeAId: 'node-2', nodeBId: 'node-3', score: 0.7 },
      ]);

      expect(count).toBe(3);
      expect(countSimilarities()).toBe(3);
    });

    it('should skip invalid scores', () => {
      const count = batchSetSimilarity([
        { nodeAId: 'node-1', nodeBId: 'node-2', score: 0.9 },
        { nodeAId: 'node-1', nodeBId: 'node-3', score: 1.5 }, // Invalid
        { nodeAId: 'node-2', nodeBId: 'node-3', score: 0.7 },
      ]);

      expect(count).toBe(2);
    });

    it('should skip self-similarities', () => {
      const count = batchSetSimilarity([
        { nodeAId: 'node-1', nodeBId: 'node-2', score: 0.9 },
        { nodeAId: 'node-1', nodeBId: 'node-1', score: 1.0 }, // Self
      ]);

      expect(count).toBe(1);
    });
  });

  describe('getSimilarityStats', () => {
    it('should return correct statistics', () => {
      batchSetSimilarity([
        { nodeAId: 'node-1', nodeBId: 'node-2', score: 0.9 },
        { nodeAId: 'node-1', nodeBId: 'node-3', score: 0.5 },
        { nodeAId: 'node-2', nodeBId: 'node-3', score: 0.7 },
      ]);

      const stats = getSimilarityStats();
      expect(stats.count).toBe(3);
      expect(stats.min_score).toBe(0.5);
      expect(stats.max_score).toBe(0.9);
      expect(stats.avg_score).toBeCloseTo(0.7, 2);
    });

    it('should return null values for empty database', () => {
      const stats = getSimilarityStats();
      expect(stats.count).toBe(0);
      expect(stats.min_score).toBeNull();
      expect(stats.max_score).toBeNull();
      expect(stats.avg_score).toBeNull();
    });
  });

  describe('findCommonSimilarNodes', () => {
    beforeEach(() => {
      // Set up a network where node-4 is similar to both node-1 and node-2
      setSimilarity('node-1', 'node-4', 0.8);
      setSimilarity('node-2', 'node-4', 0.7);
      setSimilarity('node-1', 'node-3', 0.9);
      setSimilarity('node-2', 'node-5', 0.6);
    });

    it('should find nodes similar to multiple targets', () => {
      const common = findCommonSimilarNodes(['node-1', 'node-2']);

      // node-4 should be returned as it's similar to both node-1 and node-2
      expect(common).toHaveLength(1);
      expect(common[0].node_id).toBe('node-4');
      expect(common[0].match_count).toBe(2);
      expect(common[0].total_score).toBeCloseTo(1.5, 2); // 0.8 + 0.7
    });

    it('should respect minimum score threshold', () => {
      const common = findCommonSimilarNodes(['node-1', 'node-2'], 0.75);

      // node-4's similarity to node-2 is 0.7, below threshold
      expect(common).toHaveLength(0);
    });

    it('should respect limit parameter', () => {
      // Add more similarities
      setSimilarity('node-1', 'node-5', 0.6);
      setSimilarity('node-2', 'node-3', 0.6);

      const common = findCommonSimilarNodes(['node-1', 'node-2'], 0.5, 1);
      expect(common).toHaveLength(1);
    });
  });

  describe('getAllSimilarities', () => {
    it('should return all similarity records', () => {
      batchSetSimilarity([
        { nodeAId: 'node-1', nodeBId: 'node-2', score: 0.9 },
        { nodeAId: 'node-1', nodeBId: 'node-3', score: 0.8 },
        { nodeAId: 'node-2', nodeBId: 'node-3', score: 0.7 },
      ]);

      const all = getAllSimilarities();
      expect(all).toHaveLength(3);
    });

    it('should respect limit parameter', () => {
      batchSetSimilarity([
        { nodeAId: 'node-1', nodeBId: 'node-2', score: 0.9 },
        { nodeAId: 'node-1', nodeBId: 'node-3', score: 0.8 },
        { nodeAId: 'node-2', nodeBId: 'node-3', score: 0.7 },
      ]);

      const limited = getAllSimilarities(2);
      expect(limited).toHaveLength(2);
    });
  });
});
