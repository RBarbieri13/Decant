// ============================================================
// Summary Routes
// API endpoints for node summary generation and retrieval
// ============================================================

import type { Request, Response } from 'express';
import { generateNodeSummary, getStoredSummary } from '../services/summary/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * GET /api/nodes/:id/summary
 * Returns the cached summary for a node, or null if none exists
 */
export const getNodeSummary = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const summary = getStoredSummary(id);
  if (!summary) {
    res.json({ nodeId: id, summary: null, exists: false });
    return;
  }
  res.json({ nodeId: id, summary, exists: true });
});

/**
 * POST /api/nodes/:id/summary/generate
 * Generate (or regenerate) the AI summary for a node.
 * Query param ?force=true to skip cache.
 */
export const generateSummary = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const force = req.query.force === 'true';

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
});
