// ============================================================
// Similarity Computer Service
// ============================================================
//
// Computes node similarity based on shared metadata codes using
// a weighted Jaccard similarity algorithm.
//
// ============================================================

import { log } from '../../logger/index.js';
import { getNodeMetadata, type MetadataCodeType } from '../../database/metadata.js';
import {
  setSimilarity,
  batchSetSimilarity,
  deleteSimilarityForNode,
  getSimilarity,
  type ComputationMethod,
} from '../../database/similarity.js';
import { getAllNodes, readNode } from '../../database/nodes.js';

/**
 * Weights for different metadata code types.
 * Higher weights indicate more importance for similarity calculation.
 */
const METADATA_WEIGHTS: Record<MetadataCodeType, number> = {
  ORG: 2.0,   // Organization - very important
  FNC: 1.5,   // Function/Capability - important
  TEC: 1.0,   // Technology - moderate
  DOM: 1.5,   // Domain - important
  CON: 1.0,   // Concept/Theme - moderate
  IND: 1.5,   // Industry - important
  AUD: 1.0,   // Audience - moderate
  PRC: 0.5,   // Pricing - less important
  LIC: 0.5,   // License - less important
  LNG: 0.5,   // Language - less important
  PLT: 1.0,   // Platform - moderate
};

/**
 * Minimum similarity score threshold for storing results.
 * Scores below this are considered noise and not stored.
 */
const MIN_SIMILARITY_THRESHOLD = 0.01;

/**
 * Result of a similarity computation
 */
export interface SimilarityResult {
  nodeAId: string;
  nodeBId: string;
  score: number;
  sharedCodes: string[];
  method: ComputationMethod;
}

/**
 * Result of batch similarity computation
 */
export interface BatchComputeResult {
  computed: number;
  stored: number;
  skipped: number;
  errors: number;
  durationMs: number;
}

/**
 * Options for similarity computation
 */
export interface ComputeOptions {
  /** Minimum score threshold to store (default: MIN_SIMILARITY_THRESHOLD) */
  minScore?: number;
  /** Whether to log progress (default: true) */
  logProgress?: boolean;
  /** Batch size for database operations (default: 100) */
  batchSize?: number;
}

// ============================================================
// Core Similarity Computation
// ============================================================

/**
 * Compute weighted Jaccard similarity between two nodes based on their metadata codes.
 *
 * Weighted Jaccard formula:
 * similarity = sum(min(weight_A, weight_B)) / sum(max(weight_A, weight_B))
 *
 * Where weights are determined by the metadata code type and whether the code
 * appears in both nodes, only in A, or only in B.
 *
 * @param nodeAId - First node ID
 * @param nodeBId - Second node ID
 * @returns Similarity result with score and shared codes
 */
export function computeSimilarity(
  nodeAId: string,
  nodeBId: string
): SimilarityResult | null {
  // Get metadata for both nodes
  const metadataA = getNodeMetadata(nodeAId);
  const metadataB = getNodeMetadata(nodeBId);

  // If either node has no metadata, similarity is 0
  if (metadataA.length === 0 || metadataB.length === 0) {
    return null;
  }

  // Build weighted code sets
  const codesA = new Map<string, { type: MetadataCodeType; weight: number }>();
  const codesB = new Map<string, { type: MetadataCodeType; weight: number }>();

  for (const entry of metadataA) {
    const weight = METADATA_WEIGHTS[entry.type] || 1.0;
    codesA.set(entry.code, { type: entry.type, weight });
  }

  for (const entry of metadataB) {
    const weight = METADATA_WEIGHTS[entry.type] || 1.0;
    codesB.set(entry.code, { type: entry.type, weight });
  }

  // Compute weighted Jaccard similarity
  const allCodes = new Set([...codesA.keys(), ...codesB.keys()]);
  const sharedCodes: string[] = [];
  let numerator = 0;
  let denominator = 0;

  for (const code of allCodes) {
    const weightA = codesA.get(code)?.weight || 0;
    const weightB = codesB.get(code)?.weight || 0;

    numerator += Math.min(weightA, weightB);
    denominator += Math.max(weightA, weightB);

    if (weightA > 0 && weightB > 0) {
      sharedCodes.push(code);
    }
  }

  // Calculate final score
  const score = denominator > 0 ? numerator / denominator : 0;

  // If no shared codes, return null (no similarity)
  if (sharedCodes.length === 0) {
    return null;
  }

  return {
    nodeAId,
    nodeBId,
    score,
    sharedCodes,
    method: 'jaccard_weighted',
  };
}

/**
 * Compute similarity for a node against all other nodes in the database.
 * Only stores similarities above the minimum threshold.
 *
 * @param nodeId - The node to compute similarities for
 * @param options - Computation options
 * @returns Array of computed similarity results
 */
export async function computeSimilarityForNode(
  nodeId: string,
  options: ComputeOptions = {}
): Promise<SimilarityResult[]> {
  const startTime = Date.now();
  const minScore = options.minScore ?? MIN_SIMILARITY_THRESHOLD;
  const logProgress = options.logProgress ?? true;

  if (logProgress) {
    log.info('Computing similarities for node', {
      nodeId,
      minScore,
      module: 'similarity-computer',
    });
  }

  // Get the target node to ensure it exists
  const targetNode = readNode(nodeId);
  if (!targetNode) {
    log.warn('Cannot compute similarities for non-existent node', {
      nodeId,
      module: 'similarity-computer',
    });
    return [];
  }

  // Get all other nodes
  const allNodes = getAllNodes();
  const results: SimilarityResult[] = [];
  const similarities: Array<{
    nodeAId: string;
    nodeBId: string;
    score: number;
    method?: ComputationMethod;
  }> = [];

  let computed = 0;
  let skipped = 0;

  for (const otherNode of allNodes) {
    // Skip self-comparison
    if (otherNode.id === nodeId) {
      continue;
    }

    // Compute similarity
    const result = computeSimilarity(nodeId, otherNode.id as string);

    computed++;

    // Skip if no similarity or below threshold
    if (!result || result.score < minScore) {
      skipped++;
      continue;
    }

    results.push(result);
    similarities.push({
      nodeAId: result.nodeAId,
      nodeBId: result.nodeBId,
      score: result.score,
      method: result.method,
    });
  }

  // Batch store similarities
  if (similarities.length > 0) {
    const stored = batchSetSimilarity(similarities);

    if (logProgress) {
      log.info('Computed similarities for node', {
        nodeId,
        computed,
        stored,
        skipped,
        durationMs: Date.now() - startTime,
        module: 'similarity-computer',
      });
    }
  } else {
    if (logProgress) {
      log.info('No significant similarities found for node', {
        nodeId,
        computed,
        skipped,
        durationMs: Date.now() - startTime,
        module: 'similarity-computer',
      });
    }
  }

  return results;
}

/**
 * Batch compute similarities for multiple nodes.
 * More efficient than calling computeSimilarityForNode multiple times.
 *
 * @param nodeIds - Array of node IDs to compute similarities for
 * @param options - Computation options
 * @returns Computation statistics
 */
export async function batchComputeSimilarities(
  nodeIds: string[],
  options: ComputeOptions = {}
): Promise<BatchComputeResult> {
  const startTime = Date.now();
  const minScore = options.minScore ?? MIN_SIMILARITY_THRESHOLD;
  const logProgress = options.logProgress ?? true;
  const batchSize = options.batchSize ?? 100;

  let totalComputed = 0;
  let totalStored = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  if (logProgress) {
    log.info('Starting batch similarity computation', {
      nodeCount: nodeIds.length,
      minScore,
      batchSize,
      module: 'similarity-computer',
    });
  }

  // Process nodes in batches to avoid memory issues
  for (let i = 0; i < nodeIds.length; i += batchSize) {
    const batch = nodeIds.slice(i, i + batchSize);
    const batchResults: Array<{
      nodeAId: string;
      nodeBId: string;
      score: number;
      method?: ComputationMethod;
    }> = [];

    // For each node in the batch, compute against all other nodes
    for (const nodeId of batch) {
      try {
        const node = readNode(nodeId);
        if (!node) {
          totalErrors++;
          continue;
        }

        // Get metadata for this node
        const metadata = getNodeMetadata(nodeId);
        if (metadata.length === 0) {
          totalSkipped++;
          continue;
        }

        // Compare against all other nodes in the batch and beyond
        for (const otherNodeId of nodeIds) {
          if (nodeId === otherNodeId) {
            continue;
          }

          // Avoid duplicate comparisons (only compute A->B, not B->A)
          if (nodeId > otherNodeId) {
            continue;
          }

          const result = computeSimilarity(nodeId, otherNodeId);
          totalComputed++;

          if (!result || result.score < minScore) {
            totalSkipped++;
            continue;
          }

          batchResults.push({
            nodeAId: result.nodeAId,
            nodeBId: result.nodeBId,
            score: result.score,
            method: result.method,
          });
        }
      } catch (error) {
        totalErrors++;
        log.error('Error computing similarity for node', {
          nodeId,
          error: error instanceof Error ? error.message : String(error),
          module: 'similarity-computer',
        });
      }
    }

    // Store batch results
    if (batchResults.length > 0) {
      const stored = batchSetSimilarity(batchResults);
      totalStored += stored;

      if (logProgress && (i / batchSize) % 10 === 0) {
        log.info('Batch progress', {
          processed: Math.min(i + batchSize, nodeIds.length),
          total: nodeIds.length,
          stored: totalStored,
          module: 'similarity-computer',
        });
      }
    }
  }

  const durationMs = Date.now() - startTime;

  if (logProgress) {
    log.info('Batch similarity computation completed', {
      computed: totalComputed,
      stored: totalStored,
      skipped: totalSkipped,
      errors: totalErrors,
      durationMs,
      module: 'similarity-computer',
    });
  }

  return {
    computed: totalComputed,
    stored: totalStored,
    skipped: totalSkipped,
    errors: totalErrors,
    durationMs,
  };
}

/**
 * Recompute all similarities in the database.
 * This will delete all existing similarities and recompute from scratch.
 *
 * @param options - Computation options
 * @returns Computation statistics
 */
export async function recomputeAllSimilarities(
  options: ComputeOptions = {}
): Promise<BatchComputeResult> {
  const startTime = Date.now();
  const logProgress = options.logProgress ?? true;

  if (logProgress) {
    log.info('Starting full similarity recomputation', {
      module: 'similarity-computer',
    });
  }

  // Get all nodes with metadata
  const allNodes = getAllNodes();
  const nodesWithMetadata: string[] = [];

  for (const node of allNodes) {
    const metadata = getNodeMetadata(node.id as string);
    if (metadata.length > 0) {
      nodesWithMetadata.push(node.id as string);
    }
  }

  if (logProgress) {
    log.info('Found nodes with metadata', {
      total: allNodes.length,
      withMetadata: nodesWithMetadata.length,
      module: 'similarity-computer',
    });
  }

  // Clear existing similarities for all nodes
  for (const nodeId of nodesWithMetadata) {
    deleteSimilarityForNode(nodeId);
  }

  // Compute all similarities
  const result = await batchComputeSimilarities(nodesWithMetadata, options);

  if (logProgress) {
    log.info('Full similarity recomputation completed', {
      ...result,
      totalDurationMs: Date.now() - startTime,
      module: 'similarity-computer',
    });
  }

  return result;
}

/**
 * Update similarities for a node after its metadata has changed.
 * More efficient than full recomputation - only updates similarities
 * involving this specific node.
 *
 * @param nodeId - The node whose metadata changed
 * @param options - Computation options
 * @returns Array of computed similarity results
 */
export async function updateSimilaritiesForNode(
  nodeId: string,
  options: ComputeOptions = {}
): Promise<SimilarityResult[]> {
  const logProgress = options.logProgress ?? true;

  if (logProgress) {
    log.info('Updating similarities for node after metadata change', {
      nodeId,
      module: 'similarity-computer',
    });
  }

  // Delete existing similarities for this node
  const deletedCount = deleteSimilarityForNode(nodeId);

  if (logProgress && deletedCount > 0) {
    log.debug('Deleted existing similarities', {
      nodeId,
      count: deletedCount,
      module: 'similarity-computer',
    });
  }

  // Recompute similarities for this node
  return computeSimilarityForNode(nodeId, options);
}

/**
 * Get similarity between two specific nodes.
 * If not already computed, computes it on the fly.
 *
 * @param nodeAId - First node ID
 * @param nodeBId - Second node ID
 * @returns Similarity result or null if no similarity
 */
export async function getSimilarityBetweenNodes(
  nodeAId: string,
  nodeBId: string
): Promise<SimilarityResult | null> {
  // Check if already computed
  const existing = getSimilarity(nodeAId, nodeBId);

  if (existing) {
    // Convert database format to result format
    return {
      nodeAId: existing.node_a_id,
      nodeBId: existing.node_b_id,
      score: existing.similarity_score,
      sharedCodes: [], // Not stored in DB, would need to recompute
      method: existing.computation_method as ComputationMethod,
    };
  }

  // Compute on the fly
  const result = computeSimilarity(nodeAId, nodeBId);

  // Store if above threshold
  if (result && result.score >= MIN_SIMILARITY_THRESHOLD) {
    setSimilarity(result.nodeAId, result.nodeBId, result.score, result.method);
  }

  return result;
}

/**
 * Get detailed similarity information including shared codes.
 * Re-computes to get shared code details.
 *
 * @param nodeAId - First node ID
 * @param nodeBId - Second node ID
 * @returns Detailed similarity result with shared codes
 */
export function getDetailedSimilarity(
  nodeAId: string,
  nodeBId: string
): SimilarityResult | null {
  return computeSimilarity(nodeAId, nodeBId);
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Get the weight for a metadata code type.
 *
 * @param type - The metadata code type
 * @returns The weight value
 */
export function getMetadataWeight(type: MetadataCodeType): number {
  return METADATA_WEIGHTS[type] || 1.0;
}

/**
 * Get all metadata weights.
 *
 * @returns Record of all weights by type
 */
export function getAllMetadataWeights(): Record<MetadataCodeType, number> {
  return { ...METADATA_WEIGHTS };
}

/**
 * Get the minimum similarity threshold.
 *
 * @returns The minimum threshold value
 */
export function getMinimumThreshold(): number {
  return MIN_SIMILARITY_THRESHOLD;
}
