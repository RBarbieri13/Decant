// ============================================================
// Database Schema
// ============================================================

import { getDatabase, isDatabaseInitialized } from './connection.js';
import { runPendingMigrations, getMigrationStatus } from './migrations/runner.js';
import { log } from '../logger/index.js';

/**
 * Initialize the database by running all pending migrations.
 * This is the main entry point for database setup.
 *
 * The function is idempotent - it's safe to call multiple times.
 * Already-applied migrations will be skipped.
 */
export function initializeDatabase(): void {
  const db = getDatabase();

  // Check if this is a fresh database or an existing one
  const isExisting = isDatabaseInitialized();

  if (isExisting) {
    log.debug('Database exists, checking for pending migrations...');
  } else {
    log.info('Initializing new database...');
  }

  // Run any pending migrations
  const applied = runPendingMigrations(db);

  if (applied.length === 0 && isExisting) {
    log.debug('Database is up to date');
  } else if (applied.length > 0) {
    log.info(`Database initialized/updated with ${applied.length} migration(s)`, { migrationsApplied: applied.length });
  }
}

/**
 * Run pending migrations.
 * This is an alias for initializeDatabase() for backwards compatibility.
 *
 * @deprecated Use initializeDatabase() instead
 */
export function runMigrations(): void {
  const db = getDatabase();
  runPendingMigrations(db);
  log.debug('Migrations completed');
}

/**
 * Get the current migration status.
 * Useful for debugging and administration.
 */
export function getDatabaseMigrationStatus() {
  const db = getDatabase();
  return getMigrationStatus(db);
}
