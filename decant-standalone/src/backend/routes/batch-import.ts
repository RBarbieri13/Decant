// ============================================================
// Batch Import Routes
// POST /api/batch-import - Start batch import
// POST /api/batch-import/:batchId/cancel - Cancel batch import
// GET /api/batch-import/:batchId - Get batch status
// ============================================================

import { Request, Response } from 'express';
import { log } from '../logger/index.js';
import {
  startBatchImport,
  cancelBatchImport,
  getBatchState,
  getBatchImportManager,
} from '../services/import/batch-orchestrator.js';
import type { BatchImportOptions } from '../../shared/types.js';

// ============================================================
// Start Batch Import
// ============================================================

/**
 * Start a new batch import
 * POST /api/batch-import
 * Body: { urls: string[], options?: BatchImportOptions }
 */
export async function startBatch(req: Request, res: Response): Promise<void> {
  try {
    const { urls, options } = req.body;

    // Validate URLs array
    if (!urls || !Array.isArray(urls)) {
      res.status(400).json({
        success: false,
        error: 'URLs array is required',
        code: 'URLS_REQUIRED',
      });
      return;
    }

    if (urls.length === 0) {
      res.status(400).json({
        success: false,
        error: 'At least one URL is required',
        code: 'URLS_EMPTY',
      });
      return;
    }

    // Filter out empty strings and validate URLs are strings
    const validUrls = urls.filter(
      (url: unknown): url is string => typeof url === 'string' && url.trim().length > 0
    );

    if (validUrls.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No valid URLs provided',
        code: 'URLS_INVALID',
      });
      return;
    }

    // Limit batch size
    const MAX_BATCH_SIZE = 50;
    if (validUrls.length > MAX_BATCH_SIZE) {
      res.status(400).json({
        success: false,
        error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} URLs`,
        code: 'BATCH_TOO_LARGE',
      });
      return;
    }

    log.info('Starting batch import request', {
      urlCount: validUrls.length,
      module: 'batch-import-route',
    });

    // Start the batch import
    const batchOptions: Partial<BatchImportOptions> = {};
    if (options) {
      if (typeof options.autoClassify === 'boolean') {
        batchOptions.autoClassify = options.autoClassify;
      }
      if (typeof options.skipDuplicates === 'boolean') {
        batchOptions.skipDuplicates = options.skipDuplicates;
      }
      if (typeof options.showInTreeWhenDone === 'boolean') {
        batchOptions.showInTreeWhenDone = options.showInTreeWhenDone;
      }
      if (typeof options.maxConcurrent === 'number' && options.maxConcurrent > 0) {
        batchOptions.maxConcurrent = Math.min(options.maxConcurrent, 5); // Cap at 5
      }
    }

    const state = await startBatchImport(validUrls, batchOptions);

    res.json({
      success: true,
      batchId: state.batchId,
      itemCount: state.items.length,
      status: state.status,
    });
  } catch (error) {
    log.error('Batch import start failed', {
      error: error instanceof Error ? error.message : String(error),
      module: 'batch-import-route',
    });

    res.status(500).json({
      success: false,
      error: 'Failed to start batch import',
      code: 'BATCH_START_FAILED',
    });
  }
}

// ============================================================
// Cancel Batch Import
// ============================================================

/**
 * Cancel an active batch import
 * POST /api/batch-import/:batchId/cancel
 */
export async function cancelBatch(req: Request, res: Response): Promise<void> {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      res.status(400).json({
        success: false,
        error: 'Batch ID is required',
        code: 'BATCH_ID_REQUIRED',
      });
      return;
    }

    log.info('Cancelling batch import', {
      batchId,
      module: 'batch-import-route',
    });

    const cancelled = cancelBatchImport(batchId);

    if (!cancelled) {
      res.status(404).json({
        success: false,
        error: 'Batch not found or already completed',
        code: 'BATCH_NOT_FOUND',
      });
      return;
    }

    res.json({
      success: true,
      batchId,
      message: 'Batch import cancelled',
    });
  } catch (error) {
    log.error('Batch import cancel failed', {
      error: error instanceof Error ? error.message : String(error),
      module: 'batch-import-route',
    });

    res.status(500).json({
      success: false,
      error: 'Failed to cancel batch import',
      code: 'BATCH_CANCEL_FAILED',
    });
  }
}

// ============================================================
// Get Batch Status
// ============================================================

/**
 * Get status of a batch import
 * GET /api/batch-import/:batchId
 */
export async function getBatchStatus(req: Request, res: Response): Promise<void> {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      res.status(400).json({
        success: false,
        error: 'Batch ID is required',
        code: 'BATCH_ID_REQUIRED',
      });
      return;
    }

    const state = getBatchState(batchId);

    if (!state) {
      res.status(404).json({
        success: false,
        error: 'Batch not found',
        code: 'BATCH_NOT_FOUND',
      });
      return;
    }

    // Calculate stats
    const manager = getBatchImportManager();
    const stats = manager.calculateStats(state.items);

    res.json({
      success: true,
      batchId: state.batchId,
      status: state.status,
      items: state.items,
      stats,
      options: state.options,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
    });
  } catch (error) {
    log.error('Get batch status failed', {
      error: error instanceof Error ? error.message : String(error),
      module: 'batch-import-route',
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get batch status',
      code: 'BATCH_STATUS_FAILED',
    });
  }
}
