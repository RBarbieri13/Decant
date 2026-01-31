// ============================================================
// Migration: 003_add_tree_indexes
// Adds composite indexes for optimized tree building queries
// ============================================================

import type Database from 'better-sqlite3';
import type { Migration } from './types.js';

export const name = '003_add_tree_indexes';

export function up(db: Database.Database): void {
  // Drop old simple indexes from 001_initial_schema
  // We'll replace them with composite indexes for better query optimization
  db.exec(`
    DROP INDEX IF EXISTS idx_nodes_function_parent;
    DROP INDEX IF EXISTS idx_nodes_organization_parent;
  `);

  // Composite index for function parent traversal with sorting
  // Optimizes queries like: WHERE function_parent_id = ? ORDER BY date_added DESC
  db.exec(`
    CREATE INDEX idx_nodes_function_parent_date
      ON nodes(function_parent_id, date_added DESC);
  `);

  // Composite index for organization parent traversal with sorting
  // Optimizes queries like: WHERE organization_parent_id = ? ORDER BY date_added DESC
  db.exec(`
    CREATE INDEX idx_nodes_organization_parent_date
      ON nodes(organization_parent_id, date_added DESC);
  `);

  // Additional composite index for deleted filtering + function parent
  // Optimizes queries like: WHERE is_deleted = 0 AND function_parent_id = ?
  db.exec(`
    CREATE INDEX idx_nodes_function_parent_deleted
      ON nodes(function_parent_id, is_deleted);
  `);

  // Additional composite index for deleted filtering + organization parent
  // Optimizes queries like: WHERE is_deleted = 0 AND organization_parent_id = ?
  db.exec(`
    CREATE INDEX idx_nodes_organization_parent_deleted
      ON nodes(organization_parent_id, is_deleted);
  `);
}

export function down(db: Database.Database): void {
  // Drop composite indexes
  db.exec(`
    DROP INDEX IF EXISTS idx_nodes_organization_parent_deleted;
    DROP INDEX IF EXISTS idx_nodes_function_parent_deleted;
    DROP INDEX IF EXISTS idx_nodes_organization_parent_date;
    DROP INDEX IF EXISTS idx_nodes_function_parent_date;
  `);

  // Recreate original simple indexes from 001_initial_schema
  db.exec(`
    CREATE INDEX idx_nodes_function_parent ON nodes(function_parent_id);
    CREATE INDEX idx_nodes_organization_parent ON nodes(organization_parent_id);
  `);
}

const migration: Migration = { name, up, down };
export default migration;
