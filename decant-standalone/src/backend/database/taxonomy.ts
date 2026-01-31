// ============================================================
// Taxonomy Operations (Segments & Organizations)
// Optimized tree building using hierarchy codes
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './connection.js';
import { withTransaction } from './transaction.js';
import * as cache from '../cache/index.js';
import * as hierarchyCache from '../cache/hierarchy_cache.js';

// Sample segments (Functional Taxonomy)
const DEFAULT_SEGMENTS = [
  { name: 'AI & Machine Learning', code: 'AI_ML' },
  { name: 'Development & Tools', code: 'DEV_TOOLS' },
  { name: 'Business & Productivity', code: 'BIZ_PROD' },
  { name: 'Finance & Economics', code: 'FIN_ECON' },
  { name: 'Personal & Lifestyle', code: 'PERSONAL' },
];

// Sample organizations (Organizational Taxonomy)
const DEFAULT_ORGANIZATIONS = [
  { name: 'Work', code: 'WORK' },
  { name: 'Learning', code: 'LEARNING' },
  { name: 'Personal Projects', code: 'PROJECTS' },
  { name: 'Reference', code: 'REFERENCE' },
];

export function getSegments(): any[] {
  const db = getDatabase();
  let segments = db.prepare('SELECT * FROM segments ORDER BY created_at').all() as any[];

  // If no segments exist, create defaults within a transaction
  // This ensures all default segments are created atomically
  if (segments.length === 0) {
    segments = withTransaction(() => {
      const stmt = db.prepare(`
        INSERT INTO segments (id, name, code, color)
        VALUES (?, ?, ?, ?)
      `);

      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];

      for (let i = 0; i < DEFAULT_SEGMENTS.length; i++) {
        const seg = DEFAULT_SEGMENTS[i];
        stmt.run(uuidv4(), seg.name, seg.code, colors[i]);
      }

      return db.prepare('SELECT * FROM segments ORDER BY created_at').all() as any[];
    });
  }

  return segments;
}

export function getOrganizations(): any[] {
  const db = getDatabase();
  let orgs = db.prepare('SELECT * FROM organizations ORDER BY created_at').all() as any[];

  // If no organizations exist, create defaults within a transaction
  // This ensures all default organizations are created atomically
  if (orgs.length === 0) {
    orgs = withTransaction(() => {
      const stmt = db.prepare(`
        INSERT INTO organizations (id, name, code, color)
        VALUES (?, ?, ?, ?)
      `);

      const colors = ['#9B59B6', '#E74C3C', '#3498DB', '#F39C12'];

      for (let i = 0; i < DEFAULT_ORGANIZATIONS.length; i++) {
        const org = DEFAULT_ORGANIZATIONS[i];
        stmt.run(uuidv4(), org.name, org.code, colors[i]);
      }

      return db.prepare('SELECT * FROM organizations ORDER BY created_at').all() as any[];
    });
  }

  return orgs;
}

/**
 * Get full tree for a view (function or organization)
 * Uses hierarchy codes for efficient O(n) tree building when available
 */
export function getTree(view: 'function' | 'organization'): any {
  // Check hierarchy cache first (more granular than general cache)
  const cachedTree = hierarchyCache.getTree(view);
  if (cachedTree) {
    const taxonomy = view === 'function' ? getSegments() : getOrganizations();
    return { taxonomy, root: cachedTree };
  }

  // Fallback to general cache
  const cacheKey = `tree:${view}`;
  const cached = cache.get<any>(cacheKey);
  if (cached) {
    return cached;
  }

  const db = getDatabase();
  const hierarchyCodeField = view === 'function' ? 'function_hierarchy_code' : 'organization_hierarchy_code';
  const parentField = view === 'function' ? 'function_parent_id' : 'organization_parent_id';

  // Get taxonomy
  const taxonomy = view === 'function' ? getSegments() : getOrganizations();

  // Check if we have hierarchy codes populated
  const hasHierarchyCodes = db.prepare(`
    SELECT COUNT(*) as count FROM nodes
    WHERE ${hierarchyCodeField} IS NOT NULL AND is_deleted = 0
  `).get() as { count: number };

  let result: any;

  if (hasHierarchyCodes.count > 0) {
    // Use optimized hierarchy code-based tree building
    result = buildTreeFromHierarchyCodes(taxonomy, hierarchyCodeField);
  } else {
    // Fallback to parent_id traversal
    result = buildTreeFromParentIds(taxonomy, parentField);
  }

  // Store in hierarchy cache
  hierarchyCache.setTree(view, result.root);

  // Also store in general cache for compatibility
  cache.set(cacheKey, result);

  return result;
}

/**
 * Build tree using hierarchy codes (O(n) complexity)
 * Sorted flat list can be converted to tree in single pass
 */
function buildTreeFromHierarchyCodes(
  taxonomy: any[],
  hierarchyCodeField: string
): any {
  const db = getDatabase();

  // Load all nodes sorted by hierarchy code
  // This ordering ensures parents come before children
  const allNodes = db.prepare(`
    SELECT * FROM nodes
    WHERE is_deleted = 0 AND ${hierarchyCodeField} IS NOT NULL
    ORDER BY ${hierarchyCodeField} ASC
  `).all() as any[];

  // Also get nodes without hierarchy codes (legacy data)
  const nodesWithoutCodes = db.prepare(`
    SELECT * FROM nodes
    WHERE is_deleted = 0 AND ${hierarchyCodeField} IS NULL
    ORDER BY date_added DESC
  `).all() as any[];

  // Combine and batch load key concepts
  const allNodesCombined = [...allNodes, ...nodesWithoutCodes];
  const nodeIds = allNodesCombined.map(n => n.id);
  const conceptsMap = batchLoadKeyConceptsForTree(nodeIds);

  // Transform nodes
  const transformedNodes = allNodesCombined.map(node => ({
    ...node,
    extracted_fields: JSON.parse(node.extracted_fields || '{}'),
    metadata_tags: JSON.parse(node.metadata_tags || '[]'),
    key_concepts: conceptsMap.get(node.id) || [],
    children: [] as any[],
  }));

  // Build tree from sorted hierarchy codes
  const nodeByCode = new Map<string, any>();
  const rootNodes: any[] = [];

  for (const node of transformedNodes) {
    const code = node[hierarchyCodeField];

    if (!code) {
      // Node without hierarchy code goes to root
      rootNodes.push(node);
      continue;
    }

    nodeByCode.set(code, node);

    // Find parent by removing last segment of code
    const parentCode = getParentCode(code);

    if (parentCode) {
      const parent = nodeByCode.get(parentCode);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not found (could be segment/category level)
        rootNodes.push(node);
      }
    } else {
      // Top-level node
      rootNodes.push(node);
    }
  }

  return {
    taxonomy,
    root: rootNodes,
  };
}

/**
 * Build tree using parent_id traversal (fallback for data without hierarchy codes)
 */
function buildTreeFromParentIds(
  taxonomy: any[],
  parentField: string
): any {
  const db = getDatabase();

  // Step 1: Load ALL non-deleted nodes in ONE query
  const allNodes = db.prepare(`
    SELECT * FROM nodes WHERE is_deleted = 0 ORDER BY date_added DESC
  `).all() as any[];

  // Step 2: Batch load ALL key concepts in ONE query
  const nodeIds = allNodes.map(n => n.id);
  const conceptsMap = batchLoadKeyConceptsForTree(nodeIds);

  // Step 3: Transform nodes and build parent-child lookup
  const transformedNodes = allNodes.map(node => ({
    ...node,
    extracted_fields: JSON.parse(node.extracted_fields || '{}'),
    metadata_tags: JSON.parse(node.metadata_tags || '[]'),
    key_concepts: conceptsMap.get(node.id) || [],
    children: [] as any[],
  }));

  // Step 4: Build parent -> children Map for in-memory tree construction
  const childrenByParent = new Map<string, any[]>();

  for (const node of transformedNodes) {
    const parentId = node[parentField];

    // Group by parent ID (null for root nodes)
    const parentKey = parentId || '__root__';
    const siblings = childrenByParent.get(parentKey);
    if (siblings) {
      siblings.push(node);
    } else {
      childrenByParent.set(parentKey, [node]);
    }
  }

  // Step 5: Build tree structure in memory (no recursive DB queries!)
  function buildChildrenRecursive(nodeId: string): any[] {
    const children = childrenByParent.get(nodeId) || [];
    for (const child of children) {
      child.children = buildChildrenRecursive(child.id);
    }
    return children;
  }

  // Build tree for each taxonomy item (attach children to taxonomy items)
  for (const item of taxonomy) {
    item.children = buildChildrenRecursive(item.id);
  }

  // Get root nodes (no parent in the selected view)
  const rootNodes = childrenByParent.get('__root__') || [];
  for (const rootNode of rootNodes) {
    rootNode.children = buildChildrenRecursive(rootNode.id);
  }

  return {
    taxonomy,
    root: rootNodes,
  };
}

/**
 * Get parent code by removing the last segment
 * 'A.LLM.T.1' -> 'A.LLM.T'
 * 'A.LLM' -> 'A'
 * 'A' -> null
 */
function getParentCode(code: string): string | null {
  const lastDot = code.lastIndexOf('.');
  if (lastDot === -1) return null;
  return code.substring(0, lastDot);
}

/**
 * Get subtree at a specific hierarchy path
 * Uses prefix queries for efficient retrieval
 */
export function getSubtree(view: 'function' | 'organization', path: string): any[] {
  // Check hierarchy cache first
  const cached = hierarchyCache.getTree(view, path);
  if (cached) {
    return cached;
  }

  const db = getDatabase();
  const hierarchyCodeField = view === 'function' ? 'function_hierarchy_code' : 'organization_hierarchy_code';

  // Use prefix query for efficient subtree retrieval
  const nodes = db.prepare(`
    SELECT * FROM nodes
    WHERE ${hierarchyCodeField} LIKE ? AND is_deleted = 0
    ORDER BY ${hierarchyCodeField} ASC
  `).all(`${path}.%`) as any[];

  // Also get the root node of the subtree
  const rootNode = db.prepare(`
    SELECT * FROM nodes
    WHERE ${hierarchyCodeField} = ? AND is_deleted = 0
  `).get(path) as any | undefined;

  // Combine and batch load concepts
  const allNodes = rootNode ? [rootNode, ...nodes] : nodes;
  const nodeIds = allNodes.map(n => n.id);
  const conceptsMap = batchLoadKeyConceptsForTree(nodeIds);

  // Transform and build subtree
  const transformedNodes = allNodes.map(node => ({
    ...node,
    extracted_fields: JSON.parse(node.extracted_fields || '{}'),
    metadata_tags: JSON.parse(node.metadata_tags || '[]'),
    key_concepts: conceptsMap.get(node.id) || [],
    children: [] as any[],
  }));

  // Build tree from sorted nodes
  const nodeByCode = new Map<string, any>();
  const subtreeRoot: any[] = [];

  for (const node of transformedNodes) {
    const code = node[hierarchyCodeField];
    nodeByCode.set(code, node);

    const parentCode = getParentCode(code);

    if (parentCode && parentCode.startsWith(path)) {
      // Parent is within the subtree
      const parent = nodeByCode.get(parentCode);
      if (parent) {
        parent.children.push(node);
      } else {
        subtreeRoot.push(node);
      }
    } else if (code === path) {
      // This is the root of the subtree
      subtreeRoot.push(node);
    }
  }

  // Cache the result
  hierarchyCache.setTree(view, subtreeRoot, path);

  return subtreeRoot;
}

/**
 * Get node by its hierarchy code
 */
export function getNodeByHierarchyCode(
  view: 'function' | 'organization',
  code: string
): any | null {
  const db = getDatabase();
  const hierarchyCodeField = view === 'function' ? 'function_hierarchy_code' : 'organization_hierarchy_code';

  const node = db.prepare(`
    SELECT * FROM nodes
    WHERE ${hierarchyCodeField} = ? AND is_deleted = 0
  `).get(code) as any | undefined;

  if (!node) return null;

  // Load key concepts
  const concepts = db.prepare(`
    SELECT concept FROM key_concepts WHERE node_id = ?
  `).all(node.id) as any[];

  return {
    ...node,
    extracted_fields: JSON.parse(node.extracted_fields || '{}'),
    metadata_tags: JSON.parse(node.metadata_tags || '[]'),
    key_concepts: concepts.map(c => c.concept),
  };
}

/**
 * Get ancestry path (all ancestors) for a node
 */
export function getAncestryPath(
  view: 'function' | 'organization',
  nodeId: string
): any[] {
  const db = getDatabase();
  const hierarchyCodeField = view === 'function' ? 'function_hierarchy_code' : 'organization_hierarchy_code';

  // Get the node's hierarchy code
  const node = db.prepare(`
    SELECT ${hierarchyCodeField} as code FROM nodes WHERE id = ? AND is_deleted = 0
  `).get(nodeId) as { code: string } | undefined;

  if (!node || !node.code) {
    return [];
  }

  // Build list of ancestor codes
  const ancestorCodes: string[] = [];
  let currentCode = node.code;

  while (currentCode) {
    const parentCode = getParentCode(currentCode);
    if (parentCode) {
      ancestorCodes.push(parentCode);
      currentCode = parentCode;
    } else {
      break;
    }
  }

  if (ancestorCodes.length === 0) {
    return [];
  }

  // Fetch all ancestors in one query
  const placeholders = ancestorCodes.map(() => '?').join(', ');
  const ancestors = db.prepare(`
    SELECT * FROM nodes
    WHERE ${hierarchyCodeField} IN (${placeholders}) AND is_deleted = 0
    ORDER BY LENGTH(${hierarchyCodeField}) ASC
  `).all(...ancestorCodes) as any[];

  // Transform nodes
  const nodeIds = ancestors.map(n => n.id);
  const conceptsMap = batchLoadKeyConceptsForTree(nodeIds);

  return ancestors.map(ancestor => ({
    ...ancestor,
    extracted_fields: JSON.parse(ancestor.extracted_fields || '{}'),
    metadata_tags: JSON.parse(ancestor.metadata_tags || '[]'),
    key_concepts: conceptsMap.get(ancestor.id) || [],
  }));
}

/**
 * Invalidate tree caches when nodes change
 * Call this after any mutation that affects the tree structure
 */
export function invalidateTreeCaches(
  affectedCodes?: Array<{ oldCode?: string; newCode?: string }>
): void {
  if (affectedCodes && affectedCodes.length > 0) {
    // Granular invalidation using hierarchy codes
    const mutations = affectedCodes
      .filter(m => m.oldCode || m.newCode)
      .map(m => ({
        oldCode: m.oldCode || '',
        newCode: m.newCode || '',
      }));

    hierarchyCache.invalidateForMutations(mutations);
  } else {
    // Full invalidation
    hierarchyCache.clearAll();
  }

  // Also invalidate general cache
  cache.invalidate('tree:*');
}

/**
 * Batch load key concepts for tree building.
 * Returns a Map of nodeId -> concept[]
 */
function batchLoadKeyConceptsForTree(nodeIds: string[]): Map<string, string[]> {
  const conceptsMap = new Map<string, string[]>();

  if (nodeIds.length === 0) return conceptsMap;

  const db = getDatabase();

  // Use placeholders for the IN clause
  const placeholders = nodeIds.map(() => '?').join(', ');
  const concepts = db.prepare(`
    SELECT node_id, concept FROM key_concepts WHERE node_id IN (${placeholders})
  `).all(...nodeIds) as { node_id: string; concept: string }[];

  // Build the Map: nodeId -> concept[]
  for (const { node_id, concept } of concepts) {
    const existing = conceptsMap.get(node_id);
    if (existing) {
      existing.push(concept);
    } else {
      conceptsMap.set(node_id, [concept]);
    }
  }

  return conceptsMap;
}

/**
 * Count nodes at each depth level for a given view
 * Useful for analytics and optimization
 */
export function getTreeDepthStats(view: 'function' | 'organization'): Map<number, number> {
  const db = getDatabase();
  const hierarchyCodeField = view === 'function' ? 'function_hierarchy_code' : 'organization_hierarchy_code';

  const nodes = db.prepare(`
    SELECT ${hierarchyCodeField} as code FROM nodes
    WHERE ${hierarchyCodeField} IS NOT NULL AND is_deleted = 0
  `).all() as { code: string }[];

  const depthCounts = new Map<number, number>();

  for (const { code } of nodes) {
    // Depth is determined by number of dots in the code
    const depth = (code.match(/\./g) || []).length;
    depthCounts.set(depth, (depthCounts.get(depth) || 0) + 1);
  }

  return depthCounts;
}
