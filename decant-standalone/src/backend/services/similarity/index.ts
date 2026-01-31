// ============================================================
// Similarity Service Exports
// ============================================================

export {
  computeSimilarity,
  computeSimilarityForNode,
  batchComputeSimilarities,
  recomputeAllSimilarities,
  updateSimilaritiesForNode,
  getSimilarityBetweenNodes,
  getDetailedSimilarity,
  getMetadataWeight,
  getAllMetadataWeights,
  getMinimumThreshold,
  type SimilarityResult,
  type BatchComputeResult,
  type ComputeOptions,
} from './computer.js';
