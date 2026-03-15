// ============================================================
// Node Summary Service
// Generates structured AI summaries for the detail panel
// ============================================================

import { createHash } from 'crypto';
import { log } from '../../logger/index.js';
import { getProvider, hasProvider } from '../llm/provider.js';
import { NODE_SUMMARY_SYSTEM_PROMPT, generateSummaryUserPrompt } from './prompt.js';
import { readNode } from '../../database/nodes.js';
import { getDatabase } from '../../database/connection.js';
import type { NodeSummary } from './types.js';

export type { NodeSummary } from './types.js';

// ============================================================
// Content Hash
// ============================================================

/**
 * Generate a content hash for cache invalidation.
 * Uses the node's title + description + ai_summary + key_concepts
 * so we only regenerate when the content meaningfully changes.
 */
function computeContentHash(node: Record<string, unknown>): string {
  const parts = [
    node.title ?? '',
    node.short_description ?? '',
    node.ai_summary ?? '',
    node.phrase_description ?? '',
    node.company ?? '',
    node.url ?? '',
    JSON.stringify(node.key_concepts ?? []),
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
}

/**
 * Build the node content string that gets sent to the LLM.
 * Assembles all relevant fields into a readable block.
 */
function buildNodeContent(node: Record<string, unknown>): string {
  const parts: string[] = [];

  if (node.title) parts.push(`Title: ${node.title}`);
  if (node.url) parts.push(`URL: ${node.url}`);
  if (node.source_domain) parts.push(`Source: ${node.source_domain}`);
  if (node.company && node.company !== 'Unknown' && node.company !== 'UNKN') {
    parts.push(`Organization: ${node.company}`);
  }
  if (node.phrase_description) parts.push(`Brief: ${node.phrase_description}`);
  if (node.short_description) parts.push(`Description: ${node.short_description}`);
  if (node.ai_summary) parts.push(`Content Summary:\n${node.ai_summary}`);

  const concepts = node.key_concepts as string[] | undefined;
  if (concepts && concepts.length > 0) {
    parts.push(`Key Concepts: ${concepts.join(', ')}`);
  }

  const tags = node.metadata_tags as string[] | undefined;
  if (tags && tags.length > 0) {
    parts.push(`Tags: ${tags.join(', ')}`);
  }

  if (node.segment_code) parts.push(`Segment: ${node.segment_code}`);
  if (node.category_code) parts.push(`Category: ${node.category_code}`);
  if (node.content_type_code) parts.push(`Type: ${node.content_type_code}`);
  if (node.date_added) parts.push(`Date Added: ${node.date_added}`);

  const content = parts.join('\n');

  // Truncate if too long (per spec: >8000 chars → first 6000)
  if (content.length > 8000) {
    return content.slice(0, 6000) + '\n\n(content truncated for summary generation)';
  }

  return content;
}

// ============================================================
// Summary Generation
// ============================================================

/**
 * Generate a structured summary for a node using the LLM.
 * Returns the parsed NodeSummary or null on failure.
 */
export async function generateNodeSummary(
  nodeId: string,
  force: boolean = false
): Promise<{ summary: NodeSummary; cached: boolean } | null> {
  const node = readNode(nodeId);
  if (!node) {
    log.warn('Cannot generate summary — node not found', { nodeId, module: 'summary' });
    return null;
  }

  const contentHash = computeContentHash(node);

  // Check if we already have a valid cached summary
  if (!force) {
    const existing = getStoredSummary(nodeId);
    if (existing && (node as Record<string, unknown>).summary_content_hash === contentHash) {
      return { summary: existing, cached: true };
    }
  }

  // Check LLM provider availability
  if (!hasProvider()) {
    log.warn('Cannot generate summary — LLM provider not initialized', {
      nodeId,
      module: 'summary',
    });
    return null;
  }

  const provider = getProvider();
  const nodeContent = buildNodeContent(node as Record<string, unknown>);
  const startTime = Date.now();

  try {
    const result = await provider.complete(
      [
        { role: 'system', content: NODE_SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: generateSummaryUserPrompt(nodeContent) },
      ],
      {
        temperature: 0.3,
        maxTokens: 2000,
      }
    );

    // Parse JSON response (strip backticks if present)
    const cleanText = result.content.replace(/```json|```/g, '').trim();
    let parsed: NodeSummary;
    try {
      parsed = JSON.parse(cleanText) as NodeSummary;
    } catch (parseErr) {
      log.error('Failed to parse summary JSON', {
        nodeId,
        error: parseErr instanceof Error ? parseErr.message : String(parseErr),
        rawLength: result.content.length,
        module: 'summary',
      });
      return null;
    }

    // Validate minimum required fields
    if (!parsed.title || !parsed.summary || !parsed.category) {
      log.error('Summary missing required fields', { nodeId, module: 'summary' });
      return null;
    }

    // Store in database
    storeSummary(nodeId, parsed, contentHash);

    log.info('Summary generated', {
      nodeId,
      durationMs: Date.now() - startTime,
      tokens: result.usage.totalTokens,
      module: 'summary',
    });

    return { summary: parsed, cached: false };
  } catch (error) {
    log.error('Summary generation failed', {
      nodeId,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
      module: 'summary',
    });
    return null;
  }
}

// ============================================================
// Database Operations
// ============================================================

/**
 * Store a generated summary in the database
 */
function storeSummary(nodeId: string, summary: NodeSummary, contentHash: string): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE nodes
    SET summary_json = ?, summary_content_hash = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(JSON.stringify(summary), contentHash, nodeId);
}

/**
 * Get a stored summary from the database
 */
export function getStoredSummary(nodeId: string): NodeSummary | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT summary_json FROM nodes WHERE id = ? AND is_deleted = 0
  `).get(nodeId) as { summary_json: string | null } | undefined;

  if (!row?.summary_json) return null;

  try {
    return JSON.parse(row.summary_json) as NodeSummary;
  } catch {
    return null;
  }
}

/**
 * Check if a node's summary is stale (content changed since last generation)
 */
export function isSummaryStale(nodeId: string): boolean {
  const node = readNode(nodeId);
  if (!node) return false;

  const row = node as Record<string, unknown>;
  if (!row.summary_json || !row.summary_content_hash) return true;

  const currentHash = computeContentHash(row);
  return currentHash !== row.summary_content_hash;
}
