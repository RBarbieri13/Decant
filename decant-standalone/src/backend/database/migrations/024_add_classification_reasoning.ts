// ============================================================
// Migration: 024_add_classification_reasoning
// Adds classification_reasoning to nodes — nullable JSON blob
// that stores the LLM's natural-language justification for
// the primary classification. Surfaced via tooltip on hover
// of the category badge in the data table + properties panel.
//
// Schema:
//   {
//     primaryDomainReason: string,    // one sentence
//     resourceTypeReason: string,     // one sentence
//     confidence: number              // 0..1
//   }
//
// Populated on import and on reclassify by the semantic profiler.
// Existing rows are NULL until they are reclassified or a
// backfill sweep is run.
// ============================================================

import type { Migration } from './types.js';

const migration: Migration = {
  name: '024_add_classification_reasoning',
  up(db) {
    db.exec(`
      ALTER TABLE nodes ADD COLUMN classification_reasoning TEXT DEFAULT NULL;
    `);
  },
  down(db) {
    db.exec(`
      UPDATE nodes SET classification_reasoning = NULL;
    `);
  },
};

export default migration;
