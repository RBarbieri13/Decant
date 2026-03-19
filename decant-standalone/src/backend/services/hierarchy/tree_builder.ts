// ============================================================
// Tree Builder Service
// ============================================================
// Builds a recursive N-deep tree from the hierarchy_branches
// table for UI rendering. Single dynamic view — no more
// separate function/organization views.

import { getDatabase } from '../../database/connection.js';
import { TreeNode, GumroadColor, ContentTypeCode } from '../../../shared/types.js';
import {
  CONTENT_TYPE_ICONS as SHARED_CONTENT_TYPE_ICONS,
  getIconByKeyword,
} from '../../../shared/iconDatabase.js';

// ============================================================
// Types
// ============================================================

interface BranchRow {
  id: string;
  parent_id: string | null;
  label: string;
  depth: number;
  discriminator_dimension: string | null;
  discriminator_value: string | null;
  node_count: number;
  sort_order: number;
}

interface NodeRow {
  id: string;
  title: string;
  url: string | null;
  logo_url: string | null;
  content_type_code: string | null;
  branch_id: string;
}

// ============================================================
// Color Assignment
// ============================================================

const DEPTH_COLORS: GumroadColor[] = ['pink', 'blue', 'green', 'yellow'];
const DIMENSION_COLORS: Record<string, GumroadColor> = {
  function: 'pink',
  domain: 'blue',
  technology: 'green',
  concept: 'blue',
  audience: 'yellow',
  platform: 'green',
  organization: 'pink',
  resource_type: 'yellow',
  industry: 'blue',
  pricing: 'green',
  topic_cluster: 'pink',
  segment: 'pink',
  category: 'blue',
  subcategory: 'green',
};

function getBranchColor(branch: BranchRow): GumroadColor {
  if (branch.discriminator_dimension && DIMENSION_COLORS[branch.discriminator_dimension]) {
    return DIMENSION_COLORS[branch.discriminator_dimension];
  }
  return DEPTH_COLORS[branch.depth % DEPTH_COLORS.length];
}

// ============================================================
// Icon Resolution
// ============================================================

const DIMENSION_ICONS: Record<string, string> = {
  function: 'bxs-cog',
  domain: 'bxs-book-content',
  technology: 'bxs-chip',
  concept: 'bxs-bulb',
  audience: 'bxs-group',
  platform: 'bxs-devices',
  organization: 'bxs-buildings',
  resource_type: 'bxs-file',
  industry: 'bxs-factory',
  pricing: 'bxs-dollar-circle',
  topic_cluster: 'bxs-category',
  segment: 'bxs-folder',
  category: 'bxs-folder-open',
  subcategory: 'bxs-folder-plus',
};

function getBranchIcon(branch: BranchRow): string {
  if (branch.discriminator_dimension && DIMENSION_ICONS[branch.discriminator_dimension]) {
    return DIMENSION_ICONS[branch.discriminator_dimension];
  }
  if (branch.depth === 0) return 'bxs-home';
  return 'bxs-folder';
}

// ============================================================
// Main Builder
// ============================================================

/**
 * Build the dynamic hierarchy tree from hierarchy_branches table.
 * Returns a recursive N-deep tree structure for the UI.
 */
export function buildHierarchyTree(): TreeNode[] {
  const db = getDatabase();

  // Check if dynamic hierarchy tables exist
  const tableCheck = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='hierarchy_branches'
  `).get();

  if (!tableCheck) {
    // Fall back to legacy tree builder if migration hasn't run
    return buildLegacyTree();
  }

  // Load all active branches ordered by depth then sort_order
  const branches = db.prepare(`
    SELECT id, parent_id, label, depth, discriminator_dimension,
           discriminator_value, node_count, sort_order
    FROM hierarchy_branches
    WHERE is_active = 1
    ORDER BY depth ASC, sort_order ASC
  `).all() as BranchRow[];

  if (branches.length === 0) {
    return buildLegacyTree();
  }

  // If hierarchy has no sub-branches (only root-level), it hasn't been meaningfully structured yet.
  // Fall back to legacy segment/category tree which gives useful navigation.
  const hasSubBranches = branches.some(b => b.parent_id !== null);
  if (!hasSubBranches) {
    return buildLegacyTree();
  }

  // Load all node placements (primary only)
  const nodePlacements = db.prepare(`
    SELECT
      n.id, n.title, n.url, n.logo_url, n.content_type_code,
      p.branch_id
    FROM node_branch_placements p
    JOIN nodes n ON n.id = p.node_id AND n.is_deleted = 0
    WHERE p.is_primary = 1
    ORDER BY n.title ASC
  `).all() as NodeRow[];

  // Group nodes by branch_id
  const nodesByBranch = new Map<string, NodeRow[]>();
  for (const node of nodePlacements) {
    const list = nodesByBranch.get(node.branch_id);
    if (list) {
      list.push(node);
    } else {
      nodesByBranch.set(node.branch_id, [node]);
    }
  }

  // Build branch map for parent lookups
  const branchMap = new Map<string, BranchRow>();
  const childrenMap = new Map<string, BranchRow[]>();
  for (const branch of branches) {
    branchMap.set(branch.id, branch);
    const parentId = branch.parent_id || '__root__';
    const siblings = childrenMap.get(parentId);
    if (siblings) {
      siblings.push(branch);
    } else {
      childrenMap.set(parentId, [branch]);
    }
  }

  // Recursive tree construction
  function buildBranchNode(branch: BranchRow): TreeNode {
    const children: TreeNode[] = [];
    const color = getBranchColor(branch);

    // Add child branches
    const childBranches = childrenMap.get(branch.id) || [];
    for (const child of childBranches) {
      children.push(buildBranchNode(child));
    }

    // Add leaf nodes (items directly in this branch)
    const directNodes = nodesByBranch.get(branch.id) || [];
    for (const node of directNodes) {
      children.push({
        id: node.id,
        title: node.title,
        nodeType: 'item',
        color,
        children: [],
        isExpanded: false,
        contentTypeCode: node.content_type_code as ContentTypeCode | null,
        sourceUrl: node.url,
        faviconPath: node.logo_url,
        iconHint: SHARED_CONTENT_TYPE_ICONS[node.content_type_code || 'A']
          || getIconByKeyword(node.title)
          || 'bxs-file',
      });
    }

    return {
      id: branch.id,
      title: `${branch.label} (${branch.node_count})`,
      nodeType: 'branch',
      color,
      children,
      isExpanded: false,
      iconHint: getBranchIcon(branch),
      discriminatorDimension: branch.discriminator_dimension,
      depth: branch.depth,
    };
  }

  // Build tree from root branches
  const rootBranches = childrenMap.get('__root__') || [];
  const tree: TreeNode[] = rootBranches.map(buildBranchNode);

  return tree;
}

// ============================================================
// Legacy Fallback (for pre-migration compatibility)
// ============================================================

function buildLegacyTree(): TreeNode[] {
  const db = getDatabase();

  const nodes = db.prepare(`
    SELECT id, title, url, logo_url, content_type_code,
           segment_code, category_code, subcategory_label
    FROM nodes
    WHERE is_deleted = 0
    ORDER BY date_added DESC
  `).all() as Array<{
    id: string;
    title: string;
    url: string | null;
    logo_url: string | null;
    content_type_code: string | null;
    segment_code: string | null;
    category_code: string | null;
    subcategory_label: string | null;
  }>;

  if (nodes.length === 0) return [];

  // Simple grouping: segment > category > items
  const segmentMap = new Map<string, Map<string, typeof nodes>>();

  for (const node of nodes) {
    const seg = node.segment_code || 'X';
    const cat = node.category_code || 'OTH';

    if (!segmentMap.has(seg)) segmentMap.set(seg, new Map());
    const catMap = segmentMap.get(seg)!;
    if (!catMap.has(cat)) catMap.set(cat, []);
    catMap.get(cat)!.push(node);
  }

  const tree: TreeNode[] = [];
  for (const [segCode, catMap] of [...segmentMap.entries()].sort()) {
    const catChildren: TreeNode[] = [];
    for (const [catCode, catNodes] of [...catMap.entries()].sort()) {
      const itemChildren: TreeNode[] = catNodes.map(node => ({
        id: node.id,
        title: node.title,
        nodeType: 'item' as const,
        children: [],
        isExpanded: false,
        contentTypeCode: node.content_type_code as ContentTypeCode | null,
        sourceUrl: node.url,
        faviconPath: node.logo_url,
        iconHint: SHARED_CONTENT_TYPE_ICONS[node.content_type_code || 'A'] || 'bxs-file',
      }));

      catChildren.push({
        id: `cat-${segCode}-${catCode}`,
        title: `${catCode} (${catNodes.length})`,
        nodeType: 'branch',
        children: itemChildren,
        isExpanded: false,
      });
    }

    const segTotal = [...catMap.values()].reduce((s, arr) => s + arr.length, 0);
    tree.push({
      id: `seg-${segCode}`,
      title: `${segCode} (${segTotal})`,
      nodeType: 'branch',
      children: catChildren,
      isExpanded: false,
    });
  }

  return tree;
}

// ============================================================
// Utility exports (kept for backward compatibility)
// ============================================================

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

export function getHierarchyLevel(code: string | null): number {
  if (!code) return 0;
  return code.split('.').length;
}

export function getParentCode(code: string | null): string | null {
  if (!code) return null;
  const parts = code.split('.');
  if (parts.length === 1) return null;
  return parts.slice(0, -1).join('.');
}