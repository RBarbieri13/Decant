// ============================================================
// Migration: 020_add_why_saved
// Adds three columns to nodes for the "why saved" blurb:
//   - why_saved_text: the blurb itself (nullable)
//   - why_saved_is_auto: 1 = auto-generated, 0 = user-edited
//   - why_saved_generated_at: ISO 8601 timestamp the auto-blurb was
//     generated (nullable)
// ============================================================

import type { Migration } from './types.js';

const migration: Migration = {
  name: '020_add_why_saved',
  up(db) {
    db.exec(`
      ALTER TABLE nodes ADD COLUMN why_saved_text TEXT DEFAULT NULL;
    `);
    db.exec(`
      ALTER TABLE nodes ADD COLUMN why_saved_is_auto INTEGER NOT NULL DEFAULT 1;
    `);
    db.exec(`
      ALTER TABLE nodes ADD COLUMN why_saved_generated_at TEXT DEFAULT NULL;
    `);
  },
  down(db) {
    // SQLite < 3.35 doesn't support DROP COLUMN reliably — null the columns
    db.exec(`
      UPDATE nodes
      SET why_saved_text = NULL,
          why_saved_is_auto = 1,
          why_saved_generated_at = NULL;
    `);
  },
};

export default migration;
