// ============================================================
// Reclassify Routes
// ============================================================
// Now delegates to the dynamic hierarchy engine for full rebuilds
// and the semantic profiler for single-node reclassification.

import { Request, Response } from 'express';
import { readNode } from '../database/nodes.js';
import { getHierarchyEngine, hasHierarchyEngine } from '../services/hierarchy/hierarchy_engine.js';
import { SemanticProfiler, type SemanticProfileInput } from '../services/semantic_profiler.js';
import { registerMetadataCodesFromProfile } from '../database/metadata.js';
import * as keystore from '../services/keystore.js';
import { log } from '../logger/index.js';
import * as cache from '../cache/index.js';

/**
 * POST /api/nodes/reclassify
 * Triggers a full hierarchy rebuild from scratch.
 * This replaces the old DynamicClassifier-based reclassification.
 */
export async function reclassifyAll(_req: Request, res: Response): Promise<void> {
  const startTime = Date.now();

  try {
    if (!hasHierarchyEngine()) {
      res.status(503).json({ error: 'Hierarchy engine not initialized' });
      return;
    }

    log.info('Full reclassification triggered via hierarchy rebuild', { module: 'reclassify' });

    const result = await getHierarchyEngine().buildFullHierarchy();
    cache.invalidate('tree:*');

    res.json({
      message: `Rebuilt hierarchy: ${result.branchesCreated} branches, ${result.nodesPlaced} nodes placed`,
      durationMs: Date.now() - startTime,
      totalNodes: result.nodesPlaced,
      branchesCreated: result.branchesCreated,
      llmCalls: result.llmCalls,
      tokenUsage: result.tokenUsage,
    });
  } catch (error) {
    log.error('Reclassification failed', {
      error: error instanceof Error ? error.message : String(error),
      module: 'reclassify',
    });
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * POST /api/nodes/:id/reclassify
 * Re-profile a single node and re-place it in the hierarchy.
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