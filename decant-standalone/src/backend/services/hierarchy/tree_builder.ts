// ============================================================
// Tree Builder Service
// ============================================================
// Transforms flat nodes into nested tree structure for UI rendering
// Groups by Segment > Category > Items (function view)
// or Organization > Category > Items (organization view)

import { getDatabase } from '../../database/connection.js';
import { HierarchyView, TreeNode, NodeType, GumroadColor, ContentTypeCode } from '../../../shared/types.js';

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
}

const SEGMENT_LABELS: Record<string, string> = {
  A: 'AI & Machine Learning',
  T: 'Technology & Development',
  F: 'Finance & Economics',
  S: 'Sports & Fitness',
  H: 'Health & Wellness',
  B: 'Business & Productivity',
  E: 'Entertainment & Media',
  L: 'Lifestyle & Personal',
  X: 'Science & Research',
  C: 'Creative & Design',
};

const CATEGORY_LABELS: Record<string, Record<string, string>> = {
  A: { LLM: 'Large Language Models', AGT: 'AI Agents', FND: 'Foundation Models', MLO: 'MLOps', NLP: 'Natural Language Processing', CVS: 'Computer Vision', GEN: 'Generative AI', ETH: 'AI Ethics', RES: 'AI Research', OTH: 'Other AI' },
  T: { WEB: 'Web Development', MOB: 'Mobile Development', DEV: 'Developer Tools', CLD: 'Cloud & Infrastructure', SEC: 'Security', DAT: 'Data Engineering', API: 'APIs & Integrations', OPS: 'DevOps', HRD: 'Hardware', OTH: 'Other Tech' },
  F: { INV: 'Investing', CRY: 'Crypto & Blockchain', FPA: 'FP&A', BNK: 'Banking', TAX: 'Tax & Accounting', PFN: 'Personal Finance', MKT: 'Markets', REL: 'Real Estate', ECN: 'Economics', OTH: 'Other Finance' },
  S: { NFL: 'NFL Football', FAN: 'Fantasy Sports', FIT: 'Fitness', RUN: 'Running', GYM: 'Gym & Training', NBA: 'Basketball', MLB: 'Baseball', SOC: 'Soccer', OLY: 'Olympics', OTH: 'Other Sports' },
  H: { MED: 'Medical', MNT: 'Mental Health', NUT: 'Nutrition', SLP: 'Sleep', ACC: 'Accessibility', WEL: 'Wellness', FRT: 'Fertility', AGE: 'Aging', DIS: 'Disease', OTH: 'Other Health' },
  B: { STR: 'Strategy', MNG: 'Management', PRD: 'Product', MKT: 'Marketing', SAL: 'Sales', OPS: 'Operations', HRS: 'HR & People', STP: 'Startups', ENT: 'Enterprise', OTH: 'Other Business' },
  E: { GAM: 'Gaming', MUS: 'Music', MOV: 'Movies & TV', STR: 'Streaming', SOC: 'Social Media', POP: 'Pop Culture', POD: 'Podcasts', CEL: 'Celebrities', EVT: 'Events', OTH: 'Other Entertainment' },
  L: { HOM: 'Home', FAS: 'Fashion', FOD: 'Food & Cooking', TRV: 'Travel', REL: 'Relationships', PAR: 'Parenting', PET: 'Pets', HOB: 'Hobbies', GAR: 'Garden', OTH: 'Other Lifestyle' },
  X: { PHY: 'Physics', BIO: 'Biology', CHM: 'Chemistry', AST: 'Astronomy', ENV: 'Environment', MAT: 'Mathematics', ENG: 'Engineering', SOC: 'Social Sciences', PSY: 'Psychology', OTH: 'Other Science' },
  C: { UXD: 'UX Design', GRD: 'Graphic Design', WRT: 'Writing', PHO: 'Photography', VID: 'Video Production', AUD: 'Audio Production', ART: 'Fine Art', ANI: 'Animation', TYP: 'Typography', OTH: 'Other Creative' },
};

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

const SEGMENT_ICONS: Record<string, string> = {
  A: 'bxs-brain',
  T: 'bxs-chip',
  F: 'bxs-bank',
  S: 'bxs-trophy',
  H: 'bxs-heart',
  B: 'bxs-briefcase',
  E: 'bxs-movie-play',
  L: 'bxs-home-heart',
  X: 'bxs-flask',
  C: 'bxs-palette',
};

const CATEGORY_ICONS: Record<string, Record<string, string>> = {
  A: {
    LLM: 'bxs-conversation', AGT: 'bxs-bot', FND: 'bxs-cube-alt',
    MLO: 'bxs-server', NLP: 'bxs-message-rounded-dots', CVS: 'bxs-camera',
    GEN: 'bxs-magic-wand', ETH: 'bxs-shield-alt-2', RES: 'bxs-book-content',
    OTH: 'bxs-category',
  },
  T: {
    WEB: 'bxs-globe', MOB: 'bxs-mobile', DEV: 'bxs-terminal',
    CLD: 'bxs-cloud', SEC: 'bxs-lock-alt', DAT: 'bxs-data',
    API: 'bxs-plug', OPS: 'bxs-cog', HRD: 'bxs-microchip',
    OTH: 'bxs-category',
  },
  F: {
    INV: 'bxs-bar-chart-alt-2', CRY: 'bxl-bitcoin', FPA: 'bxs-spreadsheet',
    BNK: 'bxs-bank', TAX: 'bxs-receipt', PFN: 'bxs-wallet',
    MKT: 'bxs-trending-up', REL: 'bxs-building-house', ECN: 'bxs-analyse',
    OTH: 'bxs-category',
  },
  S: {
    NFL: 'bx-football', FAN: 'bxs-star', FIT: 'bxs-heart-circle',
    RUN: 'bx-run', GYM: 'bxs-dumbbell', NBA: 'bx-basketball',
    MLB: 'bx-baseball', SOC: 'bx-football', OLY: 'bxs-medal',
    OTH: 'bxs-category',
  },
  H: {
    MED: 'bxs-first-aid', MNT: 'bxs-brain', NUT: 'bxs-leaf',
    SLP: 'bxs-moon', ACC: 'bxs-universal-access', WEL: 'bxs-spa',
    FRT: 'bxs-baby-carriage', AGE: 'bxs-hourglass', DIS: 'bxs-virus',
    OTH: 'bxs-category',
  },
  B: {
    STR: 'bxs-chess', MNG: 'bxs-user-badge', PRD: 'bxs-box',
    MKT: 'bxs-megaphone', SAL: 'bxs-dollar-circle', OPS: 'bxs-cog',
    HRS: 'bxs-group', STP: 'bxs-rocket', ENT: 'bxs-buildings',
    OTH: 'bxs-category',
  },
  E: {
    GAM: 'bxs-joystick', MUS: 'bxs-music', MOV: 'bxs-film',
    STR: 'bxs-tv', SOC: 'bxs-chat', POP: 'bxs-star',
    POD: 'bxs-microphone', CEL: 'bxs-crown', EVT: 'bxs-calendar-event',
    OTH: 'bxs-category',
  },
  L: {
    HOM: 'bxs-home', FAS: 'bxs-t-shirt', FOD: 'bxs-bowl-hot',
    TRV: 'bxs-plane-alt', REL: 'bxs-heart', PAR: 'bxs-baby-carriage',
    PET: 'bxs-dog', HOB: 'bxs-paint', GAR: 'bxs-tree',
    OTH: 'bxs-category',
  },
  X: {
    PHY: 'bxs-atom', BIO: 'bxs-vial', CHM: 'bxs-flask',
    AST: 'bxs-planet', ENV: 'bxs-leaf', MAT: 'bxs-calculator',
    ENG: 'bxs-wrench', SOC: 'bxs-group', PSY: 'bxs-brain',
    OTH: 'bxs-category',
  },
  C: {
    UXD: 'bxs-layout', GRD: 'bxs-brush', WRT: 'bxs-pencil',
    PHO: 'bxs-camera', VID: 'bxs-video', AUD: 'bxs-music',
    ART: 'bxs-palette', ANI: 'bxs-ghost', TYP: 'bxs-font-family',
    OTH: 'bxs-category',
  },
};

const CONTENT_TYPE_ICONS: Record<string, string> = {
  T: 'bxs-wrench',
  A: 'bxs-file',
  V: 'bxs-video',
  P: 'bxs-book-content',
  R: 'bxl-github',
  G: 'bxs-book-reader',
  S: 'bxs-cloud',
  C: 'bxs-graduation',
  I: 'bxs-image',
  N: 'bxs-news',
  K: 'bxs-book-bookmark',
  U: 'bxs-file-blank',
};

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
      extracted_fields
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
  const segmentMap = new Map<string, Map<string, DatabaseNode[]>>();

  for (const node of nodes) {
    const { seg, cat } = resolveClassification(node);

    if (!segmentMap.has(seg)) {
      segmentMap.set(seg, new Map());
    }
    const catMap = segmentMap.get(seg)!;
    if (!catMap.has(cat)) {
      catMap.set(cat, []);
    }
    catMap.get(cat)!.push(node);
  }

  const tree: TreeNode[] = [];
  const sortedSegments = [...segmentMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  for (const [segCode, catMap] of sortedSegments) {
    const segLabel = SEGMENT_LABELS[segCode] || segCode;
    const segColor = getSegmentColor(segCode);

    const categoryChildren: TreeNode[] = [];
    const sortedCategories = [...catMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    for (const [catCode, catNodes] of sortedCategories) {
      const catLabel = CATEGORY_LABELS[segCode]?.[catCode] || catCode;

      const itemChildren: TreeNode[] = catNodes.map(node => ({
        id: node.id,
        title: node.title,
        nodeType: 'item' as NodeType,
        color: segColor,
        children: [],
        isExpanded: false,
        contentTypeCode: node.content_type_code as ContentTypeCode | null,
        sourceUrl: node.url,
        faviconPath: node.logo_url,
        iconHint: CONTENT_TYPE_ICONS[node.content_type_code || 'A'] || 'bxs-file',
      }));

      categoryChildren.push({
        id: `cat-${segCode}-${catCode}`,
        title: `${catLabel} (${catNodes.length})`,
        nodeType: 'category' as NodeType,
        color: segColor,
        children: itemChildren,
        isExpanded: false,
        iconHint: CATEGORY_ICONS[segCode]?.[catCode] || 'bxs-folder',
      });
    }

    const totalInSegment = [...catMap.values()].reduce((sum, arr) => sum + arr.length, 0);
    tree.push({
      id: `seg-${segCode}`,
      title: `${segLabel} (${totalInSegment})`,
      nodeType: 'segment' as NodeType,
      color: segColor,
      children: categoryChildren,
      isExpanded: false,
      iconHint: SEGMENT_ICONS[segCode] || 'bxs-folder',
    });
  }

  return tree;
}

function buildOrganizationTree(nodes: DatabaseNode[]): TreeNode[] {
  const orgMap = new Map<string, Map<string, DatabaseNode[]>>();

  for (const node of nodes) {
    const org = node.company || 'Unknown';
    const { cat } = resolveClassification(node);

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
      const segCode = catNodes[0]?.segment_code || 'T';
      const catLabel = CATEGORY_LABELS[segCode]?.[catCode] || catCode;

      const itemChildren: TreeNode[] = catNodes.map(node => ({
        id: node.id,
        title: node.title,
        nodeType: 'item' as NodeType,
        color: getSegmentColor(node.segment_code),
        children: [],
        isExpanded: false,
        contentTypeCode: node.content_type_code as ContentTypeCode | null,
        sourceUrl: node.url,
        faviconPath: node.logo_url,
        iconHint: CONTENT_TYPE_ICONS[node.content_type_code || 'A'] || 'bxs-file',
      }));

      categoryChildren.push({
        id: `org-${orgName}-cat-${catCode}`,
        title: `${catLabel} (${catNodes.length})`,
        nodeType: 'category' as NodeType,
        children: itemChildren,
        isExpanded: false,
        iconHint: CATEGORY_ICONS[segCode]?.[catCode] || 'bxs-folder',
      });
    }

    const totalInOrg = [...catMap.values()].reduce((sum, arr) => sum + arr.length, 0);
    tree.push({
      id: `org-${orgName}`,
      title: `${orgName} (${totalInOrg})`,
      nodeType: 'organization' as NodeType,
      children: categoryChildren,
      isExpanded: false,
      iconHint: 'bxs-buildings',
    });
  }

  return tree;
}

function getSegmentColor(segmentCode: string | null): GumroadColor | undefined {
  if (!segmentCode) return undefined;

  const colorMap: Record<string, GumroadColor> = {
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

  return colorMap[segmentCode];
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
