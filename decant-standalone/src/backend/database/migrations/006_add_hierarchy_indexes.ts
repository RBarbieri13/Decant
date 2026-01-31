// ============================================================
// Migration: 006_add_hierarchy_indexes
// Adds covering indexes for optimized tree queries using hierarchy codes
// ============================================================

import type Database from 'better-sqlite3';
import type { Migration } from './types.js';

export const name = '006_add_hierarchy_indexes';

export function up(db: Database.Database): void {
  // ============================================================
  // Covering Indexes for Tree Queries
  // These indexes include commonly selected columns to enable
  // index-only scans (no table lookups needed)
  // ============================================================

  // Covering index for function tree queries
  // Supports: SELECT * FROM nodes WHERE function_hierarchy_code LIKE 'A.%' ORDER BY function_hierarchy_code
  // Includes title for display without table lookup
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nodes_function_tree
      ON nodes(function_hierarchy_code, is_deleted, title)
      WHERE function_hierarchy_code IS NOT NULL;
  `);

  // Covering index for organization tree queries
  // Supports: SELECT * FROM nodes WHERE organization_hierarchy_code LIKE 'ANTH.%' ORDER BY organization_hierarchy_code
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nodes_organization_tree
      ON nodes(organization_hierarchy_code, is_deleted, title)
      WHERE organization_hierarchy_code IS NOT NULL;
  `);

  // ============================================================
  // Prefix Query Indexes
  // Optimized for subtree retrieval using LIKE 'prefix%' patterns
  // ============================================================

  // Full classification lookup index
  // Supports queries like: WHERE segment_code = 'A' AND category_code = 'LLM' AND content_type_code = 'T'
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nodes_segment_category_type
      ON nodes(segment_code, category_code, content_type_code)
      WHERE is_deleted = 0;
  `);

  // ============================================================
  // Hierarchy Code Range Indexes
  // These indexes support efficient range scans for subtree queries
  // ============================================================

  // Index for efficient function code range scans
  // Supports: WHERE function_hierarchy_code >= 'A.' AND function_hierarchy_code < 'B'
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nodes_function_code_range
      ON nodes(function_hierarchy_code)
      WHERE is_deleted = 0 AND function_hierarchy_code IS NOT NULL;
  `);

  // Index for efficient organization code range scans
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nodes_organization_code_range
      ON nodes(organization_hierarchy_code)
      WHERE is_deleted = 0 AND organization_hierarchy_code IS NOT NULL;
  `);

  // ============================================================
  // Composite Indexes for Common Access Patterns
  // ============================================================

  // Index for finding nodes by segment with hierarchy code ordering
  // Useful for loading all nodes in a segment sorted by their position
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nodes_segment_hierarchy
      ON nodes(segment_code, function_hierarchy_code)
      WHERE is_deleted = 0 AND segment_code IS NOT NULL;
  `);

  // Index for date-ordered queries within a segment
  // Supports: WHERE segment_code = 'A' ORDER BY date_added DESC
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nodes_segment_date
      ON nodes(segment_code, date_added DESC)
      WHERE is_deleted = 0 AND segment_code IS NOT NULL;
  `);

  // ============================================================
  // Lookup Indexes for Code-to-Node Resolution
  // ============================================================

  // Unique-like index for finding a specific node by its function code
  // Note: Not enforced as UNIQUE because codes can change during rebalancing
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nodes_function_code_lookup
      ON nodes(function_hierarchy_code, id)
      WHERE is_deleted = 0 AND function_hierarchy_code IS NOT NULL;
  `);

  // Same for organization codes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nodes_organization_code_lookup
      ON nodes(organization_hierarchy_code, id)
      WHERE is_deleted = 0 AND organization_hierarchy_code IS NOT NULL;
  `);
}

export function down(db: Database.Database): void {
  // Drop all indexes created in this migration
  db.exec(`
    DROP INDEX IF EXISTS idx_nodes_organization_code_lookup;
    DROP INDEX IF EXISTS idx_nodes_function_code_lookup;
    DROP INDEX IF EXISTS idx_nodes_segment_date;
    DROP INDEX IF EXISTS idx_nodes_segment_hierarchy;
    DROP INDEX IF EXISTS idx_nodes_organization_code_range;
    DROP INDEX IF EXISTS idx_nodes_function_code_range;
    DROP INDEX IF EXISTS idx_nodes_segment_category_type;
    DROP INDEX IF EXISTS idx_nodes_organization_tree;
    DROP INDEX IF EXISTS idx_nodes_function_tree;
  `);
}

const migration: Migration = { name, up, down };
export default migration;
