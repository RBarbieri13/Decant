// ============================================================
// Backup Service Tests
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import {
  createBackup,
  listBackups,
  restoreBackup,
  deleteBackup,
  exportData,
  importData,
  getBackupDirectory,
  type ExportData,
} from '../backup.js';
import { getDatabase, closeDatabase, getDatabasePath } from '../../database/connection.js';
import { runMigrations } from '../../database/migrations/runner.js';

describe('Backup Service', () => {
  let testDbPath: string;
  let originalDbPath: string;

  beforeEach(async () => {
    // Create a test database
    const testDir = path.join(os.tmpdir(), 'decant-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    testDbPath = path.join(testDir, 'decant.db');

    // Store original path and override
    originalDbPath = getDatabasePath();

    // Initialize database with schema
    const db = getDatabase();
    await runMigrations();

    // Insert test data
    db.prepare(`
      INSERT INTO segments (id, name, code, description, color, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('seg1', 'Test Segment', 'TEST_SEG', 'Test segment description', '#ff0000', new Date().toISOString());

    db.prepare(`
      INSERT INTO organizations (id, name, code, description, color, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('org1', 'Test Org', 'TEST_ORG', 'Test org description', '#00ff00', new Date().toISOString());

    db.prepare(`
      INSERT INTO nodes (
        id, title, url, source_domain, date_added,
        function_parent_id, organization_parent_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'node1',
      'Test Node',
      'https://example.com/test',
      'example.com',
      new Date().toISOString(),
      'seg1',
      'org1',
      new Date().toISOString(),
      new Date().toISOString()
    );

    db.prepare(`
      INSERT INTO key_concepts (id, node_id, concept)
      VALUES (?, ?, ?)
    `).run('kc1', 'node1', 'test concept');
  });

  afterEach(async () => {
    closeDatabase();

    // Clean up test database
    try {
      if (testDbPath && fsSync.existsSync(testDbPath)) {
        await fs.unlink(testDbPath);
        await fs.unlink(testDbPath + '-wal').catch(() => {});
        await fs.unlink(testDbPath + '-shm').catch(() => {});
        await fs.rm(path.dirname(testDbPath), { recursive: true, force: true });
      }
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  // ============================================================
  // Backup Creation Tests
  // ============================================================

  describe('createBackup', () => {
    it('should create a backup file with correct naming', async () => {
      const result = await createBackup();

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/^decant-backup-\d{8}-\d{6}\.db$/);
      expect(result.path).toContain('backups');

      // Verify the backup file exists
      const exists = fsSync.existsSync(result.path);
      expect(exists).toBe(true);

      // Clean up
      await fs.unlink(result.path);
    });

    it('should create a valid SQLite database backup', async () => {
      const result = await createBackup();

      // Read first 16 bytes to check SQLite magic number
      const handle = await fs.open(result.path, 'r');
      const buffer = Buffer.alloc(16);
      await handle.read(buffer, 0, 16, 0);
      await handle.close();

      expect(buffer.toString('ascii', 0, 16)).toBe('SQLite format 3\0');

      // Clean up
      await fs.unlink(result.path);
    });

    it('should create backup directory if it does not exist', async () => {
      const backupDir = getBackupDirectory();

      // Remove backup directory
      if (fsSync.existsSync(backupDir)) {
        await fs.rm(backupDir, { recursive: true, force: true });
      }

      const result = await createBackup();

      // Verify directory was created
      expect(fsSync.existsSync(backupDir)).toBe(true);
      expect(fsSync.existsSync(result.path)).toBe(true);

      // Clean up
      await fs.unlink(result.path);
    });
  });

  // ============================================================
  // Backup Listing Tests
  // ============================================================

  describe('listBackups', () => {
    it('should return empty array when no backups exist', async () => {
      const backupDir = getBackupDirectory();

      // Clear backup directory
      if (fsSync.existsSync(backupDir)) {
        const files = await fs.readdir(backupDir);
        await Promise.all(files.map(f => fs.unlink(path.join(backupDir, f))));
      }

      const backups = await listBackups();
      expect(backups).toEqual([]);
    });

    it('should list all backup files', async () => {
      // Create multiple backups
      const backup1 = await createBackup();
      await new Promise(resolve => setTimeout(resolve, 1100)); // Ensure different timestamps
      const backup2 = await createBackup();

      const backups = await listBackups();

      expect(backups.length).toBeGreaterThanOrEqual(2);
      expect(backups.some(b => b.filename === backup1.filename)).toBe(true);
      expect(backups.some(b => b.filename === backup2.filename)).toBe(true);

      // Clean up
      await fs.unlink(backup1.path);
      await fs.unlink(backup2.path);
    });

    it('should return backups sorted by newest first', async () => {
      const backup1 = await createBackup();
      await new Promise(resolve => setTimeout(resolve, 1100));
      const backup2 = await createBackup();

      const backups = await listBackups();

      // Find our test backups
      const b1Index = backups.findIndex(b => b.filename === backup1.filename);
      const b2Index = backups.findIndex(b => b.filename === backup2.filename);

      expect(b2Index).toBeLessThan(b1Index);

      // Clean up
      await fs.unlink(backup1.path);
      await fs.unlink(backup2.path);
    });

    it('should include file size and creation date', async () => {
      const backup = await createBackup();
      const backups = await listBackups();

      const found = backups.find(b => b.filename === backup.filename);
      expect(found).toBeDefined();
      expect(found!.sizeBytes).toBeGreaterThan(0);
      expect(found!.createdAt).toBeInstanceOf(Date);
      expect(found!.path).toBe(backup.path);

      // Clean up
      await fs.unlink(backup.path);
    });

    it('should ignore non-backup files in directory', async () => {
      const backupDir = getBackupDirectory();
      const randomFile = path.join(backupDir, 'random.txt');

      // Create a non-backup file
      await fs.writeFile(randomFile, 'test content');

      const backups = await listBackups();

      expect(backups.every(b => b.filename.match(/^decant-backup-.*\.db$/))).toBe(true);

      // Clean up
      await fs.unlink(randomFile);
    });
  });

  // ============================================================
  // Backup Deletion Tests
  // ============================================================

  describe('deleteBackup', () => {
    it('should delete a backup file', async () => {
      const backup = await createBackup();

      expect(fsSync.existsSync(backup.path)).toBe(true);

      const result = await deleteBackup(backup.filename);

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(backup.filename);
      expect(fsSync.existsSync(backup.path)).toBe(false);
    });

    it('should throw error when backup does not exist', async () => {
      await expect(deleteBackup('nonexistent-backup.db')).rejects.toThrow('Backup file not found');
    });

    it('should validate filename pattern', async () => {
      await expect(deleteBackup('../../../etc/passwd')).rejects.toThrow('Invalid backup filename');
      await expect(deleteBackup('invalid-name.db')).rejects.toThrow('Invalid backup filename');
    });

    it('should prevent path traversal attacks', async () => {
      await expect(deleteBackup('../../secret.db')).rejects.toThrow();
    });
  });

  // ============================================================
  // Restore Tests
  // ============================================================

  describe('restoreBackup', () => {
    it('should restore database from backup', async () => {
      // Create a backup
      const backup = await createBackup();

      // Modify the database
      const db = getDatabase();
      db.prepare('DELETE FROM nodes').run();

      // Verify data is gone
      const nodesBeforeRestore = db.prepare('SELECT COUNT(*) as count FROM nodes').get() as { count: number };
      expect(nodesBeforeRestore.count).toBe(0);

      // Restore from backup
      const result = await restoreBackup(backup.filename);

      expect(result.success).toBe(true);
      expect(result.restoredFrom).toBe(backup.filename);

      // Verify data is restored
      const dbAfter = getDatabase();
      const nodesAfterRestore = dbAfter.prepare('SELECT COUNT(*) as count FROM nodes').get() as { count: number };
      expect(nodesAfterRestore.count).toBe(1);

      // Clean up
      await fs.unlink(backup.path);
    });

    it('should throw error when backup file does not exist', async () => {
      await expect(restoreBackup('nonexistent-backup.db')).rejects.toThrow('Backup file not found');
    });

    it('should validate backup is a valid SQLite database', async () => {
      const backupDir = getBackupDirectory();
      const invalidBackup = path.join(backupDir, 'decant-backup-20230101-120000.db');

      // Create an invalid backup file
      await fs.writeFile(invalidBackup, 'This is not a SQLite database');

      await expect(restoreBackup('decant-backup-20230101-120000.db')).rejects.toThrow(
        'Invalid backup file: not a valid SQLite database'
      );

      // Clean up
      await fs.unlink(invalidBackup);
    });
  });

  // ============================================================
  // Export Tests
  // ============================================================

  describe('exportData', () => {
    it('should export all data as JSON', () => {
      const exported = exportData();

      expect(exported.exportedAt).toBeDefined();
      expect(new Date(exported.exportedAt)).toBeInstanceOf(Date);
      expect(exported.version).toBe('1.0');
      expect(exported.data).toBeDefined();
    });

    it('should include all table data', () => {
      const exported = exportData();

      expect(Array.isArray(exported.data.nodes)).toBe(true);
      expect(Array.isArray(exported.data.key_concepts)).toBe(true);
      expect(Array.isArray(exported.data.segments)).toBe(true);
      expect(Array.isArray(exported.data.organizations)).toBe(true);
    });

    it('should export test data correctly', () => {
      const exported = exportData();

      expect(exported.data.nodes.length).toBe(1);
      expect(exported.data.nodes[0].id).toBe('node1');
      expect(exported.data.nodes[0].title).toBe('Test Node');

      expect(exported.data.key_concepts.length).toBe(1);
      expect(exported.data.key_concepts[0].concept).toBe('test concept');

      expect(exported.data.segments.length).toBe(1);
      expect(exported.data.segments[0].code).toBe('TEST_SEG');

      expect(exported.data.organizations.length).toBe(1);
      expect(exported.data.organizations[0].code).toBe('TEST_ORG');
    });
  });

  // ============================================================
  // Import Tests
  // ============================================================

  describe('importData', () => {
    let exportedData: ExportData;

    beforeEach(() => {
      exportedData = exportData();
    });

    it('should import data in merge mode', () => {
      // Clear the database
      const db = getDatabase();
      db.prepare('DELETE FROM key_concepts').run();
      db.prepare('DELETE FROM nodes').run();

      // Import
      const result = importData(exportedData, 'merge');

      expect(result.imported).toBeGreaterThan(0);
      expect(result.errors).toBe(0);

      // Verify data
      const nodes = db.prepare('SELECT COUNT(*) as count FROM nodes').get() as { count: number };
      expect(nodes.count).toBe(1);
    });

    it('should skip duplicates in merge mode', () => {
      // Import twice
      const result1 = importData(exportedData, 'merge');
      const result2 = importData(exportedData, 'merge');

      expect(result1.imported).toBeGreaterThan(0);
      expect(result2.skipped).toBeGreaterThan(0);
      expect(result2.imported).toBe(0);
    });

    it('should replace all data in replace mode', () => {
      const db = getDatabase();

      // Add new data
      db.prepare(`
        INSERT INTO nodes (
          id, title, url, source_domain, date_added,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'node2',
        'New Node',
        'https://example.com/new',
        'example.com',
        new Date().toISOString(),
        new Date().toISOString(),
        new Date().toISOString()
      );

      // Import in replace mode
      const result = importData(exportedData, 'replace');

      expect(result.imported).toBeGreaterThan(0);

      // Verify only imported data exists
      const nodes = db.prepare('SELECT * FROM nodes').all();
      expect(nodes.length).toBe(1);
      expect((nodes[0] as any).id).toBe('node1');
    });

    it('should throw error for invalid data structure', () => {
      const invalidData = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        data: {
          // Missing required fields
          nodes: [],
        },
      };

      expect(() => importData(invalidData as any, 'merge')).toThrow('Invalid import data structure');
    });

    it('should return detailed summary', () => {
      const db = getDatabase();
      db.prepare('DELETE FROM key_concepts').run();
      db.prepare('DELETE FROM nodes').run();

      const result = importData(exportedData, 'merge');

      expect(result.imported).toBeGreaterThan(0);
      expect(result.skipped).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(Array.isArray(result.details)).toBe(true);
    });

    it('should handle foreign key constraints gracefully', () => {
      const db = getDatabase();

      // Create invalid export with orphaned key concepts
      const invalidExport: ExportData = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        data: {
          nodes: [],
          key_concepts: [
            {
              id: 'kc-orphan',
              node_id: 'nonexistent-node',
              concept: 'orphan concept',
            },
          ],
          segments: [],
          organizations: [],
        },
      };

      db.prepare('DELETE FROM key_concepts').run();
      db.prepare('DELETE FROM nodes').run();

      // Should not throw, but should skip orphaned concepts
      const result = importData(invalidExport, 'merge');
      expect(result.skipped).toBeGreaterThan(0);
    });
  });
});
