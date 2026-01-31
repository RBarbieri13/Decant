// ============================================================
// Migration: 004_add_hierarchy_codes
// Adds hierarchy code columns for dual hierarchy positioning
// ============================================================

import type Database from 'better-sqlite3';
import type { Migration } from './types.js';

export const name = '004_add_hierarchy_codes';

export function up(db: Database.Database): void {
  // Add hierarchy code columns to nodes table
  // These columns store the computed hierarchy codes for each view
  db.exec(`
    -- Function hierarchy code
    -- Format: [SEGMENT].[CATEGORY].[CONTENT_TYPE][SUBCATEGORY_CHAIN]
    -- Example: A.LLM.T.1 or A.LLM.T.1.2.a
    ALTER TABLE nodes ADD COLUMN function_hierarchy_code VARCHAR(100);
  `);

  db.exec(`
    -- Organization hierarchy code
    -- Format: [ORG].[CATEGORY].[CONTENT_TYPE][SUBCATEGORY_CHAIN]
    -- Example: ANTH.LLM.T.1
    ALTER TABLE nodes ADD COLUMN organization_hierarchy_code VARCHAR(100);
  `);

  db.exec(`
    -- Segment code (single uppercase letter: A, T, F, S, H, B, E, L, X, C)
    ALTER TABLE nodes ADD COLUMN segment_code CHAR(1);
  `);

  db.exec(`
    -- Category code (3 uppercase letters: LLM, AGT, FND, etc.)
    ALTER TABLE nodes ADD COLUMN category_code CHAR(3);
  `);

  db.exec(`
    -- Content type code (single uppercase letter: T, A, V, P, R, G, S, C, I, N, K, U)
    ALTER TABLE nodes ADD COLUMN content_type_code CHAR(1);
  `);

  // Create indexes for efficient hierarchy code lookups
  db.exec(`
    -- Index for function hierarchy code lookups and uniqueness validation
    CREATE INDEX idx_nodes_function_hierarchy_code
      ON nodes(function_hierarchy_code)
      WHERE function_hierarchy_code IS NOT NULL AND is_deleted = 0;
  `);

  db.exec(`
    -- Index for organization hierarchy code lookups and uniqueness validation
    CREATE INDEX idx_nodes_organization_hierarchy_code
      ON nodes(organization_hierarchy_code)
      WHERE organization_hierarchy_code IS NOT NULL AND is_deleted = 0;
  `);

  // Create composite indexes for efficient filtering by classification codes
  db.exec(`
    -- Composite index for segment + category filtering
    CREATE INDEX idx_nodes_segment_category
      ON nodes(segment_code, category_code)
      WHERE is_deleted = 0;
  `);

  db.exec(`
    -- Composite index for segment + content type filtering
    CREATE INDEX idx_nodes_segment_content_type
      ON nodes(segment_code, content_type_code)
      WHERE is_deleted = 0;
  `);

  db.exec(`
    -- Composite index for category + content type filtering
    CREATE INDEX idx_nodes_category_content_type
      ON nodes(category_code, content_type_code)
      WHERE is_deleted = 0;
  `);

  // Index for finding all nodes by segment
  db.exec(`
    CREATE INDEX idx_nodes_segment_code
      ON nodes(segment_code)
      WHERE is_deleted = 0;
  `);

  // Index for finding all nodes by content type
  db.exec(`
    CREATE INDEX idx_nodes_content_type_code
      ON nodes(content_type_code)
      WHERE is_deleted = 0;
  `);
}

export function down(db: Database.Database): void {
  // Drop indexes first
  db.exec(`
    DROP INDEX IF EXISTS idx_nodes_content_type_code;
    DROP INDEX IF EXISTS idx_nodes_segment_code;
    DROP INDEX IF EXISTS idx_nodes_category_content_type;
    DROP INDEX IF EXISTS idx_nodes_segment_content_type;
    DROP INDEX IF EXISTS idx_nodes_segment_category;
    DROP INDEX IF EXISTS idx_nodes_organization_hierarchy_code;
    DROP INDEX IF EXISTS idx_nodes_function_hierarchy_code;
  `);

  // Note: SQLite does not support DROP COLUMN directly
  // We need to recreate the table without the columns
  // For safety, we'll create a backup table and restore

  // Step 1: Create a backup of the nodes table without the new columns
  db.exec(`
    CREATE TABLE nodes_backup AS
    SELECT
      id,
      title,
      url,
      source_domain,
      date_added,
      company,
      phrase_description,
      short_description,
      logo_url,
      ai_summary,
      extracted_fields,
      metadata_tags,
      function_parent_id,
      organization_parent_id,
      is_deleted,
      created_at,
      updated_at
    FROM nodes;
  `);

  // Step 2: Drop the original table
  db.exec(`DROP TABLE nodes;`);

  // Step 3: Recreate the original table structure
  db.exec(`
    CREATE TABLE nodes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      source_domain TEXT NOT NULL,
      date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
      company TEXT,
      phrase_description TEXT,
      short_description TEXT,
      logo_url TEXT,
      ai_summary TEXT,
      extracted_fields JSON,
      metadata_tags JSON DEFAULT '[]',
      function_parent_id TEXT,
      organization_parent_id TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Step 4: Copy data back
  db.exec(`
    INSERT INTO nodes
    SELECT * FROM nodes_backup;
  `);

  // Step 5: Drop the backup table
  db.exec(`DROP TABLE nodes_backup;`);

  // Step 6: Recreate the original indexes
  db.exec(`
    CREATE INDEX idx_nodes_function_parent_date
      ON nodes(function_parent_id, date_added DESC);
    CREATE INDEX idx_nodes_organization_parent_date
      ON nodes(organization_parent_id, date_added DESC);
    CREATE INDEX idx_nodes_function_parent_deleted
      ON nodes(function_parent_id, is_deleted);
    CREATE INDEX idx_nodes_organization_parent_deleted
      ON nodes(organization_parent_id, is_deleted);
    CREATE INDEX idx_nodes_source_domain ON nodes(source_domain);
    CREATE INDEX idx_nodes_company ON nodes(company);
    CREATE INDEX idx_nodes_date_added ON nodes(date_added);
    CREATE INDEX idx_nodes_updated_at ON nodes(updated_at);
    CREATE INDEX idx_nodes_deleted ON nodes(is_deleted);
  `);
}

const migration: Migration = { name, up, down };
export default migration;
