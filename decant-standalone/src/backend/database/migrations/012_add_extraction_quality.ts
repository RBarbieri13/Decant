// ============================================================
// Migration: 012_add_extraction_quality
// Adds extraction quality tracking columns for monitoring
// scrape quality and enabling targeted re-scraping
// ============================================================

import type { Migration } from './types.js';

const migration: Migration = {
  name: '012_add_extraction_quality',
  up(db) {
    // Check which columns already exist to make this idempotent
    const tableInfo = db.prepare(`PRAGMA table_info(nodes)`).all() as Array<{ name: string }>;
    const existingColumns = new Set(tableInfo.map(col => col.name));

    if (!existingColumns.has('extraction_quality')) {
      db.exec(`ALTER TABLE nodes ADD COLUMN extraction_quality TEXT DEFAULT NULL;`);
    }

    if (!existingColumns.has('extraction_source')) {
      db.exec(`ALTER TABLE nodes ADD COLUMN extraction_source TEXT DEFAULT NULL;`);
    }

    if (!existingColumns.has('extraction_notes')) {
      db.exec(`ALTER TABLE nodes ADD COLUMN extraction_notes TEXT DEFAULT NULL;`);
    }

    // Index for querying nodes by extraction quality (e.g., find all 'minimal' nodes)
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_nodes_extraction_quality
        ON nodes(extraction_quality)
        WHERE is_deleted = 0;
    `);
  },
  down(db) {
    db.exec(`DROP INDEX IF EXISTS idx_nodes_extraction_quality;`);
    // SQLite doesn't support DROP COLUMN — columns remain but are ignored
  },
};

export default migration;
