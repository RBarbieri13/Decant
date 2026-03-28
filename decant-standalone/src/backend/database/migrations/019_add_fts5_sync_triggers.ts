// ============================================================
// Migration: 019_add_fts5_sync_triggers
// Adds SQLite triggers to keep nodes_fts in sync with nodes.
// The FTS5 table was created with content='nodes' (external
// content mode) but had no triggers, so inserts/updates/deletes
// on nodes were never reflected in the FTS index.
// ============================================================

import type Database from 'better-sqlite3';
import type { Migration } from './types.js';

export const name = '019_add_fts5_sync_triggers';

/**
 * SQL to drop the three FTS sync triggers.
 * Exported so test helpers can use it during database reset.
 */
export const DROP_FTS_TRIGGERS_SQL = `
  DROP TRIGGER IF EXISTS nodes_ai_fts;
  DROP TRIGGER IF EXISTS nodes_ad_fts;
  DROP TRIGGER IF EXISTS nodes_au_fts;
`;

/**
 * SQL to create the three FTS sync triggers.
 * Exported so test helpers can recreate them after a bulk reset.
 *
 * FTS5 external-content tables require explicit INSERT/DELETE
 * commands to stay in sync. The canonical pattern from SQLite docs:
 *
 *  - AFTER INSERT: insert new row into FTS
 *  - AFTER DELETE: delete old row from FTS
 *  - AFTER UPDATE: delete old row, insert new row
 *
 * For soft-deletes (is_deleted = 1), the UPDATE trigger handles
 * removing the FTS entry when a node is marked deleted, and
 * re-adding it if is_deleted is flipped back to 0.
 */
export const CREATE_FTS_TRIGGERS_SQL = `
  CREATE TRIGGER IF NOT EXISTS nodes_ai_fts AFTER INSERT ON nodes
  WHEN NEW.is_deleted = 0
  BEGIN
    INSERT INTO nodes_fts(rowid, title, source_domain, company, phrase_description, short_description, ai_summary)
    VALUES (NEW.rowid, NEW.title, NEW.source_domain, NEW.company, NEW.phrase_description, NEW.short_description, NEW.ai_summary);
  END;

  CREATE TRIGGER IF NOT EXISTS nodes_ad_fts AFTER DELETE ON nodes
  BEGIN
    INSERT INTO nodes_fts(nodes_fts, rowid, title, source_domain, company, phrase_description, short_description, ai_summary)
    VALUES ('delete', OLD.rowid, OLD.title, OLD.source_domain, OLD.company, OLD.phrase_description, OLD.short_description, OLD.ai_summary);
  END;

  CREATE TRIGGER IF NOT EXISTS nodes_au_fts AFTER UPDATE ON nodes
  BEGIN
    INSERT INTO nodes_fts(nodes_fts, rowid, title, source_domain, company, phrase_description, short_description, ai_summary)
    SELECT 'delete', OLD.rowid, OLD.title, OLD.source_domain, OLD.company, OLD.phrase_description, OLD.short_description, OLD.ai_summary
    WHERE OLD.is_deleted = 0;

    INSERT INTO nodes_fts(rowid, title, source_domain, company, phrase_description, short_description, ai_summary)
    SELECT NEW.rowid, NEW.title, NEW.source_domain, NEW.company, NEW.phrase_description, NEW.short_description, NEW.ai_summary
    WHERE NEW.is_deleted = 0;
  END;
`;

export function up(db: Database.Database): void {
  // Check if nodes_fts table exists (it may not on fresh DBs that
  // haven't run migration 001 yet, but the runner guarantees order).
  const ftsExists = db.prepare(`
    SELECT COUNT(*) as count FROM sqlite_master
    WHERE type = 'table' AND name = 'nodes_fts'
  `).get() as { count: number };

  if (ftsExists.count === 0) {
    return; // No FTS table — nothing to do
  }

  db.exec(CREATE_FTS_TRIGGERS_SQL);

  // Rebuild the FTS index to backfill all existing nodes.
  // This ensures the index is correct for data inserted before triggers existed.
  db.exec(`
    INSERT INTO nodes_fts(nodes_fts) VALUES('rebuild');
  `);
}

export function down(db: Database.Database): void {
  db.exec(DROP_FTS_TRIGGERS_SQL);
}

const migration: Migration = { name, up, down };
export default migration;
