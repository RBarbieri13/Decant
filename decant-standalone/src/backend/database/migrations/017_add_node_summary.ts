// ============================================================
// Migration: 017_add_node_summary
// Adds summary_json and summary_content_hash columns to nodes
// for AI-generated structured summary panel data
// ============================================================

import type { Migration } from './types.js';

const migration: Migration = {
  name: '017_add_node_summary',
  up(db) {
    db.exec(`
      ALTER TABLE nodes ADD COLUMN summary_json TEXT DEFAULT NULL;
    `);
    db.exec(`
      ALTER TABLE nodes ADD COLUMN summary_content_hash TEXT DEFAULT NULL;
    `);
  },
  down(db) {
    // SQLite < 3.35 doesn't support DROP COLUMN — recreate table
    // For simplicity, just null out the columns (they'll be ignored)
    db.exec(`
      UPDATE nodes SET summary_json = NULL, summary_content_hash = NULL;
    `);
  },
};

export default migration;
