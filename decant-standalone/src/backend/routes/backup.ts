// ============================================================
// Backup API Routes
// ============================================================

import { Request, Response } from 'express';
import {
  createBackup as doCreateBackup,
  listBackups as doListBackups,
  restoreBackup as doRestoreBackup,
  deleteBackup as doDeleteBackup,
  exportData as doExportData,
  importData as doImportData,
  ExportData,
} from '../services/backup.js';

// ============================================================
// Backup Endpoints
// ============================================================

/**
 * POST /api/backup
 * Create a new backup of the database
 */
export async function createBackup(_req: Request, res: Response): Promise<void> {
  try {
    const result = await doCreateBackup();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
}

/**
 * GET /api/backups
 * List all available backups
 */
export async function listBackups(_req: Request, res: Response): Promise<void> {
  try {
    const backups = await doListBackups();
    res.json(backups);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
}

/**
 * POST /api/restore
 * Restore the database from a backup
 */
export async function restoreBackup(req: Request, res: Response): Promise<void> {
  try {
    const { filename } = req.body;

    if (!filename || typeof filename !== 'string') {
      res.status(400).json({
        success: false,
        error: 'filename is required in request body',
      });
      return;
    }

    const result = await doRestoreBackup(filename);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
}

/**
 * DELETE /api/backups/:filename
 * Delete a backup file
 */
export async function deleteBackupFile(req: Request, res: Response): Promise<void> {
  try {
    const { filename } = req.params;

    if (!filename) {
      res.status(400).json({
        success: false,
        error: 'filename parameter is required',
      });
      return;
    }

    const result = await doDeleteBackup(filename);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
}

// ============================================================
// Export/Import Endpoints
// ============================================================

/**
 * GET /api/export
 * Export all data as JSON
 */
export async function exportDataAsJson(_req: Request, res: Response): Promise<void> {
  try {
    const data = doExportData();

    // Set headers for file download
    const timestamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="decant-export-${timestamp}.json"`
    );

    res.json(data);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
}

/**
 * POST /api/import/json
 * Import data from JSON
 */
export async function importDataFromJson(req: Request, res: Response): Promise<void> {
  try {
    const { data, mode = 'merge' } = req.body;

    if (!data) {
      res.status(400).json({
        success: false,
        error: 'data is required in request body',
      });
      return;
    }

    if (mode !== 'merge' && mode !== 'replace') {
      res.status(400).json({
        success: false,
        error: 'mode must be either "merge" or "replace"',
      });
      return;
    }

    // Validate the data structure
    const importData = data as ExportData;

    if (!importData.exportedAt || !importData.version || !importData.data) {
      res.status(400).json({
        success: false,
        error: 'Invalid import data structure. Expected { exportedAt, version, data }',
      });
      return;
    }

    const result = doImportData(importData, mode);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
}
