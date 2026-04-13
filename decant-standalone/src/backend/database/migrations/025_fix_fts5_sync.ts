// ============================================================
// Migration: 025_fix_fts5_sync
// Fixes FTS5 sync triggers so that nodes_fts stays in sync
// with INSERT, UPDATE, and soft-DELETE mutations on the nodes
// table.
//
// Migration 019 added triggers but used a FROM-less
//   SELECT … WHERE OLD.is_deleted = 0
// pattern inside the AFTER UPDATE trigger body. Some SQLite
// builds optimise that into a no-op because there is no source
// table for the WHERE to filter against. The result: updates
// and soft-deletes silently skipped the FTS sync, leaving
// stale or ghost entries in nodes_fts.
//
// This migration:
//  1. Drops ALL three legacy triggers (019).
//  2. Recreates them with explicit WHEN guards on the trigger
//     definition, and for the UPDATE case splits into two
//     separate triggers — one for the FTS delete step and one
//     for the FTS insert step — each with its own WHEN clause.
//  3. Rebuilds the FTS index from scratch to fix any existing
//     stale data.
// ============================================================

import type { Migration } from './types.js';

export const name = '025_fix_fts5_sync';

/**
 * SQL to drop the FTS triggers (both old 3-trigger set and new 4-trigger set).
 * Exported for use by test helpers.
 */
export const DROP_FTS_TRIGGERS_SQL = `
  DROP TRIGGER IF EXISTS nodes_ai_fts;
  DROP TRIGGER IF EXISTS nodes_ad_fts;
  DROP TRIGGER IF EXISTS nodes_au_fts;
  DROP TRIGGER IF EXISTS nodes_au_fts_del;
  DROP TRIGGER IF EXISTS nodes_au_fts_ins;
`;

/**
 * SQL to create the four FTS sync triggers.
 * Exported for use by test helpers after a bulk reset.
 *
 * Trigger design:
 *
 *  nodes_ai_fts        – AFTER INSERT, WHEN NEW.is_deleted = 0
 *                         Inserts the new row into the FTS index.
 *
 *  nodes_ad_fts        – AFTER DELETE (hard delete, rare)
 *                         Removes the row from the FTS index.
 *
 *  nodes_au_fts_del    – AFTER UPDATE, WHEN OLD.is_deleted = 0
 *                         Removes the OLD values from the FTS index.
 *                         Fires whenever an existing, non-deleted row
 *                         is updated (covers both field edits and
 *                         soft-delete flips).
 *
 *  nodes_au_fts_ins    – AFTER UPDATE, WHEN NEW.is_deleted = 0
 *                         Inserts the NEW values into the FTS index.
 *                         Fires only when the post-update row is still
 *                         non-deleted. Together with nodes_au_fts_del
 *                         this implements a delete-then-reinsert that
 *                         keeps the index current.
 *
 * For a normal field edit (is_deleted stays 0):
 *   nodes_au_fts_del fires → removes old entry
 *   nodes_au_fts_ins fires → adds new entry
 *
 * For a soft-delete (is_deleted goes 0 → 1):
 *   nodes_au_fts_del fires → removes old entry
 *   nodes_au_fts_ins does NOT fire → entry stays gone ✓
 *
 * For an un-delete (is_deleted goes 1 → 0):
 *   nodes_au_fts_del does NOT fire → nothing to remove (wasn't indexed)
 *   nodes_au_fts_ins fires → adds the entry back ✓
 */
export const CREATE_FTS_TRIGGERS_SQL = `
  CREATE TRIGGER IF NOT EXISTS nodes_ai_fts
  AFTER INSERT ON nodes
  WHEN NEW.is_deleted = 0
  BEGIN
    INSERT INTO nodes_fts(rowid, title, source_domain, company, phrase_description, short_description, ai_summary)
    VALUES (NEW.rowid, NEW.title, NEW.source_domain, NEW.company, NEW.phrase_description, NEW.short_description, NEW.ai_summary);
  END;

  CREATE TRIGGER IF NOT EXISTS nodes_ad_fts
  AFTER DELETE ON nodes
  BEGIN
    INSERT INTO nodes_fts(nodes_fts, rowid, title, source_domain, company, phrase_description, short_description, ai_summary)
    VALUES ('delete', OLD.rowid, OLD.title, OLD.source_domain, OLD.company, OLD.phrase_description, OLD.short_description, OLD.ai_summary);
  END;

  CREATE TRIGGER IF NOT EXISTS nodes_au_fts_del
  AFTER UPDATE ON nodes
  WHEN OLD.is_deleted = 0
  BEGIN
    INSERT INTO nodes_fts(nodes_fts, rowid, title, source_domain, company, phrase_description, short_description, ai_summary)
    VALUES ('delete', OLD.rowid, OLD.title, OLD.source_domain, OLD.company, OLD.phrase_description, OLD.short_description, OLD.ai_summary);
  END;

  CREATE TRIGGER IF NOT EXISTS nodes_au_fts_ins
  AFTER UPDATE ON nodes
  WHEN NEW.is_deleted = 0
  BEGIN
    INSERT INTO nodes_fts(rowid, title, source_domain, company, phrase_description, short_description, ai_summary)
    VALUES (NEW.rowid, NEW.title, NEW.source_domain, NEW.company, NEW.phrase_description, NEW.short_description, NEW.ai_summary);
  END;
`;

export function up(db: import('better-sqlite3').Database): void {
  // Check if nodes_fts table exists
  const ftsExists = db.prepare(`
    SELECT COUNT(*) as count FROM sqlite_master
    WHERE type = 'table' AND name = 'nodes_fts'
  `).get() as { count: number };

  if (ftsExists.count === 0) {
    return; // No FTS table — nothing to do
  }

  // Drop all legacy triggers (019 created 3, we create 4)
  db.exec(DROP_FTS_TRIGGERS_SQL);

  // Create the corrected trigger set
  db.exec(CREATE_FTS_TRIGGERS_SQL);

  // Rebuild the FTS index from scratch to fix stale data
  db.exec(`INSERT INTO nodes_fts(nodes_fts) VALUES('rebuild');`);
}

export function down(db: import('better-sqlite3').Database): void {
  db.exec(DROP_FTS_TRIGGERS_SQL);
}

const migration: Migration = { name, up, down };
export default migration;
