// ============================================================
// Migration: 022_add_surface_mode
// Adds surface_mode to nodes — distinguishes items saved for
// active reading (read_later) from items saved as long-term
// reference material. Drives different surfacing behavior in
// the UI (read_later is promoted, reference is archived).
//
// All existing rows default to 'reference' (decision locked in
// the 18-feature UX plan). Users manually flip items to
// 'read_later' via the PropertiesPanel toggle.
// ============================================================

import type { Migration } from './types.js';

const migration: Migration = {
  name: '022_add_surface_mode',
  up(db) {
    db.exec(`
      ALTER TABLE nodes
      ADD COLUMN surface_mode TEXT NOT NULL DEFAULT 'reference'
      CHECK (surface_mode IN ('read_later', 'reference'));
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_nodes_surface_mode
      ON nodes(surface_mode)
      WHERE is_deleted = 0;
    `);

    // Explicit backfill for safety — DEFAULT handles new rows but
    // we want existing rows set to 'reference' unambiguously.
    db.exec(`
      UPDATE nodes SET surface_mode = 'reference' WHERE surface_mode IS NULL;
    `);
  },
  down(db) {
    db.exec(`
      DROP INDEX IF EXISTS idx_nodes_surface_mode;
    `);
    // SQLite < 3.35 can't drop columns reliably — null them instead.
    db.exec(`
      UPDATE nodes SET surface_mode = 'reference';
    `);
  },
};

export default migration;