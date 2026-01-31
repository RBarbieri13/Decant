// ============================================================
// Migration Types
// ============================================================

import type Database from 'better-sqlite3';

/**
 * Represents a database migration
 */
export interface Migration {
  /** Unique name of the migration (e.g., "001_initial_schema") */
  name: string;
  /** Function to apply the migration */
  up: (db: Database.Database) => void;
  /** Function to rollback the migration */
  down: (db: Database.Database) => void;
}

/**
 * Represents a migration record stored in the database
 */
export interface MigrationRecord {
  id: number;
  name: string;
  applied_at: string;
}

/**
 * Migration status information
 */
export interface MigrationStatus {
  name: string;
  applied: boolean;
  appliedAt?: string;
}
