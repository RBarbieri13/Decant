// ============================================================
// Tree Builder Service
// ============================================================
// Transforms flat nodes into nested tree structure for UI rendering
// Groups by Segment > Category > Items (function view)
// or Organization > Category > Items (organization view)

import { getDatabase } from '../../database/connection.js';
import { HierarchyView, TreeNode, NodeType, GumroadColor, ContentTypeCode } from '../../../shared/types.js';
import {
  CONTENT_TYPE_ICONS as SHARED_CONTENT_TYPE_ICONS,
  ORGANIZATION_ICONS,
  getIconByKeyword,
  resolveSegmentIcon,
  resolveCategoryIcon,
} from '../../../shared/iconDatabase.js';
import { getSegmentLabels, getCategoryLabels } from '../../database/taxonomy_ops.js';

interface DatabaseNode {
  id: string;
  title: string;
  function_hierarchy_code: string | null;
  organization_hierarchy_code: string | null;
  content_type_code: string | null;
  category_code: string | null;
  url: string | null;
  logo_url: string | null;
  segment_code: string | null;
  company: string | null;
  extracted_fields: string | null;
  subcategory_label: string | null;
}

/**
 * Resolve segment code from either the dedicated column or extracted_fields JSON
 */
function resolveSegment(node: DatabaseNode): string {
  if (node.segment_code) return node.segment_code;
  if (node.extracted_fields) {
    try {
      const fields = JSON.parse(node.extracted_fields);
      if (fields.segment) return fields.segment;
      if (fields.segment_code) return fields.segment_code;
    } catch {}
  }
  return 'X'; // fallback to Science & Research
}

/**
 * Resolve category code from either the dedicated column or extracted_fields JSON
 */
function resolveCategory(node: DatabaseNode): string {
  if (node.category_code) return node.category_code;
  if (node.extracted_fields) {
    try {
      const fields = JSON.parse(node.extracted_fields);
      if (fields.category) return fields.category;
      if (fields.category_code) return fields.category_code;
    } catch {}
  }
  return 'OTH'; // fallback to Other
}

/**
 * Resolve content type code from either the dedicated column or extracted_fields JSON
 */
function resolveContentType(node: DatabaseNode): string | null {
  if (node.content_type_code) return node.content_type_code;
  if (node.extracted_fields) {
    try {
      const fields = JSON.parse(node.extracted_fields);
      if (fields.contentType) return fields.contentType;
      if (fields.content_type_code) return fields.content_type_code;
    } catch {}
  }
  return null;
}

// Segment and category labels are now read dynamically from the DB
// via getSegmentLabels() and getCategoryLabels() from taxonomy_ops.ts.
// This enables the dynamic reclassification system to generate emergent taxonomies.

const CONTENT_TYPE_LABELS: Record<string, string> = {
  T: 'Tools & Software',
  A: 'Articles',
  V: 'Videos',
  P: 'Research Papers',
  R: 'Repositories',
  G: 'Guides & Tutorials',
  S: 'Services',
  C: 'Courses',
  I: 'Images & Graphics',
  N: 'News',
  K: 'Knowledge Bases',
  U: 'Other',
};

const CONTENT_TYPE_ICONS = SHARED_CONTENT_TYPE_ICONS;

/**
 * Build hierarchy tree from database nodes
 * Groups nodes into: Segment > Category > Items (function view)
 * or Organization > Category > Items (organization view)
 */
export function buildHierarchyTree(viewType: HierarchyView): TreeNode[] {
  const db = getDatabase();

  const nodes = db.prepare(`
    SELECT
      id, title, function_hierarchy_code, organization_hierarchy_code,
      content_type_code, category_code, url, logo_url, segment_code, company,
      extracted_fields, subcategory_label
    FROM nodes
    WHERE is_deleted = 0
    ORDER BY date_added DESC
  `).all() as DatabaseNode[];

  if (nodes.length === 0) return [];

  if (viewType === 'function') {
    return buildFunctionTree(nodes);
  }
  return buildOrganizationTree(nodes);
}

function resolveClassification(node: DatabaseNode): { seg: string; cat: string; ct: string } {
  let seg = node.segment_code || '';
  let cat = node.category_code || '';
  let ct = node.content_type_code || '';

  if (!seg && node.extracted_fields) {
    try {
      const fields = JSON.parse(node.extracted_fields);
      if (fields.segment) seg = fields.segment;
      if (fields.category) cat = fields.category;
      if (fields.contentType) ct = fields.contentType;
    } catch {
      // ignore parse errors
    }
  }

  return {
    seg: seg || 'T',
    cat: cat || 'OTH',
    ct: ct || 'A',
  };
}

function buildFunctionTree(nodes: DatabaseNode[]): TreeNode[] {
  // Load dynamic labels from DB (with hardcoded fallbacks)
  const segLabels = getSegmentLabels();
  const catLabels = getCategoryLabels();

  // Segment → Category → Subcategory → Items
  const segmentMap = new Map<string, Map<string, Map<string, DatabaseNode[]>>>();

  for (const node of nodes) {
    const seg = resolveSegment(node);
    const cat = resolveCategory(node);
    const rawSubcat = node.subcategory_label?.trim();
    const subcat = (rawSubcat && rawSubcat.length > 2) ? rawSubcat : 'General';

    if (!segmentMap.has(seg)) {
      segmentMap.set(seg, new Map());
    }
    const catMap = segmentMap.get(seg)!;
    if (!catMap.has(cat)) {
      catMap.set(cat, new Map());
    }
    const subcatMap = catMap.get(cat)!;
    if (!subcatMap.has(subcat)) {
      subcatMap.set(subcat, []);
    }
    subcatMap.get(subcat)!.push(node);
  }

  const tree: TreeNode[] = [];
  const sortedSegments = [...segmentMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  for (const [segCode, catMap] of sortedSegments) {
    const segLabel = segLabels[segCode] || segCode;
    const segColor = getSegmentColor(segCode);

    const categoryChildren: TreeNode[] = [];
    const sortedCategories = [...catMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    for (const [catCode, subcatMap] of sortedCategories) {
      const catLabel = catLabels[segCode]?.[catCode] || catCode;
      const sortedSubcats = [...subcatMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      const totalInCat = [...subcatMap.values()].reduce((sum, arr) => sum + arr.length, 0);

      // If only one subcategory (or only 'General'), show items directly under category
      const hasMultipleSubcats = sortedSubcats.length > 1 ||
        (sortedSubcats.length === 1 && sortedSubcats[0][0] !== 'General');

      let catChildren: TreeNode[];

      if (hasMultipleSubcats) {
        // Add subcategory tier
        catChildren = sortedSubcats.map(([subcatLabel, subcatNodes]) => {
          const itemChildren: TreeNode[] = subcatNodes.map(node => ({
            id: node.id,
            title: node.title,
            nodeType: 'item' as NodeType,
            color: segColor,
            children: [],
            isExpanded: false,
            contentTypeCode: node.content_type_code as ContentTypeCode | null,
            sourceUrl: node.url,
            faviconPath: node.logo_url,
            iconHint: CONTENT_TYPE_ICONS[node.content_type_code || 'A'] || getIconByKeyword(node.title) || 'bxs-file',
          }));
          return {
            id: `subcat-${segCode}-${catCode}-${subcatLabel.replace(/\s+/g, '_')}`,
            title: `${subcatLabel} (${subcatNodes.length})`,
            nodeType: 'subcategory' as NodeType,
            color: segColor,
            children: itemChildren,
            isExpanded: false,
          };
        });
      } else {
        // Flatten items directly under category
        const allNodes = sortedSubcats.flatMap(([, nodes]) => nodes);
        catChildren = allNodes.map(node => ({
          id: node.id,
          title: node.title,
          nodeType: 'item' as NodeType,
          color: segColor,
          children: [],
          isExpanded: false,
          contentTypeCode: node.content_type_code as ContentTypeCode | null,
          sourceUrl: node.url,
          faviconPath: node.logo_url,
          iconHint: CONTENT_TYPE_ICONS[node.content_type_code || 'A'] || getIconByKeyword(node.title) || 'bxs-file',
        }));
      }

      categoryChildren.push({
        id: `cat-${segCode}-${catCode}`,
        title: `${catLabel} (${totalInCat})`,
        nodeType: 'category' as NodeType,
        color: segColor,
        children: catChildren,
        isExpanded: false,
        iconHint: resolveCategoryIcon(segCode, catCode),
      });
    }

    const totalInSegment = [...catMap.values()].reduce(
      (sum, subcatMap) => sum + [...subcatMap.values()].reduce((s, arr) => s + arr.length, 0),
      0
    );
    tree.push({
      id: `seg-${segCode}`,
      title: `${segLabel} (${totalInSegment})`,
      nodeType: 'segment' as NodeType,
      color: segColor,
      children: categoryChildren,
      isExpanded: false,
      iconHint: resolveSegmentIcon(segCode),
    });
  }

  return tree;
}

function buildOrganizationTree(nodes: DatabaseNode[]): TreeNode[] {
  const catLabels = getCategoryLabels();
  const orgMap = new Map<string, Map<string, DatabaseNode[]>>();

  for (const node of nodes) {
    const org = node.company || 'Unknown';
    const cat = resolveCategory(node);

    if (!orgMap.has(org)) {
      orgMap.set(org, new Map());
    }
    const catMap = orgMap.get(org)!;
    if (!catMap.has(cat)) {
      catMap.set(cat, []);
    }
    catMap.get(cat)!.push(node);
  }

  const tree: TreeNode[] = [];
  const sortedOrgs = [...orgMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  for (const [orgName, catMap] of sortedOrgs) {
    const categoryChildren: TreeNode[] = [];
    const sortedCategories = [...catMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    for (const [catCode, catNodes] of sortedCategories) {
      const segCode = resolveSegment(catNodes[0]);
      const catLabel = catLabels[segCode]?.[catCode] || catCode;

      const itemChildren: TreeNode[] = catNodes.map(node => ({
        id: node.id,
        title: node.title,
        nodeType: 'item' as NodeType,
        color: getSegmentColor(resolveSegment(node)),
        children: [],
        isExpanded: false,
        contentTypeCode: node.content_type_code as ContentTypeCode | null,
        sourceUrl: node.url,
        faviconPath: node.logo_url,
        iconHint: CONTENT_TYPE_ICONS[node.content_type_code || 'A'] || getIconByKeyword(node.title) || 'bxs-file',
      }));

      categoryChildren.push({
        id: `org-${orgName}-cat-${catCode}`,
        title: `${catLabel} (${catNodes.length})`,
        nodeType: 'category' as NodeType,
        children: itemChildren,
        isExpanded: false,
        iconHint: resolveCategoryIcon(segCode, catCode),
      });
    }

    const totalInOrg = [...catMap.values()].reduce((sum, arr) => sum + arr.length, 0);
    tree.push({
      id: `org-${orgName}`,
      title: `${orgName} (${totalInOrg})`,
      nodeType: 'organization' as NodeType,
      children: categoryChildren,
      isExpanded: false,
      iconHint: ORGANIZATION_ICONS[orgName] || 'bxs-buildings',
    });
  }

  return tree;
}

function getSegmentColor(segmentCode: string | null): GumroadColor | undefined {
  if (!segmentCode) return undefined;

  // Known codes keep their assigned colors for visual stability
  const knownColors: Record<string, GumroadColor> = {
    'A': 'pink',
    'T': 'blue',
    'F': 'green',
    'S': 'yellow',
    'H': 'pink',
    'B': 'blue',
    'E': 'yellow',
    'L': 'green',
    'X': 'blue',
    'C': 'pink',
  };
  if (knownColors[segmentCode]) return knownColors[segmentCode];

  // Dynamic codes get colors from rotation
  const colors: GumroadColor[] = ['pink', 'blue', 'green', 'yellow'];
  return colors[segmentCode.charCodeAt(0) % colors.length];
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
