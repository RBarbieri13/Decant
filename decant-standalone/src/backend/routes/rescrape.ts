// ============================================================
// Rescrape Routes
// ============================================================
// Re-imports nodes with minimal extraction quality using
// p-limit concurrency and SSE-style progress tracking.

import { Request, Response } from 'express';
import pLimit from 'p-limit';
import { getDatabase } from '../database/connection.js';
import { importUrl as orchestratorImportUrl } from '../services/import/orchestrator.js';
import { log } from '../logger/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// ============================================================
// In-memory progress tracking (mirrors reclassify pattern)
// ============================================================

interface RescrapeProgress {
  isRunning: boolean;
  total: number;
  completed: number;
  failed: number;
  phase: string;
  startedAt: string | null;
  completedAt: string | null;
  lastError: string | null;
  errors: string[];
}

const progress: RescrapeProgress = {
  isRunning: false,
  total: 0,
  completed: 0,
  failed: 0,
  phase: '',
  startedAt: null,
  completedAt: null,
  lastError: null,
  errors: [],
};

const CONCURRENCY = 3;

/**
 * GET /api/admin/rescrape-poor-quality/progress
 * Returns current rescrape progress for polling.
 */
export function getRescrapeProgress(_req: Request, res: Response): void {
  res.json({
    isRunning: progress.isRunning,
    total: progress.total,
    completed: progress.completed,
    failed: progress.failed,
    phase: progress.phase,
    startedAt: progress.startedAt,
    completedAt: progress.completedAt,
    lastError: progress.lastError,
    errorCount: progress.errors.length,
  });
}

/**
 * POST /api/admin/rescrape-poor-quality
 * Re-imports nodes with minimal extraction quality using p-limit(3) concurrency.
 * Returns immediately and processes in the background -- poll progress endpoint for status.
 *
 * NOTE: Responds immediately then runs background work.
 */
export const rescrapePoorQuality = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  if (progress.isRunning) {
    res.status(409).json({
      error: 'Rescrape already in progress',
      progress: {
        isRunning: progress.isRunning,
        total: progress.total,
        completed: progress.completed,
        failed: progress.failed,
        phase: progress.phase,
      },
    });
    return;
  }

  const db = getDatabase();
  const rows = db.prepare(
    `SELECT id, url FROM nodes WHERE (extraction_quality = 'minimal' OR extraction_quality IS NULL) AND is_deleted = 0`
  ).all() as { id: string; url: string }[];

  if (rows.length === 0) {
    res.json({ count: 0, message: 'No nodes with minimal extraction quality found' });
    return;
  }

  // Initialize progress
  progress.isRunning = true;
  progress.total = rows.length;
  progress.completed = 0;
  progress.failed = 0;
  progress.phase = `Queuing ${rows.length} nodes for re-scrape...`;
  progress.startedAt = new Date().toISOString();
  progress.completedAt = null;
  progress.lastError = null;
  progress.errors = [];

  // Respond immediately so client can start polling
  res.json({
    message: `Re-scraping ${rows.length} nodes — poll /api/admin/rescrape-poor-quality/progress for status`,
    total: rows.length,
  });

  // Run concurrently in background
  setImmediate(async () => {
    const limit = pLimit(CONCURRENCY);

    try {
      progress.phase = `Re-scraping ${rows.length} nodes (concurrency: ${CONCURRENCY})...`;
      log.info(`Starting rescrape of ${rows.length} poor-quality nodes`, {
        module: 'admin',
        concurrency: CONCURRENCY,
      });

      const tasks = rows.map((row) =>
        limit(async () => {
          try {
            await orchestratorImportUrl(row.url, { forceRefresh: true });
            progress.completed++;
            progress.phase = `Re-scraped ${progress.completed}/${progress.total} (${progress.failed} failed)`;
          } catch (error) {
            progress.failed++;
            const msg = error instanceof Error ? error.message : String(error);
            progress.lastError = `${row.id}: ${msg}`;
            progress.errors.push(progress.lastError);
            progress.phase = `Re-scraped ${progress.completed}/${progress.total} (${progress.failed} failed)`;
          }
        })
      );

      await Promise.all(tasks);

      progress.phase = 'Complete';
      progress.isRunning = false;
      progress.completedAt = new Date().toISOString();

      log.info('Rescrape poor quality completed', {
        completed: progress.completed,
        failed: progress.failed,
        total: progress.total,
        module: 'admin',
      });
    } catch (err) {
      progress.isRunning = false;
      progress.completedAt = new Date().toISOString();
      progress.lastError = err instanceof Error ? err.message : String(err);
      progress.phase = 'Failed';
      log.error('Rescrape background job failed', { error: progress.lastError, module: 'admin' });
    }
  });
});
