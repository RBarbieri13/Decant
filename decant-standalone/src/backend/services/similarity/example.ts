// ============================================================
// Similarity Computer - Usage Examples
// ============================================================
//
// This file demonstrates how to use the similarity computer service
// in various scenarios.
//
// ============================================================

import {
  computeSimilarity,
  computeSimilarityForNode,
  batchComputeSimilarities,
  recomputeAllSimilarities,
  updateSimilaritiesForNode,
  getDetailedSimilarity,
} from './computer.js';
import { getSimilarNodes } from '../../database/similarity.js';
import { setNodeMetadata } from '../../database/metadata.js';
import { log } from '../../logger/index.js';

/**
 * Example 1: Compute similarity between two specific nodes
 */
export async function example1_computeBetweenTwo(nodeAId: string, nodeBId: string): Promise<void> {
  log.info('Example 1: Computing similarity between two nodes');

  const result = computeSimilarity(nodeAId, nodeBId);

  if (result) {
    log.info('Similarity computed', {
      nodeA: result.nodeAId,
      nodeB: result.nodeBId,
      score: result.score.toFixed(3),
      sharedCodes: result.sharedCodes.length,
      method: result.method,
    });

    console.log(`\nShared codes: ${result.sharedCodes.join(', ')}`);
  } else {
    log.info('No similarity found (no shared codes or missing metadata)');
  }
}

/**
 * Example 2: Find all similar nodes for a single node
 */
export async function example2_findSimilarNodes(nodeId: string): Promise<void> {
  log.info('Example 2: Finding similar nodes for a single node');

  // Compute similarities against all other nodes
  const results = await computeSimilarityForNode(nodeId, {
    minScore: 0.1, // Only store similarities >= 0.1
    logProgress: true,
  });

  log.info('Similarities computed', {
    nodeId,
    similarNodesFound: results.length,
  });

  // Query the top 5 most similar nodes
  const topSimilar = getSimilarNodes(nodeId, 5);

  console.log(`\nTop 5 similar nodes for ${nodeId}:`);
  topSimilar.forEach((similar, index) => {
    console.log(
      `${index + 1}. Node ${similar.node_id}: ${(similar.similarity_score * 100).toFixed(1)}% similar`
    );
  });
}

/**
 * Example 3: Batch compute similarities for multiple nodes
 */
export async function example3_batchCompute(nodeIds: string[]): Promise<void> {
  log.info('Example 3: Batch computing similarities');

  const result = await batchComputeSimilarities(nodeIds, {
    minScore: 0.05,
    batchSize: 50,
    logProgress: true,
  });

  log.info('Batch computation completed', {
    nodesProcessed: nodeIds.length,
    computed: result.computed,
    stored: result.stored,
    skipped: result.skipped,
    errors: result.errors,
    durationMs: result.durationMs,
    averageMs: Math.round(result.durationMs / nodeIds.length),
  });

  console.log(`\nBatch Results:`);
  console.log(`- Nodes processed: ${nodeIds.length}`);
  console.log(`- Comparisons made: ${result.computed}`);
  console.log(`- Similarities stored: ${result.stored}`);
  console.log(`- Below threshold: ${result.skipped}`);
  console.log(`- Errors: ${result.errors}`);
  console.log(`- Duration: ${(result.durationMs / 1000).toFixed(2)}s`);
}

/**
 * Example 4: Update similarities after metadata change
 */
export async function example4_updateAfterMetadataChange(nodeId: string): Promise<void> {
  log.info('Example 4: Updating similarities after metadata change');

  // Simulate adding new metadata
  const newMetadata = [
    { type: 'DOM', code: 'ARTIFICIAL_INTELLIGENCE' },
    { type: 'TEC', code: 'DEEP_LEARNING' },
    { type: 'ORG', code: 'OPENAI' },
  ] as const;

  console.log(`\nAdding metadata to node ${nodeId}:`);
  newMetadata.forEach((meta) => {
    console.log(`  - ${meta.type}: ${meta.code}`);
  });

  setNodeMetadata(nodeId, [...newMetadata]);

  // Update similarities
  const results = await updateSimilaritiesForNode(nodeId, {
    minScore: 0.1,
  });

  log.info('Similarities updated after metadata change', {
    nodeId,
    newSimilarities: results.length,
  });

  console.log(`\nUpdated ${results.length} similarity relationships`);
}

/**
 * Example 5: Full database recomputation
 */
export async function example5_fullRecomputation(): Promise<void> {
  log.info('Example 5: Full similarity recomputation');

  console.log('\nStarting full recomputation (this may take a while)...');

  const result = await recomputeAllSimilarities({
    minScore: 0.05,
    batchSize: 100,
    logProgress: true,
  });

  log.info('Full recomputation completed', result);

  console.log(`\nRecomputation Results:`);
  console.log(`- Total comparisons: ${result.computed}`);
  console.log(`- Similarities stored: ${result.stored}`);
  console.log(`- Skipped (low score): ${result.skipped}`);
  console.log(`- Errors: ${result.errors}`);
  console.log(`- Duration: ${(result.durationMs / 1000 / 60).toFixed(2)} minutes`);
}

/**
 * Example 6: Get detailed similarity with shared codes
 */
export async function example6_detailedSimilarity(nodeAId: string, nodeBId: string): Promise<void> {
  log.info('Example 6: Getting detailed similarity information');

  const result = getDetailedSimilarity(nodeAId, nodeBId);

  if (result) {
    console.log(`\nDetailed Similarity Report:`);
    console.log(`Node A: ${result.nodeAId}`);
    console.log(`Node B: ${result.nodeBId}`);
    console.log(`Score: ${(result.score * 100).toFixed(1)}%`);
    console.log(`Method: ${result.method}`);
    console.log(`\nShared Metadata Codes (${result.sharedCodes.length}):`);
    result.sharedCodes.forEach((code) => {
      console.log(`  - ${code}`);
    });
  } else {
    console.log(`\nNo similarity between nodes (no shared codes or missing metadata)`);
  }
}

/**
 * Example 7: Progressive similarity analysis
 * Shows how similarity changes as metadata is added
 */
export async function example7_progressiveAnalysis(
  nodeAId: string,
  nodeBId: string
): Promise<void> {
  log.info('Example 7: Progressive similarity analysis');

  console.log(`\nAnalyzing similarity as metadata is added...`);

  // Start with base metadata
  setNodeMetadata(nodeAId, [{ type: 'DOM', code: 'ARTIFICIAL_INTELLIGENCE' }]);
  setNodeMetadata(nodeBId, [{ type: 'DOM', code: 'ARTIFICIAL_INTELLIGENCE' }]);

  let result = computeSimilarity(nodeAId, nodeBId);
  console.log(`\n1. After adding DOM:AI to both: ${(result?.score ?? 0).toFixed(3)}`);

  // Add technology
  setNodeMetadata(nodeAId, [
    { type: 'DOM', code: 'ARTIFICIAL_INTELLIGENCE' },
    { type: 'TEC', code: 'PYTHON' },
  ]);
  setNodeMetadata(nodeBId, [
    { type: 'DOM', code: 'ARTIFICIAL_INTELLIGENCE' },
    { type: 'TEC', code: 'PYTHON' },
  ]);

  result = computeSimilarity(nodeAId, nodeBId);
  console.log(`2. After adding TEC:PYTHON to both: ${(result?.score ?? 0).toFixed(3)}`);

  // Add organization (high weight)
  setNodeMetadata(nodeAId, [
    { type: 'DOM', code: 'ARTIFICIAL_INTELLIGENCE' },
    { type: 'TEC', code: 'PYTHON' },
    { type: 'ORG', code: 'OPENAI' },
  ]);
  setNodeMetadata(nodeBId, [
    { type: 'DOM', code: 'ARTIFICIAL_INTELLIGENCE' },
    { type: 'TEC', code: 'PYTHON' },
    { type: 'ORG', code: 'OPENAI' },
  ]);

  result = computeSimilarity(nodeAId, nodeBId);
  console.log(`3. After adding ORG:OPENAI to both: ${(result?.score ?? 0).toFixed(3)}`);

  // Add diverging metadata
  setNodeMetadata(nodeAId, [
    { type: 'DOM', code: 'ARTIFICIAL_INTELLIGENCE' },
    { type: 'TEC', code: 'PYTHON' },
    { type: 'ORG', code: 'OPENAI' },
    { type: 'FNC', code: 'TEXT_GENERATION' },
  ]);
  setNodeMetadata(nodeBId, [
    { type: 'DOM', code: 'ARTIFICIAL_INTELLIGENCE' },
    { type: 'TEC', code: 'PYTHON' },
    { type: 'ORG', code: 'OPENAI' },
    { type: 'FNC', code: 'IMAGE_GENERATION' },
  ]);

  result = computeSimilarity(nodeAId, nodeBId);
  console.log(`4. After adding different FNC to each: ${(result?.score ?? 0).toFixed(3)}`);
  console.log(`   (Similarity decreased due to diverging functions)`);
}

/**
 * Run all examples
 */
export async function runAllExamples(
  nodeAId: string,
  nodeBId: string,
  nodeCId: string
): Promise<void> {
  console.log('='.repeat(60));
  console.log('Similarity Computer - Usage Examples');
  console.log('='.repeat(60));

  try {
    await example1_computeBetweenTwo(nodeAId, nodeBId);
    console.log('\n' + '-'.repeat(60));

    await example2_findSimilarNodes(nodeAId);
    console.log('\n' + '-'.repeat(60));

    await example3_batchCompute([nodeAId, nodeBId, nodeCId]);
    console.log('\n' + '-'.repeat(60));

    await example4_updateAfterMetadataChange(nodeAId);
    console.log('\n' + '-'.repeat(60));

    await example6_detailedSimilarity(nodeAId, nodeBId);
    console.log('\n' + '-'.repeat(60));

    await example7_progressiveAnalysis(nodeAId, nodeBId);
    console.log('\n' + '='.repeat(60));
  } catch (error) {
    log.error('Error running examples', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
