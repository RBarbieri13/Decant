// ============================================================
// Import Route
// POST /api/import - Import a URL with AI classification
// ============================================================

import { Request, Response } from 'express';
import { log } from '../logger/index.js';
import * as keystore from '../services/keystore.js';
import {
  getImportOrchestrator,
  type ImportResult,
  type ImportError,
} from '../services/import/orchestrator.js';
import { getImportCache } from '../services/import/cache.js';
import { readNode } from '../database/nodes.js';

// ============================================================
// Import Endpoint
// ============================================================

/**
 * Import a URL
 * POST /api/import
 * Body: { url: string, forceRefresh?: boolean, priority?: number }
 */
export async function importUrl(req: Request, res: Response): Promise<void> {
  try {
    const { url, forceRefresh, priority } = req.body;

    // Basic validation (orchestrator does full validation)
    if (!url || typeof url !== 'string') {
      res.status(400).json({
        success: false,
        error: 'URL is required',
        code: 'URL_REQUIRED',
      });
      return;
    }

    // Execute import via orchestrator
    const orchestrator = getImportOrchestrator();
    const result = await orchestrator.import({
      url,
      forceRefresh: forceRefresh === true,
      priority: typeof priority === 'number' ? priority : undefined,
    });

    // Handle error result
    if (!result.success) {
      const errorResult = result as ImportError;
      const status = getStatusCodeFromErrorCode(errorResult.code);
      res.status(status).json(errorResult);
      return;
    }

    // Success - return full result
    const successResult = result as ImportResult;

    // Get the full node data for backward compatibility
    const node = readNode(successResult.nodeId);

    res.json({
      success: true,
      nodeId: successResult.nodeId,
      cached: successResult.cached,
      node: node,
      classification: {
        segment: successResult.classification.segment,
        category: successResult.classification.category,
        contentType: successResult.classification.contentType,
        organization: successResult.classification.organization,
        confidence: successResult.classification.confidence,
      },
      hierarchyCodes: successResult.hierarchyCodes,
      metadata: successResult.metadata,
      phase2: {
        queued: successResult.phase2Queued,
        jobId: successResult.phase2JobId,
      },
    });
  } catch (error) {
    log.error('Import route error', { err: error, module: 'import' });

    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: `Import failed: ${message}`,
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Check if a URL is already imported
 * GET /api/import/check?url=<url>
 */
export async function checkImportStatus(req: Request, res: Response): Promise<void> {
  try {
    const url = req.query.url as string;

    if (!url || typeof url !== 'string') {
      res.status(400).json({
        success: false,
        error: 'URL query parameter is required',
        code: 'URL_REQUIRED',
      });
      return;
    }

    const cache = getImportCache();
    const cached = cache.get(url);

    if (cached) {
      // Verify the node still exists
      const node = readNode(cached.nodeId);

      if (node) {
        res.json({
          exists: true,
          cached: true,
          nodeId: cached.nodeId,
          classification: cached.classification,
          cachedAt: cached.cachedAt,
        });
        return;
      }

      // Node was deleted, invalidate cache
      cache.invalidate(url);
    }

    res.json({
      exists: false,
      cached: false,
    });
  } catch (error) {
    log.error('Check import status error', { err: error, module: 'import' });
    res.status(500).json({
      success: false,
      error: 'Failed to check import status',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Invalidate import cache for a URL
 * DELETE /api/import/cache?url=<url>
 */
export async function invalidateImportCache(req: Request, res: Response): Promise<void> {
  try {
    const url = req.query.url as string;

    if (!url || typeof url !== 'string') {
      res.status(400).json({
        success: false,
        error: 'URL query parameter is required',
        code: 'URL_REQUIRED',
      });
      return;
    }

    const orchestrator = getImportOrchestrator();
    const invalidated = orchestrator.invalidateCache(url);

    res.json({
      success: true,
      invalidated,
    });
  } catch (error) {
    log.error('Invalidate import cache error', { err: error, module: 'import' });
    res.status(500).json({
      success: false,
      error: 'Failed to invalidate cache',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Get import cache statistics
 * GET /api/import/cache/stats
 */
export async function getImportCacheStats(_req: Request, res: Response): Promise<void> {
  try {
    const cache = getImportCache();
    const stats = cache.getStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    log.error('Get import cache stats error', { err: error, module: 'import' });
    res.status(500).json({
      success: false,
      error: 'Failed to get cache stats',
      code: 'INTERNAL_ERROR',
    });
  }
}

// ============================================================
// API Key Management Endpoints
// ============================================================

/**
 * Set API key endpoint
 * POST /api/settings/api-key
 * Body: { apiKey: string }
 */
export async function setApiKeyEndpoint(req: Request, res: Response): Promise<void> {
  try {
    const { apiKey } = req.body;

    if (!apiKey || typeof apiKey !== 'string') {
      res.status(400).json({ error: 'API key is required' });
      return;
    }

    // Validate API key format (basic check)
    if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
      res.status(400).json({ error: 'Invalid API key format' });
      return;
    }

    // Store API key securely in encrypted keystore
    await keystore.setApiKey('openai', apiKey);
    log.info('API key configured via settings', { module: 'settings' });
    res.json({ success: true });
  } catch (error) {
    log.error('Failed to set API key', { err: error, module: 'settings' });
    res.status(500).json({ error: 'Failed to set API key' });
  }
}

/**
 * Check if API key is configured
 * GET /api/settings/api-key/status
 */
export async function getApiKeyStatus(_req: Request, res: Response): Promise<void> {
  try {
    const hasKey = await keystore.isConfigured('openai');
    res.json({ configured: hasKey });
  } catch (error) {
    log.error('Failed to check API key status', { err: error, module: 'settings' });
    res.status(500).json({ error: 'Failed to check API key status' });
  }
}

/**
 * Delete API key endpoint
 * DELETE /api/settings/api-key
 */
export async function deleteApiKeyEndpoint(_req: Request, res: Response): Promise<void> {
  try {
    await keystore.deleteApiKey('openai');
    log.info('API key deleted via settings', { module: 'settings' });
    res.json({ success: true });
  } catch (error) {
    log.error('Failed to delete API key', { err: error, module: 'settings' });
    res.status(500).json({ error: 'Failed to delete API key' });
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Map error codes to HTTP status codes
 */
function getStatusCodeFromErrorCode(code: string): number {
  const statusMap: Record<string, number> = {
    // 400 Bad Request
    URL_REQUIRED: 400,
    URL_EMPTY: 400,
    URL_INVALID: 400,
    URL_INVALID_PROTOCOL: 400,
    URL_NO_HOSTNAME: 400,
    EXTRACTION_FAILED: 400,

    // 401 Unauthorized
    API_KEY_INVALID: 401,

    // 403 Forbidden
    SSRF_BLOCKED: 403,

    // 404 Not Found
    NOT_FOUND: 404,

    // 408 Request Timeout
    TIMEOUT: 408,

    // 413 Payload Too Large
    CONTENT_TOO_LARGE: 413,

    // 502 Bad Gateway
    FETCH_FAILED: 502,

    // 503 Service Unavailable
    API_KEY_MISSING: 503,
  };

  return statusMap[code] || 500;
}
