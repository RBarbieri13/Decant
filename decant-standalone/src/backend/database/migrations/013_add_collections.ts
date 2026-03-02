// ============================================================
// Migration: 013_add_collections
// Adds collections and collection_nodes tables for user-created
// folder collections in the sidebar
// ============================================================

import type { Migration } from './types.js';

const migration: Migration = {
  name: '013_add_collections',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '📁',
        color TEXT NOT NULL DEFAULT '#2d5b47',
        parent_id TEXT DEFAULT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (parent_id) REFERENCES collections(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS collection_nodes (
        collection_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        added_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (collection_id, node_id),
        FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_collections_parent ON collections(parent_id);
      CREATE INDEX IF NOT EXISTS idx_collections_sort ON collections(parent_id, position);
      CREATE INDEX IF NOT EXISTS idx_collection_nodes_collection ON collection_nodes(collection_id);
      CREATE INDEX IF NOT EXISTS idx_collection_nodes_node ON collection_nodes(node_id);
    `);
  },
  down(db) {
    db.exec(`
      DROP INDEX IF EXISTS idx_collection_nodes_node;
      DROP INDEX IF EXISTS idx_collection_nodes_collection;
      DROP INDEX IF EXISTS idx_collections_sort;
      DROP INDEX IF EXISTS idx_collections_parent;
      DROP TABLE IF EXISTS collection_nodes;
      DROP TABLE IF EXISTS collections;
    `);
  },
};

export default migration;
