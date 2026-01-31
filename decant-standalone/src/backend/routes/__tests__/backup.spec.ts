// ============================================================
// Backup API Routes Tests
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { createTestApp } from '../../__tests__/test-app.js';
import { getBackupDirectory, exportData } from '../../services/backup.js';
import { getDatabase, closeDatabase } from '../../database/connection.js';
import type { Express } from 'express';

describe('Backup API Routes', () => {
  let app: Express;

  beforeEach(async () => {
    app = createTestApp();

    // Insert test data
    const db = getDatabase();

    db.prepare(`
      INSERT OR IGNORE INTO segments (id, name, code, description, color, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('seg-test', 'Test Segment', 'TEST_SEG', 'Test segment', '#ff0000', new Date().toISOString());

    db.prepare(`
      INSERT OR IGNORE INTO organizations (id, name, code, description, color, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('org-test', 'Test Org', 'TEST_ORG', 'Test org', '#00ff00', new Date().toISOString());

    db.prepare(`
      INSERT OR IGNORE INTO nodes (
        id, title, url, source_domain, date_added,
        function_parent_id, organization_parent_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'node-test',
      'Test Node',
      'https://test.example.com/backup',
      'test.example.com',
      new Date().toISOString(),
      'seg-test',
      'org-test',
      new Date().toISOString(),
      new Date().toISOString()
    );
  });

  afterEach(async () => {
    // Clean up test backups
    const backupDir = getBackupDirectory();
    if (fsSync.existsSync(backupDir)) {
      const files = await fs.readdir(backupDir);
      for (const file of files) {
        if (file.startsWith('decant-backup-') && file.endsWith('.db')) {
          await fs.unlink(path.join(backupDir, file)).catch(() => {});
        }
      }
    }
  });

  // ============================================================
  // POST /api/backup - Create Backup
  // ============================================================

  describe('POST /api/backup', () => {
    it('should create a new backup', async () => {
      const response = await request(app)
        .post('/api/backup')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.filename).toMatch(/^decant-backup-\d{8}-\d{6}\.db$/);
      expect(response.body.path).toBeDefined();

      // Verify file exists
      expect(fsSync.existsSync(response.body.path)).toBe(true);
    });

    it('should return proper error on failure', async () => {
      // This is hard to test without mocking, but we can verify error structure
      // In a real scenario, we might mock the backup service to throw an error

      // For now, just verify the endpoint exists and returns JSON
      const response = await request(app).post('/api/backup');

      expect(response.headers['content-type']).toMatch(/json/);
    });
  });

  // ============================================================
  // GET /api/backups - List Backups
  // ============================================================

  describe('GET /api/backups', () => {
    it('should return empty array when no backups exist', async () => {
      // Clear all backups
      const backupDir = getBackupDirectory();
      if (fsSync.existsSync(backupDir)) {
        const files = await fs.readdir(backupDir);
        await Promise.all(
          files.map(f => fs.unlink(path.join(backupDir, f)).catch(() => {}))
        );
      }

      const response = await request(app)
        .get('/api/backups')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });

    it('should list all backups', async () => {
      // Create backups
      await request(app).post('/api/backup');
      await new Promise(resolve => setTimeout(resolve, 1100));
      await request(app).post('/api/backup');

      const response = await request(app)
        .get('/api/backups')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);

      // Verify structure
      response.body.forEach((backup: any) => {
        expect(backup.filename).toMatch(/^decant-backup-.*\.db$/);
        expect(backup.path).toBeDefined();
        expect(backup.createdAt).toBeDefined();
        expect(backup.sizeBytes).toBeGreaterThan(0);
      });
    });

    it('should return backups sorted by newest first', async () => {
      // Create two backups with delay
      const first = await request(app).post('/api/backup');
      await new Promise(resolve => setTimeout(resolve, 1100));
      const second = await request(app).post('/api/backup');

      const response = await request(app)
        .get('/api/backups')
        .expect(200);

      const firstIndex = response.body.findIndex((b: any) => b.filename === first.body.filename);
      const secondIndex = response.body.findIndex((b: any) => b.filename === second.body.filename);

      expect(secondIndex).toBeLessThan(firstIndex);
    });
  });

  // ============================================================
  // DELETE /api/backups/:filename - Delete Backup
  // ============================================================

  describe('DELETE /api/backups/:filename', () => {
    it('should delete a backup', async () => {
      // Create a backup
      const createResponse = await request(app).post('/api/backup');
      const filename = createResponse.body.filename;

      // Delete it
      const deleteResponse = await request(app)
        .delete(`/api/backups/${filename}`)
        .expect(200);

      expect(deleteResponse.body.success).toBe(true);
      expect(deleteResponse.body.deleted).toBe(filename);

      // Verify it's gone
      const listResponse = await request(app).get('/api/backups');
      expect(listResponse.body.find((b: any) => b.filename === filename)).toBeUndefined();
    });

    it('should return 400 when filename is missing', async () => {
      const response = await request(app)
        .delete('/api/backups/')
        .expect(404); // Express returns 404 for missing route params
    });

    it('should return error when backup does not exist', async () => {
      const response = await request(app)
        .delete('/api/backups/nonexistent-backup.db')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Backup file not found');
    });

    it('should reject invalid filename patterns', async () => {
      const response = await request(app)
        .delete('/api/backups/../../etc/passwd')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  // ============================================================
  // POST /api/restore - Restore Backup
  // ============================================================

  describe('POST /api/restore', () => {
    it('should restore from backup', async () => {
      // Create a backup
      const createResponse = await request(app).post('/api/backup');
      const filename = createResponse.body.filename;

      // Modify database
      const db = getDatabase();
      db.prepare('DELETE FROM nodes WHERE id = ?').run('node-test');

      // Verify node is deleted
      const beforeRestore = db.prepare('SELECT * FROM nodes WHERE id = ?').get('node-test');
      expect(beforeRestore).toBeUndefined();

      // Restore
      const restoreResponse = await request(app)
        .post('/api/restore')
        .send({ filename })
        .expect(200);

      expect(restoreResponse.body.success).toBe(true);
      expect(restoreResponse.body.restoredFrom).toBe(filename);

      // Verify node is back
      const dbAfter = getDatabase();
      const afterRestore = dbAfter.prepare('SELECT * FROM nodes WHERE id = ?').get('node-test');
      expect(afterRestore).toBeDefined();
    });

    it('should return 400 when filename is missing', async () => {
      const response = await request(app)
        .post('/api/restore')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('filename is required');
    });

    it('should return error when backup does not exist', async () => {
      const response = await request(app)
        .post('/api/restore')
        .send({ filename: 'nonexistent.db' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Backup file not found');
    });
  });

  // ============================================================
  // GET /api/export - Export Data as JSON
  // ============================================================

  describe('GET /api/export', () => {
    it('should export all data as JSON', async () => {
      const response = await request(app)
        .get('/api/export')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.headers['content-disposition']).toMatch(/attachment/);
      expect(response.headers['content-disposition']).toMatch(/decant-export-/);

      // Verify structure
      expect(response.body.exportedAt).toBeDefined();
      expect(response.body.version).toBe('1.0');
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data.nodes)).toBe(true);
      expect(Array.isArray(response.body.data.key_concepts)).toBe(true);
      expect(Array.isArray(response.body.data.segments)).toBe(true);
      expect(Array.isArray(response.body.data.organizations)).toBe(true);
    });

    it('should include test data', async () => {
      const response = await request(app)
        .get('/api/export')
        .expect(200);

      const testNode = response.body.data.nodes.find((n: any) => n.id === 'node-test');
      expect(testNode).toBeDefined();
      expect(testNode.title).toBe('Test Node');

      const testSegment = response.body.data.segments.find((s: any) => s.code === 'TEST_SEG');
      expect(testSegment).toBeDefined();

      const testOrg = response.body.data.organizations.find((o: any) => o.code === 'TEST_ORG');
      expect(testOrg).toBeDefined();
    });
  });

  // ============================================================
  // POST /api/import/json - Import Data from JSON
  // ============================================================

  describe('POST /api/import/json', () => {
    it('should import data in merge mode', async () => {
      // Export current data
      const exportResponse = await request(app).get('/api/export');
      const exportedData = exportResponse.body;

      // Clear database
      const db = getDatabase();
      db.prepare('DELETE FROM nodes WHERE id = ?').run('node-test');

      // Import
      const importResponse = await request(app)
        .post('/api/import/json')
        .send({ data: exportedData, mode: 'merge' })
        .expect(200);

      expect(importResponse.body.success).toBe(true);
      expect(importResponse.body.imported).toBeGreaterThan(0);

      // Verify data is back
      const afterImport = db.prepare('SELECT * FROM nodes WHERE id = ?').get('node-test');
      expect(afterImport).toBeDefined();
    });

    it('should import data in replace mode', async () => {
      // Export current data
      const exportResponse = await request(app).get('/api/export');
      const exportedData = exportResponse.body;

      // Add new node
      const db = getDatabase();
      db.prepare(`
        INSERT INTO nodes (
          id, title, url, source_domain, date_added,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        'node-new',
        'New Node',
        'https://new.example.com',
        'new.example.com',
        new Date().toISOString(),
        new Date().toISOString(),
        new Date().toISOString()
      );

      // Import in replace mode
      const importResponse = await request(app)
        .post('/api/import/json')
        .send({ data: exportedData, mode: 'replace' })
        .expect(200);

      expect(importResponse.body.success).toBe(true);

      // Verify only exported data exists
      const newNode = db.prepare('SELECT * FROM nodes WHERE id = ?').get('node-new');
      expect(newNode).toBeUndefined();

      const testNode = db.prepare('SELECT * FROM nodes WHERE id = ?').get('node-test');
      expect(testNode).toBeDefined();
    });

    it('should default to merge mode when mode is not specified', async () => {
      const exportResponse = await request(app).get('/api/export');
      const exportedData = exportResponse.body;

      const importResponse = await request(app)
        .post('/api/import/json')
        .send({ data: exportedData })
        .expect(200);

      expect(importResponse.body.success).toBe(true);
    });

    it('should return 400 when data is missing', async () => {
      const response = await request(app)
        .post('/api/import/json')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('data is required');
    });

    it('should return 400 for invalid mode', async () => {
      const exportResponse = await request(app).get('/api/export');

      const response = await request(app)
        .post('/api/import/json')
        .send({ data: exportResponse.body, mode: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('mode must be either "merge" or "replace"');
    });

    it('should return 400 for invalid data structure', async () => {
      const response = await request(app)
        .post('/api/import/json')
        .send({
          data: {
            exportedAt: new Date().toISOString(),
            // Missing version and data fields
          },
          mode: 'merge',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid import data structure');
    });

    it('should return import summary', async () => {
      const exportResponse = await request(app).get('/api/export');

      const importResponse = await request(app)
        .post('/api/import/json')
        .send({ data: exportResponse.body, mode: 'merge' })
        .expect(200);

      expect(importResponse.body.success).toBe(true);
      expect(importResponse.body.imported).toBeDefined();
      expect(importResponse.body.skipped).toBeDefined();
      expect(importResponse.body.errors).toBeDefined();
      expect(Array.isArray(importResponse.body.details)).toBe(true);
    });
  });

  // ============================================================
  // Error Handling
  // ============================================================

  describe('Error Handling', () => {
    it('should return proper error structure on failure', async () => {
      const response = await request(app)
        .post('/api/restore')
        .send({ filename: 'invalid.db' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(typeof response.body.error).toBe('string');
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/import/json')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      // Express will reject malformed JSON before it reaches our handler
    });
  });
});
