// ============================================================
// Reclassify Routes
// ============================================================
// Delegates to the DynamicClassifier for holistic reclassification
// and the semantic profiler for single-node reclassification.

import { Request, Response } from 'express';
import { readNode, getAllNodes, updateNodeWithSemanticProfile, applyDynamicAssignments } from '../database/nodes.js';
import { getHierarchyEngine, hasHierarchyEngine } from '../services/hierarchy/hierarchy_engine.js';
import { DynamicClassifier, type CondensedNode } from '../services/dynamic_classifier.js';
import { SemanticProfiler, type SemanticProfileInput } from '../services/semantic_profiler.js';
import { registerMetadataCodesFromProfile } from '../database/metadata.js';
import { replaceTaxonomy } from '../database/taxonomy_ops.js';
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
  phase: string;
  startedAt: string | null;
  completedAt: string | null;
  lastError: string | null;
}

const progress: ReclassifyProgress = {
  isRunning: false,
  total: 0,
  completed: 0,
  failed: 0,
  phase: '',
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
 * Holistic reclassification: one LLM call generates taxonomy + assignments
 * for all nodes, then rebuilds the hierarchy from the result.
 *
 * Phases (tracked via progress.completed / progress.total=3):
 *   1. Classify — DynamicClassifier.classifyAll() generates taxonomy + assignments
 *   2. Apply    — applyDynamicAssignments() + replaceTaxonomy() persist to DB
 *   3. Build    — engine.buildFromClassification() rebuilds hierarchy_branches
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

    // Initialize progress — 3 phases: classify, apply, build
    progress.isRunning = true;
    progress.total = 3;
    progress.completed = 0;
    progress.failed = 0;
    progress.phase = 'Analyzing all content...';
    progress.startedAt = new Date().toISOString();
    progress.completedAt = null;
    progress.lastError = null;

    // Respond immediately so the client can start polling
    res.json({
      message: `Classifying ${nodes.length} nodes holistically — poll /api/nodes/reclassify/progress for status`,
      total: nodes.length,
    });

    // Run classification async (after response is sent)
    setImmediate(async () => {
      try {
        log.info(`Starting holistic reclassification of ${nodes.length} nodes`, { module: 'reclassify' });

        const classifier = new DynamicClassifier(apiKey, {
          taxonomyModel: 'gpt-4o',
          assignmentModel: 'gpt-4o-mini',
        });
        const engine = getHierarchyEngine();

        // Build condensed representations for the classifier
        const condensedNodes: CondensedNode[] = nodes.map(node => ({
          id: node.id as string,
          title: (node.title as string) || '',
          domain: (node.source_domain as string) || '',
          quickPhrase: (node.phrase_description as string) || undefined,
          shortDescription: (node.short_description as string) || undefined,
          keyConcepts: (node.key_concepts as string[]) || undefined,
        }));

        // Phase 1: Classify all nodes in one holistic LLM call
        progress.phase = `Classifying ${condensedNodes.length} items with AI...`;
        log.info('Phase 1/3: Running holistic classification', { module: 'reclassify', nodeCount: condensedNodes.length });
        const { taxonomy, assignments, tokenUsage } = await classifier.classifyAll(condensedNodes);
        progress.completed = 1;
        log.info('Phase 1/3 complete: classification done', {
          module: 'reclassify',
          segments: taxonomy.segments.length,
          categories: taxonomy.categories.length,
          assignments: assignments.length,
          totalTokens: tokenUsage.totalTokens,
        });

        // Phase 2: Persist taxonomy and node assignments to DB
        progress.phase = `Saving ${taxonomy.segments.length} categories & ${assignments.length} assignments...`;
        log.info('Phase 2/3: Applying assignments and saving taxonomy', { module: 'reclassify' });
        replaceTaxonomy(taxonomy);
        applyDynamicAssignments(assignments);
        progress.completed = 2;
        log.info('Phase 2/3 complete: DB updated', { module: 'reclassify' });

        // Phase 3: Rebuild hierarchy branches from taxonomy + assignments
        progress.phase = 'Building hierarchy tree...';
        log.info('Phase 3/3: Building hierarchy from classification', { module: 'reclassify' });
        await engine.buildFromClassification(taxonomy, assignments);
        cache.invalidate('tree:*');
        progress.completed = 3;
        progress.phase = 'Complete';

        progress.isRunning = false;
        progress.completedAt = new Date().toISOString();
        log.info('Reclassification complete', {
          module: 'reclassify',
          segments: taxonomy.segments.length,
          categories: taxonomy.categories.length,
          assignments: assignments.length,
          totalTokens: tokenUsage.totalTokens,
        });
      } catch (err) {
        progress.isRunning = false;
        progress.failed = 1;
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
