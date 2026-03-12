// ============================================================
// Migration: 014_add_function_tags
// Adds function_tags column for storing use-case phrases
// generated during Phase 1 classification
// ============================================================

import type { Migration } from './types.js';

const migration: Migration = {
  name: '014_add_function_tags',
  up(db) {
    const tableInfo = db.prepare(`PRAGMA table_info(nodes)`).all() as Array<{ name: string }>;
    const existingColumns = new Set(tableInfo.map(col => col.name));

    if (!existingColumns.has('function_tags')) {
      db.exec(`ALTER TABLE nodes ADD COLUMN function_tags TEXT DEFAULT NULL;`);
    }
  },
  down(db) {
    // SQLite doesn't support DROP COLUMN — column remains but is ignored
  },
};

export default migration;
