// ============================================================
// iMessage Routes
// POST /api/imessage/extract-urls  - Extract recent URLs from self-texts
// POST /api/imessage/check-duplicates - Check which URLs already exist in Decant
// ============================================================

import { Request, Response } from 'express';
import { log } from '../logger/index.js';
import { extractRecentUrls } from '../services/imessage/extract.js';
import { findNodeByUrl } from '../database/nodes.js';

// ============================================================
// Extract URLs
// ============================================================

/**
 * Extract recent URLs from iMessage self-text thread
 * POST /api/imessage/extract-urls
 * Body: { count?: number, offset?: number }
 */
export async function extractUrls(req: Request, res: Response): Promise<void> {
  try {
    const { count, offset } = req.body ?? {};

    // Validate count if provided
    if (count !== undefined) {
      const num = Number(count);
      if (!Number.isInteger(num) || num < 1 || num > 100) {
        res.status(400).json({
          success: false,
          error: 'count must be an integer between 1 and 100',
        });
        return;
      }
    }

    // Validate offset if provided
    if (offset !== undefined) {
      const num = Number(offset);
      if (!Number.isInteger(num) || num < 0) {
        res.status(400).json({
          success: false,
          error: 'offset must be a non-negative integer',
        });
        return;
      }
    }

    log.info('Extracting iMessage URLs', {
      count: count ?? 20,
      offset: offset ?? 0,
      module: 'imessage',
    });

    const result = await extractRecentUrls({ count, offset });

    if (result.urls.length === 0) {
      res.json({
        success: false,
        urls: [],
        hasMore: false,
        error: result.error ?? 'No URLs found in recent self-texts.',
      });
      return;
    }

    res.json({
      success: true,
      urls: result.urls,
      hasMore: result.hasMore,
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
      hasMore: false,
      error: message,
    });
  }
}

// ============================================================
// Check Duplicates
// ============================================================

/**
 * Check which URLs already exist as nodes in Decant
 * POST /api/imessage/check-duplicates
 * Body: { urls: string[] }
 * Returns: { duplicates: Record<string, { nodeId: string; title: string }> }
 */
export async function checkDuplicates(req: Request, res: Response): Promise<void> {
  try {
    const { urls } = req.body ?? {};

    if (!Array.isArray(urls) || urls.length === 0) {
      res.status(400).json({
        success: false,
        error: 'urls must be a non-empty array of strings',
      });
      return;
    }

    if (urls.length > 200) {
      res.status(400).json({
        success: false,
        error: 'Maximum 200 URLs per request',
      });
      return;
    }

    const duplicates: Record<string, { nodeId: string; title: string }> = {};

    for (const url of urls) {
      if (typeof url !== 'string') continue;
      const existing = findNodeByUrl(url);
      if (existing) {
        duplicates[url] = {
          nodeId: existing.id as string,
          title: (existing.title as string) || 'Untitled',
        };
      }
    }

    res.json({
      success: true,
      duplicates,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('iMessage duplicate check failed', {
      error: message,
      module: 'imessage',
    });
    res.status(500).json({
      success: false,
      error: message,
    });
  }
}
