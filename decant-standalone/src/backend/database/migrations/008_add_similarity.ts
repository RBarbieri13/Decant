// ============================================================
// Migration: 008_add_similarity
// Adds node similarity tracking table and indexes
// for finding similar/related items
// ============================================================

import type Database from 'better-sqlite3';
import type { Migration } from './types.js';

export const name = '008_add_similarity';

/**
 * Node Similarity Table
 *
 * Tracks similarity relationships between nodes.
 * Uses symmetric storage (node_a_id < node_b_id) to avoid duplicates.
 *
 * Similarity scores range from 0.0 to 1.0 where:
 * - 0.0 = completely dissimilar
 * - 1.0 = identical
 *
 * Computation methods:
 * - jaccard_weighted: Weighted Jaccard similarity (default)
 * - cosine: Cosine similarity
 * - tfidf: TF-IDF based similarity
 * - manual: Manually set by user
 */

export function up(db: Database.Database): void {
  // Create node_similarity table
  db.exec(`
    CREATE TABLE node_similarity (
      id TEXT PRIMARY KEY,
      node_a_id TEXT NOT NULL,
      node_b_id TEXT NOT NULL,
      similarity_score REAL NOT NULL CHECK(similarity_score >= 0.0 AND similarity_score <= 1.0),
      computation_method TEXT NOT NULL DEFAULT 'jaccard_weighted',
      computed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (node_a_id) REFERENCES nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (node_b_id) REFERENCES nodes(id) ON DELETE CASCADE,
      UNIQUE(node_a_id, node_b_id),
      CHECK(node_a_id < node_b_id)
    );
  `);

  // Index for finding similar nodes for node_a
  db.exec(`
    CREATE INDEX idx_similarity_node_a ON node_similarity(node_a_id);
  `);

  // Index for finding similar nodes for node_b
  db.exec(`
    CREATE INDEX idx_similarity_node_b ON node_similarity(node_b_id);
  `);

  // Index for finding top similar items (sorted by score descending)
  db.exec(`
    CREATE INDEX idx_similarity_score ON node_similarity(similarity_score DESC);
  `);

  // Composite index for efficient queries on node_a with score ordering
  db.exec(`
    CREATE INDEX idx_similarity_node_a_score ON node_similarity(node_a_id, similarity_score DESC);
  `);

  // Composite index for efficient queries on node_b with score ordering
  db.exec(`
    CREATE INDEX idx_similarity_node_b_score ON node_similarity(node_b_id, similarity_score DESC);
  `);
}

export function down(db: Database.Database): void {
  // Drop indexes first
  db.exec(`
    DROP INDEX IF EXISTS idx_similarity_node_b_score;
    DROP INDEX IF EXISTS idx_similarity_node_a_score;
    DROP INDEX IF EXISTS idx_similarity_score;
    DROP INDEX IF EXISTS idx_similarity_node_b;
    DROP INDEX IF EXISTS idx_similarity_node_a;
  `);

  // Drop table
  db.exec(`DROP TABLE IF EXISTS node_similarity;`);
}

const migration: Migration = { name, up, down };
export default migration;
