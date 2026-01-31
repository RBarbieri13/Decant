// ============================================================
// Migration: 001_initial_schema
// Creates the initial database schema for Decant
// ============================================================

import type Database from 'better-sqlite3';
import type { Migration } from './types.js';

export const name = '001_initial_schema';

export function up(db: Database.Database): void {
  db.exec(`
    -- Core nodes table for storing all collected items
    CREATE TABLE IF NOT EXISTS nodes (
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

    -- Key concepts extracted from nodes
    CREATE TABLE IF NOT EXISTS key_concepts (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      concept TEXT NOT NULL,
      FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
      UNIQUE(node_id, concept)
    );

    -- Functional segments (e.g., HR, Finance, Engineering)
    CREATE TABLE IF NOT EXISTS segments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE,
      description TEXT,
      color TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Organizational hierarchy (e.g., Company divisions)
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE,
      description TEXT,
      color TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_nodes_function_parent ON nodes(function_parent_id);
    CREATE INDEX IF NOT EXISTS idx_nodes_organization_parent ON nodes(organization_parent_id);
    CREATE INDEX IF NOT EXISTS idx_nodes_deleted ON nodes(is_deleted);
    CREATE INDEX IF NOT EXISTS idx_key_concepts_node ON key_concepts(node_id);

    -- Full-text search virtual table
    CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
      title,
      source_domain,
      company,
      phrase_description,
      short_description,
      ai_summary,
      content='nodes',
      content_rowid='rowid'
    );
  `);
}

export function down(db: Database.Database): void {
  db.exec(`
    -- Drop in reverse order of creation to respect dependencies
    DROP TABLE IF EXISTS nodes_fts;
    DROP INDEX IF EXISTS idx_key_concepts_node;
    DROP INDEX IF EXISTS idx_nodes_deleted;
    DROP INDEX IF EXISTS idx_nodes_organization_parent;
    DROP INDEX IF EXISTS idx_nodes_function_parent;
    DROP TABLE IF EXISTS organizations;
    DROP TABLE IF EXISTS segments;
    DROP TABLE IF EXISTS key_concepts;
    DROP TABLE IF EXISTS nodes;
  `);
}

const migration: Migration = { name, up, down };
export default migration;
