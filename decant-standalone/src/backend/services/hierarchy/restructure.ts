// ============================================================
// Hierarchy Restructuring Service
// Handles dynamic restructuring and conflict resolution when
// new nodes are added to the hierarchy
// ============================================================

import { getDatabase } from '../../database/connection.js';
import { withTransaction } from '../../database/transaction.js';
import {
  findBestDifferentiator,
  type DifferentiableNode,
  type DifferentiatorGroup,
} from './differentiator.js';
import {
  type HierarchyNode,
  type HierarchyViewType,
  generateFunctionHierarchyCode,
  generateOrganizationHierarchyCode,
  formatSubcategoryChain,
} from './code_generator.js';

// ============================================================
// Types
// ============================================================

/**
 * Context for restructuring operation
 */
export interface RestructureContext {
  /** ID of the new node being added */
  newNodeId: string;
  /** Attributes of the new node for differentiation */
  newNodeAttributes: DifferentiableNode;
  /** Target path where node is being added (e.g., "A.LLM.T") */
  targetPath: string;
  /** Existing nodes at or under the target path */
  existingNodes: DifferentiableNode[];
  /** Type of hierarchy being restructured */
  hierarchyType: HierarchyViewType;
}

/**
 * Result of a restructuring operation
 */
export interface RestructureResult {
  /** New hierarchy code for the added node */
  newNodeCode: string;
  /** All code mutations that need to be applied */
  mutations: HierarchyCodeMutation[];
  /** Names/descriptions of subcategories created during restructure */
  subcategoriesCreated: string[];
  /** Whether restructuring was needed */
  restructuringNeeded: boolean;
}

/**
 * A single hierarchy code mutation
 */
export interface HierarchyCodeMutation {
  /** Node ID being mutated */
  nodeId: string;
  /** Previous hierarchy code (null if new) */
  oldCode: string | null;
  /** New hierarchy code */
  newCode: string;
  /** Type of hierarchy code being mutated */
  hierarchyType: HierarchyViewType;
}

/**
 * Audit log entry for restructuring operations
 */
export interface RestructureAuditEntry {
  /** Timestamp of the operation */
  timestamp: string;
  /** Type of restructure operation */
  operation: 'add' | 'restructure' | 'conflict_resolution';
  /** Context summary */
  context: {
    targetPath: string;
    hierarchyType: HierarchyViewType;
    nodesAffected: number;
  };
  /** All mutations applied */
  mutations: HierarchyCodeMutation[];
}

/**
 * Conflict detection result
 */
export interface ConflictInfo {
  /** Whether a conflict exists */
  hasConflict: boolean;
  /** Nodes that would have the same code */
  conflictingNodes: DifferentiableNode[];
  /** The conflicting code pattern */
  conflictingCodePattern: string | null;
}

// ============================================================
// Conflict Detection
// ============================================================

/**
 * Detect if a new node would conflict with existing nodes at the same position
 * A conflict occurs when multiple nodes would occupy the same terminal position
 * in the hierarchy (same segment, category, content type, and parent)
 *
 * @param newNode - The node being added
 * @param existingAtPath - Existing nodes at the same hierarchy position
 * @returns Conflict information
 */
export function detectConflict(
  newNode: DifferentiableNode,
  existingAtPath: DifferentiableNode[]
): ConflictInfo {
  // If there are no existing nodes, no conflict
  if (existingAtPath.length === 0) {
    return {
      hasConflict: false,
      conflictingNodes: [],
      conflictingCodePattern: null,
    };
  }

  // Filter out the new node from existing if it's already there
  const existingOtherNodes = existingAtPath.filter(n => n.id !== newNode.id);

  // If there are other nodes at this position, we have a conflict
  // (the new node plus existing nodes would need differentiation)
  if (existingOtherNodes.length > 0) {
    return {
      hasConflict: true,
      conflictingNodes: existingOtherNodes,
      conflictingCodePattern: null, // Will be determined during restructure
    };
  }

  return {
    hasConflict: false,
    conflictingNodes: [],
    conflictingCodePattern: null,
  };
}

/**
 * Check if a node already has a unique code at its position
 * Returns true if no other nodes share the same base code
 */
export function hasUniquePosition(
  nodeId: string,
  hierarchyType: HierarchyViewType
): boolean {
  const db = getDatabase();
  const codeColumn = hierarchyType === 'function'
    ? 'function_hierarchy_code'
    : 'organization_hierarchy_code';

  // Get the node's current code
  const node = db.prepare(`
    SELECT ${codeColumn} as code FROM nodes WHERE id = ? AND is_deleted = 0
  `).get(nodeId) as { code: string | null } | undefined;

  if (!node || !node.code) {
    return false;
  }

  // Check if any other node has the same code
  const duplicates = db.prepare(`
    SELECT COUNT(*) as count FROM nodes
    WHERE ${codeColumn} = ? AND id != ? AND is_deleted = 0
  `).get(node.code, nodeId) as { count: number };

  return duplicates.count === 0;
}

// ============================================================
// Restructuring Planning
// ============================================================

/**
 * Plan a restructure operation to resolve conflicts
 * This generates the mutations needed without executing them
 *
 * Algorithm:
 * 1. Collect all nodes at the conflict level (including new node)
 * 2. Use findBestDifferentiator to find the best way to split them
 * 3. Group nodes by differentiator value
 * 4. Assign sequential subcategory numbers (1, 2, 3...)
 * 5. Recursively handle groups with multiple nodes
 * 6. Return planned code changes
 *
 * @param context - The restructure context
 * @returns The restructure result with planned mutations
 */
export function planRestructure(context: RestructureContext): RestructureResult {
  const {
    newNodeId,
    newNodeAttributes,
    targetPath,
    existingNodes,
    hierarchyType,
  } = context;

  // Combine new node with existing nodes
  const allNodes: DifferentiableNode[] = [
    newNodeAttributes,
    ...existingNodes.filter(n => n.id !== newNodeId),
  ];

  // If only the new node, no restructuring needed
  if (allNodes.length === 1) {
    const newCode = `${targetPath}.1`;
    return {
      newNodeCode: newCode,
      mutations: [{
        nodeId: newNodeId,
        oldCode: null,
        newCode,
        hierarchyType,
      }],
      subcategoriesCreated: [],
      restructuringNeeded: false,
    };
  }

  // Find the best differentiator and group nodes
  const { type: differentiatorType, groups } = findBestDifferentiator(allNodes);

  // Generate subcategory chains for all nodes
  const subcategoryChains = generateSubcategoryChains(groups, 0);

  // Build mutations
  const mutations: HierarchyCodeMutation[] = [];
  const subcategoriesCreated: string[] = [];
  let newNodeCode = '';

  // Get existing codes for comparison
  const existingCodes = getExistingCodes(allNodes.map(n => n.id), hierarchyType);

  for (const [nodeId, chain] of subcategoryChains) {
    const formattedChain = formatSubcategoryChain(chain);
    const newCode = `${targetPath}.${formattedChain.join('.')}`;
    const oldCode = existingCodes.get(nodeId) || null;

    if (nodeId === newNodeId) {
      newNodeCode = newCode;
    }

    // Only add mutation if code actually changes
    if (oldCode !== newCode) {
      mutations.push({
        nodeId,
        oldCode,
        newCode,
        hierarchyType,
      });
    }
  }

  // Track subcategories created based on differentiator groups
  if (groups.length > 1) {
    subcategoriesCreated.push(
      `Split by ${differentiatorType}: ${groups.map(g => g.value).join(', ')}`
    );
  }

  return {
    newNodeCode,
    mutations,
    subcategoriesCreated,
    restructuringNeeded: mutations.length > 1, // More than just the new node
  };
}

/**
 * Generate subcategory chains for grouped nodes
 * Recursively handles groups with multiple nodes
 *
 * @param groups - Differentiator groups
 * @param depth - Current recursion depth
 * @param maxDepth - Maximum recursion depth
 * @returns Map of node ID to subcategory chain
 */
function generateSubcategoryChains(
  groups: DifferentiatorGroup[],
  depth: number,
  maxDepth: number = 10
): Map<string, string[]> {
  const result = new Map<string, string[]>();

  // Prevent infinite recursion
  if (depth >= maxDepth) {
    let index = 1;
    for (const group of groups) {
      for (const node of group.nodes) {
        result.set(node.id, [String(index++)]);
      }
    }
    return result;
  }

  // Assign sequential numbers to groups
  groups.forEach((group, groupIndex) => {
    const groupNumber = String(groupIndex + 1);

    if (group.nodes.length === 1) {
      // Single node in group - just the group number
      result.set(group.nodes[0].id, [groupNumber]);
    } else {
      // Multiple nodes in group - find next differentiator
      const { groups: subGroups } = findBestDifferentiator(group.nodes);
      const subChains = generateSubcategoryChains(subGroups, depth + 1, maxDepth);

      for (const [nodeId, subChain] of subChains) {
        result.set(nodeId, [groupNumber, ...subChain]);
      }
    }
  });

  return result;
}

/**
 * Get existing hierarchy codes for a list of nodes
 */
function getExistingCodes(
  nodeIds: string[],
  hierarchyType: HierarchyViewType
): Map<string, string> {
  if (nodeIds.length === 0) {
    return new Map();
  }

  const db = getDatabase();
  const codeColumn = hierarchyType === 'function'
    ? 'function_hierarchy_code'
    : 'organization_hierarchy_code';

  const placeholders = nodeIds.map(() => '?').join(', ');
  const rows = db.prepare(`
    SELECT id, ${codeColumn} as code FROM nodes
    WHERE id IN (${placeholders}) AND is_deleted = 0
  `).all(...nodeIds) as Array<{ id: string; code: string | null }>;

  const result = new Map<string, string>();
  for (const row of rows) {
    if (row.code) {
      result.set(row.id, row.code);
    }
  }

  return result;
}

// ============================================================
// Restructuring Execution
// ============================================================

/**
 * Execute a restructure operation, applying all mutations atomically
 *
 * @param result - The restructure result from planRestructure
 * @returns Audit entry for the operation
 */
export function executeRestructure(result: RestructureResult): RestructureAuditEntry {
  const db = getDatabase();

  // Extract hierarchy type from mutations (all should be same type)
  const hierarchyType = result.mutations[0]?.hierarchyType || 'function';

  const timestamp = new Date().toISOString();
  const auditEntry: RestructureAuditEntry = {
    timestamp,
    operation: result.restructuringNeeded ? 'restructure' : 'add',
    context: {
      targetPath: extractBasePath(result.newNodeCode),
      hierarchyType,
      nodesAffected: result.mutations.length,
    },
    mutations: result.mutations,
  };

  // Execute all mutations in a transaction
  withTransaction(() => {
    const functionUpdateStmt = db.prepare(`
      UPDATE nodes
      SET function_hierarchy_code = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const orgUpdateStmt = db.prepare(`
      UPDATE nodes
      SET organization_hierarchy_code = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    for (const mutation of result.mutations) {
      if (mutation.hierarchyType === 'function') {
        functionUpdateStmt.run(mutation.newCode, mutation.nodeId);
      } else {
        orgUpdateStmt.run(mutation.newCode, mutation.nodeId);
      }
    }

    // Log the restructure operation to the audit table if it exists
    try {
      const auditStmt = db.prepare(`
        INSERT INTO hierarchy_audit_log (
          timestamp, operation, target_path, hierarchy_type,
          nodes_affected, mutations_json
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      auditStmt.run(
        timestamp,
        auditEntry.operation,
        auditEntry.context.targetPath,
        auditEntry.context.hierarchyType,
        auditEntry.context.nodesAffected,
        JSON.stringify(auditEntry.mutations)
      );
    } catch {
      // Audit table may not exist, that's okay
      // Just log to console for debugging
      console.debug('[Restructure] Audit entry:', JSON.stringify(auditEntry, null, 2));
    }
  });

  return auditEntry;
}

/**
 * Extract the base path from a full hierarchy code
 * E.g., "A.LLM.T.1.2" -> "A.LLM.T"
 */
function extractBasePath(code: string): string {
  const parts = code.split('.');
  // Base path is first 3 parts (segment.category.contentType)
  return parts.slice(0, 3).join('.');
}

// ============================================================
// High-Level API
// ============================================================

/**
 * Add a node to the hierarchy with automatic conflict resolution
 * This is the main entry point for adding nodes that may conflict
 *
 * @param nodeId - ID of the node to add
 * @param hierarchyType - Type of hierarchy to add to
 * @returns Restructure result with the new code and any mutations
 */
export function addNodeWithRestructure(
  nodeId: string,
  hierarchyType: HierarchyViewType
): RestructureResult {
  const db = getDatabase();

  // Get the node's details
  const nodeRow = db.prepare(`
    SELECT
      id, title, company, source_domain,
      extracted_fields, metadata_tags, date_added, created_at,
      segment_code, category_code, content_type_code,
      function_parent_id, organization_parent_id,
      function_hierarchy_code, organization_hierarchy_code
    FROM nodes
    WHERE id = ? AND is_deleted = 0
  `).get(nodeId) as any;

  if (!nodeRow) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  const node: HierarchyNode = {
    ...nodeRow,
    extracted_fields: nodeRow.extracted_fields ? JSON.parse(nodeRow.extracted_fields) : {},
    metadata_tags: nodeRow.metadata_tags ? JSON.parse(nodeRow.metadata_tags) : [],
  };

  // Determine the base target path
  const segment = node.segment_code || 'X';
  const category = node.category_code || 'UNK';
  const contentType = node.content_type_code || 'A';
  const parentId = hierarchyType === 'function'
    ? node.function_parent_id
    : node.organization_parent_id;

  // For organization hierarchy, we need the org code
  let targetPath: string;
  if (hierarchyType === 'organization') {
    const orgCode = extractOrgCodeFromNode(node);
    targetPath = `${orgCode}.${category}.${contentType}`;
  } else {
    targetPath = `${segment}.${category}.${contentType}`;
  }

  // Find existing nodes at the same position
  const parentField = hierarchyType === 'function' ? 'function_parent_id' : 'organization_parent_id';
  const existingRows = db.prepare(`
    SELECT
      id, title, company, source_domain,
      extracted_fields, metadata_tags, date_added, created_at,
      segment_code, category_code, content_type_code
    FROM nodes
    WHERE
      is_deleted = 0
      AND id != ?
      AND segment_code = ?
      AND category_code = ?
      AND content_type_code = ?
      AND (${parentField} = ? OR (${parentField} IS NULL AND ? IS NULL))
  `).all(
    nodeId,
    node.segment_code || null,
    node.category_code || null,
    node.content_type_code || null,
    parentId || null,
    parentId || null
  ) as any[];

  const existingNodes: DifferentiableNode[] = existingRows.map(row => ({
    ...row,
    extracted_fields: row.extracted_fields ? JSON.parse(row.extracted_fields) : {},
    metadata_tags: row.metadata_tags ? JSON.parse(row.metadata_tags) : [],
  }));

  // Build restructure context
  const context: RestructureContext = {
    newNodeId: nodeId,
    newNodeAttributes: node,
    targetPath,
    existingNodes,
    hierarchyType,
  };

  // Plan and execute restructure
  const result = planRestructure(context);
  executeRestructure(result);

  return result;
}

/**
 * Extract organization code from a node (helper)
 */
function extractOrgCodeFromNode(node: HierarchyNode): string {
  // Known company mappings
  const knownMappings: Record<string, string> = {
    'anthropic': 'ANTH',
    'openai': 'OAIA',
    'google': 'GOOG',
    'microsoft': 'MSFT',
    'amazon': 'AMZN',
    'meta': 'META',
    'apple': 'AAPL',
    'nvidia': 'NVDA',
    'hugging face': 'HGFC',
    'huggingface': 'HGFC',
    'langchain': 'LNGC',
  };

  if (node.company) {
    const normalized = node.company.toLowerCase().trim();
    if (knownMappings[normalized]) {
      return knownMappings[normalized];
    }
    const cleaned = normalized.replace(/[^a-z0-9]/g, '');
    return cleaned.substring(0, 4).toUpperCase().padEnd(4, 'X');
  }

  if (node.source_domain) {
    const base = node.source_domain
      .toLowerCase()
      .replace(/^(www\.|api\.|docs\.|blog\.)/i, '')
      .replace(/\.(com|org|net|io|ai|dev|app|co|us|uk|de|fr)$/i, '');
    return base.substring(0, 4).toUpperCase().padEnd(4, 'X');
  }

  return 'UNKN';
}

/**
 * Get nodes that would be affected by adding a node at a specific position
 * Useful for previewing restructure impacts
 *
 * @param targetPath - The base hierarchy path (e.g., "A.LLM.T")
 * @param hierarchyType - Type of hierarchy
 * @param parentId - Optional parent node ID
 * @returns Array of nodes at the position
 */
export function getNodesAtPosition(
  targetPath: string,
  hierarchyType: HierarchyViewType,
  parentId?: string | null
): DifferentiableNode[] {
  const db = getDatabase();
  const [segment, category, contentType] = targetPath.split('.');
  const parentField = hierarchyType === 'function' ? 'function_parent_id' : 'organization_parent_id';

  const rows = db.prepare(`
    SELECT
      id, title, company, source_domain,
      extracted_fields, metadata_tags, date_added, created_at
    FROM nodes
    WHERE
      is_deleted = 0
      AND segment_code = ?
      AND category_code = ?
      AND content_type_code = ?
      AND (${parentField} = ? OR (${parentField} IS NULL AND ? IS NULL))
  `).all(
    segment || null,
    category || null,
    contentType || null,
    parentId || null,
    parentId || null
  ) as any[];

  return rows.map(row => ({
    ...row,
    extracted_fields: row.extracted_fields ? JSON.parse(row.extracted_fields) : {},
    metadata_tags: row.metadata_tags ? JSON.parse(row.metadata_tags) : [],
  }));
}

/**
 * Preview the impact of adding a node without executing changes
 *
 * @param newNode - The new node to add
 * @param targetPath - Target hierarchy path
 * @param hierarchyType - Type of hierarchy
 * @param parentId - Optional parent node ID
 * @returns Preview of restructure result
 */
export function previewRestructure(
  newNode: DifferentiableNode,
  targetPath: string,
  hierarchyType: HierarchyViewType,
  parentId?: string | null
): RestructureResult {
  const existingNodes = getNodesAtPosition(targetPath, hierarchyType, parentId);

  const context: RestructureContext = {
    newNodeId: newNode.id,
    newNodeAttributes: newNode,
    targetPath,
    existingNodes,
    hierarchyType,
  };

  return planRestructure(context);
}

/**
 * Validate that a restructure would not create any duplicate codes
 *
 * @param result - The restructure result to validate
 * @returns Validation result with any issues found
 */
export function validateRestructure(result: RestructureResult): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for duplicate new codes in mutations
  const newCodes = new Set<string>();
  for (const mutation of result.mutations) {
    if (newCodes.has(mutation.newCode)) {
      issues.push(`Duplicate code in mutations: ${mutation.newCode}`);
    }
    newCodes.add(mutation.newCode);
  }

  // Check for empty codes
  for (const mutation of result.mutations) {
    if (!mutation.newCode || mutation.newCode.trim() === '') {
      issues.push(`Empty code for node: ${mutation.nodeId}`);
    }
  }

  // Check code format
  const codePattern = /^[A-Z0-9]+\.[A-Z0-9]+\.[A-Z](\.[a-zA-Z0-9]+)*$/;
  for (const mutation of result.mutations) {
    if (!codePattern.test(mutation.newCode)) {
      issues.push(`Invalid code format: ${mutation.newCode}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
