import type Database from 'better-sqlite3';
import type { Migration } from './types.js';

const migration: Migration = {
  name: '010_backfill_classification_codes',

  up(db: Database.Database) {
    const nodes = db.prepare(`
      SELECT id, extracted_fields, segment_code, category_code, content_type_code
      FROM nodes
      WHERE is_deleted = 0
        AND (segment_code IS NULL OR segment_code = '')
        AND extracted_fields IS NOT NULL
        AND extracted_fields != '{}'
    `).all() as Array<{
      id: string;
      extracted_fields: string;
      segment_code: string | null;
      category_code: string | null;
      content_type_code: string | null;
    }>;

    if (nodes.length === 0) return;

    const updateStmt = db.prepare(`
      UPDATE nodes
      SET segment_code = ?, category_code = ?, content_type_code = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const validSegments = new Set(['A', 'T', 'F', 'S', 'H', 'B', 'E', 'L', 'X', 'C']);
    const validContentTypes = new Set(['T', 'A', 'V', 'P', 'R', 'G', 'S', 'C', 'I', 'N', 'K', 'U']);

    let backfilledCount = 0;

    for (const node of nodes) {
      try {
        const fields = JSON.parse(node.extracted_fields);
        const segment = fields.segment;
        const category = fields.category;
        const contentType = fields.contentType;

        if (segment && validSegments.has(segment)) {
          updateStmt.run(
            segment,
            category || 'OTH',
            contentType && validContentTypes.has(contentType) ? contentType : 'A',
            node.id
          );
          backfilledCount++;
        }
      } catch {
        // Skip nodes with invalid JSON
      }
    }

    if (backfilledCount > 0) {
      console.log(`[migration-010] Backfilled classification codes for ${backfilledCount} nodes`);
    }
  },

  down(_db: Database.Database) {
    // No rollback needed - we only filled in NULL values
  },
};

export default migration;
