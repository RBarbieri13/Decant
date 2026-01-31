// ============================================================
// Migration: 009_add_hierarchy_audit
// Adds hierarchy code change tracking for audit trail
// ============================================================

import type Database from 'better-sqlite3';
import type { Migration } from './types.js';

export const name = '009_add_hierarchy_audit';

/**
 * Hierarchy Code Changes Audit Table
 *
 * Tracks all changes to hierarchy codes for accountability and debugging.
 * Maintains a complete history of code assignments, moves, and restructures.
 *
 * Use Cases:
 * - Debugging classification issues
 * - Understanding why a node has a particular code
 * - Auditing AI-driven code assignments
 * - Reverting problematic restructures
 * - Analyzing code change patterns
 *
 * Change Types:
 * - created: Initial code assignment (old_code will be NULL)
 * - updated: Code changed within same hierarchy level
 * - moved: Node moved to different parent/location
 * - restructured: Batch operation affecting multiple nodes
 *
 * Triggered By:
 * - import: AI import process
 * - user_move: Manual drag-and-drop
 * - restructure: Bulk reorganization
 * - merge: Merging duplicate nodes/categories
 */

export function up(db: Database.Database): void {
  // Create hierarchy_code_changes table
  db.exec(`
    CREATE TABLE hierarchy_code_changes (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      hierarchy_type TEXT NOT NULL CHECK(hierarchy_type IN ('function', 'organization')),
      old_code TEXT,
      new_code TEXT NOT NULL,
      change_type TEXT NOT NULL CHECK(change_type IN ('created', 'updated', 'moved', 'restructured')),
      reason TEXT,
      triggered_by TEXT NOT NULL CHECK(triggered_by IN ('import', 'user_move', 'restructure', 'merge')),
      related_node_ids TEXT,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT,
      FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
    );
  `);

  // Index for looking up a node's complete history
  db.exec(`
    CREATE INDEX idx_hierarchy_changes_node_id
      ON hierarchy_code_changes(node_id);
  `);

  // Index for recent changes (most common query pattern)
  db.exec(`
    CREATE INDEX idx_hierarchy_changes_changed_at
      ON hierarchy_code_changes(changed_at DESC);
  `);

  // Composite index for node history by hierarchy type and time
  db.exec(`
    CREATE INDEX idx_hierarchy_changes_node_type_time
      ON hierarchy_code_changes(node_id, hierarchy_type, changed_at DESC);
  `);

  // Index for filtering by change type
  db.exec(`
    CREATE INDEX idx_hierarchy_changes_change_type
      ON hierarchy_code_changes(change_type);
  `);

  // Index for filtering by trigger source
  db.exec(`
    CREATE INDEX idx_hierarchy_changes_triggered_by
      ON hierarchy_code_changes(triggered_by);
  `);

  // Composite index for filtering by hierarchy type and change type
  db.exec(`
    CREATE INDEX idx_hierarchy_changes_type_change
      ON hierarchy_code_changes(hierarchy_type, change_type);
  `);
}

export function down(db: Database.Database): void {
  // Drop indexes first
  db.exec(`
    DROP INDEX IF EXISTS idx_hierarchy_changes_type_change;
    DROP INDEX IF EXISTS idx_hierarchy_changes_triggered_by;
    DROP INDEX IF EXISTS idx_hierarchy_changes_change_type;
    DROP INDEX IF EXISTS idx_hierarchy_changes_node_type_time;
    DROP INDEX IF EXISTS idx_hierarchy_changes_changed_at;
    DROP INDEX IF EXISTS idx_hierarchy_changes_node_id;
  `);

  // Drop table
  db.exec(`DROP TABLE IF EXISTS hierarchy_code_changes;`);
}

const migration: Migration = { name, up, down };
export default migration;
