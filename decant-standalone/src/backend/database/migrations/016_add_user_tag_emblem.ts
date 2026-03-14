// ============================================================
// Migration: 016_add_user_tag_emblem
// Adds emblem column to user_tags for emoji emblems on tag chips
// ============================================================

import type { Migration } from './types.js';

const migration: Migration = {
  name: '016_add_user_tag_emblem',
  up(db) {
    db.exec(`
      ALTER TABLE user_tags ADD COLUMN emblem TEXT NOT NULL DEFAULT '🏷';
    `);
  },
  down(db) {
    // SQLite doesn't support DROP COLUMN before 3.35.0;
    // recreate the table without the emblem column
    db.exec(`
      CREATE TABLE user_tags_backup AS
        SELECT id, name, color, position, created_at FROM user_tags;
      DROP TABLE user_tags;
      CREATE TABLE user_tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#6b7280',
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO user_tags SELECT * FROM user_tags_backup;
      DROP TABLE user_tags_backup;
    `);
  },
};

export default migration;
