// ============================================================
// Dynamic Hierarchy Routes
// ============================================================
// API endpoints for the dynamic recursive hierarchy system.
// Provides tree rendering, statistics, and rebuild triggers.

import { Request, Response } from 'express';
import { buildHierarchyTree } from '../services/hierarchy/tree_builder.js';
import {
  getHierarchyEngine,
  hasHierarchyEngine,
} from '../services/hierarchy/hierarchy_engine.js';
import * as appCache from '../cache/index.js';
import { log } from '../logger/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * GET /api/hierarchy/dynamic/tree
 * Returns the dynamic hierarchy tree for UI rendering.
 */
export const getDynamicTree = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const tree = buildHierarchyTree();
  res.json({ root: tree });
});

/**
 * GET /api/hierarchy/dynamic/stats
 * Returns hierarchy statistics (branch counts, depth distribution, dirty count).
 */
export const getHierarchyStats = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  if (!hasHierarchyEngine()) {
    res.json({ initialized: false });
    return;
  }
  const stats = getHierarchyEngine().getStats();
  res.json({ initialized: true, ...stats });
});

/**
 * POST /api/hierarchy/rebuild
 * Run a full global refinement pass (evaluate all branches via LLM).
 * This is the user-clickable "rebuild" action.
 */
export const rebuildHierarchy = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  if (!hasHierarchyEngine()) {
    res.status(503).json({ error: 'Hierarchy engine not initialized' });
    return;
  }

  log.info('Manual hierarchy rebuild triggered', { module: 'dynamic-hierarchy' });
  const result = await getHierarchyEngine().refineHierarchy('full', 'manual');
  appCache.invalidate('tree:*');
  res.json({ success: true, ...result });
});

/**
 * POST /api/hierarchy/rebuild-full
 * Complete rebuild from scratch -- clears all branches and re-clusters from the ground up.
 * More destructive than /rebuild -- use when hierarchy is in a bad state.
 */
export const rebuildFullHierarchy = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  if (!hasHierarchyEngine()) {
    res.status(503).json({ error: 'Hierarchy engine not initialized' });
    return;
  }

  log.info('Full hierarchy rebuild from scratch triggered', { module: 'dynamic-hierarchy' });
  const result = await getHierarchyEngine().buildFullHierarchy();
  appCache.invalidate('tree:*');
  res.json({ success: true, ...result });
});

/**
 * POST /api/hierarchy/node/:id/move
 * Manually move a node to a different branch.
 */
export const moveNodeToBranch = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!hasHierarchyEngine()) {
    res.status(503).json({ error: 'Hierarchy engine not initialized' });
    return;
  }

  const { id } = req.params;
  const { branchId } = req.body;

  if (!id || !branchId) {
    res.status(400).json({ error: 'Node ID and branchId are required' });
    return;
  }

  const engine = getHierarchyEngine();
  engine.moveNode(id, branchId);
  appCache.invalidate('tree:*');

  res.json({ success: true, nodeId: id, branchId });
});
