/**
 * Example: Using the Node Similarity System
 *
 * This file demonstrates how to use the similarity database functions
 * to build features like "similar items" and recommendations.
 */

import {
  setSimilarity,
  getSimilarNodes,
  batchSetSimilarity,
  findCommonSimilarNodes,
  getAverageSimilarity,
  getSimilarityStats,
  deleteSimilarityForNode,
  type ComputationMethod,
} from '../backend/database';

// ============================================================
// Example 1: Computing and Storing Similarity
// ============================================================

/**
 * Simple Jaccard similarity calculator for demonstration.
 * In production, you'd use more sophisticated algorithms.
 */
function computeJaccardSimilarity(
  keyConcepts1: string[],
  keyConcepts2: string[]
): number {
  const set1 = new Set(keyConcepts1);
  const set2 = new Set(keyConcepts2);

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Compute and store similarity between two nodes
 */
async function computeAndStoreSimilarity(
  nodeA: { id: string; key_concepts: string[] },
  nodeB: { id: string; key_concepts: string[] }
) {
  const score = computeJaccardSimilarity(
    nodeA.key_concepts,
    nodeB.key_concepts
  );

  // Only store if similarity is meaningful (> 0.3)
  if (score > 0.3) {
    setSimilarity(nodeA.id, nodeB.id, score, 'jaccard_weighted');
    console.log(`Stored similarity: ${nodeA.id} <-> ${nodeB.id} = ${score.toFixed(3)}`);
  }
}

// ============================================================
// Example 2: Batch Computing Similarities
// ============================================================

/**
 * Compute similarities for all nodes in a batch.
 * More efficient than computing one-by-one.
 */
async function batchComputeSimilarities(
  nodes: Array<{ id: string; key_concepts: string[] }>
) {
  console.log(`Computing similarities for ${nodes.length} nodes...`);

  const similarities = [];

  // Compute all pairwise similarities
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const score = computeJaccardSimilarity(
        nodes[i].key_concepts,
        nodes[j].key_concepts
      );

      // Only store meaningful similarities
      if (score > 0.3) {
        similarities.push({
          nodeAId: nodes[i].id,
          nodeBId: nodes[j].id,
          score,
          method: 'jaccard_weighted' as ComputationMethod,
        });
      }
    }
  }

  // Store all at once (atomic transaction)
  const count = batchSetSimilarity(similarities);
  console.log(`Stored ${count} similarity relationships`);

  return count;
}

// ============================================================
// Example 3: Finding Similar Items
// ============================================================

/**
 * Get similar items for display in UI
 */
async function displaySimilarItems(nodeId: string, limit: number = 5) {
  const similar = getSimilarNodes(nodeId, limit);

  console.log(`\nTop ${limit} items similar to ${nodeId}:`);
  console.log('─'.repeat(60));

  if (similar.length === 0) {
    console.log('No similar items found');
    return [];
  }

  for (const item of similar) {
    console.log(
      `  ${item.node_id.padEnd(20)} | Score: ${item.similarity_score.toFixed(3)} | Method: ${item.computation_method}`
    );
  }

  return similar;
}

// ============================================================
// Example 4: Recommendation System
// ============================================================

/**
 * Recommend items based on a user's collection
 */
async function recommendForUserCollection(
  userNodeIds: string[],
  minScore: number = 0.5,
  limit: number = 10
) {
  console.log(`\nGenerating recommendations for collection of ${userNodeIds.length} items...`);

  const recommendations = findCommonSimilarNodes(userNodeIds, minScore, limit);

  console.log(`\nTop ${limit} recommendations:`);
  console.log('─'.repeat(80));

  if (recommendations.length === 0) {
    console.log('No recommendations found');
    return [];
  }

  for (const rec of recommendations) {
    console.log(
      `  ${rec.node_id.padEnd(20)} | Total Score: ${rec.total_score.toFixed(3)} | Matches: ${rec.match_count}/${userNodeIds.length}`
    );
  }

  return recommendations;
}

// ============================================================
// Example 5: Similarity Analytics
// ============================================================

/**
 * Display analytics about similarity data
 */
async function displaySimilarityAnalytics() {
  const stats = getSimilarityStats();

  console.log('\nSimilarity Database Statistics:');
  console.log('─'.repeat(60));
  console.log(`Total Relationships: ${stats.count}`);
  console.log(`Score Range: ${stats.min_score?.toFixed(3)} - ${stats.max_score?.toFixed(3)}`);
  console.log(`Average Score: ${stats.avg_score?.toFixed(3)}`);

  return stats;
}

/**
 * Get node-specific analytics
 */
async function displayNodeAnalytics(nodeId: string) {
  const similarNodes = getSimilarNodes(nodeId, 100); // Get all
  const avgScore = getAverageSimilarity(nodeId);

  console.log(`\nAnalytics for node ${nodeId}:`);
  console.log('─'.repeat(60));
  console.log(`Total Similar Items: ${similarNodes.length}`);
  console.log(`Average Similarity: ${avgScore?.toFixed(3) ?? 'N/A'}`);

  if (similarNodes.length > 0) {
    const highSimilarity = similarNodes.filter(s => s.similarity_score > 0.8).length;
    const mediumSimilarity = similarNodes.filter(
      s => s.similarity_score >= 0.5 && s.similarity_score <= 0.8
    ).length;
    const lowSimilarity = similarNodes.filter(s => s.similarity_score < 0.5).length;

    console.log(`  High (>0.8): ${highSimilarity}`);
    console.log(`  Medium (0.5-0.8): ${mediumSimilarity}`);
    console.log(`  Low (<0.5): ${lowSimilarity}`);
  }
}

// ============================================================
// Example 6: Maintenance Operations
// ============================================================

/**
 * Prune low-quality similarity relationships
 */
async function pruneLowQualitySimilarities(threshold: number = 0.3) {
  console.log(`\nPruning similarities below ${threshold}...`);

  // Note: This would require a new function in similarity.ts
  // For now, showing the concept
  console.log('This would remove all similarities with score < threshold');
}

/**
 * Clean up similarities for deleted nodes
 */
async function cleanupDeletedNode(nodeId: string) {
  console.log(`\nCleaning up similarities for deleted node ${nodeId}...`);

  const deleted = deleteSimilarityForNode(nodeId);
  console.log(`Removed ${deleted} similarity relationships`);

  return deleted;
}

// ============================================================
// Example 7: Full Workflow
// ============================================================

/**
 * Complete workflow: compute, store, and query similarities
 */
async function fullSimilarityWorkflow() {
  console.log('\n' + '='.repeat(80));
  console.log('SIMILARITY WORKFLOW EXAMPLE');
  console.log('='.repeat(80));

  // Sample nodes (in real app, these would come from database)
  const nodes = [
    { id: 'node-1', key_concepts: ['ai', 'machine-learning', 'python', 'tensorflow'] },
    { id: 'node-2', key_concepts: ['ai', 'machine-learning', 'javascript', 'tensorflow'] },
    { id: 'node-3', key_concepts: ['web-dev', 'javascript', 'react', 'frontend'] },
    { id: 'node-4', key_concepts: ['ai', 'deep-learning', 'python', 'pytorch'] },
    { id: 'node-5', key_concepts: ['database', 'sql', 'postgresql', 'backend'] },
  ];

  // Step 1: Compute and store similarities
  console.log('\nStep 1: Computing similarities...');
  await batchComputeSimilarities(nodes);

  // Step 2: Display analytics
  console.log('\nStep 2: Similarity analytics...');
  await displaySimilarityAnalytics();

  // Step 3: Find similar items for a specific node
  console.log('\nStep 3: Finding similar items...');
  await displaySimilarItems('node-1', 3);

  // Step 4: Generate recommendations for a collection
  console.log('\nStep 4: Generating recommendations...');
  await recommendForUserCollection(['node-1', 'node-4'], 0.4, 5);

  // Step 5: Node-specific analytics
  console.log('\nStep 5: Node analytics...');
  await displayNodeAnalytics('node-1');

  console.log('\n' + '='.repeat(80));
  console.log('WORKFLOW COMPLETE');
  console.log('='.repeat(80) + '\n');
}

// ============================================================
// Export for use in other modules
// ============================================================

export {
  computeAndStoreSimilarity,
  batchComputeSimilarities,
  displaySimilarItems,
  recommendForUserCollection,
  displaySimilarityAnalytics,
  displayNodeAnalytics,
  cleanupDeletedNode,
  fullSimilarityWorkflow,
};

// ============================================================
// Run example if executed directly
// ============================================================

if (require.main === module) {
  fullSimilarityWorkflow().catch(console.error);
}
