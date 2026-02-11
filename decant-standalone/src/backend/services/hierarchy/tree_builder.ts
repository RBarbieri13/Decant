// ============================================================
// Tree Builder Service
// ============================================================
// Transforms flat hierarchy codes into nested tree structure for UI rendering

import { getDatabase } from '../../database/connection.js';
import { HierarchyView, TreeNode, NodeType, GumroadColor, ContentTypeCode } from '../../../shared/types.js';

interface DatabaseNode {
  id: string;
  title: string;
  node_type: string;
  function_code: string | null;
  organization_code: string | null;
  function_parent_id: string | null;
  organization_parent_id: string | null;
  content_type_code: string | null;
  source_url: string | null;
  favicon_path: string | null;
  segment_code: string | null;
}

/**
 * Build hierarchy tree from database nodes
 * @param viewType - 'function' or 'organization' view
 * @returns Nested tree structure for UI rendering
 */
export function buildHierarchyTree(viewType: HierarchyView): TreeNode[] {
  const db = getDatabase();

  // Read all non-deleted nodes with their hierarchy data
  const nodes = db.prepare(`
    SELECT
      id,
      title,
      node_type,
      function_code,
      organization_code,
      function_parent_id,
      organization_parent_id,
      content_type_code,
      source_url,
      favicon_path,
      segment_code
    FROM nodes
    WHERE is_deleted = 0
    ORDER BY
      CASE
        WHEN ? = 'function' THEN function_position
        ELSE organization_position
      END ASC
  `).all(viewType) as DatabaseNode[];

  // Create lookup map for fast access
  const nodeMap = new Map<string, TreeNode>();

  // First pass: Create all tree nodes
  for (const node of nodes) {
    const treeNode: TreeNode = {
      id: node.id,
      title: node.title,
      nodeType: node.node_type as NodeType,
      color: getNodeColor(node),
      children: [],
      isExpanded: false,
      contentTypeCode: node.content_type_code as ContentTypeCode | null,
      sourceUrl: node.source_url,
      faviconPath: node.favicon_path,
    };
    nodeMap.set(node.id, treeNode);
  }

  // Second pass: Build parent-child relationships
  const rootNodes: TreeNode[] = [];

  for (const node of nodes) {
    const treeNode = nodeMap.get(node.id);
    if (!treeNode) continue;

    const parentId = viewType === 'function'
      ? node.function_parent_id
      : node.organization_parent_id;

    if (parentId) {
      // Has parent - add to parent's children
      const parent = nodeMap.get(parentId);
      if (parent) {
        parent.children.push(treeNode);
      } else {
        // Parent not found (orphaned node) - add to root
        rootNodes.push(treeNode);
      }
    } else {
      // No parent - this is a root node
      rootNodes.push(treeNode);
    }
  }

  // Sort children within each node by title
  for (const node of nodeMap.values()) {
    node.children.sort((a, b) => a.title.localeCompare(b.title));
  }

  return rootNodes;
}

/**
 * Get Gumroad color for a node based on its segment
 * Maps segment codes to the 4 Gumroad colors
 */
function getNodeColor(node: DatabaseNode): GumroadColor | undefined {
  // Use segment_code to determine color
  const segment = node.segment_code;

  if (!segment) return undefined;

  // Map segments to Gumroad colors
  const colorMap: Record<string, GumroadColor> = {
    'A': 'pink',   // AI
    'T': 'blue',   // Technology
    'F': 'green',  // Finance
    'S': 'yellow', // Sports
    'H': 'pink',   // Health
    'B': 'blue',   // Business
    'E': 'yellow', // Entertainment
    'L': 'green',  // Lifestyle
    'X': 'blue',   // Science
    'C': 'pink',   // Creative
  };

  return colorMap[segment];
}

/**
 * Parse hierarchy code into parts
 * Example: "A.LLM.T.1" -> { segment: "A", category: "LLM", contentType: "T", index: 1 }
 */
export function parseHierarchyCode(code: string | null): {
  segment?: string;
  category?: string;
  contentType?: string;
  index?: number;
} {
  if (!code) return {};

  const parts = code.split('.');

  return {
    segment: parts[0],
    category: parts[1],
    contentType: parts[2],
    index: parts[3] ? parseInt(parts[3], 10) : undefined,
  };
}

/**
 * Get hierarchy level from code
 * A = segment
 * A.LLM = category
 * A.LLM.T = content type
 * A.LLM.T.1 = item
 */
export function getHierarchyLevel(code: string | null): number {
  if (!code) return 0;
  return code.split('.').length;
}

/**
 * Get parent code from hierarchy code
 * A.LLM.T.1 -> A.LLM.T
 * A.LLM.T -> A.LLM
 * A.LLM -> A
 * A -> null
 */
export function getParentCode(code: string | null): string | null {
  if (!code) return null;

  const parts = code.split('.');
  if (parts.length === 1) return null;

  return parts.slice(0, -1).join('.');
}
