// ============================================================
// Dynamic Classifier Service
// ============================================================
// Classifies all nodes together, generating an emergent taxonomy
// based on semantic similarity rather than a static predefined taxonomy.

import { OpenAIProvider } from './llm/provider.js';
import { log } from '../logger/index.js';
import {
  type CondensedNode,
  type DynamicTaxonomy,
  type NodeAssignment,
  DynamicClassificationSchema,
  DynamicTaxonomySchema,
  AssignmentBatchSchema,
  buildCombinedPrompt,
  buildTaxonomyOnlyPrompt,
  buildAssignmentPrompt,
} from './llm/prompts/dynamic_classification.js';

// ============================================================
// Types
// ============================================================

export interface DynamicClassificationResult {
  taxonomy: DynamicTaxonomy;
  assignments: NodeAssignment[];
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface DynamicClassifierOptions {
  taxonomyModel?: string;
  assignmentModel?: string;
  temperature?: number;
  combinedThreshold?: number;
  assignmentBatchSize?: number;
  assignmentConcurrency?: number;
}

// Re-export for consumers
export type { CondensedNode, DynamicTaxonomy, NodeAssignment };

// ============================================================
// Constants
// ============================================================

const DEFAULT_TAXONOMY_MODEL = 'gpt-4o';
const DEFAULT_ASSIGNMENT_MODEL = 'gpt-4o-mini';
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_COMBINED_THRESHOLD = 150;
const DEFAULT_ASSIGNMENT_BATCH_SIZE = 80;
const DEFAULT_ASSIGNMENT_CONCURRENCY = 2;

// ============================================================
// DynamicClassifier
// ============================================================

export class DynamicClassifier {
  private taxonomyProvider: OpenAIProvider;
  private assignmentProvider: OpenAIProvider;
  private temperature: number;
  private combinedThreshold: number;
  private assignmentBatchSize: number;
  private assignmentConcurrency: number;

  constructor(apiKey: string, options: DynamicClassifierOptions = {}) {
    this.temperature = options.temperature ?? DEFAULT_TEMPERATURE;
    this.combinedThreshold = options.combinedThreshold ?? DEFAULT_COMBINED_THRESHOLD;
    this.assignmentBatchSize = options.assignmentBatchSize ?? DEFAULT_ASSIGNMENT_BATCH_SIZE;
    this.assignmentConcurrency = options.assignmentConcurrency ?? DEFAULT_ASSIGNMENT_CONCURRENCY;

    this.taxonomyProvider = new OpenAIProvider({
      apiKey,
      defaultModel: options.taxonomyModel ?? DEFAULT_TAXONOMY_MODEL,
      enableCircuitBreaker: false,
    });

    this.assignmentProvider = new OpenAIProvider({
      apiKey,
      defaultModel: options.assignmentModel ?? DEFAULT_ASSIGNMENT_MODEL,
      enableCircuitBreaker: false,
    });
  }

  /**
   * Classify all nodes together, generating an emergent taxonomy.
   */
  async classifyAll(nodes: CondensedNode[]): Promise<DynamicClassificationResult> {
    if (nodes.length === 0) {
      return {
        taxonomy: { segments: [], categories: [] },
        assignments: [],
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }

    log.info(`Dynamic classification starting for ${nodes.length} nodes`, {
      module: 'dynamic-classifier',
      threshold: this.combinedThreshold,
      approach: nodes.length <= this.combinedThreshold ? 'combined' : 'phased',
    });

    if (nodes.length <= this.combinedThreshold) {
      return this.classifyCombined(nodes);
    }
    return this.classifyPhased(nodes);
  }

  // ============================================================
  // Combined Approach (≤150 nodes)
  // ============================================================

  private async classifyCombined(nodes: CondensedNode[]): Promise<DynamicClassificationResult> {
    const prompt = buildCombinedPrompt(nodes);

    log.info('Running combined taxonomy + assignment call', {
      module: 'dynamic-classifier',
      nodeCount: nodes.length,
    });

    const result = await this.taxonomyProvider.completeWithSchema(
      [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      DynamicClassificationSchema,
      {
        temperature: this.temperature,
        maxTokens: 16000,
      },
    );

    const taxonomy: DynamicTaxonomy = {
      segments: result.data.segments,
      categories: result.data.categories,
    };

    const validatedTaxonomy = this.validateTaxonomy(taxonomy);
    const validatedAssignments = this.validateAssignments(result.data.assignments, validatedTaxonomy, nodes);

    log.info('Combined classification complete', {
      module: 'dynamic-classifier',
      segments: validatedTaxonomy.segments.length,
      categories: validatedTaxonomy.categories.length,
      assignments: validatedAssignments.length,
      tokens: result.usage.totalTokens,
    });

    return {
      taxonomy: validatedTaxonomy,
      assignments: validatedAssignments,
      tokenUsage: result.usage,
    };
  }

  // ============================================================
  // Phased Approach (>150 nodes)
  // ============================================================

  private async classifyPhased(nodes: CondensedNode[]): Promise<DynamicClassificationResult> {
    const totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    // Phase A: Generate taxonomy
    log.info('Phase A: Generating taxonomy', {
      module: 'dynamic-classifier',
      nodeCount: nodes.length,
    });

    const taxPrompt = buildTaxonomyOnlyPrompt(nodes);
    const taxResult = await this.taxonomyProvider.completeWithSchema(
      [
        { role: 'system', content: taxPrompt.system },
        { role: 'user', content: taxPrompt.user },
      ],
      DynamicTaxonomySchema,
      {
        temperature: this.temperature,
        maxTokens: 4000,
      },
    );

    totalUsage.promptTokens += taxResult.usage.promptTokens;
    totalUsage.completionTokens += taxResult.usage.completionTokens;
    totalUsage.totalTokens += taxResult.usage.totalTokens;

    const taxonomy = this.validateTaxonomy(taxResult.data);

    log.info('Phase A complete, taxonomy generated', {
      module: 'dynamic-classifier',
      segments: taxonomy.segments.length,
      categories: taxonomy.categories.length,
    });

    // Phase B: Assign in batches
    const batches = this.chunkArray(nodes, this.assignmentBatchSize);
    const allAssignments: NodeAssignment[] = [];

    log.info(`Phase B: Assigning ${nodes.length} nodes in ${batches.length} batches`, {
      module: 'dynamic-classifier',
      batchSize: this.assignmentBatchSize,
      concurrency: this.assignmentConcurrency,
    });

    // Process batches with limited concurrency
    for (let i = 0; i < batches.length; i += this.assignmentConcurrency) {
      const concurrentBatches = batches.slice(i, i + this.assignmentConcurrency);
      const batchResults = await Promise.all(
        concurrentBatches.map((batch, j) => this.assignBatch(taxonomy, batch, i + j + 1, batches.length))
      );

      for (const batchResult of batchResults) {
        allAssignments.push(...batchResult.assignments);
        totalUsage.promptTokens += batchResult.usage.promptTokens;
        totalUsage.completionTokens += batchResult.usage.completionTokens;
        totalUsage.totalTokens += batchResult.usage.totalTokens;
      }
    }

    const validatedAssignments = this.validateAssignments(allAssignments, taxonomy, nodes);

    log.info('Phase B complete, all nodes assigned', {
      module: 'dynamic-classifier',
      assignments: validatedAssignments.length,
      totalTokens: totalUsage.totalTokens,
    });

    return {
      taxonomy,
      assignments: validatedAssignments,
      tokenUsage: totalUsage,
    };
  }

  private async assignBatch(
    taxonomy: DynamicTaxonomy,
    batch: CondensedNode[],
    batchNum: number,
    totalBatches: number,
  ): Promise<{ assignments: NodeAssignment[]; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
    log.info(`Assigning batch ${batchNum}/${totalBatches} (${batch.length} nodes)`, {
      module: 'dynamic-classifier',
    });

    const prompt = buildAssignmentPrompt(taxonomy, batch);
    const result = await this.assignmentProvider.completeWithSchema(
      [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      AssignmentBatchSchema,
      {
        temperature: this.temperature,
        maxTokens: 8000,
      },
    );

    return {
      assignments: result.data.assignments,
      usage: result.usage,
    };
  }

  // ============================================================
  // Validation
  // ============================================================

  private validateTaxonomy(taxonomy: DynamicTaxonomy): DynamicTaxonomy {
    // Deduplicate segment codes
    const seenSegCodes = new Set<string>();
    const segments = taxonomy.segments.filter(seg => {
      const code = seg.code.toUpperCase().charAt(0);
      if (seenSegCodes.has(code)) return false;
      seenSegCodes.add(code);
      return true;
    }).map(seg => ({
      ...seg,
      code: seg.code.toUpperCase().charAt(0),
      label: seg.label.slice(0, 40),
      description: seg.description.slice(0, 100),
    }));

    // Deduplicate category codes within each segment
    const seenCatCodes = new Map<string, Set<string>>();
    const categories = taxonomy.categories.filter(cat => {
      const segCode = cat.segmentCode.toUpperCase().charAt(0);
      const catCode = cat.code.toUpperCase().slice(0, 3);

      // Skip categories for non-existent segments
      if (!seenSegCodes.has(segCode)) return false;

      if (!seenCatCodes.has(segCode)) {
        seenCatCodes.set(segCode, new Set());
      }
      const segCats = seenCatCodes.get(segCode)!;
      if (segCats.has(catCode)) return false;
      segCats.add(catCode);
      return true;
    }).map(cat => ({
      ...cat,
      segmentCode: cat.segmentCode.toUpperCase().charAt(0),
      code: cat.code.toUpperCase().slice(0, 3),
      label: cat.label.slice(0, 60),
      description: cat.description.slice(0, 100),
    }));

    // Ensure every segment has at least one category
    for (const seg of segments) {
      const hasCats = categories.some(c => c.segmentCode === seg.code);
      if (!hasCats) {
        categories.push({
          segmentCode: seg.code,
          code: 'OTH',
          label: `Other ${seg.label}`,
          description: `Uncategorized items in ${seg.label}`,
        });
      }
    }

    return { segments, categories };
  }

  private validateAssignments(
    assignments: NodeAssignment[],
    taxonomy: DynamicTaxonomy,
    allNodes: CondensedNode[],
  ): NodeAssignment[] {
    const validSegCodes = new Set(taxonomy.segments.map(s => s.code));
    const validCatCodes = new Map<string, Set<string>>();
    for (const cat of taxonomy.categories) {
      if (!validCatCodes.has(cat.segmentCode)) {
        validCatCodes.set(cat.segmentCode, new Set());
      }
      validCatCodes.get(cat.segmentCode)!.add(cat.code);
    }

    // Default segment/category for unassigned nodes
    const defaultSeg = taxonomy.segments[0]?.code || 'X';
    const defaultCat = taxonomy.categories.find(c => c.segmentCode === defaultSeg)?.code || 'OTH';

    // Build assignment map
    const assignmentMap = new Map<string, NodeAssignment>();
    for (const assignment of assignments) {
      let segCode = assignment.segmentCode?.toUpperCase()?.charAt(0) || defaultSeg;
      let catCode = assignment.categoryCode?.toUpperCase()?.slice(0, 3) || defaultCat;

      // Fix invalid segment codes
      if (!validSegCodes.has(segCode)) {
        segCode = defaultSeg;
      }

      // Fix invalid category codes
      if (!validCatCodes.get(segCode)?.has(catCode)) {
        catCode = validCatCodes.get(segCode)?.values().next().value || defaultCat;
      }

      assignmentMap.set(assignment.nodeId, {
        ...assignment,
        title: (assignment.title || '').slice(0, 200),
        segmentCode: segCode,
        categoryCode: catCode,
        subcategoryLabel: (assignment.subcategoryLabel || '').slice(0, 40),
        contentType: (assignment.contentType || 'U').toUpperCase().charAt(0),
        organization: (assignment.organization || 'UNKN').toUpperCase().slice(0, 4),
        quickPhrase: (assignment.quickPhrase || '').slice(0, 100),
        description: (assignment.description || '').slice(0, 300),
        functionTags: (assignment.functionTags || '').slice(0, 200),
        confidence: Math.max(0, Math.min(1, assignment.confidence ?? 0.5)),
      });
    }

    // Ensure every input node has an assignment
    for (const node of allNodes) {
      if (!assignmentMap.has(node.id)) {
        log.warn(`Node ${node.id} not assigned by LLM, using defaults`, {
          module: 'dynamic-classifier',
          title: node.title,
        });
        assignmentMap.set(node.id, {
          nodeId: node.id,
          title: node.title,
          segmentCode: defaultSeg,
          categoryCode: defaultCat,
          subcategoryLabel: '',
          contentType: 'U',
          organization: 'UNKN',
          quickPhrase: node.quickPhrase || node.title.slice(0, 100),
          description: node.shortDescription || '',
          functionTags: '',
          confidence: 0.3,
        });
      }
    }

    return Array.from(assignmentMap.values());
  }

  // ============================================================
  // Utilities
  // ============================================================

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
