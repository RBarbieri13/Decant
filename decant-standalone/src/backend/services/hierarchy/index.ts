// ============================================================
// Hierarchy Service - Public API
// ============================================================

export {
  // Types
  type HierarchyViewType,
  type HierarchyNode,
  type CodeGenerationResult,
  type CodeGenerationResultWithMutations,

  // Code generation functions
  generateFunctionHierarchyCode,
  generateOrganizationHierarchyCode,
  generateSubcategoryChain,
  formatSubcategoryCode,
  formatSubcategoryChain,

  // Database operations
  getNodesForCodeGeneration,
  groupNodesByPosition,
  buildNodeTree,
  generateCodesForView,

  // Main entry points
  regenerateAllHierarchyCodes,
  regenerateNodeHierarchyCode,
  getNodeHierarchyCode,
  validateHierarchyCodeUniqueness,

  // Conflict detection
  checkForConflicts,
  getSiblingNodeIds,
} from './code_generator.js';

export {
  // Types
  type DifferentiatorType,
  type DifferentiableNode,
  type DifferentiatorResult,
  type DifferentiatorGroup,

  // Constants
  DIFFERENTIATOR_PRIORITY,

  // Extraction functions
  extractBrand,
  extractVersion,
  extractVariant,
  extractCreator,
  extractDate,
  extractUniqueId,
  extractDifferentiator,

  // Grouping functions
  findBestDifferentiator,
  groupNodesByDifferentiator,
  getAllDifferentiators,
} from './differentiator.js';

export {
  // Types
  type RestructureContext,
  type RestructureResult,
  type HierarchyCodeMutation,
  type RestructureAuditEntry,
  type ConflictInfo,

  // Conflict detection
  detectConflict,
  hasUniquePosition,

  // Restructuring operations
  planRestructure,
  executeRestructure,
  addNodeWithRestructure,

  // Preview and validation
  getNodesAtPosition,
  previewRestructure,
  validateRestructure,
} from './restructure.js';
