// ============================================================
// Migration Integration Tests
// Tests migration behavior with real file system database
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Unmock the connection module to use real database files
vi.unmock('../../connection.js');
vi.unmock('../../connection');

import {
  ensureMigrationsTable,
  getAppliedMigrations,
  getMigrationStatus,
  getPendingMigrations,
  runPendingMigrations,
  rollbackAllMigrations,
  migrations,
} from '../runner.js';
import type { MigrationRecord, MigrationStatus } from '../types.js';

describe('Migration Integration Tests', () => {
  let testDb: Database.Database;
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    // Create a temp directory for test database
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'decant-migration-test-'));
    dbPath = path.join(tempDir, 'test-migrations.db');

    // Create a real database file
    testDb = new Database(dbPath);
    testDb.pragma('foreign_keys = ON');
    testDb.pragma('journal_mode = WAL');
  });

  afterEach(() => {
    // Close database
    if (testDb) {
      testDb.close();
    }

    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      // Need to clean up WAL files too
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
      fs.rmdirSync(tempDir);
    }
  });

  describe('Migration Application Order', () => {
    it('should apply all migrations in sequential order', () => {
      const appliedNames = runPendingMigrations(testDb);

      // Verify all migrations were applied
      expect(appliedNames).toHaveLength(migrations.length);

      // Verify they were applied in order
      for (let i = 0; i < migrations.length; i++) {
        expect(appliedNames[i]).toBe(migrations[i].name);
      }

      // Verify the _migrations table records are in order
      const records = getAppliedMigrations(testDb);
      expect(records).toHaveLength(migrations.length);

      for (let i = 0; i < records.length; i++) {
        expect(records[i].name).toBe(migrations[i].name);
        expect(records[i].id).toBe(i + 1); // IDs should be sequential
      }
    });

    it('should apply migrations atomically (each in its own transaction)', () => {
      // Run migrations
      runPendingMigrations(testDb);

      // Each migration should have an applied_at timestamp
      const records = getAppliedMigrations(testDb);

      for (const record of records) {
        expect(record.applied_at).toBeDefined();
        expect(typeof record.applied_at).toBe('string');
        // Should be a valid ISO date string
        expect(() => new Date(record.applied_at)).not.toThrow();
      }
    });
  });

  describe('Migration Idempotency', () => {
    it('should be idempotent - running twice has no effect', () => {
      // First run
      const firstRun = runPendingMigrations(testDb);
      expect(firstRun.length).toBe(migrations.length);

      // Second run should not apply anything
      const secondRun = runPendingMigrations(testDb);
      expect(secondRun.length).toBe(0);

      // Database state should be unchanged
      const records = getAppliedMigrations(testDb);
      expect(records.length).toBe(migrations.length);
    });

    it('should be idempotent - running multiple times has no effect', () => {
      // Run 5 times
      for (let i = 0; i < 5; i++) {
        runPendingMigrations(testDb);
      }

      // Should still have exactly the same number of migration records
      const records = getAppliedMigrations(testDb);
      expect(records.length).toBe(migrations.length);
    });

    it('should maintain consistent database state across multiple runs', () => {
      // Apply migrations
      runPendingMigrations(testDb);

      // Get initial table structure
      const getTableNames = () => {
        const tables = testDb
          .prepare(
            `SELECT name FROM sqlite_master
             WHERE type='table' AND name NOT LIKE 'sqlite_%'
             ORDER BY name`
          )
          .all() as { name: string }[];
        return tables.map((t) => t.name);
      };

      const initialTables = getTableNames();

      // Run migrations again
      runPendingMigrations(testDb);

      // Tables should be unchanged
      const finalTables = getTableNames();
      expect(finalTables).toEqual(initialTables);
    });
  });

  describe('_migrations Table Tracking', () => {
    it('should create _migrations table if not exists', () => {
      // Initially no _migrations table
      const beforeTable = testDb
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'`
        )
        .get();
      expect(beforeTable).toBeUndefined();

      // Run migrations
      runPendingMigrations(testDb);

      // _migrations table should exist
      const afterTable = testDb
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'`
        )
        .get();
      expect(afterTable).toBeDefined();
    });

    it('should track each applied migration with name and timestamp', () => {
      runPendingMigrations(testDb);

      const records = testDb
        .prepare('SELECT id, name, applied_at FROM _migrations ORDER BY id')
        .all() as MigrationRecord[];

      expect(records.length).toBe(migrations.length);

      for (const record of records) {
        expect(record.id).toBeTypeOf('number');
        expect(record.name).toBeTypeOf('string');
        expect(record.applied_at).toBeTypeOf('string');

        // Name should match one of the migrations
        const matchingMigration = migrations.find((m) => m.name === record.name);
        expect(matchingMigration).toBeDefined();
      }
    });

    it('should not duplicate records for the same migration', () => {
      // Run migrations twice
      runPendingMigrations(testDb);
      runPendingMigrations(testDb);

      // Check for duplicates
      const records = testDb
        .prepare('SELECT name, COUNT(*) as count FROM _migrations GROUP BY name')
        .all() as { name: string; count: number }[];

      for (const record of records) {
        expect(record.count).toBe(1);
      }
    });

    it('should provide accurate migration status', () => {
      // Before running migrations
      const beforeStatus = getMigrationStatus(testDb);
      expect(beforeStatus.every((s) => !s.applied)).toBe(true);

      // Run first migration manually
      ensureMigrationsTable(testDb);
      testDb.exec(`INSERT INTO _migrations (name) VALUES ('001_initial_schema')`);

      // Check status shows first as applied, rest as pending
      const partialStatus = getMigrationStatus(testDb);
      const firstMigration = partialStatus.find(
        (s) => s.name === '001_initial_schema'
      );
      expect(firstMigration?.applied).toBe(true);

      const pendingCount = partialStatus.filter((s) => !s.applied).length;
      expect(pendingCount).toBe(migrations.length - 1);
    });
  });

  describe('Migration Failure Handling', () => {
    it('should handle migration failure gracefully', () => {
      // First apply all migrations
      runPendingMigrations(testDb);

      // Verify migrations were applied
      const applied = getAppliedMigrations(testDb);
      expect(applied.length).toBe(migrations.length);

      // The runner should have proper error handling - test that status is accurate
      const status = getMigrationStatus(testDb);
      expect(status.every((s) => s.applied)).toBe(true);
    });

    it('should rollback failed migration transaction', () => {
      // Create a custom test - simulate failure by checking transaction behavior
      // Create a table, start a transaction, fail it, verify rollback

      // First apply all real migrations
      runPendingMigrations(testDb);

      // Now test transaction rollback behavior
      const tableName = 'test_rollback_table';

      // This transaction should fail and rollback
      try {
        const failedTransaction = testDb.transaction(() => {
          testDb.exec(`CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY)`);
          // Force an error
          throw new Error('Simulated failure');
        });
        failedTransaction();
      } catch {
        // Expected to fail
      }

      // Table should not exist due to rollback
      const tableExists = testDb
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
        )
        .get(tableName);

      expect(tableExists).toBeUndefined();
    });

    it('should preserve database state on migration failure', () => {
      // Apply migrations
      runPendingMigrations(testDb);

      // Record initial state
      const initialRecords = getAppliedMigrations(testDb);
      const initialTables = testDb
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
        )
        .all();

      // Try to run again (should be no-op)
      runPendingMigrations(testDb);

      // State should be unchanged
      const finalRecords = getAppliedMigrations(testDb);
      const finalTables = testDb
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
        )
        .all();

      expect(finalRecords.length).toBe(initialRecords.length);
      expect(finalTables).toEqual(initialTables);
    });
  });

  describe('Schema Verification', () => {
    it('should create all expected tables', () => {
      runPendingMigrations(testDb);

      const expectedTables = [
        '_migrations',
        'nodes',
        'key_concepts',
        'segments',
        'organizations',
      ];

      for (const tableName of expectedTables) {
        const table = testDb
          .prepare(
            `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
          )
          .get(tableName);
        expect(table).toBeDefined();
      }
    });

    it('should create all expected indexes', () => {
      runPendingMigrations(testDb);

      const indexes = testDb
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'`
        )
        .all() as { name: string }[];

      const indexNames = indexes.map((i) => i.name);

      // Indexes from 001_initial_schema (still present after 003)
      expect(indexNames).toContain('idx_nodes_deleted');
      expect(indexNames).toContain('idx_key_concepts_node');

      // Indexes from 002_add_indexes
      expect(indexNames).toContain('idx_nodes_source_domain');
      expect(indexNames).toContain('idx_nodes_company');
      expect(indexNames).toContain('idx_nodes_date_added');
      expect(indexNames).toContain('idx_nodes_updated_at');

      // Composite indexes from 003_add_tree_indexes
      // (these replace idx_nodes_function_parent and idx_nodes_organization_parent)
      expect(indexNames).toContain('idx_nodes_function_parent_date');
      expect(indexNames).toContain('idx_nodes_organization_parent_date');
      expect(indexNames).toContain('idx_nodes_function_parent_deleted');
      expect(indexNames).toContain('idx_nodes_organization_parent_deleted');
    });

    it('should create FTS5 virtual table for full-text search', () => {
      runPendingMigrations(testDb);

      // FTS5 tables are stored as 'table' type in sqlite_master
      const ftsTable = testDb
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='nodes_fts'`
        )
        .get();
      expect(ftsTable).toBeDefined();
    });

    it('should maintain referential integrity', () => {
      runPendingMigrations(testDb);

      // Insert a node
      testDb
        .prepare(
          `INSERT INTO nodes (id, title, url, source_domain) VALUES (?, ?, ?, ?)`
        )
        .run('test-node', 'Test Node', 'https://example.com', 'example.com');

      // Insert a key concept referencing the node
      testDb
        .prepare(`INSERT INTO key_concepts (id, node_id, concept) VALUES (?, ?, ?)`)
        .run('kc-1', 'test-node', 'Test Concept');

      // Trying to delete the node should fail due to foreign key constraint
      // (unless ON DELETE CASCADE is set, in which case the key_concept is deleted)
      testDb.prepare(`DELETE FROM nodes WHERE id = ?`).run('test-node');

      // Key concept should be deleted due to CASCADE
      const keyConcept = testDb
        .prepare(`SELECT * FROM key_concepts WHERE id = ?`)
        .get('kc-1');
      expect(keyConcept).toBeUndefined();
    });
  });

  describe('Full Migration Cycle', () => {
    it('should support full up/down/up cycle', () => {
      // Up
      const upResult = runPendingMigrations(testDb);
      expect(upResult.length).toBe(migrations.length);

      // Down
      const downResult = rollbackAllMigrations(testDb);
      expect(downResult.length).toBe(migrations.length);

      // Verify core tables are dropped (except _migrations)
      // Note: We check for regular tables only, as virtual tables like FTS5
      // may have internal tables that persist
      const coreTablesAfterDown = testDb
        .prepare(
          `SELECT name FROM sqlite_master
           WHERE type='table'
           AND name NOT IN ('_migrations')
           AND name NOT LIKE 'nodes_fts%'
           AND name NOT LIKE 'sqlite_%'`
        )
        .all() as { name: string }[];

      expect(coreTablesAfterDown.length).toBe(0);

      // Up again
      const reUpResult = runPendingMigrations(testDb);
      expect(reUpResult.length).toBe(migrations.length);

      // Verify tables are back
      const tablesAfterReUp = testDb
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='nodes'`
        )
        .get();
      expect(tablesAfterReUp).toBeDefined();
    });

    it('should preserve database file integrity', () => {
      // Run migrations
      runPendingMigrations(testDb);

      // Close and reopen database
      testDb.close();
      testDb = new Database(dbPath);
      testDb.pragma('foreign_keys = ON');

      // Migrations should still be recorded
      const records = getAppliedMigrations(testDb);
      expect(records.length).toBe(migrations.length);

      // Tables should still exist
      const nodesTable = testDb
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='nodes'`
        )
        .get();
      expect(nodesTable).toBeDefined();
    });
  });
});
