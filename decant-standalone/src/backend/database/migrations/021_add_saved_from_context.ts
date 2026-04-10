// ============================================================
// Migration: 021_add_saved_from_context
// Adds saved_from_context to nodes — a nullable JSON blob that
// captures context around how the node was saved.
//
// Schema:
//   {
//     source: 'imessage' | 'browser' | 'manual' | 'batch',
//     surrounding_messages?: string[],  // 2-3 snippets for imessage
//     timestamp?: string                 // ISO 8601
//   }
//
// NOTE: Sender field is INTENTIONALLY OMITTED. The iMessage
// extractor only reads the user's outgoing thread, so sender
// is always "you". Decision locked in the dynamic-hierarchy plan.
// ============================================================

import type { Migration } from './types.js';

const migration: Migration = {
  name: '021_add_saved_from_context',
  up(db) {
    db.exec(`
      ALTER TABLE nodes ADD COLUMN saved_from_context TEXT DEFAULT NULL;
    `);
  },
  down(db) {
    db.exec(`
      UPDATE nodes SET saved_from_context = NULL;
    `);
  },
};

export default migration;
