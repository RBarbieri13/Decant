// ============================================================
// Migration Runner
// Handles database migration execution and tracking
// ============================================================

import type Database from 'better-sqlite3';
import type { Migration, MigrationRecord, MigrationStatus } from './types.js';
import { log } from '../../logger/index.js';

// Import all migrations in order
import migration001 from './001_initial_schema.js';
import migration002 from './002_add_indexes.js';
import migration003 from './003_add_tree_indexes.js';
import migration004 from './004_add_hierarchy_codes.js';
import migration005 from './005_add_processing_queue.js';
import migration006 from './006_add_hierarchy_indexes.js';
import migration007 from './007_add_metadata_registry.js';
import migration008 from './008_add_similarity.js';
import migration009 from './009_add_hierarchy_audit.js';

/**
 * All available migrations in order of execution
 */
export const migrations: Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
  migration009,
];

/**
 * Ensures the _migrations table exists
 */
export function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/**
 * Gets all applied migrations from the database
 */
export function getAppliedMigrations(db: Database.Database): MigrationRecord[] {
  ensureMigrationsTable(db);
  const stmt = db.prepare('SELECT id, name, applied_at FROM _migrations ORDER BY id ASC');
  return stmt.all() as MigrationRecord[];
}

/**
 * Records a migration as applied
 */
function recordMigration(db: Database.Database, name: string): void {
  const stmt = db.prepare('INSERT INTO _migrations (name) VALUES (?)');
  stmt.run(name);
}

/**
 * Removes a migration record (used during rollback)
 */
function removeMigrationRecord(db: Database.Database, name: string): void {
  const stmt = db.prepare('DELETE FROM _migrations WHERE name = ?');
  stmt.run(name);
}

/**
 * Gets the status of all migrations (applied and pending)
 */
export function getMigrationStatus(db: Database.Database): MigrationStatus[] {
  const appliedMigrations = getAppliedMigrations(db);
  const appliedMap = new Map(appliedMigrations.map(m => [m.name, m]));

  return migrations.map(migration => {
    const applied = appliedMap.get(migration.name);
    return {
      name: migration.name,
      applied: !!applied,
      appliedAt: applied?.applied_at,
    };
  });
}

/**
 * Gets pending migrations that haven't been applied yet
 */
export function getPendingMigrations(db: Database.Database): Migration[] {
  const appliedMigrations = getAppliedMigrations(db);
  const appliedNames = new Set(appliedMigrations.map(m => m.name));
  return migrations.filter(m => !appliedNames.has(m.name));
}

/**
 * Runs all pending migrations
 * Returns the names of migrations that were applied
 */
export function runPendingMigrations(db: Database.Database): string[] {
  ensureMigrationsTable(db);

  const pending = getPendingMigrations(db);
  const applied: string[] = [];

  for (const migration of pending) {
    log.debug(`Running migration: ${migration.name}`, { migration: migration.name, module: 'migrations' });

    // Run each migration in a transaction
    const runMigration = db.transaction(() => {
      migration.up(db);
      recordMigration(db, migration.name);
    });

    try {
      runMigration();
      applied.push(migration.name);
      log.debug(`Applied migration: ${migration.name}`, { migration: migration.name, module: 'migrations' });
    } catch (error) {
      log.error(`Migration failed: ${migration.name}`, { migration: migration.name, err: error, module: 'migrations' });
      throw new Error(`Migration ${migration.name} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (applied.length === 0) {
    log.debug('No pending migrations to apply', { module: 'migrations' });
  } else {
    log.info(`Applied ${applied.length} migration(s)`, { count: applied.length, migrations: applied, module: 'migrations' });
  }

  return applied;
}

/**
 * Rolls back a specific migration by name
 * Returns true if the migration was rolled back, false if not found
 */
export function rollbackMigration(db: Database.Database, name: string): boolean {
  ensureMigrationsTable(db);

  // Find the migration
  const migration = migrations.find(m => m.name === name);
  if (!migration) {
    log.error(`Migration not found: ${name}`, { migration: name, module: 'migrations' });
    return false;
  }

  // Check if it's applied
  const appliedMigrations = getAppliedMigrations(db);
  const isApplied = appliedMigrations.some(m => m.name === name);
  if (!isApplied) {
    log.debug(`Migration not applied, nothing to rollback: ${name}`, { migration: name, module: 'migrations' });
    return false;
  }

  // Check for dependent migrations (migrations applied after this one)
  const migrationIndex = migrations.findIndex(m => m.name === name);
  const laterMigrations = migrations.slice(migrationIndex + 1);
  const appliedLaterMigrations = laterMigrations.filter(m =>
    appliedMigrations.some(a => a.name === m.name)
  );

  if (appliedLaterMigrations.length > 0) {
    const laterNames = appliedLaterMigrations.map(m => m.name).join(', ');
    throw new Error(
      `Cannot rollback ${name}: later migrations depend on it (${laterNames}). ` +
      `Rollback those migrations first.`
    );
  }

  log.debug(`Rolling back migration: ${name}`, { migration: name, module: 'migrations' });

  // Run rollback in a transaction
  const doRollback = db.transaction(() => {
    migration.down(db);
    removeMigrationRecord(db, name);
  });

  try {
    doRollback();
    log.info(`Rolled back migration: ${name}`, { migration: name, module: 'migrations' });
    return true;
  } catch (error) {
    log.error(`Rollback failed: ${name}`, { migration: name, err: error, module: 'migrations' });
    throw new Error(`Rollback of ${migration.name} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Rolls back all migrations in reverse order
 * Use with caution - this will destroy all data
 */
export function rollbackAllMigrations(db: Database.Database): string[] {
  ensureMigrationsTable(db);

  const applied = getAppliedMigrations(db);
  const rolledBack: string[] = [];

  // Rollback in reverse order
  for (const record of [...applied].reverse()) {
    const migration = migrations.find(m => m.name === record.name);
    if (migration) {
      log.debug(`Rolling back migration: ${migration.name}`, { migration: migration.name, module: 'migrations' });

      const doRollback = db.transaction(() => {
        migration.down(db);
        removeMigrationRecord(db, migration.name);
      });

      try {
        doRollback();
        rolledBack.push(migration.name);
        log.debug(`Rolled back migration: ${migration.name}`, { migration: migration.name, module: 'migrations' });
      } catch (error) {
        log.error(`Rollback failed: ${migration.name}`, { migration: migration.name, err: error, module: 'migrations' });
        throw new Error(`Rollback of ${migration.name} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  if (rolledBack.length === 0) {
    log.debug('No migrations to rollback', { module: 'migrations' });
  } else {
    log.info(`Rolled back ${rolledBack.length} migration(s)`, { count: rolledBack.length, migrations: rolledBack, module: 'migrations' });
  }

  return rolledBack;
}
