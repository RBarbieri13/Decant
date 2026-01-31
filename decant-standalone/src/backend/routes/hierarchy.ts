// ============================================================
// Hierarchy API Routes
// Tree queries and hierarchy code-based operations
// ============================================================

import { Request, Response } from 'express';
import {
  getTree,
  getSubtree,
  getNodeByHierarchyCode,
  getAncestryPath,
  getTreeDepthStats,
  getSegments as dbGetSegments,
  getOrganizations as dbGetOrganizations,
  invalidateTreeCaches,
} from '../database/taxonomy.js';
import * as hierarchyCache from '../cache/hierarchy_cache.js';

// ============================================================
// Existing Endpoints
// ============================================================

/**
 * GET /api/hierarchy/:view
 * Get the full hierarchy tree for a view (function or organization)
 */
export async function getHierarchyTree(req: Request, res: Response): Promise<void> {
  try {
    const view = req.params.view as 'function' | 'organization';
    if (!['function', 'organization'].includes(view)) {
      res.status(400).json({ error: 'Invalid view. Must be "function" or "organization"' });
      return;
    }
    const tree = getTree(view);
    res.json(tree);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * GET /api/segments
 * Get all segments (functional taxonomy)
 */
export async function getSegments(req: Request, res: Response): Promise<void> {
  try {
    const segments = dbGetSegments();
    res.json(segments);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * GET /api/organizations
 * Get all organizations (organizational taxonomy)
 */
export async function getOrganizations(req: Request, res: Response): Promise<void> {
  try {
    const orgs = dbGetOrganizations();
    res.json(orgs);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

// ============================================================
// New Hierarchy Code-Based Endpoints
// ============================================================

/**
 * GET /api/hierarchy/code/:view/:code
 * Get a node by its hierarchy code
 *
 * @param view - 'function' or 'organization'
 * @param code - Hierarchy code (e.g., 'A.LLM.T.1')
 *
 * @example GET /api/hierarchy/code/function/A.LLM.T.1
 */
export async function getNodeByCode(req: Request, res: Response): Promise<void> {
  try {
    const view = req.params.view as 'function' | 'organization';
    const code = req.params.code;

    if (!['function', 'organization'].includes(view)) {
      res.status(400).json({ error: 'Invalid view. Must be "function" or "organization"' });
      return;
    }

    if (!code) {
      res.status(400).json({ error: 'Hierarchy code is required' });
      return;
    }

    const node = getNodeByHierarchyCode(view, code);

    if (!node) {
      res.status(404).json({ error: `Node not found with code: ${code}` });
      return;
    }

    res.json(node);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * GET /api/hierarchy/path/:view/:nodeId
 * Get the ancestry path (all ancestors) for a node
 *
 * @param view - 'function' or 'organization'
 * @param nodeId - UUID of the node
 *
 * @returns Array of ancestor nodes from root to parent (not including the node itself)
 *
 * @example GET /api/hierarchy/path/function/550e8400-e29b-41d4-a716-446655440000
 */
export async function getPath(req: Request, res: Response): Promise<void> {
  try {
    const view = req.params.view as 'function' | 'organization';
    const nodeId = req.params.nodeId;

    if (!['function', 'organization'].includes(view)) {
      res.status(400).json({ error: 'Invalid view. Must be "function" or "organization"' });
      return;
    }

    if (!nodeId) {
      res.status(400).json({ error: 'Node ID is required' });
      return;
    }

    const ancestors = getAncestryPath(view, nodeId);
    res.json({
      nodeId,
      view,
      ancestors,
      depth: ancestors.length,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * GET /api/hierarchy/subtree/:view/:path
 * Get a subtree at a specific hierarchy path
 *
 * @param view - 'function' or 'organization'
 * @param path - Hierarchy path prefix (e.g., 'A.LLM' for all LLM-related items)
 *
 * @returns Array of nodes in the subtree with nested children
 *
 * @example GET /api/hierarchy/subtree/function/A.LLM
 */
export async function getSubtreeAtPath(req: Request, res: Response): Promise<void> {
  try {
    const view = req.params.view as 'function' | 'organization';
    const path = req.params.path;

    if (!['function', 'organization'].includes(view)) {
      res.status(400).json({ error: 'Invalid view. Must be "function" or "organization"' });
      return;
    }

    if (!path) {
      res.status(400).json({ error: 'Path is required' });
      return;
    }

    // Validate path format (alphanumeric segments separated by dots)
    const pathRegex = /^[A-Za-z0-9]+(\.[A-Za-z0-9]+)*$/;
    if (!pathRegex.test(path)) {
      res.status(400).json({
        error: 'Invalid path format. Use dot-separated alphanumeric segments (e.g., A.LLM.T)',
      });
      return;
    }

    const subtree = getSubtree(view, path);
    res.json({
      path,
      view,
      nodes: subtree,
      count: countNodesRecursive(subtree),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * GET /api/hierarchy/stats/:view
 * Get depth statistics for the hierarchy
 *
 * @param view - 'function' or 'organization'
 *
 * @returns Depth level counts and cache statistics
 */
export async function getHierarchyStats(req: Request, res: Response): Promise<void> {
  try {
    const view = req.params.view as 'function' | 'organization';

    if (!['function', 'organization'].includes(view)) {
      res.status(400).json({ error: 'Invalid view. Must be "function" or "organization"' });
      return;
    }

    const depthStats = getTreeDepthStats(view);
    const cacheStats = hierarchyCache.getStats();

    // Convert Map to object for JSON response
    const depthBreakdown: Record<number, number> = {};
    let totalNodes = 0;
    let maxDepth = 0;

    depthStats.forEach((count, depth) => {
      depthBreakdown[depth] = count;
      totalNodes += count;
      if (depth > maxDepth) maxDepth = depth;
    });

    res.json({
      view,
      totalNodes,
      maxDepth,
      depthBreakdown,
      cache: {
        function: cacheStats.function.size,
        organization: cacheStats.organization.size,
      },
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * POST /api/hierarchy/invalidate
 * Manually invalidate hierarchy caches
 *
 * @body view - Optional: 'function', 'organization', or 'all' (default: 'all')
 * @body codes - Optional: Array of { oldCode, newCode } for granular invalidation
 */
export async function invalidateCache(req: Request, res: Response): Promise<void> {
  try {
    const { view, codes } = req.body as {
      view?: 'function' | 'organization' | 'all';
      codes?: Array<{ oldCode?: string; newCode?: string }>;
    };

    if (codes && codes.length > 0) {
      // Granular invalidation
      invalidateTreeCaches(codes);
      res.json({
        success: true,
        message: `Invalidated cache for ${codes.length} code mutation(s)`,
        affected: codes,
      });
    } else if (view && view !== 'all') {
      // View-specific invalidation
      hierarchyCache.invalidateView(view);
      res.json({
        success: true,
        message: `Invalidated ${view} hierarchy cache`,
      });
    } else {
      // Full invalidation
      invalidateTreeCaches();
      res.json({
        success: true,
        message: 'Invalidated all hierarchy caches',
      });
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * GET /api/hierarchy/cache/stats
 * Get detailed cache statistics
 */
export async function getCacheStats(req: Request, res: Response): Promise<void> {
  try {
    const stats = hierarchyCache.getStats();

    res.json({
      function: {
        size: stats.function.size,
        keys: stats.function.keys,
      },
      organization: {
        size: stats.organization.size,
        keys: stats.organization.keys,
      },
      totalEntries: stats.function.size + stats.organization.size,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Count nodes recursively in a tree structure
 */
function countNodesRecursive(nodes: any[]): number {
  let count = nodes.length;
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      count += countNodesRecursive(node.children);
    }
  }
  return count;
}
