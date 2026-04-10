// ============================================================
// Backfill Routes
// ============================================================
// Feature #1: backfill "Untitled" and reasoning-less nodes by
// re-running the semantic profiler against each one. Mirrors
// the rescrape pattern — runs in the background with p-limit
// concurrency and exposes a polling endpoint.

import { Request, Response } from 'express';
import pLimit from 'p-limit';
import {
  findUntitledNodes, readNode, updateTitleOnly, updateWhySaved, updateClassificationReasoning,
} from '../database/nodes.js';
import { SemanticProfiler, type SemanticProfileInput } from '../services/semantic_profiler.js';
import * as keystore from '../services/keystore.js';
import * as cache from '../cache/index.js';
import { log } from '../logger/index.js';

interface BackfillProgress {
  isRunning: boolean;
  total: number;
  completed: number;
  failed: number;
  currentId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  lastError: string | null;
}

const progress: BackfillProgress = {
  isRunning: false,
  total: 0,
  completed: 0,
  failed: 0,
  currentId: null,
  startedAt: null,
  completedAt: null,
  lastError: null,
};

const CONCURRENCY = 3;

export function getBackfillTitlesProgress(_req: Request, res: Response): void {
  res.json({ ...progress });
}

/**
 * POST /api/admin/backfill-titles
 *
 * Idempotent: the query (title IS NULL OR title = '' OR title = 'Untitled'
 * OR classification_reasoning IS NULL) means already-fixed nodes skip on
 * the next run.
 */
export async function backfillTitles(_req: Request, res: Response): Promise<void> {
  if (progress.isRunning) {
    res.status(409).json({ error: 'Backfill already in progress', progress });
    return;
  }

  const apiKey = await keystore.getApiKey('openai');
  if (!apiKey) {
    res.status(400).json({ error: 'OpenAI API key not configured' });
    return;
  }

  const candidates = findUntitledNodes();

  progress.isRunning = true;
  progress.total = candidates.length;
  progress.completed = 0;
  progress.failed = 0;
  progress.currentId = null;
  progress.startedAt = new Date().toISOString();
  progress.completedAt = null;
  progress.lastError = null;

  res.json({ started: true, total: candidates.length });

  // Run in the background — do NOT await.
  void runBackfill(apiKey, candidates).catch((err) => {
    log.error('backfillTitles crashed', { error: (err as Error).message });
    progress.lastError = (err as Error).message;
    progress.isRunning = false;
    progress.completedAt = new Date().toISOString();
  });
}

async function runBackfill(
  apiKey: string,
  candidates: Array<{ id: string; title: string; url: string; source_domain: string }>,
): Promise<void> {
  const profiler = new SemanticProfiler(apiKey, { model: 'gpt-4o-mini' });
  const limit = pLimit(CONCURRENCY);

  await Promise.all(
    candidates.map((candidate) =>
      limit(async () => {
        progress.currentId = candidate.id;
        try {
          const node = readNode(candidate.id);
          if (!node) {
            progress.failed += 1;
            return;
          }

          const input: SemanticProfileInput = {
            url: (node.url as string) || candidate.url || '',
            title: (node.title as string) || '',
            domain: (node.source_domain as string) || candidate.source_domain || undefined,
            description:
              (node.short_description as string) ||
              (node.phrase_description as string) ||
              undefined,
            content: (node.ai_summary as string) || undefined,
          };

          const { profile } = await profiler.profile(input);

          if (profile.title && profile.title !== (node.title as string)) {
            updateTitleOnly(candidate.id, profile.title.slice(0, 500));
          }

          if (profile.whySaved) {
            updateWhySaved(candidate.id, profile.whySaved, true, new Date().toISOString());
          }

          if (profile.classificationReasoning) {
            updateClassificationReasoning(candidate.id, {
              primaryDomainReason: profile.classificationReasoning.primaryDomainReason || '',
              resourceTypeReason: profile.classificationReasoning.resourceTypeReason || '',
              confidence: profile.confidence,
            });
          }

          progress.completed += 1;
        } catch (err) {
          progress.failed += 1;
          progress.lastError = (err as Error).message;
          log.warn('backfill item failed', {
            nodeId: candidate.id,
            error: (err as Error).message,
          });
        }
      }),
    ),
  );

  cache.invalidate('tree:*');
  progress.isRunning = false;
  progress.currentId = null;
  progress.completedAt = new Date().toISOString();
}
