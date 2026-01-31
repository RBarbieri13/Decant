// ============================================================
// Migration: 005_add_processing_queue
// Creates the processing queue table for background job management
// ============================================================

import type Database from 'better-sqlite3';
import type { Migration } from './types.js';

export const name = '005_add_processing_queue';

export function up(db: Database.Database): void {
  db.exec(`
    -- Processing queue for background jobs (Phase 2 enrichment, etc.)
    CREATE TABLE IF NOT EXISTS processing_queue (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      phase TEXT NOT NULL DEFAULT 'phase2',
      status TEXT NOT NULL DEFAULT 'pending',
      priority INTEGER DEFAULT 0,
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 3,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME,
      FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
    );

    -- Index for fetching pending jobs by priority and age
    CREATE INDEX IF NOT EXISTS idx_queue_status_priority
      ON processing_queue(status, priority DESC, created_at ASC);

    -- Index for fetching jobs by node
    CREATE INDEX IF NOT EXISTS idx_queue_node_id
      ON processing_queue(node_id);

    -- Index for cleanup of completed jobs
    CREATE INDEX IF NOT EXISTS idx_queue_status_processed
      ON processing_queue(status, processed_at);
  `);
}

export function down(db: Database.Database): void {
  db.exec(`
    DROP INDEX IF EXISTS idx_queue_status_processed;
    DROP INDEX IF EXISTS idx_queue_node_id;
    DROP INDEX IF EXISTS idx_queue_status_priority;
    DROP TABLE IF EXISTS processing_queue;
  `);
}

const migration: Migration = { name, up, down };
export default migration;
