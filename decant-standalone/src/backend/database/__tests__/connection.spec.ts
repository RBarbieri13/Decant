// ============================================================
// Database Connection Tests
// Tests for connection.ts module
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

// We need to test the actual connection module, not the mocked version
// So we import directly and don't use the setup file's mocks
vi.unmock('../connection.js');
vi.unmock('../connection');

// Import after unmocking
import {
  getDatabasePath,
  getDatabase,
  closeDatabase,
  _resetDatabaseInstance,
} from '../connection.js';

describe('Database Connection', () => {
  // Store original env for restoration
  const originalEnv = { ...process.env };
  let tempDir: string;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    delete process.env.DATABASE_PATH;

    // Create a temp directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'decant-test-'));

    // Reset the database singleton
    _resetDatabaseInstance();
  });

  afterEach(() => {
    // Clean up: close any open database
    _resetDatabaseInstance();

    // Restore original environment
    process.env = originalEnv;

    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('getDatabasePath', () => {
    it('should use DATABASE_PATH environment variable when set', () => {
      const customPath = path.join(tempDir, 'custom', 'decant.db');
      process.env.DATABASE_PATH = customPath;

      const result = getDatabasePath();

      expect(result).toBe(customPath);
    });

    it('should create parent directory for DATABASE_PATH if it does not exist', () => {
      const customPath = path.join(tempDir, 'nested', 'dirs', 'decant.db');
      process.env.DATABASE_PATH = customPath;

      // Ensure parent doesn't exist
      expect(fs.existsSync(path.dirname(customPath))).toBe(false);

      getDatabasePath();

      // Now parent should exist
      expect(fs.existsSync(path.dirname(customPath))).toBe(true);
    });

    it('should default to ~/.decant/data/ when DATABASE_PATH is not set', () => {
      delete process.env.DATABASE_PATH;

      const result = getDatabasePath();

      const expectedDir = path.join(os.homedir(), '.decant', 'data');
      expect(result).toBe(path.join(expectedDir, 'decant.db'));
    });

    it('should create default directory if it does not exist', () => {
      delete process.env.DATABASE_PATH;

      // Mock homedir to use our temp directory
      const mockHomeDir = path.join(tempDir, 'home');
      vi.spyOn(os, 'homedir').mockReturnValue(mockHomeDir);

      const expectedDir = path.join(mockHomeDir, '.decant', 'data');

      // Ensure directory doesn't exist
      expect(fs.existsSync(expectedDir)).toBe(false);

      getDatabasePath();

      // Now directory should exist
      expect(fs.existsSync(expectedDir)).toBe(true);

      vi.restoreAllMocks();
    });
  });

  describe('getDatabase', () => {
    it('should return a singleton database instance', () => {
      const dbPath = path.join(tempDir, 'singleton-test.db');
      process.env.DATABASE_PATH = dbPath;

      const db1 = getDatabase();
      const db2 = getDatabase();

      expect(db1).toBe(db2);
      expect(db1).toBeInstanceOf(Database);
    });

    it('should have foreign keys enabled', () => {
      const dbPath = path.join(tempDir, 'fk-test.db');
      process.env.DATABASE_PATH = dbPath;

      const db = getDatabase();
      const result = db.pragma('foreign_keys') as { foreign_keys: number }[];

      expect(result[0].foreign_keys).toBe(1);
    });

    it('should use WAL mode for better concurrency', () => {
      const dbPath = path.join(tempDir, 'wal-test.db');
      process.env.DATABASE_PATH = dbPath;

      const db = getDatabase();
      const result = db.pragma('journal_mode') as { journal_mode: string }[];

      expect(result[0].journal_mode).toBe('wal');
    });

    it('should create database file if it does not exist', () => {
      const dbPath = path.join(tempDir, 'new-db.db');
      process.env.DATABASE_PATH = dbPath;

      expect(fs.existsSync(dbPath)).toBe(false);

      getDatabase();

      expect(fs.existsSync(dbPath)).toBe(true);
    });
  });

  describe('closeDatabase', () => {
    it('should close the database connection safely', () => {
      const dbPath = path.join(tempDir, 'close-test.db');
      process.env.DATABASE_PATH = dbPath;

      // Open the database
      const db = getDatabase();
      expect(db.open).toBe(true);

      // Close it
      closeDatabase();

      // After closing, the db variable is set to null internally
      // So getting a new database should create a new instance
      _resetDatabaseInstance(); // Ensure clean state
      const db2 = getDatabase();
      expect(db2).toBeInstanceOf(Database);
      expect(db2.open).toBe(true);
    });

    it('should not throw when called multiple times', () => {
      const dbPath = path.join(tempDir, 'multi-close-test.db');
      process.env.DATABASE_PATH = dbPath;

      getDatabase();

      // Close multiple times should not throw
      expect(() => closeDatabase()).not.toThrow();
      expect(() => closeDatabase()).not.toThrow();
      expect(() => closeDatabase()).not.toThrow();
    });

    it('should not throw when called before any database is opened', () => {
      // Don't open any database, just try to close
      expect(() => closeDatabase()).not.toThrow();
    });
  });

  describe('_resetDatabaseInstance', () => {
    it('should allow re-initialization with different settings', () => {
      // First database with path 1
      const dbPath1 = path.join(tempDir, 'db1.db');
      process.env.DATABASE_PATH = dbPath1;
      getDatabase();
      expect(fs.existsSync(dbPath1)).toBe(true);

      // Reset and use different path
      _resetDatabaseInstance();

      const dbPath2 = path.join(tempDir, 'db2.db');
      process.env.DATABASE_PATH = dbPath2;
      getDatabase();
      expect(fs.existsSync(dbPath2)).toBe(true);
    });
  });

  describe('Database Pragmas', () => {
    it('should have proper SQLite configuration', () => {
      const dbPath = path.join(tempDir, 'pragma-test.db');
      process.env.DATABASE_PATH = dbPath;

      const db = getDatabase();

      // Check foreign keys
      const fkResult = db.pragma('foreign_keys') as { foreign_keys: number }[];
      expect(fkResult[0].foreign_keys).toBe(1);

      // Check WAL mode
      const walResult = db.pragma('journal_mode') as { journal_mode: string }[];
      expect(walResult[0].journal_mode).toBe('wal');
    });
  });
});
