// ============================================================
// Backup Service
// Provides backup, restore, and export functionality for the database
// ============================================================

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import { getDatabase, closeDatabase, getDatabasePath } from '../database/connection.js';
import { log } from '../logger/index.js';

// ============================================================
// Types
// ============================================================

export interface BackupInfo {
  filename: string;
  path: string;
  createdAt: Date;
  sizeBytes: number;
}

export interface ExportData {
  exportedAt: string;
  version: string;
  data: {
    nodes: any[];
    key_concepts: any[];
    segments: any[];
    organizations: any[];
  };
}

export interface ImportSummary {
  imported: number;
  skipped: number;
  errors: number;
  details?: string[];
}

// ============================================================
// Constants
// ============================================================

const BACKUP_DIR_NAME = 'backups';
const EXPORT_VERSION = '1.0';

// ============================================================
// Helper Functions
// ============================================================

/**
 * Get the backup directory path, creating it if it doesn't exist
 */
export function getBackupDirectory(): string {
  const dataDir = path.join(os.homedir(), '.decant', 'data');
  const backupDir = path.join(dataDir, BACKUP_DIR_NAME);

  if (!fsSync.existsSync(backupDir)) {
    fsSync.mkdirSync(backupDir, { recursive: true });
  }

  return backupDir;
}

/**
 * Generate a timestamped backup filename
 */
function generateBackupFilename(): string {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .replace(/\.\d{3}Z$/, '')
    .slice(0, 15); // Format: YYYYMMDD-HHMMSS

  return `decant-backup-${timestamp}.db`;
}

/**
 * Parse timestamp from backup filename
 */
function parseBackupTimestamp(filename: string): Date | null {
  const match = filename.match(/decant-backup-(\d{8})-(\d{6})\.db$/);
  if (!match) return null;

  const [, date, time] = match;
  const year = parseInt(date.slice(0, 4));
  const month = parseInt(date.slice(4, 6)) - 1;
  const day = parseInt(date.slice(6, 8));
  const hour = parseInt(time.slice(0, 2));
  const minute = parseInt(time.slice(2, 4));
  const second = parseInt(time.slice(4, 6));

  return new Date(year, month, day, hour, minute, second);
}

// ============================================================
// Backup Operations
// ============================================================

/**
 * Create a backup of the current database
 * Uses SQLite's backup API through better-sqlite3 for safe copying
 */
export async function createBackup(): Promise<{ success: true; filename: string; path: string }> {
  const db = getDatabase();
  const backupDir = getBackupDirectory();
  const filename = generateBackupFilename();
  const backupPath = path.join(backupDir, filename);

  try {
    // Checkpoint WAL to ensure all data is in the main database file
    db.pragma('wal_checkpoint(TRUNCATE)');

    // Use better-sqlite3's backup method for safe copying
    await db.backup(backupPath);

    log.info('Backup created successfully', { backupPath, filename, module: 'backup' });

    return {
      success: true,
      filename,
      path: backupPath,
    };
  } catch (error) {
    log.error('Failed to create backup', { err: error, module: 'backup' });
    throw new Error(`Failed to create backup: ${(error as Error).message}`);
  }
}

/**
 * List all available backups
 */
export async function listBackups(): Promise<BackupInfo[]> {
  const backupDir = getBackupDirectory();

  try {
    const files = await fs.readdir(backupDir);
    const backups: BackupInfo[] = [];

    for (const filename of files) {
      if (!filename.match(/^decant-backup-.*\.db$/)) continue;

      const filePath = path.join(backupDir, filename);
      const stats = await fs.stat(filePath);
      const createdAt = parseBackupTimestamp(filename) || stats.mtime;

      backups.push({
        filename,
        path: filePath,
        createdAt,
        sizeBytes: stats.size,
      });
    }

    // Sort by creation date, newest first
    backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return backups;
  } catch (error) {
    log.error('Failed to list backups', { err: error, module: 'backup' });
    throw new Error(`Failed to list backups: ${(error as Error).message}`);
  }
}

/**
 * Restore the database from a backup
 */
export async function restoreBackup(filename: string): Promise<{ success: true; restoredFrom: string }> {
  const backupDir = getBackupDirectory();
  const backupPath = path.join(backupDir, filename);
  const dbPath = getDatabasePath();

  // Validate backup file exists
  try {
    await fs.access(backupPath);
  } catch {
    throw new Error(`Backup file not found: ${filename}`);
  }

  // Validate it's a real SQLite file (check magic bytes)
  const handle = await fs.open(backupPath, 'r');
  const buffer = Buffer.alloc(16);
  await handle.read(buffer, 0, 16, 0);
  await handle.close();

  const sqliteHeader = 'SQLite format 3\0';
  if (buffer.toString('ascii', 0, 16) !== sqliteHeader) {
    throw new Error('Invalid backup file: not a valid SQLite database');
  }

  try {
    // Close the current database connection
    closeDatabase();

    // Remove WAL and SHM files if they exist
    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';

    try { await fs.unlink(walPath); } catch { /* ignore if not exists */ }
    try { await fs.unlink(shmPath); } catch { /* ignore if not exists */ }

    // Copy backup over current database
    await fs.copyFile(backupPath, dbPath);

    // Reopen the database connection (will be done automatically on next getDatabase call)
    log.info('Database restored from backup', { filename, module: 'backup' });

    return {
      success: true,
      restoredFrom: filename,
    };
  } catch (error) {
    log.error('Failed to restore backup', { err: error, filename, module: 'backup' });
    throw new Error(`Failed to restore backup: ${(error as Error).message}`);
  }
}

/**
 * Delete a backup file
 */
export async function deleteBackup(filename: string): Promise<{ success: true; deleted: string }> {
  const backupDir = getBackupDirectory();
  const backupPath = path.join(backupDir, filename);

  // Validate backup file exists
  try {
    await fs.access(backupPath);
  } catch {
    throw new Error(`Backup file not found: ${filename}`);
  }

  // Security check: ensure the file is in the backup directory
  const normalizedBackupPath = path.normalize(backupPath);
  const normalizedBackupDir = path.normalize(backupDir);

  if (!normalizedBackupPath.startsWith(normalizedBackupDir)) {
    throw new Error('Invalid backup file path');
  }

  // Validate filename pattern
  if (!filename.match(/^decant-backup-.*\.db$/)) {
    throw new Error('Invalid backup filename');
  }

  try {
    await fs.unlink(backupPath);
    log.info('Backup deleted', { filename, module: 'backup' });

    return {
      success: true,
      deleted: filename,
    };
  } catch (error) {
    log.error('Failed to delete backup', { err: error, filename, module: 'backup' });
    throw new Error(`Failed to delete backup: ${(error as Error).message}`);
  }
}

// ============================================================
// Export Operations
// ============================================================

/**
 * Export all data as JSON
 */
export function exportData(): ExportData {
  const db = getDatabase();

  // Get all nodes (including deleted for completeness)
  const nodes = db.prepare('SELECT * FROM nodes').all();

  // Get all key concepts
  const keyConcepts = db.prepare('SELECT * FROM key_concepts').all();

  // Get all segments
  const segments = db.prepare('SELECT * FROM segments').all();

  // Get all organizations
  const organizations = db.prepare('SELECT * FROM organizations').all();

  return {
    exportedAt: new Date().toISOString(),
    version: EXPORT_VERSION,
    data: {
      nodes,
      key_concepts: keyConcepts,
      segments,
      organizations,
    },
  };
}

// ============================================================
// Import Operations
// ============================================================

/**
 * Validate import data structure
 */
function validateImportData(data: unknown): data is ExportData {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  if (typeof obj.exportedAt !== 'string') return false;
  if (typeof obj.version !== 'string') return false;
  if (!obj.data || typeof obj.data !== 'object') return false;

  const dataObj = obj.data as Record<string, unknown>;

  if (!Array.isArray(dataObj.nodes)) return false;
  if (!Array.isArray(dataObj.key_concepts)) return false;
  if (!Array.isArray(dataObj.segments)) return false;
  if (!Array.isArray(dataObj.organizations)) return false;

  return true;
}

/**
 * Import data from JSON
 */
export function importData(
  importData: ExportData,
  mode: 'merge' | 'replace' = 'merge'
): ImportSummary {
  const db = getDatabase();

  // Validate data structure
  if (!validateImportData(importData)) {
    throw new Error('Invalid import data structure');
  }

  const summary: ImportSummary = {
    imported: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  // Start transaction
  const transaction = db.transaction(() => {
    if (mode === 'replace') {
      // Clear all tables in reverse dependency order
      db.prepare('DELETE FROM key_concepts').run();
      db.prepare('DELETE FROM nodes').run();
      db.prepare('DELETE FROM segments').run();
      db.prepare('DELETE FROM organizations').run();
      summary.details?.push('Cleared existing data');
    }

    // Import segments
    const existingSegments = new Set(
      (db.prepare('SELECT code FROM segments').all() as any[]).map(s => s.code)
    );

    const insertSegment = db.prepare(`
      INSERT INTO segments (id, name, code, description, color, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const segment of importData.data.segments) {
      if (mode === 'merge' && existingSegments.has(segment.code)) {
        summary.skipped++;
        continue;
      }

      try {
        insertSegment.run(
          segment.id,
          segment.name,
          segment.code,
          segment.description || null,
          segment.color || null,
          segment.created_at || new Date().toISOString()
        );
        summary.imported++;
      } catch (error) {
        summary.errors++;
        summary.details?.push(`Failed to import segment ${segment.code}: ${(error as Error).message}`);
      }
    }

    // Import organizations
    const existingOrgs = new Set(
      (db.prepare('SELECT code FROM organizations').all() as any[]).map(o => o.code)
    );

    const insertOrg = db.prepare(`
      INSERT INTO organizations (id, name, code, description, color, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const org of importData.data.organizations) {
      if (mode === 'merge' && existingOrgs.has(org.code)) {
        summary.skipped++;
        continue;
      }

      try {
        insertOrg.run(
          org.id,
          org.name,
          org.code,
          org.description || null,
          org.color || null,
          org.created_at || new Date().toISOString()
        );
        summary.imported++;
      } catch (error) {
        summary.errors++;
        summary.details?.push(`Failed to import organization ${org.code}: ${(error as Error).message}`);
      }
    }

    // Import nodes
    const existingUrls = new Set(
      (db.prepare('SELECT url FROM nodes').all() as any[]).map(n => n.url)
    );

    const insertNode = db.prepare(`
      INSERT INTO nodes (
        id, title, url, source_domain, date_added, company,
        phrase_description, short_description, logo_url, ai_summary,
        extracted_fields, metadata_tags, function_parent_id,
        organization_parent_id, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const node of importData.data.nodes) {
      if (mode === 'merge' && existingUrls.has(node.url)) {
        summary.skipped++;
        continue;
      }

      try {
        insertNode.run(
          node.id,
          node.title,
          node.url,
          node.source_domain,
          node.date_added || new Date().toISOString(),
          node.company || null,
          node.phrase_description || null,
          node.short_description || null,
          node.logo_url || null,
          node.ai_summary || null,
          typeof node.extracted_fields === 'string'
            ? node.extracted_fields
            : JSON.stringify(node.extracted_fields || {}),
          typeof node.metadata_tags === 'string'
            ? node.metadata_tags
            : JSON.stringify(node.metadata_tags || []),
          node.function_parent_id || null,
          node.organization_parent_id || null,
          node.is_deleted || 0,
          node.created_at || new Date().toISOString(),
          node.updated_at || new Date().toISOString()
        );
        summary.imported++;
      } catch (error) {
        summary.errors++;
        summary.details?.push(`Failed to import node ${node.url}: ${(error as Error).message}`);
      }
    }

    // Import key concepts
    const existingConcepts = new Set(
      (db.prepare('SELECT node_id || "-" || concept as key FROM key_concepts').all() as any[])
        .map(c => c.key)
    );

    const insertConcept = db.prepare(`
      INSERT INTO key_concepts (id, node_id, concept)
      VALUES (?, ?, ?)
    `);

    for (const concept of importData.data.key_concepts) {
      const key = `${concept.node_id}-${concept.concept}`;
      if (mode === 'merge' && existingConcepts.has(key)) {
        summary.skipped++;
        continue;
      }

      try {
        insertConcept.run(concept.id, concept.node_id, concept.concept);
        summary.imported++;
      } catch (error) {
        // Key concepts might fail if parent node wasn't imported (foreign key)
        // This is expected in merge mode when the URL was skipped
        if (mode === 'merge') {
          summary.skipped++;
        } else {
          summary.errors++;
          summary.details?.push(`Failed to import key concept: ${(error as Error).message}`);
        }
      }
    }
  });

  // Execute transaction
  try {
    transaction();
  } catch (error) {
    throw new Error(`Import failed: ${(error as Error).message}`);
  }

  return summary;
}
