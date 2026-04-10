// ============================================================
// Migration: 023_add_smart_collections
// Extends the collections table to support saved-search (smart)
// collections in addition to user-curated folders.
//
//   - collection_type: 'folder' (default, existing behavior) or
//     'smart' (auto-resolves from saved_search_json)
//   - saved_search_json: nullable JSON blob representing the
//     filter state captured when the smart collection was saved
//     (shape matches the columnFilters + hierarchyFilter used
//     in DecantDemo.tsx)
// ============================================================

import type { Migration } from './types.js';

const migration: Migration = {
  name: '023_add_smart_collections',
  up(db) {
    db.exec(`
      ALTER TABLE collections
      ADD COLUMN collection_type TEXT NOT NULL DEFAULT 'folder'
      CHECK (collection_type IN ('folder', 'smart'));
    `);

    db.exec(`
      ALTER TABLE collections
      ADD COLUMN saved_search_json TEXT DEFAULT NULL;
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_collections_type
      ON collections(collection_type);
    `);
  },
  down(db) {
    db.exec(`
      DROP INDEX IF EXISTS idx_collections_type;
    `);
    // SQLite < 3.35 can't drop columns reliably — null them instead.
    db.exec(`
      UPDATE collections
      SET collection_type = 'folder',
          saved_search_json = NULL;
    `);
  },
};

export default migration;
