// ============================================================
// iMessage Routes
// POST /api/imessage/extract-urls - Extract recent URLs from self-texts
// ============================================================

import { Request, Response } from 'express';
import { log } from '../logger/index.js';
import { extractRecentUrls } from '../services/imessage/extract.js';

// ============================================================
// Extract URLs
// ============================================================

/**
 * Extract recent URLs from iMessage self-text thread
 * POST /api/imessage/extract-urls
 * Body: { count?: number }
 */
export async function extractUrls(req: Request, res: Response): Promise<void> {
  try {
    const { count } = req.body ?? {};

    // Validate count if provided
    if (count !== undefined) {
      const num = Number(count);
      if (!Number.isInteger(num) || num < 1 || num > 20) {
        res.status(400).json({
          success: false,
          error: 'count must be an integer between 1 and 20',
        });
        return;
      }
    }

    log.info('Extracting iMessage URLs', {
      count: count ?? 5,
      module: 'imessage',
    });

    const result = await extractRecentUrls({ count });

    if (result.urls.length === 0) {
      res.json({
        success: false,
        urls: [],
        error: result.error ?? 'No URLs found in recent self-texts.',
      });
      return;
    }

    res.json({
      success: true,
      urls: result.urls,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('iMessage URL extraction route failed', {
      error: message,
      module: 'imessage',
    });
    res.status(500).json({
      success: false,
      urls: [],
      error: message,
    });
  }
}
