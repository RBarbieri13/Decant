// ============================================================
// Test Setup - Initializes in-memory SQLite for testing
// ============================================================

import Database from 'better-sqlite3';
import { vi, beforeEach, afterEach, afterAll } from 'vitest';

// Store the test database instance
let testDb: Database.Database | null = null;

/**
 * Get or create a test database (in-memory)
 */
export function getTestDatabase(): Database.Database {
  if (!testDb) {
    testDb = new Database(':memory:');
    testDb.pragma('foreign_keys = ON');
    initializeTestSchema(testDb);
  }
  return testDb;
}

/**
 * Close the test database
 */
export function closeTestDatabase(): void {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
}

/**
 * Reset the test database (clear all data but keep schema)
 */
export function resetTestDatabase(): void {
  if (testDb) {
    testDb.exec(`
      DELETE FROM key_concepts;
      DELETE FROM nodes;
      DELETE FROM segments;
      DELETE FROM organizations;
    `);
  }
}

/**
 * Initialize test schema (same as production but in-memory)
 */
function initializeTestSchema(db: Database.Database): void {
  db.exec(`
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

    CREATE TABLE IF NOT EXISTS key_concepts (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      concept TEXT NOT NULL,
      FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
      UNIQUE(node_id, concept)
    );

    CREATE TABLE IF NOT EXISTS segments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE,
      description TEXT,
      color TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE,
      description TEXT,
      color TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_nodes_function_parent ON nodes(function_parent_id);
    CREATE INDEX IF NOT EXISTS idx_nodes_organization_parent ON nodes(organization_parent_id);
    CREATE INDEX IF NOT EXISTS idx_nodes_deleted ON nodes(is_deleted);
    CREATE INDEX IF NOT EXISTS idx_key_concepts_node ON key_concepts(node_id);
  `);
}

// Mock the connection module to use in-memory database
vi.mock('../database/connection.js', () => ({
  getDatabase: () => getTestDatabase(),
  closeDatabase: () => closeTestDatabase(),
  getDatabasePath: () => ':memory:',
  isDatabaseInitialized: () => true,
}));

// Also mock with .ts extension for imports that use it
vi.mock('../database/connection', () => ({
  getDatabase: () => getTestDatabase(),
  closeDatabase: () => closeTestDatabase(),
  getDatabasePath: () => ':memory:',
  isDatabaseInitialized: () => true,
}));

// Mock transaction helper to just execute the function directly
// In tests, the mock connection already provides a test database
vi.mock('../database/transaction.js', () => ({
  withTransaction: <T>(fn: () => T): T => fn(),
  withTransactionSync: <T>(fn: () => T): T => fn(),
}));

vi.mock('../database/transaction', () => ({
  withTransaction: <T>(fn: () => T): T => fn(),
  withTransactionSync: <T>(fn: () => T): T => fn(),
}));

// Global hooks
beforeEach(() => {
  // Ensure test database is initialized before each test
  getTestDatabase();
});

afterEach(() => {
  // Reset database state after each test
  resetTestDatabase();
});

afterAll(() => {
  // Clean up after all tests
  closeTestDatabase();
});

// Export utilities for tests
export { vi };
