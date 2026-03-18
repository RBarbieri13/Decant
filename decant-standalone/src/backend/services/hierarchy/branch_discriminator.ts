// ============================================================
// Branch Discriminator Engine
// ============================================================
// Evaluates whether a hierarchy branch should be split and,
// if so, which dimension to split on. Uses GPT-4o-mini for
// fast, cheap branch evaluations.

import { OpenAIProvider } from '../llm/provider.js';
import {
  BranchEvaluationSchema,
  BranchLabelSchema,
  buildBranchEvaluationPrompt,
  buildBranchLabelPrompt,
  type BranchEvaluation,
  type BranchLabel,
  type BranchContext,
  type BranchNodeSummary,
  type CandidateDimension,
} from '../llm/prompts/branch_evaluation.js';
import { getDatabase } from '../../database/connection.js';
import { log } from '../../logger/index.js';

// Re-export types for consumers
export type { BranchEvaluation, BranchLabel, BranchContext, BranchNodeSummary, CandidateDimension };

// ============================================================
// Types
// ============================================================

export interface DiscriminatorOptions {
  model?: string;
  temperature?: number;
  /** Minimum nodes required before considering a split */
  minNodesForSplit?: number;
  /** Maximum hierarchy depth allowed */
  maxDepth?: number;
  /** Cohesion threshold above which no split is needed */
  cohesionThreshold?: number;
  /** Minimum nodes per proposed child branch */
  minChildSize?: number;
}

export interface EvaluationResult {
  evaluation: BranchEvaluation;
  skipped: boolean;
  skipReason?: string;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  durationMs: number;
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MIN_NODES = 4;
const DEFAULT_MAX_DEPTH = 15;
const DEFAULT_COHESION_THRESHOLD = 0.85;
const DEFAULT_MIN_CHILD_SIZE = 2;

// ============================================================
// BranchDiscriminator
// ============================================================

export class BranchDiscriminator {
  private provider: OpenAIProvider;
  private model: string;
  private temperature: number;
  private minNodesForSplit: number;
  private maxDepth: number;
  private cohesionThreshold: number;
  private minChildSize: number;

  constructor(apiKey: string, options: DiscriminatorOptions = {}) {
    this.model = options.model ?? DEFAULT_MODEL;
    this.temperature = options.temperature ?? DEFAULT_TEMPERATURE;
    this.minNodesForSplit = options.minNodesForSplit ?? DEFAULT_MIN_NODES;
    this.maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
    this.minChildSize = options.minChildSize ?? DEFAULT_MIN_CHILD_SIZE;
    this.cohesionThreshold = options.cohesionThreshold ?? DEFAULT_COHESION_THRESHOLD;

    this.provider = new OpenAIProvider({
      apiKey,
      defaultModel: this.model,
      enableCircuitBreaker: false,
    });
  }

  /**
   * Evaluate whether a branch should be split.
   * Applies pre-flight checks before calling the LLM.
   */
  async evaluate(context: BranchContext): Promise<EvaluationResult> {
    const startTime = Date.now();

    // Pre-flight checks (skip LLM call if clearly unnecessary)
    const skipCheck = this.preFlightCheck(context);
    if (skipCheck) {
      return {
        evaluation: {
          shouldSplit: false,
          reason: skipCheck,
          bestDimension: 'function',
          proposedChildren: [],
          branchCohesion: 1.0,
          confidence: 1.0,
        },
        skipped: true,
        skipReason: skipCheck,
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        durationMs: Date.now() - startTime,
      };
    }

    try {
      const prompt = buildBranchEvaluationPrompt(context);

      const result = await this.provider.completeWithSchema(
        [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        BranchEvaluationSchema,
        {
          temperature: this.temperature,
          maxTokens: 2000,
        },
      );

      const evaluation = this.validateEvaluation(result.data, context);

      log.info('Branch evaluation complete', {
        module: 'branch-discriminator',
        branchId: context.branchId,
        label: context.branchLabel,
        shouldSplit: evaluation.shouldSplit,
        dimension: evaluation.bestDimension,
        childCount: evaluation.proposedChildren.length,
        cohesion: evaluation.branchCohesion,
        tokens: result.usage.totalTokens,
      });

      return {
        evaluation,
        skipped: false,
        tokenUsage: result.usage,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      log.error('Branch evaluation failed, defaulting to no-split', {
        module: 'branch-discriminator',
        branchId: context.branchId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        evaluation: {
          shouldSplit: false,
          reason: `Evaluation failed: ${error instanceof Error ? error.message : 'unknown error'}`,
          bestDimension: 'function',
          proposedChildren: [],
          branchCohesion: 0.5,
          confidence: 0.1,
        },
        skipped: false,
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Generate a human-readable label for a branch from its node titles.
   */
  async generateLabel(nodeTitles: string[], parentLabel: string | null): Promise<BranchLabel> {
    try {
      const prompt = buildBranchLabelPrompt(nodeTitles.slice(0, 20), parentLabel);

      const result = await this.provider.completeWithSchema(
        [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        BranchLabelSchema,
        {
          temperature: 0.3,
          maxTokens: 200,
        },
      );

      return result.data;
    } catch (error) {
      log.warn('Branch label generation failed, using fallback', {
        module: 'branch-discriminator',
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        label: nodeTitles[0]?.slice(0, 60) || 'Unnamed Group',
        description: `Group of ${nodeTitles.length} resources`,
      };
    }
  }

  /**
   * Build a BranchContext from a branch ID by loading data from the database.
   */
  buildContextFromDb(branchId: string): BranchContext | null {
    const db = getDatabase();

    // Load the branch
    const branch = db.prepare(`
      SELECT id, parent_id, label, depth, discriminator_dimension, discriminator_value
      FROM hierarchy_branches
      WHERE id = ? AND is_active = 1
    `).get(branchId) as {
      id: string;
      parent_id: string | null;
      label: string;
      depth: number;
      discriminator_dimension: string | null;
      discriminator_value: string | null;
    } | undefined;

    if (!branch) return null;

    // Load parent info
    let parentLabel: string | null = null;
    let parentDimension: string | null = null;
    if (branch.parent_id) {
      const parent = db.prepare(`
        SELECT label, discriminator_dimension
        FROM hierarchy_branches WHERE id = ?
      `).get(branch.parent_id) as { label: string; discriminator_dimension: string | null } | undefined;

      if (parent) {
        parentLabel = parent.label;
        parentDimension = parent.discriminator_dimension;
      }
    }

    // Load nodes in this branch (primary placements only)
    const nodeRows = db.prepare(`
      SELECT
        n.id,
        n.title,
        COALESCE(n.company, '') as company,
        n.extracted_fields,
        n.phrase_description
      FROM node_branch_placements p
      JOIN nodes n ON n.id = p.node_id AND n.is_deleted = 0
      WHERE p.branch_id = ? AND p.is_primary = 1
    `).all(branchId) as Array<{
      id: string;
      title: string;
      company: string;
      extracted_fields: string | null;
      phrase_description: string | null;
    }>;

    const nodes: BranchNodeSummary[] = nodeRows.map(row => {
      let fields: Record<string, unknown> = {};
      if (row.extracted_fields) {
        try { fields = JSON.parse(row.extracted_fields); } catch { /* ignore */ }
      }

      // Extract concepts from multiple possible sources (new format + old format)
      let topConcepts: string[] = [];
      if (Array.isArray(fields.concepts)) {
        topConcepts = (fields.concepts as string[]).slice(0, 5);
      } else {
        // Try to extract from descriptorString (old format: pipe-delimited)
        const descriptor = fields.descriptorString as string | undefined;
        if (descriptor) {
          topConcepts = descriptor.split('|').map(s => s.trim()).filter(s => s.length > 2).slice(0, 5);
        }
      }

      let topTechnologies: string[] = [];
      if (Array.isArray(fields.technologies)) {
        topTechnologies = (fields.technologies as string[]).slice(0, 5);
      }

      return {
        id: row.id,
        title: row.title,
        company: row.company,
        primaryFunction: (fields.primaryFunction as string) || (fields.category as string) || '',
        primaryDomain: (fields.primaryDomain as string) || (fields.segment as string) || '',
        resourceType: (fields.resourceType as string) || (fields.contentType as string) || '',
        topConcepts,
        topTechnologies,
        audience: Array.isArray(fields.audience) ? (fields.audience as string[]) : [],
        platform: Array.isArray(fields.platform) ? (fields.platform as string[]) : [],
        phraseDescription: row.phrase_description || '',
      };
    });

    return {
      branchId: branch.id,
      branchLabel: branch.label,
      branchDepth: branch.depth,
      parentLabel,
      parentDimension,
      discriminatorDimension: branch.discriminator_dimension,
      discriminatorValue: branch.discriminator_value,
      nodes,
    };
  }

  // ============================================================
  // Private Methods
  // ============================================================

  /**
   * Pre-flight checks to avoid unnecessary LLM calls.
   * Returns a skip reason string if the branch should NOT be evaluated,
   * or null if evaluation should proceed.
   */
  private preFlightCheck(context: BranchContext): string | null {
    if (context.nodes.length < this.minNodesForSplit) {
      return `Too few nodes (${context.nodes.length} < ${this.minNodesForSplit})`;
    }

    if (context.branchDepth >= this.maxDepth) {
      return `Maximum depth reached (${context.branchDepth} >= ${this.maxDepth})`;
    }

    return null;
  }

  /**
   * Validate and fix the LLM's evaluation to enforce structural rules.
   */
  private validateEvaluation(evaluation: BranchEvaluation, context: BranchContext): BranchEvaluation {
    if (!evaluation.shouldSplit) {
      return { ...evaluation, proposedChildren: [] };
    }

    // Collect all node IDs in the branch for validation
    const branchNodeIds = new Set(context.nodes.map(n => n.id));

    // Filter out invalid children
    let validChildren = evaluation.proposedChildren.filter(child => {
      // Remove children with invalid node IDs
      const validNodeIds = child.nodeIds.filter(id => branchNodeIds.has(id));
      if (validNodeIds.length < this.minChildSize) return false;

      child.nodeIds = validNodeIds;
      return true;
    });

    // If filtering left us with < 2 children, cancel the split
    if (validChildren.length < 2) {
      return {
        ...evaluation,
        shouldSplit: false,
        reason: `Split rejected: only ${validChildren.length} valid child branch(es) after validation`,
        proposedChildren: [],
      };
    }

    // Ensure every node in the branch is assigned to exactly one child
    const assignedNodeIds = new Set<string>();
    for (const child of validChildren) {
      for (const nodeId of child.nodeIds) {
        assignedNodeIds.add(nodeId);
      }
    }

    // Find unassigned nodes
    const unassignedNodeIds = [...branchNodeIds].filter(id => !assignedNodeIds.has(id));
    if (unassignedNodeIds.length > 0) {
      // Find the largest child and add unassigned nodes there
      const largestChild = validChildren.reduce((a, b) =>
        a.nodeIds.length >= b.nodeIds.length ? a : b
      );
      largestChild.nodeIds.push(...unassignedNodeIds);
    }

    // Deduplicate: ensure no node appears in multiple children
    const seen = new Set<string>();
    for (const child of validChildren) {
      child.nodeIds = child.nodeIds.filter(id => {
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    }

    // Final check: remove children that became too small after dedup
    validChildren = validChildren.filter(child => child.nodeIds.length >= this.minChildSize);

    if (validChildren.length < 2) {
      return {
        ...evaluation,
        shouldSplit: false,
        reason: 'Split rejected: insufficient children after deduplication',
        proposedChildren: [],
      };
    }

    return {
      ...evaluation,
      proposedChildren: validChildren,
    };
  }
}

// ============================================================
// Singleton
// ============================================================

let instance: BranchDiscriminator | null = null;

export function initializeBranchDiscriminator(apiKey: string, options?: DiscriminatorOptions): BranchDiscriminator {
  instance = new BranchDiscriminator(apiKey, options);
  return instance;
}

export function getBranchDiscriminator(): BranchDiscriminator {
  if (!instance) {
    throw new Error('BranchDiscriminator not initialized. Call initializeBranchDiscriminator() first.');
  }
  return instance;
}

export function hasBranchDiscriminator(): boolean {
  return instance !== null;
}

export function clearBranchDiscriminator(): void {
  instance = null;
}
