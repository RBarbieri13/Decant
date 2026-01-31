// ============================================================
// Audit API Routes
// ============================================================

import { Request, Response } from 'express';
import {
  getNodeHistory,
  getRecentChanges,
  getChangeStatistics,
  type GetNodeHistoryOptions,
} from '../database/audit.js';
import { readNode } from '../database/nodes.js';

/**
 * GET /api/nodes/:id/history
 * Get code change history for a specific node
 */
export async function getNodeAuditHistory(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const {
      hierarchyType,
      limit,
      offset,
    } = req.query;

    // Validate node exists
    const node = readNode(id);
    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }

    const options: GetNodeHistoryOptions = {};

    if (hierarchyType === 'function' || hierarchyType === 'organization') {
      options.hierarchyType = hierarchyType;
    }

    if (limit) {
      const limitNum = parseInt(limit as string, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        options.limit = limitNum;
      }
    }

    if (offset) {
      const offsetNum = parseInt(offset as string, 10);
      if (!isNaN(offsetNum) && offsetNum >= 0) {
        options.offset = offsetNum;
      }
    }

    const changes = getNodeHistory(id, options);

    // Enrich changes with related node titles
    const enrichedChanges = await Promise.all(
      changes.map(async (change) => {
        let relatedNodes: Array<{ id: string; title: string }> | undefined;

        if (change.relatedNodeIds && change.relatedNodeIds.length > 0) {
          relatedNodes = change.relatedNodeIds
            .map((relatedId) => {
              const relatedNode = readNode(relatedId);
              return relatedNode
                ? { id: relatedNode.id as string, title: relatedNode.title as string }
                : null;
            })
            .filter((n): n is { id: string; title: string } => n !== null);
        }

        return {
          id: change.id,
          hierarchyType: change.hierarchyType,
          oldCode: change.oldCode,
          newCode: change.newCode,
          changeType: change.changeType,
          reason: change.reason,
          triggeredBy: change.triggeredBy,
          changedAt: change.changedAt,
          relatedNodes,
          metadata: change.metadata,
        };
      })
    );

    res.json({
      nodeId: id,
      changes: enrichedChanges,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * GET /api/audit/recent
 * Get recent changes across all nodes
 */
export async function getRecentAuditChanges(req: Request, res: Response): Promise<void> {
  try {
    const { limit } = req.query;
    const limitNum = limit ? parseInt(limit as string, 10) : 50;

    if (isNaN(limitNum) || limitNum <= 0 || limitNum > 500) {
      res.status(400).json({ error: 'Invalid limit parameter (must be 1-500)' });
      return;
    }

    const changes = getRecentChanges(limitNum);

    // Enrich changes with node titles
    const enrichedChanges = await Promise.all(
      changes.map(async (change) => {
        const node = readNode(change.nodeId);
        let relatedNodes: Array<{ id: string; title: string }> | undefined;

        if (change.relatedNodeIds && change.relatedNodeIds.length > 0) {
          relatedNodes = change.relatedNodeIds
            .map((relatedId) => {
              const relatedNode = readNode(relatedId);
              return relatedNode
                ? { id: relatedNode.id as string, title: relatedNode.title as string }
                : null;
            })
            .filter((n): n is { id: string; title: string } => n !== null);
        }

        return {
          id: change.id,
          nodeId: change.nodeId,
          nodeTitle: node?.title || 'Unknown',
          hierarchyType: change.hierarchyType,
          oldCode: change.oldCode,
          newCode: change.newCode,
          changeType: change.changeType,
          reason: change.reason,
          triggeredBy: change.triggeredBy,
          changedAt: change.changedAt,
          relatedNodes,
        };
      })
    );

    res.json({
      changes: enrichedChanges,
      total: enrichedChanges.length,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * GET /api/audit/stats
 * Get audit statistics
 */
export async function getAuditStatistics(req: Request, res: Response): Promise<void> {
  try {
    const stats = getChangeStatistics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}
