// ============================================================
// Migration Runner Unit Tests
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  ensureMigrationsTable,
  getAppliedMigrations,
  getMigrationStatus,
  getPendingMigrations,
  runPendingMigrations,
  rollbackMigration,
  rollbackAllMigrations,
  migrations,
} from '../runner.js';
import type { Migration } from '../types.js';

describe('Migration Runner', () => {
  let testDb: Database.Database;

  beforeEach(() => {
    // Create fresh in-memory database for each test
    testDb = new Database(':memory:');
    testDb.pragma('foreign_keys = ON');
  });

  afterEach(() => {
    if (testDb) {
      testDb.close();
    }
  });

  describe('ensureMigrationsTable', () => {
    it('should create _migrations table if it does not exist', () => {
      ensureMigrationsTable(testDb);

      const result = testDb
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'`)
        .get();

      expect(result).toBeDefined();
      expect((result as any).name).toBe('_migrations');
    });

    it('should not fail if _migrations table already exists', () => {
      ensureMigrationsTable(testDb);

      // Should not throw when called again
      expect(() => ensureMigrationsTable(testDb)).not.toThrow();
    });

    it('should create table with correct schema', () => {
      ensureMigrationsTable(testDb);

      const columns = testDb
        .prepare(`PRAGMA table_info(_migrations)`)
        .all() as any[];

      const columnNames = columns.map(c => c.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('applied_at');
    });
  });

  describe('getAppliedMigrations', () => {
    it('should return empty array when no migrations applied', () => {
      const applied = getAppliedMigrations(testDb);
      expect(applied).toEqual([]);
    });

    it('should return applied migrations in order', () => {
      ensureMigrationsTable(testDb);

      testDb.prepare(`INSERT INTO _migrations (name) VALUES (?)`).run('001_test');
      testDb.prepare(`INSERT INTO _migrations (name) VALUES (?)`).run('002_test');

      const applied = getAppliedMigrations(testDb);

      expect(applied).toHaveLength(2);
      expect(applied[0].name).toBe('001_test');
      expect(applied[1].name).toBe('002_test');
      expect(applied[0].applied_at).toBeDefined();
    });
  });

  describe('getMigrationStatus', () => {
    it('should show all migrations with applied status', () => {
      ensureMigrationsTable(testDb);

      // Apply first migration only
      testDb.prepare(`INSERT INTO _migrations (name) VALUES (?)`).run('001_initial_schema');

      const status = getMigrationStatus(testDb);

      expect(status.length).toBeGreaterThan(0);

      const first = status.find(s => s.name === '001_initial_schema');
      expect(first?.applied).toBe(true);
      expect(first?.appliedAt).toBeDefined();

      // Check that at least one migration is not applied
      const hasUnapplied = status.some(s => !s.applied);
      expect(hasUnapplied).toBe(true);
    });
  });

  describe('getPendingMigrations', () => {
    it('should return all migrations when none applied', () => {
      const pending = getPendingMigrations(testDb);
      expect(pending.length).toBe(migrations.length);
    });

    it('should return only unapplied migrations', () => {
      ensureMigrationsTable(testDb);

      // Apply first migration
      testDb.prepare(`INSERT INTO _migrations (name) VALUES (?)`).run('001_initial_schema');

      const pending = getPendingMigrations(testDb);

      expect(pending.length).toBe(migrations.length - 1);
      expect(pending.every(m => m.name !== '001_initial_schema')).toBe(true);
    });
  });

  describe('runPendingMigrations', () => {
    it('should run all pending migrations', () => {
      const applied = runPendingMigrations(testDb);

      expect(applied.length).toBe(migrations.length);

      // Verify all migrations are recorded
      const records = getAppliedMigrations(testDb);
      expect(records.length).toBe(migrations.length);
    });

    it('should run migrations in order', () => {
      const applied = runPendingMigrations(testDb);

      // Check that migrations are applied in order
      for (let i = 0; i < applied.length; i++) {
        expect(applied[i]).toBe(migrations[i].name);
      }
    });

    it('should not rerun already applied migrations', () => {
      // Run migrations first time
      const firstRun = runPendingMigrations(testDb);
      expect(firstRun.length).toBeGreaterThan(0);

      // Run again
      const secondRun = runPendingMigrations(testDb);
      expect(secondRun.length).toBe(0);
    });

    it('should create tables from initial schema migration', () => {
      runPendingMigrations(testDb);

      // Verify nodes table exists
      const nodesTable = testDb
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='nodes'`)
        .get();
      expect(nodesTable).toBeDefined();

      // Verify segments table exists
      const segmentsTable = testDb
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='segments'`)
        .get();
      expect(segmentsTable).toBeDefined();
    });

    it('should create indexes from index migration', () => {
      runPendingMigrations(testDb);

      // Verify indexes exist
      const indexes = testDb
        .prepare(`SELECT name FROM sqlite_master WHERE type='index'`)
        .all() as any[];

      const indexNames = indexes.map(idx => idx.name);
      expect(indexNames).toContain('idx_nodes_source_domain');
      expect(indexNames).toContain('idx_nodes_company');
      expect(indexNames).toContain('idx_nodes_date_added');
    });

    it('should rollback on migration failure', () => {
      // Create a migration that will fail
      const failingMigration: Migration = {
        name: '999_failing_test',
        up: (db) => {
          db.exec('CREATE TABLE test_table (id INTEGER PRIMARY KEY)');
          // This will fail - invalid SQL
          db.exec('INVALID SQL STATEMENT');
        },
        down: (db) => {
          db.exec('DROP TABLE IF EXISTS test_table');
        },
      };

      // Temporarily add failing migration
      const originalMigrations = [...migrations];
      (migrations as any).push(failingMigration);

      try {
        expect(() => runPendingMigrations(testDb)).toThrow();

        // Verify the migration was not recorded
        const applied = getAppliedMigrations(testDb);
        expect(applied.every(m => m.name !== '999_failing_test')).toBe(true);

        // Verify the test table was rolled back
        const testTable = testDb
          .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'`)
          .get();
        expect(testTable).toBeUndefined();
      } finally {
        // Restore original migrations
        (migrations as any).pop();
      }
    });
  });

  describe('rollbackMigration', () => {
    beforeEach(() => {
      // Apply all migrations before rollback tests
      runPendingMigrations(testDb);
    });

    it('should rollback a specific migration', () => {
      const success = rollbackMigration(testDb, '002_add_indexes');

      expect(success).toBe(true);

      // Verify migration record removed
      const applied = getAppliedMigrations(testDb);
      expect(applied.every(m => m.name !== '002_add_indexes')).toBe(true);
    });

    it('should remove indexes when rolling back index migration', () => {
      rollbackMigration(testDb, '002_add_indexes');

      const indexes = testDb
        .prepare(`SELECT name FROM sqlite_master WHERE type='index'`)
        .all() as any[];

      const indexNames = indexes.map(idx => idx.name);
      expect(indexNames).not.toContain('idx_nodes_source_domain');
      expect(indexNames).not.toContain('idx_nodes_company');
    });

    it('should return false for non-existent migration', () => {
      const success = rollbackMigration(testDb, '999_nonexistent');
      expect(success).toBe(false);
    });

    it('should return false for unapplied migration', () => {
      // Rollback all first
      rollbackAllMigrations(testDb);

      const success = rollbackMigration(testDb, '001_initial_schema');
      expect(success).toBe(false);
    });

    it('should prevent rollback if later migrations depend on it', () => {
      // Try to rollback first migration when second is still applied
      expect(() => rollbackMigration(testDb, '001_initial_schema')).toThrow(
        /later migrations depend on it/
      );
    });
  });

  describe('rollbackAllMigrations', () => {
    beforeEach(() => {
      // Apply all migrations before rollback tests
      runPendingMigrations(testDb);
    });

    it('should rollback all migrations in reverse order', () => {
      const rolledBack = rollbackAllMigrations(testDb);

      expect(rolledBack.length).toBe(migrations.length);

      // Verify all migration records removed
      const applied = getAppliedMigrations(testDb);
      expect(applied.length).toBe(0);
    });

    it('should rollback migrations in reverse order', () => {
      const rolledBack = rollbackAllMigrations(testDb);

      // Last migration should be rolled back first
      expect(rolledBack[0]).toBe(migrations[migrations.length - 1].name);
      expect(rolledBack[rolledBack.length - 1]).toBe(migrations[0].name);
    });

    it('should drop all tables', () => {
      rollbackAllMigrations(testDb);

      // Verify tables are dropped
      const tables = testDb
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name != '_migrations'`)
        .all() as any[];

      expect(tables.length).toBe(0);
    });

    it('should handle empty database gracefully', () => {
      // Rollback all first time
      rollbackAllMigrations(testDb);

      // Rollback again should return empty array
      const secondRollback = rollbackAllMigrations(testDb);
      expect(secondRollback.length).toBe(0);
    });
  });

  describe('migration idempotency', () => {
    it('should allow full cycle of up and down', () => {
      // Apply all
      const applied = runPendingMigrations(testDb);
      expect(applied.length).toBe(migrations.length);

      // Rollback all
      const rolledBack = rollbackAllMigrations(testDb);
      expect(rolledBack.length).toBe(migrations.length);

      // Apply again
      const reapplied = runPendingMigrations(testDb);
      expect(reapplied.length).toBe(migrations.length);

      // Verify database structure is correct
      const tables = testDb
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name != '_migrations'`)
        .all() as any[];

      expect(tables.length).toBeGreaterThan(0);
    });

    it('should maintain data integrity through partial rollback', () => {
      // Insert test data
      testDb.prepare(`
        INSERT INTO segments (id, name) VALUES (?, ?)
      `).run('test-id', 'Test Segment');

      // Rollback index migration (doesn't affect data)
      rollbackMigration(testDb, '002_add_indexes');

      // Verify data still exists
      const segment = testDb
        .prepare(`SELECT * FROM segments WHERE id = ?`)
        .get('test-id');

      expect(segment).toBeDefined();
      expect((segment as any).name).toBe('Test Segment');
    });
  });
});
