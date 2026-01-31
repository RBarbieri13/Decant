// ============================================================
// Similarity Computer Service - Tests
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { computeSimilarity, getMetadataWeight, getAllMetadataWeights } from './computer.js';
import { createNode, deleteNode } from '../../database/nodes.js';
import { setNodeMetadata } from '../../database/metadata.js';
import { deleteSimilarityForNode } from '../../database/similarity.js';
import { initializeDatabase } from '../../database/schema.js';

describe('Similarity Computer', () => {
  let nodeA: string;
  let nodeB: string;
  let nodeC: string;

  beforeEach(() => {
    // Ensure database is initialized
    initializeDatabase();

    // Create test nodes
    const resultA = createNode({
      title: 'Node A - AI Platform',
      url: 'https://example.com/a',
      source_domain: 'example.com',
    }) as any;
    nodeA = resultA.id;

    const resultB = createNode({
      title: 'Node B - AI Tool',
      url: 'https://example.com/b',
      source_domain: 'example.com',
    }) as any;
    nodeB = resultB.id;

    const resultC = createNode({
      title: 'Node C - Finance App',
      url: 'https://example.com/c',
      source_domain: 'example.com',
    }) as any;
    nodeC = resultC.id;
  });

  afterEach(() => {
    // Clean up
    if (nodeA) {
      deleteSimilarityForNode(nodeA);
      deleteNode(nodeA);
    }
    if (nodeB) {
      deleteSimilarityForNode(nodeB);
      deleteNode(nodeB);
    }
    if (nodeC) {
      deleteSimilarityForNode(nodeC);
      deleteNode(nodeC);
    }
  });

  describe('computeSimilarity', () => {
    it('should return null when nodes have no metadata', () => {
      const result = computeSimilarity(nodeA, nodeB);
      expect(result).toBeNull();
    });

    it('should return null when nodes have no shared codes', () => {
      // Node A: AI-related codes
      setNodeMetadata(nodeA, [
        { type: 'DOM', code: 'ARTIFICIAL_INTELLIGENCE' },
        { type: 'TEC', code: 'MACHINE_LEARNING' },
      ]);

      // Node C: Finance-related codes
      setNodeMetadata(nodeC, [
        { type: 'DOM', code: 'FINANCE' },
        { type: 'TEC', code: 'BLOCKCHAIN' },
      ]);

      const result = computeSimilarity(nodeA, nodeC);
      expect(result).toBeNull();
    });

    it('should compute weighted Jaccard similarity for nodes with shared codes', () => {
      // Node A: AI codes
      setNodeMetadata(nodeA, [
        { type: 'ORG', code: 'OPENAI' },
        { type: 'DOM', code: 'ARTIFICIAL_INTELLIGENCE' },
        { type: 'TEC', code: 'MACHINE_LEARNING' },
        { type: 'FNC', code: 'TEXT_GENERATION' },
      ]);

      // Node B: Similar AI codes
      setNodeMetadata(nodeB, [
        { type: 'ORG', code: 'OPENAI' },
        { type: 'DOM', code: 'ARTIFICIAL_INTELLIGENCE' },
        { type: 'TEC', code: 'DEEP_LEARNING' },
        { type: 'FNC', code: 'TEXT_GENERATION' },
      ]);

      const result = computeSimilarity(nodeA, nodeB);

      expect(result).not.toBeNull();
      expect(result!.score).toBeGreaterThan(0);
      expect(result!.score).toBeLessThanOrEqual(1);
      expect(result!.sharedCodes).toContain('OPENAI');
      expect(result!.sharedCodes).toContain('ARTIFICIAL_INTELLIGENCE');
      expect(result!.sharedCodes).toContain('TEXT_GENERATION');
      expect(result!.sharedCodes).toHaveLength(3);
      expect(result!.method).toBe('jaccard_weighted');
    });

    it('should apply higher weights to ORG and FNC codes', () => {
      // Node A: High-weight codes
      setNodeMetadata(nodeA, [
        { type: 'ORG', code: 'GOOGLE' },
        { type: 'FNC', code: 'SEARCH' },
      ]);

      // Node B: Same high-weight codes
      setNodeMetadata(nodeB, [
        { type: 'ORG', code: 'GOOGLE' },
        { type: 'FNC', code: 'SEARCH' },
      ]);

      // Node C: Low-weight codes
      setNodeMetadata(nodeC, [
        { type: 'LNG', code: 'ENGLISH' },
        { type: 'PRC', code: 'FREE' },
      ]);

      const resultAB = computeSimilarity(nodeA, nodeB);
      const resultAC = computeSimilarity(nodeA, nodeC);

      // Nodes with high-weight shared codes should have higher similarity
      expect(resultAB).not.toBeNull();
      expect(resultAC).toBeNull(); // No shared codes
    });

    it('should handle identical metadata (perfect similarity)', () => {
      const metadata = [
        { type: 'ORG', code: 'MICROSOFT' },
        { type: 'DOM', code: 'CLOUD_COMPUTING' },
        { type: 'TEC', code: 'AZURE' },
      ] as const;

      setNodeMetadata(nodeA, [...metadata]);
      setNodeMetadata(nodeB, [...metadata]);

      const result = computeSimilarity(nodeA, nodeB);

      expect(result).not.toBeNull();
      expect(result!.score).toBe(1.0); // Perfect similarity
      expect(result!.sharedCodes).toHaveLength(3);
    });

    it('should handle partial overlap correctly', () => {
      setNodeMetadata(nodeA, [
        { type: 'DOM', code: 'DATA_SCIENCE' },
        { type: 'TEC', code: 'PYTHON' },
        { type: 'TEC', code: 'TENSORFLOW' },
      ]);

      setNodeMetadata(nodeB, [
        { type: 'DOM', code: 'DATA_SCIENCE' },
        { type: 'TEC', code: 'PYTHON' },
        { type: 'TEC', code: 'PYTORCH' },
      ]);

      const result = computeSimilarity(nodeA, nodeB);

      expect(result).not.toBeNull();
      expect(result!.score).toBeGreaterThan(0);
      expect(result!.score).toBeLessThan(1.0); // Not perfect
      expect(result!.sharedCodes).toContain('DATA_SCIENCE');
      expect(result!.sharedCodes).toContain('PYTHON');
      expect(result!.sharedCodes).not.toContain('TENSORFLOW');
      expect(result!.sharedCodes).not.toContain('PYTORCH');
    });
  });

  describe('metadata weights', () => {
    it('should return correct weights for different types', () => {
      expect(getMetadataWeight('ORG')).toBe(2.0);
      expect(getMetadataWeight('FNC')).toBe(1.5);
      expect(getMetadataWeight('DOM')).toBe(1.5);
      expect(getMetadataWeight('IND')).toBe(1.5);
      expect(getMetadataWeight('TEC')).toBe(1.0);
      expect(getMetadataWeight('CON')).toBe(1.0);
      expect(getMetadataWeight('AUD')).toBe(1.0);
      expect(getMetadataWeight('PLT')).toBe(1.0);
      expect(getMetadataWeight('PRC')).toBe(0.5);
      expect(getMetadataWeight('LIC')).toBe(0.5);
      expect(getMetadataWeight('LNG')).toBe(0.5);
    });

    it('should return all weights', () => {
      const weights = getAllMetadataWeights();
      expect(Object.keys(weights)).toHaveLength(11);
      expect(weights.ORG).toBe(2.0);
      expect(weights.PRC).toBe(0.5);
    });
  });
});
