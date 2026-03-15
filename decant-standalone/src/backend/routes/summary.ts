// ============================================================
// Summary Routes
// API endpoints for node summary generation and retrieval
// ============================================================

import type { Request, Response } from 'express';
import { generateNodeSummary, getStoredSummary } from '../services/summary/index.js';
import { log } from '../logger/index.js';

/**
 * GET /api/nodes/:id/summary
 * Returns the cached summary for a node, or null if none exists
 */
export async function getNodeSummary(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const summary = getStoredSummary(id);
    if (!summary) {
      res.json({ nodeId: id, summary: null, exists: false });
      return;
    }
    res.json({ nodeId: id, summary, exists: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error('Failed to get summary', { nodeId: id, error: msg, module: 'summary-route' });
    res.status(500).json({ error: msg });
  }
}

/**
 * POST /api/nodes/:id/summary/generate
 * Generate (or regenerate) the AI summary for a node.
 * Query param ?force=true to skip cache.
 */
export async function generateSummary(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const force = req.query.force === 'true';

  try {
    const result = await generateNodeSummary(id, force);

    if (!result) {
      res.status(422).json({
        error: 'Unable to generate summary. Ensure the LLM provider is configured and the node exists.',
        nodeId: id,
      });
      return;
    }

    res.json({
      nodeId: id,
      summary: result.summary,
      cached: result.cached,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error('Summary generation failed', { nodeId: id, error: msg, module: 'summary-route' });
    res.status(500).json({ error: msg });
  }
}
