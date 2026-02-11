// ============================================================
// Tree Builder Service
// ============================================================
// Transforms flat hierarchy codes into nested tree structure for UI rendering

import { getDatabase } from '../../database/connection.js';
import { HierarchyView, TreeNode, NodeType, GumroadColor, ContentTypeCode } from '../../../shared/types.js';

interface DatabaseNode {
  id: string;
  title: string;
  function_hierarchy_code: string | null;
  organization_hierarchy_code: string | null;
  content_type_code: string | null;
  url: string | null;
  logo_url: string | null;
  segment_code: string | null;
}

/**
 * Build hierarchy tree from database nodes
 * For now, returns a flat list since we don't have true hierarchical parent-child relationships yet
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
      function_hierarchy_code,
      organization_hierarchy_code,
      content_type_code,
      url,
      logo_url,
      segment_code
    FROM nodes
    WHERE is_deleted = 0
    ORDER BY date_added DESC
  `).all() as DatabaseNode[];

  // For now, return flat list of all nodes as root nodes
  // In future, we can group by hierarchy codes to create nested structure
  return nodes.map(node => ({
    id: node.id,
    title: node.title,
    nodeType: 'item' as NodeType,
    color: getNodeColor(node),
    children: [],
    isExpanded: false,
    contentTypeCode: node.content_type_code as ContentTypeCode | null,
    sourceUrl: node.url,
    faviconPath: node.logo_url,
  }));
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
