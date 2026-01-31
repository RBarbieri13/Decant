// ============================================================
// Node Similarity Operations
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './connection.js';
import { withTransaction } from './transaction.js';

/**
 * Represents a similarity relationship between two nodes
 */
export interface SimilarityRecord {
  id: string;
  node_a_id: string;
  node_b_id: string;
  similarity_score: number;
  computation_method: string;
  computed_at: string;
}

/**
 * Represents a similar node with metadata
 */
export interface SimilarNode {
  node_id: string;
  similarity_score: number;
  computation_method: string;
  computed_at: string;
}

/**
 * Valid computation methods for similarity
 */
export type ComputationMethod = 'jaccard_weighted' | 'cosine' | 'tfidf' | 'manual';

/**
 * Normalizes a node pair to ensure consistent ordering.
 * Always returns (smaller_id, larger_id) to prevent duplicate entries.
 *
 * @param nodeAId - First node ID
 * @param nodeBId - Second node ID
 * @returns Tuple with IDs in sorted order [smaller_id, larger_id]
 */
export function normalizeNodePair(nodeAId: string, nodeBId: string): [string, string] {
  return nodeAId < nodeBId ? [nodeAId, nodeBId] : [nodeBId, nodeAId];
}

/**
 * Get similar nodes for a given node ID, sorted by similarity score descending.
 *
 * @param nodeId - The node to find similar items for
 * @param limit - Maximum number of similar nodes to return (default: 10)
 * @returns Array of similar nodes with scores
 *
 * @example
 * ```typescript
 * const similar = getSimilarNodes('node-123', 5);
 * for (const item of similar) {
 *   console.log(`Similar node: ${item.node_id}, score: ${item.similarity_score}`);
 * }
 * ```
 */
export function getSimilarNodes(nodeId: string, limit: number = 10): SimilarNode[] {
  const db = getDatabase();

  // Query both directions since we store with node_a_id < node_b_id
  // UNION to combine results where nodeId appears as either node_a or node_b
  const results = db.prepare(`
    SELECT
      node_b_id as node_id,
      similarity_score,
      computation_method,
      computed_at
    FROM node_similarity
    WHERE node_a_id = ?

    UNION ALL

    SELECT
      node_a_id as node_id,
      similarity_score,
      computation_method,
      computed_at
    FROM node_similarity
    WHERE node_b_id = ?

    ORDER BY similarity_score DESC
    LIMIT ?
  `).all(nodeId, nodeId, limit) as SimilarNode[];

  return results;
}

/**
 * Set or update the similarity score between two nodes.
 * Uses UPSERT logic (INSERT OR REPLACE) to handle both new and existing records.
 *
 * @param nodeAId - First node ID
 * @param nodeBId - Second node ID
 * @param score - Similarity score (0.0 to 1.0)
 * @param method - Computation method used (default: 'jaccard_weighted')
 * @returns The created/updated similarity record
 *
 * @throws Error if score is out of valid range [0.0, 1.0]
 *
 * @example
 * ```typescript
 * setSimilarity('node-123', 'node-456', 0.85, 'cosine');
 * ```
 */
export function setSimilarity(
  nodeAId: string,
  nodeBId: string,
  score: number,
  method: ComputationMethod = 'jaccard_weighted'
): SimilarityRecord {
  if (score < 0 || score > 1) {
    throw new Error(`Similarity score must be between 0.0 and 1.0, got ${score}`);
  }

  if (nodeAId === nodeBId) {
    throw new Error('Cannot set similarity between a node and itself');
  }

  const db = getDatabase();
  const [normalizedA, normalizedB] = normalizeNodePair(nodeAId, nodeBId);

  // Use UPSERT pattern with INSERT OR REPLACE
  // First, try to get existing record to preserve ID
  const existing = db.prepare(`
    SELECT id FROM node_similarity
    WHERE node_a_id = ? AND node_b_id = ?
  `).get(normalizedA, normalizedB) as { id: string } | undefined;

  const id = existing?.id || uuidv4();

  return withTransaction(() => {
    db.prepare(`
      INSERT OR REPLACE INTO node_similarity (
        id, node_a_id, node_b_id, similarity_score, computation_method, computed_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(id, normalizedA, normalizedB, score, method);

    const record = db.prepare(`
      SELECT * FROM node_similarity WHERE id = ?
    `).get(id) as SimilarityRecord;

    return record;
  });
}

/**
 * Delete all similarity records for a given node.
 * This removes the node from both sides of similarity pairs.
 *
 * @param nodeId - The node ID to remove similarity records for
 * @returns Number of records deleted
 *
 * @example
 * ```typescript
 * const deleted = deleteSimilarityForNode('node-123');
 * console.log(`Removed ${deleted} similarity records`);
 * ```
 */
export function deleteSimilarityForNode(nodeId: string): number {
  const db = getDatabase();

  return withTransaction(() => {
    // Delete where node is either node_a or node_b
    const result = db.prepare(`
      DELETE FROM node_similarity
      WHERE node_a_id = ? OR node_b_id = ?
    `).run(nodeId, nodeId);

    return result.changes;
  });
}

/**
 * Get the average similarity score for a node across all its similarity relationships.
 *
 * @param nodeId - The node ID to calculate average for
 * @returns Average similarity score, or null if no similarities exist
 *
 * @example
 * ```typescript
 * const avg = getAverageSimilarity('node-123');
 * if (avg !== null) {
 *   console.log(`Average similarity: ${avg.toFixed(3)}`);
 * }
 * ```
 */
export function getAverageSimilarity(nodeId: string): number | null {
  const db = getDatabase();

  // Calculate average across both directions
  const result = db.prepare(`
    SELECT AVG(similarity_score) as avg_score
    FROM (
      SELECT similarity_score FROM node_similarity WHERE node_a_id = ?
      UNION ALL
      SELECT similarity_score FROM node_similarity WHERE node_b_id = ?
    )
  `).get(nodeId, nodeId) as { avg_score: number | null };

  return result.avg_score;
}

/**
 * Get a specific similarity record between two nodes.
 *
 * @param nodeAId - First node ID
 * @param nodeBId - Second node ID
 * @returns Similarity record if it exists, null otherwise
 */
export function getSimilarity(nodeAId: string, nodeBId: string): SimilarityRecord | null {
  const db = getDatabase();
  const [normalizedA, normalizedB] = normalizeNodePair(nodeAId, nodeBId);

  const record = db.prepare(`
    SELECT * FROM node_similarity
    WHERE node_a_id = ? AND node_b_id = ?
  `).get(normalizedA, normalizedB) as SimilarityRecord | undefined;

  return record || null;
}

/**
 * Batch set multiple similarity relationships in a single transaction.
 * Useful for bulk updates during similarity computation.
 *
 * @param similarities - Array of similarity data to insert/update
 * @returns Number of records successfully created/updated
 *
 * @example
 * ```typescript
 * const similarities = [
 *   { nodeAId: 'node-1', nodeBId: 'node-2', score: 0.85, method: 'cosine' },
 *   { nodeAId: 'node-1', nodeBId: 'node-3', score: 0.72, method: 'cosine' },
 * ];
 * const count = batchSetSimilarity(similarities);
 * console.log(`Updated ${count} similarity records`);
 * ```
 */
export function batchSetSimilarity(
  similarities: Array<{
    nodeAId: string;
    nodeBId: string;
    score: number;
    method?: ComputationMethod;
  }>
): number {
  const db = getDatabase();

  return withTransaction(() => {
    let count = 0;

    for (const sim of similarities) {
      if (sim.score < 0 || sim.score > 1) {
        continue; // Skip invalid scores
      }

      if (sim.nodeAId === sim.nodeBId) {
        continue; // Skip self-similarity
      }

      const [normalizedA, normalizedB] = normalizeNodePair(sim.nodeAId, sim.nodeBId);
      const method = sim.method || 'jaccard_weighted';

      // Check for existing record
      const existing = db.prepare(`
        SELECT id FROM node_similarity
        WHERE node_a_id = ? AND node_b_id = ?
      `).get(normalizedA, normalizedB) as { id: string } | undefined;

      const id = existing?.id || uuidv4();

      db.prepare(`
        INSERT OR REPLACE INTO node_similarity (
          id, node_a_id, node_b_id, similarity_score, computation_method, computed_at
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(id, normalizedA, normalizedB, sim.score, method);

      count++;
    }

    return count;
  });
}

/**
 * Get all similarity records in the database.
 * Use with caution on large datasets.
 *
 * @param limit - Maximum number of records to return (default: 1000)
 * @returns Array of all similarity records
 */
export function getAllSimilarities(limit: number = 1000): SimilarityRecord[] {
  const db = getDatabase();

  const records = db.prepare(`
    SELECT * FROM node_similarity
    ORDER BY similarity_score DESC
    LIMIT ?
  `).all(limit) as SimilarityRecord[];

  return records;
}

/**
 * Count total number of similarity records in the database.
 *
 * @returns Total count of similarity records
 */
export function countSimilarities(): number {
  const db = getDatabase();

  const result = db.prepare(`
    SELECT COUNT(*) as count FROM node_similarity
  `).get() as { count: number };

  return result.count;
}

/**
 * Get statistics about similarity data in the database.
 *
 * @returns Object with min, max, and average similarity scores
 */
export function getSimilarityStats(): {
  count: number;
  min_score: number | null;
  max_score: number | null;
  avg_score: number | null;
} {
  const db = getDatabase();

  const stats = db.prepare(`
    SELECT
      COUNT(*) as count,
      MIN(similarity_score) as min_score,
      MAX(similarity_score) as max_score,
      AVG(similarity_score) as avg_score
    FROM node_similarity
  `).get() as {
    count: number;
    min_score: number | null;
    max_score: number | null;
    avg_score: number | null;
  };

  return stats;
}

/**
 * Find nodes that are similar to multiple target nodes.
 * Useful for finding items related to a collection.
 *
 * @param nodeIds - Array of node IDs to find common similar items for
 * @param minScore - Minimum similarity score threshold (default: 0.5)
 * @param limit - Maximum results to return (default: 10)
 * @returns Nodes similar to multiple targets, sorted by total similarity
 */
export function findCommonSimilarNodes(
  nodeIds: string[],
  minScore: number = 0.5,
  limit: number = 10
): Array<{ node_id: string; total_score: number; match_count: number }> {
  if (nodeIds.length === 0) {
    return [];
  }

  const db = getDatabase();
  const placeholders = nodeIds.map(() => '?').join(', ');

  // Find nodes that appear as similar to multiple target nodes
  const results = db.prepare(`
    SELECT
      CASE
        WHEN node_a_id IN (${placeholders}) THEN node_b_id
        ELSE node_a_id
      END as node_id,
      SUM(similarity_score) as total_score,
      COUNT(*) as match_count
    FROM node_similarity
    WHERE
      (node_a_id IN (${placeholders}) OR node_b_id IN (${placeholders}))
      AND similarity_score >= ?
      AND CASE
        WHEN node_a_id IN (${placeholders}) THEN node_b_id
        ELSE node_a_id
      END NOT IN (${placeholders})
    GROUP BY node_id
    ORDER BY total_score DESC, match_count DESC
    LIMIT ?
  `).all(
    ...nodeIds,
    ...nodeIds,
    ...nodeIds,
    minScore,
    ...nodeIds,
    ...nodeIds,
    limit
  ) as Array<{ node_id: string; total_score: number; match_count: number }>;

  return results;
}
