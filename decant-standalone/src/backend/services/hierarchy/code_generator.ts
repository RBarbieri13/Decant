// ============================================================
// Hierarchy Code Generator Service
// Generates unique hierarchy codes for nodes in dual hierarchy
// ============================================================

import { getDatabase } from '../../database/connection.js';
import { withTransaction } from '../../database/transaction.js';
import {
  findBestDifferentiator,
  groupNodesByDifferentiator,
  type DifferentiableNode,
  type DifferentiatorGroup,
} from './differentiator.js';

// ============================================================
// Types
// ============================================================

/**
 * Hierarchy view type for code generation
 */
export type HierarchyViewType = 'function' | 'organization';

/**
 * Node with hierarchy information for code generation
 */
export interface HierarchyNode extends DifferentiableNode {
  function_parent_id: string | null;
  organization_parent_id: string | null;
  segment_code: string | null;
  category_code: string | null;
  content_type_code: string | null;
  function_hierarchy_code: string | null;
  organization_hierarchy_code: string | null;
}

/**
 * Code generation result for a node
 */
export interface CodeGenerationResult {
  nodeId: string;
  functionHierarchyCode: string | null;
  organizationHierarchyCode: string | null;
  segmentCode: string | null;
  categoryCode: string | null;
  contentTypeCode: string | null;
}

/**
 * Extended code generation result with mutation tracking
 */
export interface CodeGenerationResultWithMutations extends CodeGenerationResult {
  /** All nodes whose codes were affected by this operation */
  affectedNodes: Array<{
    nodeId: string;
    oldFunctionCode: string | null;
    newFunctionCode: string | null;
    oldOrganizationCode: string | null;
    newOrganizationCode: string | null;
  }>;
  /** Whether conflicts were detected and resolved */
  conflictsResolved: boolean;
  /** Description of restructuring performed */
  restructureDescription: string | null;
}

/**
 * Tree node for building hierarchy
 */
interface TreeNode {
  node: HierarchyNode;
  children: TreeNode[];
}

// ============================================================
// Code Generation Algorithm
// ============================================================

/**
 * Generate a Function hierarchy code
 * Format: [SEGMENT].[CATEGORY].[CONTENT_TYPE][SUBCATEGORY_CHAIN]
 * Example: A.LLM.T.1 or A.LLM.T.1.2.a
 */
export function generateFunctionHierarchyCode(
  segmentCode: string,
  categoryCode: string,
  contentTypeCode: string,
  subcategoryChain: string[]
): string {
  const baseCode = `${segmentCode}.${categoryCode}.${contentTypeCode}`;

  if (subcategoryChain.length === 0) {
    return baseCode;
  }

  return `${baseCode}.${subcategoryChain.join('.')}`;
}

/**
 * Generate an Organization hierarchy code
 * Format: [ORG].[CATEGORY].[CONTENT_TYPE][SUBCATEGORY_CHAIN]
 * Example: ANTH.LLM.T.1
 */
export function generateOrganizationHierarchyCode(
  orgCode: string,
  categoryCode: string,
  contentTypeCode: string,
  subcategoryChain: string[]
): string {
  const baseCode = `${orgCode}.${categoryCode}.${contentTypeCode}`;

  if (subcategoryChain.length === 0) {
    return baseCode;
  }

  return `${baseCode}.${subcategoryChain.join('.')}`;
}

/**
 * Generate subcategory chain codes for a group of sibling nodes
 * This is the core algorithm for unique positioning
 *
 * Algorithm:
 * 1. If only 1 node at position: append ".1"
 * 2. If multiple nodes: find differentiator, group by it, assign sequential numbers
 * 3. Recurse for groups with multiple nodes
 */
export function generateSubcategoryChain(
  nodes: DifferentiableNode[],
  depth: number = 0,
  maxDepth: number = 10
): Map<string, string[]> {
  const result = new Map<string, string[]>();

  // Prevent infinite recursion
  if (depth >= maxDepth) {
    // Assign sequential numbers based on node ID order
    nodes.forEach((node, index) => {
      result.set(node.id, [String(index + 1)]);
    });
    return result;
  }

  // Single node case - always gets ".1"
  if (nodes.length === 1) {
    result.set(nodes[0].id, ['1']);
    return result;
  }

  // Multiple nodes - find best differentiator and group
  const { groups } = findBestDifferentiator(nodes);

  // Assign sequential numbers to groups
  groups.forEach((group, groupIndex) => {
    const groupNumber = String(groupIndex + 1);

    if (group.nodes.length === 1) {
      // Single node in group - just the group number
      result.set(group.nodes[0].id, [groupNumber]);
    } else {
      // Multiple nodes in group - recurse to differentiate further
      const subChains = generateSubcategoryChain(group.nodes, depth + 1, maxDepth);

      for (const [nodeId, subChain] of subChains) {
        result.set(nodeId, [groupNumber, ...subChain]);
      }
    }
  });

  return result;
}

/**
 * Convert a subcategory number to a letter code for deeper levels
 * Level 0-1: numeric (1, 2, 3...)
 * Level 2+: alternating letters (a, b, c... then A, B, C... then aa, ab...)
 */
export function formatSubcategoryCode(number: number, level: number): string {
  if (level < 2) {
    return String(number);
  }

  // Level 2: lowercase letters (a-z)
  if (level === 2) {
    if (number <= 26) {
      return String.fromCharCode(96 + number); // 'a' = 97
    }
    // Beyond z, use aa, ab, etc.
    const first = Math.floor((number - 1) / 26);
    const second = ((number - 1) % 26) + 1;
    return String.fromCharCode(96 + first) + String.fromCharCode(96 + second);
  }

  // Level 3+: uppercase letters
  if (number <= 26) {
    return String.fromCharCode(64 + number); // 'A' = 65
  }

  // Beyond Z, use AA, AB, etc.
  const first = Math.floor((number - 1) / 26);
  const second = ((number - 1) % 26) + 1;
  return String.fromCharCode(64 + first) + String.fromCharCode(64 + second);
}

/**
 * Format a subcategory chain with proper level-based formatting
 */
export function formatSubcategoryChain(chain: string[]): string[] {
  return chain.map((code, index) => {
    const num = parseInt(code, 10);
    if (isNaN(num)) {
      return code; // Keep non-numeric codes as-is
    }
    return formatSubcategoryCode(num, index);
  });
}

// ============================================================
// Database Operations
// ============================================================

/**
 * Get all nodes that need hierarchy codes generated
 */
export function getNodesForCodeGeneration(): HierarchyNode[] {
  const db = getDatabase();

  const nodes = db.prepare(`
    SELECT
      id,
      title,
      company,
      source_domain,
      extracted_fields,
      metadata_tags,
      date_added,
      created_at,
      function_parent_id,
      organization_parent_id,
      segment_code,
      category_code,
      content_type_code,
      function_hierarchy_code,
      organization_hierarchy_code
    FROM nodes
    WHERE is_deleted = 0
    ORDER BY date_added ASC
  `).all() as any[];

  return nodes.map(node => ({
    ...node,
    extracted_fields: node.extracted_fields ? JSON.parse(node.extracted_fields) : {},
    metadata_tags: node.metadata_tags ? JSON.parse(node.metadata_tags) : [],
  }));
}

/**
 * Get nodes grouped by their base hierarchy position
 * (same segment, category, content type, and parent)
 */
export function groupNodesByPosition(
  nodes: HierarchyNode[],
  view: HierarchyViewType
): Map<string, HierarchyNode[]> {
  const groups = new Map<string, HierarchyNode[]>();
  const parentField = view === 'function' ? 'function_parent_id' : 'organization_parent_id';

  for (const node of nodes) {
    // Create a position key based on parent and classification
    const parentId = node[parentField] || 'root';
    const segment = node.segment_code || 'X';
    const category = node.category_code || 'UNK';
    const contentType = node.content_type_code || 'A';

    const positionKey = `${parentId}:${segment}:${category}:${contentType}`;

    const existing = groups.get(positionKey);
    if (existing) {
      existing.push(node);
    } else {
      groups.set(positionKey, [node]);
    }
  }

  return groups;
}

/**
 * Build a tree structure from flat nodes
 */
export function buildNodeTree(
  nodes: HierarchyNode[],
  view: HierarchyViewType
): TreeNode[] {
  const parentField = view === 'function' ? 'function_parent_id' : 'organization_parent_id';
  const nodeMap = new Map<string, TreeNode>();
  const rootNodes: TreeNode[] = [];

  // Create tree nodes
  for (const node of nodes) {
    nodeMap.set(node.id, { node, children: [] });
  }

  // Build tree relationships
  for (const node of nodes) {
    const treeNode = nodeMap.get(node.id)!;
    const parentId = node[parentField];

    if (parentId && nodeMap.has(parentId)) {
      nodeMap.get(parentId)!.children.push(treeNode);
    } else {
      rootNodes.push(treeNode);
    }
  }

  return rootNodes;
}

/**
 * Generate hierarchy codes for all nodes in a view
 */
export function generateCodesForView(
  nodes: HierarchyNode[],
  view: HierarchyViewType
): Map<string, string> {
  const codes = new Map<string, string>();

  // Group nodes by their base position
  const positionGroups = groupNodesByPosition(nodes, view);

  // Generate subcategory chains for each position group
  for (const [positionKey, groupNodes] of positionGroups) {
    const [, segment, category, contentType] = positionKey.split(':');

    // Generate subcategory chains for nodes at this position
    const subcategoryChains = generateSubcategoryChain(groupNodes);

    // Build final codes
    for (const [nodeId, chain] of subcategoryChains) {
      const formattedChain = formatSubcategoryChain(chain);

      let code: string;
      if (view === 'function') {
        code = generateFunctionHierarchyCode(segment, category, contentType, formattedChain);
      } else {
        // For organization view, we need the org code instead of segment
        const node = groupNodes.find(n => n.id === nodeId);
        const orgCode = extractOrgCode(node);
        code = generateOrganizationHierarchyCode(orgCode, category, contentType, formattedChain);
      }

      codes.set(nodeId, code);
    }
  }

  return codes;
}

/**
 * Extract organization code from a node
 */
function extractOrgCode(node: HierarchyNode | undefined): string {
  if (!node) return 'UNKN';

  // Check company field and convert to 4-letter code
  if (node.company) {
    return companyToOrgCode(node.company);
  }

  // Check metadata tags for ORG
  if (node.metadata_tags && Array.isArray(node.metadata_tags)) {
    const orgTag = node.metadata_tags.find(tag =>
      typeof tag === 'string' && tag.startsWith('ORG:')
    );
    if (orgTag) {
      return companyToOrgCode(orgTag.replace('ORG:', ''));
    }
  }

  // Fallback to domain
  if (node.source_domain) {
    return domainToOrgCode(node.source_domain);
  }

  return 'UNKN';
}

/**
 * Convert a company name to a 4-letter organization code
 */
function companyToOrgCode(company: string): string {
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
    'stability ai': 'STAI',
    'midjourney': 'MDJN',
    'cohere': 'COHR',
    'deepmind': 'DPMN',
  };

  const normalizedCompany = company.toLowerCase().trim();

  if (knownMappings[normalizedCompany]) {
    return knownMappings[normalizedCompany];
  }

  // Generate a 4-letter code from the company name
  const cleaned = normalizedCompany.replace(/[^a-z0-9]/g, '');

  if (cleaned.length >= 4) {
    return cleaned.substring(0, 4).toUpperCase();
  }

  // Pad short names
  return cleaned.padEnd(4, 'X').toUpperCase();
}

/**
 * Convert a domain to a 4-letter organization code
 */
function domainToOrgCode(domain: string): string {
  // Remove common prefixes and suffixes
  let base = domain
    .toLowerCase()
    .replace(/^(www\.|api\.|docs\.|blog\.)/i, '')
    .replace(/\.(com|org|net|io|ai|dev|app|co|us|uk|de|fr)$/i, '');

  return companyToOrgCode(base);
}

/**
 * Regenerate all hierarchy codes for all nodes
 * This is the main entry point for code generation
 */
export function regenerateAllHierarchyCodes(): CodeGenerationResult[] {
  const db = getDatabase();
  const results: CodeGenerationResult[] = [];

  // Get all nodes
  const nodes = getNodesForCodeGeneration();

  if (nodes.length === 0) {
    return results;
  }

  // Generate codes for both views
  const functionCodes = generateCodesForView(nodes, 'function');
  const organizationCodes = generateCodesForView(nodes, 'organization');

  // Update all nodes in a transaction
  withTransaction(() => {
    const updateStmt = db.prepare(`
      UPDATE nodes
      SET
        function_hierarchy_code = ?,
        organization_hierarchy_code = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    for (const node of nodes) {
      const functionCode = functionCodes.get(node.id) || null;
      const organizationCode = organizationCodes.get(node.id) || null;

      updateStmt.run(functionCode, organizationCode, node.id);

      results.push({
        nodeId: node.id,
        functionHierarchyCode: functionCode,
        organizationHierarchyCode: organizationCode,
        segmentCode: node.segment_code,
        categoryCode: node.category_code,
        contentTypeCode: node.content_type_code,
      });
    }
  });

  return results;
}

/**
 * Generate hierarchy codes for a single node with conflict detection
 * This recalculates codes for the node and any siblings at the same position
 *
 * @param nodeId - The ID of the node to regenerate codes for
 * @param options - Options for code generation
 * @returns Extended result with mutation tracking
 */
export function regenerateNodeHierarchyCode(
  nodeId: string,
  options?: { trackMutations?: boolean }
): CodeGenerationResultWithMutations | null {
  const db = getDatabase();
  const trackMutations = options?.trackMutations ?? true;

  // Get the target node
  const nodeRow = db.prepare(`
    SELECT
      id,
      title,
      company,
      source_domain,
      extracted_fields,
      metadata_tags,
      date_added,
      created_at,
      function_parent_id,
      organization_parent_id,
      segment_code,
      category_code,
      content_type_code,
      function_hierarchy_code,
      organization_hierarchy_code
    FROM nodes
    WHERE id = ? AND is_deleted = 0
  `).get(nodeId) as any;

  if (!nodeRow) {
    return null;
  }

  const node: HierarchyNode = {
    ...nodeRow,
    extracted_fields: nodeRow.extracted_fields ? JSON.parse(nodeRow.extracted_fields) : {},
    metadata_tags: nodeRow.metadata_tags ? JSON.parse(nodeRow.metadata_tags) : [],
  };

  // Get all nodes for complete regeneration
  const allNodes = getNodesForCodeGeneration();

  // Store old codes for mutation tracking
  const oldCodes = new Map<string, { function: string | null; organization: string | null }>();
  if (trackMutations) {
    for (const n of allNodes) {
      oldCodes.set(n.id, {
        function: n.function_hierarchy_code,
        organization: n.organization_hierarchy_code,
      });
    }
  }

  // Detect conflicts at the node's position
  const functionPositionKey = `${node.function_parent_id || 'root'}:${node.segment_code || 'X'}:${node.category_code || 'UNK'}:${node.content_type_code || 'A'}`;
  const functionSiblings = allNodes.filter(n =>
    n.id !== nodeId &&
    `${n.function_parent_id || 'root'}:${n.segment_code || 'X'}:${n.category_code || 'UNK'}:${n.content_type_code || 'A'}` === functionPositionKey
  );

  const hasConflicts = functionSiblings.length > 0;

  // Regenerate codes for all nodes (this handles conflicts automatically)
  const functionCodes = generateCodesForView(allNodes, 'function');
  const organizationCodes = generateCodesForView(allNodes, 'organization');

  // Track affected nodes
  const affectedNodes: Array<{
    nodeId: string;
    oldFunctionCode: string | null;
    newFunctionCode: string | null;
    oldOrganizationCode: string | null;
    newOrganizationCode: string | null;
  }> = [];

  // Update affected nodes in a transaction
  withTransaction(() => {
    const updateStmt = db.prepare(`
      UPDATE nodes
      SET
        function_hierarchy_code = ?,
        organization_hierarchy_code = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    for (const n of allNodes) {
      const functionCode = functionCodes.get(n.id) || null;
      const organizationCode = organizationCodes.get(n.id) || null;
      const old = oldCodes.get(n.id);

      // Only update and track if code changed
      const functionChanged = old?.function !== functionCode;
      const organizationChanged = old?.organization !== organizationCode;

      if (functionChanged || organizationChanged) {
        updateStmt.run(functionCode, organizationCode, n.id);

        if (trackMutations) {
          affectedNodes.push({
            nodeId: n.id,
            oldFunctionCode: old?.function || null,
            newFunctionCode: functionCode,
            oldOrganizationCode: old?.organization || null,
            newOrganizationCode: organizationCode,
          });
        }
      }
    }
  });

  const functionCode = functionCodes.get(nodeId) || null;
  const organizationCode = organizationCodes.get(nodeId) || null;

  // Generate restructure description
  let restructureDescription: string | null = null;
  if (hasConflicts && affectedNodes.length > 1) {
    const siblingCount = affectedNodes.length - 1;
    restructureDescription = `Resolved conflicts with ${siblingCount} sibling node${siblingCount > 1 ? 's' : ''} at position ${node.segment_code}.${node.category_code}.${node.content_type_code}`;
  }

  return {
    nodeId,
    functionHierarchyCode: functionCode,
    organizationHierarchyCode: organizationCode,
    segmentCode: node.segment_code,
    categoryCode: node.category_code,
    contentTypeCode: node.content_type_code,
    affectedNodes,
    conflictsResolved: hasConflicts,
    restructureDescription,
  };
}

/**
 * Get a node's hierarchy code by ID
 */
export function getNodeHierarchyCode(nodeId: string): CodeGenerationResult | null {
  const db = getDatabase();

  const node = db.prepare(`
    SELECT
      id,
      function_hierarchy_code,
      organization_hierarchy_code,
      segment_code,
      category_code,
      content_type_code
    FROM nodes
    WHERE id = ? AND is_deleted = 0
  `).get(nodeId) as any;

  if (!node) {
    return null;
  }

  return {
    nodeId: node.id,
    functionHierarchyCode: node.function_hierarchy_code,
    organizationHierarchyCode: node.organization_hierarchy_code,
    segmentCode: node.segment_code,
    categoryCode: node.category_code,
    contentTypeCode: node.content_type_code,
  };
}

/**
 * Validate that all hierarchy codes are unique
 * Returns any duplicate codes found
 */
export function validateHierarchyCodeUniqueness(): {
  functionDuplicates: Array<{ code: string; nodeIds: string[] }>;
  organizationDuplicates: Array<{ code: string; nodeIds: string[] }>;
} {
  const db = getDatabase();

  // Find function hierarchy code duplicates
  const functionDuplicates = db.prepare(`
    SELECT function_hierarchy_code as code, GROUP_CONCAT(id) as node_ids
    FROM nodes
    WHERE is_deleted = 0
      AND function_hierarchy_code IS NOT NULL
    GROUP BY function_hierarchy_code
    HAVING COUNT(*) > 1
  `).all() as Array<{ code: string; node_ids: string }>;

  // Find organization hierarchy code duplicates
  const organizationDuplicates = db.prepare(`
    SELECT organization_hierarchy_code as code, GROUP_CONCAT(id) as node_ids
    FROM nodes
    WHERE is_deleted = 0
      AND organization_hierarchy_code IS NOT NULL
    GROUP BY organization_hierarchy_code
    HAVING COUNT(*) > 1
  `).all() as Array<{ code: string; node_ids: string }>;

  return {
    functionDuplicates: functionDuplicates.map(d => ({
      code: d.code,
      nodeIds: d.node_ids.split(','),
    })),
    organizationDuplicates: organizationDuplicates.map(d => ({
      code: d.code,
      nodeIds: d.node_ids.split(','),
    })),
  };
}

/**
 * Check if a node would conflict with existing nodes at a position
 *
 * @param nodeId - ID of the node to check
 * @param view - Hierarchy view type
 * @returns Conflict information
 */
export function checkForConflicts(
  nodeId: string,
  view: HierarchyViewType
): { hasConflict: boolean; conflictingNodeIds: string[] } {
  const db = getDatabase();
  const parentField = view === 'function' ? 'function_parent_id' : 'organization_parent_id';

  // Get the node's position information
  const node = db.prepare(`
    SELECT segment_code, category_code, content_type_code, ${parentField} as parent_id
    FROM nodes
    WHERE id = ? AND is_deleted = 0
  `).get(nodeId) as any;

  if (!node) {
    return { hasConflict: false, conflictingNodeIds: [] };
  }

  // Find other nodes at the same position
  const conflictingNodes = db.prepare(`
    SELECT id FROM nodes
    WHERE id != ?
      AND is_deleted = 0
      AND segment_code = ?
      AND category_code = ?
      AND content_type_code = ?
      AND (${parentField} = ? OR (${parentField} IS NULL AND ? IS NULL))
  `).all(
    nodeId,
    node.segment_code,
    node.category_code,
    node.content_type_code,
    node.parent_id,
    node.parent_id
  ) as Array<{ id: string }>;

  return {
    hasConflict: conflictingNodes.length > 0,
    conflictingNodeIds: conflictingNodes.map(n => n.id),
  };
}

/**
 * Get siblings of a node (nodes at the same position)
 *
 * @param nodeId - ID of the node
 * @param view - Hierarchy view type
 * @returns Array of sibling node IDs
 */
export function getSiblingNodeIds(
  nodeId: string,
  view: HierarchyViewType
): string[] {
  const result = checkForConflicts(nodeId, view);
  return result.conflictingNodeIds;
}
