// ============================================================
// Database Connection
// ============================================================

import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { log } from '../logger/index.js';

let db: Database.Database | null = null;

/**
 * Get the database file path.
 *
 * Priority:
 * 1. DATABASE_PATH environment variable (used in Docker/production)
 * 2. Default: ~/.decant/data/decant.db (local development)
 *
 * Creates the parent directory if it doesn't exist.
 */
export function getDatabasePath(): string {
  // Check for DATABASE_PATH environment variable (used in Docker)
  const envPath = process.env.DATABASE_PATH;
  if (envPath) {
    // Ensure the parent directory exists
    const parentDir = path.dirname(envPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    return envPath;
  }

  // Default to ~/.decant/data/decant.db
  const dataDir = path.join(os.homedir(), '.decant', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'decant.db');
}

export function getDatabase(): Database.Database {
  if (db) {
    return db;
  }

  const dbPath = getDatabasePath();
  log.info(`Opening database at: ${dbPath}`, { dbPath });

  db = new Database(dbPath);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    log.debug('Database connection closed');
  }
}

export function isDatabaseInitialized(): boolean {
  const database = getDatabase();
  const result = database.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='nodes'
  `).get();
  return !!result;
}

/**
 * Reset the singleton database instance.
 * Used only for testing to allow re-initialization with different settings.
 * @internal
 */
export function _resetDatabaseInstance(): void {
  if (db) {
    try {
      db.close();
    } catch {
      // Ignore errors during close - database might already be closed
    }
  }
  db = null;
}
