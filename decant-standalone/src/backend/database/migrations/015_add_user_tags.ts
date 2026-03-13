// ============================================================
// Migration: 015_add_user_tags
// Adds user_tags and node_user_tags tables for user-created
// custom labels that can be assigned to any node
// ============================================================

import type { Migration } from './types.js';

const migration: Migration = {
  name: '015_add_user_tags',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#6b7280',
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS node_user_tags (
        node_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (node_id, tag_id),
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES user_tags(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_node_user_tags_node ON node_user_tags(node_id);
      CREATE INDEX IF NOT EXISTS idx_node_user_tags_tag ON node_user_tags(tag_id);
    `);
  },
  down(db) {
    db.exec(`
      DROP INDEX IF EXISTS idx_node_user_tags_tag;
      DROP INDEX IF EXISTS idx_node_user_tags_node;
      DROP TABLE IF EXISTS node_user_tags;
      DROP TABLE IF EXISTS user_tags;
    `);
  },
};

export default migration;
