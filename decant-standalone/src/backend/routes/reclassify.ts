// ============================================================
// Reclassify Routes
// ============================================================
// Delegates to the dynamic hierarchy engine for full rebuilds
// and the semantic profiler for single-node reclassification.

import { Request, Response } from 'express';
import { readNode, getAllNodes, updateNodeWithSemanticProfile } from '../database/nodes.js';
import { getHierarchyEngine, hasHierarchyEngine } from '../services/hierarchy/hierarchy_engine.js';
import { SemanticProfiler, type SemanticProfileInput } from '../services/semantic_profiler.js';
import { registerMetadataCodesFromProfile } from '../database/metadata.js';
import * as keystore from '../services/keystore.js';
import { log } from '../logger/index.js';
import * as cache from '../cache/index.js';

// ============================================================
// In-memory progress tracking (single-process server)
// ============================================================

interface ReclassifyProgress {
  isRunning: boolean;
  total: number;
  completed: number;
  failed: number;
  startedAt: string | null;
  completedAt: string | null;
  lastError: string | null;
}

const progress: ReclassifyProgress = {
  isRunning: false,
  total: 0,
  completed: 0,
  failed: 0,
  startedAt: null,
  completedAt: null,
  lastError: null,
};

/**
 * GET /api/nodes/reclassify/progress
 * Returns current reclassification progress for polling.
 */
export function getReclassifyProgress(_req: Request, res: Response): void {
  res.json({ ...progress });
}

/**
 * POST /api/nodes/reclassify
 * Re-profiles every node with the updated semantic profiler, then rebuilds
 * the full hierarchy from the fresh profiles.
 */
export async function reclassifyAll(_req: Request, res: Response): Promise<void> {
  if (progress.isRunning) {
    res.status(409).json({ error: 'Reclassification already in progress', progress: { ...progress } });
    return;
  }

  try {
    if (!hasHierarchyEngine()) {
      res.status(503).json({ error: 'Hierarchy engine not initialized' });
      return;
    }

    const apiKey = await keystore.getApiKey('openai');
    if (!apiKey) {
      res.status(400).json({ error: 'OpenAI API key not configured' });
      return;
    }

    const nodes = getAllNodes() as Array<Record<string, unknown>>;

    // Initialize progress
    progress.isRunning = true;
    progress.total = nodes.length;
    progress.completed = 0;
    progress.failed = 0;
    progress.startedAt = new Date().toISOString();
    progress.completedAt = null;
    progress.lastError = null;

    // Respond immediately so the client can start polling
    res.json({
      message: `Re-profiling ${nodes.length} nodes — poll /api/nodes/reclassify/progress for status`,
      total: nodes.length,
    });

    // Run re-profiling async (after response is sent)
    setImmediate(async () => {
      try {
        log.info(`Starting full reclassification of ${nodes.length} nodes`, { module: 'reclassify' });
        const profiler = new SemanticProfiler(apiKey, { model: 'gpt-4o-mini' });
        const engine = getHierarchyEngine();

        for (const node of nodes) {
          try {
            const input: SemanticProfileInput = {
              url: (node.url as string) || '',
              title: (node.title as string) || '',
              domain: (node.source_domain as string) || undefined,
              description: (node.short_description as string) || (node.phrase_description as string) || undefined,
              content: (node.ai_summary as string) || undefined,
            };

            const result = await profiler.profile(input);
            const profile = result.profile;

            // Persist fresh profile data to nodes table
            updateNodeWithSemanticProfile(node.id as string, profile);

            // Update faceted metadata codes
            registerMetadataCodesFromProfile(node.id as string, profile);

            // Update node's placement in the live tree
            engine.placeNode(node.id as string, profile);

            progress.completed++;
          } catch (err) {
            progress.failed++;
            progress.lastError = err instanceof Error ? err.message : String(err);
            log.warn(`Failed to re-profile node ${node.id}`, {
              error: progress.lastError,
              module: 'reclassify',
            });
          }
        }

        // Rebuild full hierarchy from fresh profiles
        log.info('All nodes re-profiled — rebuilding full hierarchy', { module: 'reclassify' });
        await engine.buildFullHierarchy();
        cache.invalidate('tree:*');

        progress.isRunning = false;
        progress.completedAt = new Date().toISOString();
        log.info(`Reclassification complete: ${progress.completed} succeeded, ${progress.failed} failed`, { module: 'reclassify' });
      } catch (err) {
        progress.isRunning = false;
        progress.completedAt = new Date().toISOString();
        progress.lastError = err instanceof Error ? err.message : String(err);
        log.error('Reclassification background job failed', { error: progress.lastError, module: 'reclassify' });
      }
    });

  } catch (error) {
    progress.isRunning = false;
    log.error('Reclassification setup failed', {
      error: error instanceof Error ? error.message : String(error),
      module: 'reclassify',
    });
    // Response already sent in the happy path, so only send error if we haven't responded yet
    if (!res.headersSent) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}

/**
 * POST /api/nodes/:id/reclassify
 * Re-profile a single node and re-place it in the hierarchy.
 * Also persists the new profile data back to the nodes table.
 */
export async function reclassifyNode(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const node = readNode(id);
    if (!node) {
      res.status(404).json({ error: 'Node not found' });
      return;
    }

    const apiKey = await keystore.getApiKey('openai');
    if (!apiKey) {
      res.status(400).json({ error: 'OpenAI API key not configured' });
      return;
    }

    if (!hasHierarchyEngine()) {
      res.status(503).json({ error: 'Hierarchy engine not initialized' });
      return;
    }

    // Re-profile the node
    const profiler = new SemanticProfiler(apiKey, { model: 'gpt-4o' });
    const input: SemanticProfileInput = {
      url: (node.url as string) || '',
      title: (node.title as string) || '',
      domain: (node.source_domain as string) || undefined,
      description: (node.short_description as string) || (node.phrase_description as string) || undefined,
      content: (node.ai_summary as string) || undefined,
    };

    const result = await profiler.profile(input);
    const profile = result.profile;

    // Persist profile data to the nodes table
    updateNodeWithSemanticProfile(id, profile);

    // Update faceted metadata
    registerMetadataCodesFromProfile(id, profile);

    // Re-place in hierarchy
    const engine = getHierarchyEngine();
    const placement = engine.placeNode(id, profile);

    cache.invalidate('tree:*');

    const updatedNode = readNode(id);

    res.json({
      message: 'Node re-profiled and re-placed',
      profile: {
        title: profile.title,
        company: profile.company,
        primaryFunction: profile.primaryFunction,
        primaryDomain: profile.primaryDomain,
        resourceType: profile.resourceType,
        confidence: profile.confidence,
      },
      placement: {
        branchId: placement.branchId,
        branchLabel: placement.branchLabel,
        branchDepth: placement.branchDepth,
        path: placement.path,
      },
      node: updatedNode,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}
