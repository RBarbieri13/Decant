// ============================================================
// Test Setup - Initializes in-memory SQLite for testing
// ============================================================

import Database from 'better-sqlite3';
import { vi, beforeEach, afterEach, afterAll } from 'vitest';
import { runPendingMigrations } from '../database/migrations/runner.js';

// Store the test database instance
let testDb: Database.Database | null = null;

/**
 * Get or create a test database (in-memory)
 */
export function getTestDatabase(): Database.Database {
  if (!testDb) {
    testDb = new Database(':memory:');
    testDb.pragma('foreign_keys = ON');
    // Use the real migration runner so the schema stays in sync automatically
    runPendingMigrations(testDb);
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
      DELETE FROM collection_nodes;
      DELETE FROM collections;
      DELETE FROM node_similarity;
      DELETE FROM node_metadata;
      DELETE FROM hierarchy_code_changes;
      DELETE FROM processing_queue;
      DELETE FROM key_concepts;
      DELETE FROM nodes;
      DELETE FROM categories;
      DELETE FROM content_types;
      DELETE FROM segments;
      DELETE FROM organizations;
      DELETE FROM metadata_code_registry;
    `);
  }
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
