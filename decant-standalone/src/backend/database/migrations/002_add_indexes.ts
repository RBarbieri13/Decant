// ============================================================
// Migration: 002_add_indexes
// Adds additional indexes for improved query performance
// ============================================================

import type Database from 'better-sqlite3';
import type { Migration } from './types.js';

export const name = '002_add_indexes';

export function up(db: Database.Database): void {
  // Add index on source_domain for filtering by domain
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nodes_source_domain ON nodes(source_domain);
  `);

  // Add index on company for filtering/grouping by company
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nodes_company ON nodes(company);
  `);

  // Add index on date_added for chronological sorting
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nodes_date_added ON nodes(date_added);
  `);

  // Add index on updated_at for finding recently modified items
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nodes_updated_at ON nodes(updated_at);
  `);
}

export function down(db: Database.Database): void {
  db.exec(`
    DROP INDEX IF EXISTS idx_nodes_updated_at;
    DROP INDEX IF EXISTS idx_nodes_date_added;
    DROP INDEX IF EXISTS idx_nodes_company;
    DROP INDEX IF EXISTS idx_nodes_source_domain;
  `);
}

const migration: Migration = { name, up, down };
export default migration;
