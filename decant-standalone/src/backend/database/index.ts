// ============================================================
// Database Module Index
// ============================================================

export { getDatabase, closeDatabase, getDatabasePath, isDatabaseInitialized } from './connection.js';
export { initializeDatabase, runMigrations, getDatabaseMigrationStatus } from './schema.js';
export { getMigrationStatus, runPendingMigrations, rollbackMigration } from './migrations/index.js';
export { withTransaction, withTransactionSync } from './transaction.js';
export { createNode, readNode, updateNode, deleteNode, getAllNodes, getNodeById, countNodes, getNodesPaginated, batchLoadKeyConcepts, readNodes, mergeNodes } from './nodes.js';
export type { CreateNodeInput, UpdateNodeInput, MergeNodesOptions } from './nodes.js';
export { getSegments, getOrganizations, getTree } from './taxonomy.js';
export { searchNodes, countSearchResults } from './search.js';

// Metadata registry types
export type {
  MetadataCodeType,
  RegistryEntry,
  NodeMetadataEntry,
  MetadataInput,
  CodeStats,
} from './metadata.js';

// Metadata registry constants and functions
export {
  VALID_METADATA_CODE_TYPES,
  METADATA_TYPE_LABELS,
  // Normalization helpers
  normalizeCode,
  normalizeDisplayName,
  isValidMetadataType,
  // Registry operations
  getRegistryEntry,
  getOrCreateRegistryEntry,
  getCodesByType,
  getAllRegistryEntries,
  searchCodes,
  getCodeStats,
  incrementCodeUsage,
  // Node metadata operations
  setNodeMetadata,
  addNodeMetadata,
  getNodeMetadata,
  getNodeMetadataByType,
  getNodesByMetadataCode,
  removeNodeMetadata,
  clearNodeMetadata,
  batchLoadNodeMetadata,
} from './metadata.js';

// Similarity types
export type {
  SimilarityRecord,
  SimilarNode,
  ComputationMethod,
} from './similarity.js';

// Similarity functions
export {
  normalizeNodePair,
  getSimilarNodes,
  setSimilarity,
  deleteSimilarityForNode,
  getAverageSimilarity,
  getSimilarity,
  batchSetSimilarity,
  getAllSimilarities,
  countSimilarities,
  getSimilarityStats,
  findCommonSimilarNodes,
} from './similarity.js';

// Audit types
export type {
  HierarchyType,
  ChangeType,
  TriggeredBy,
  CodeChangeRecord,
  LogCodeChangeParams,
  GetNodeHistoryOptions,
} from './audit.js';

// Audit functions
export {
  logCodeChange,
  getNodeHistory,
  getRecentChanges,
  getChangesByType,
  getBatchChanges,
  getChangesByTrigger,
  getChangeStatistics,
} from './audit.js';
