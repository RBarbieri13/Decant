// ============================================================
// Metadata Code Color Mapping Utility
// Maps 9 metadata code types to 4 Gumroad colors
// ============================================================

/**
 * Gumroad color palette
 */
export type GumroadColor = 'yellow' | 'blue' | 'pink' | 'green';

/**
 * Tag color type (includes more options for general UI components)
 */
export type TagColor = GumroadColor | 'purple' | 'gray' | 'orange' | 'teal';

/**
 * Metadata code types from backend
 */
export type MetadataCodeType =
  | 'ORG'  // Organization
  | 'DOM'  // Domain
  | 'FNC'  // Function
  | 'TEC'  // Technology
  | 'CON'  // Concepts
  | 'IND'  // Industry
  | 'AUD'  // Audience
  | 'PRC'  // Pricing
  | 'PLT'; // Platform

/**
 * Map metadata code types to Gumroad colors
 */
const METADATA_CODE_COLOR_MAP: Record<MetadataCodeType, GumroadColor> = {
  ORG: 'yellow',  // Organization → yellow
  DOM: 'blue',    // Domain → blue
  FNC: 'pink',    // Function → pink
  TEC: 'green',   // Technology → green
  CON: 'blue',    // Concepts → blue
  IND: 'yellow',  // Industry → yellow
  AUD: 'pink',    // Audience → pink
  PRC: 'green',   // Pricing → green
  PLT: 'green',   // Platform → green
};

/**
 * Get color for a metadata code type
 */
export function getMetadataCodeColor(type: string): GumroadColor {
  const normalizedType = type.toUpperCase() as MetadataCodeType;
  return METADATA_CODE_COLOR_MAP[normalizedType] || 'blue';
}

/**
 * Get color for a segment code
 */
export function getSegmentColor(segmentCode: string): GumroadColor {
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

  return colorMap[segmentCode.toUpperCase()] || 'blue';
}

export function formatMetadataCodesForDisplay(
  metadataCodes: Array<{ type: string; code: string; confidence?: number }>
): Array<{ label: string; color: GumroadColor; type: string }> {
  return metadataCodes.map(({ type, code }) => ({
    label: code,
    color: getMetadataCodeColor(type),
    type,
  }));
}

const SEGMENT_LABELS: Record<string, string> = {
  A: 'AI & ML', T: 'Technology', F: 'Finance', S: 'Sports',
  H: 'Health', B: 'Business', E: 'Entertainment', L: 'Lifestyle',
  X: 'Science', C: 'Creative',
};

const CATEGORY_LABELS: Record<string, Record<string, string>> = {
  A: { LLM: 'LLMs', AGT: 'AI Agents', FND: 'Foundation', MLO: 'MLOps', NLP: 'NLP', CVS: 'Vision', GEN: 'Generative', ETH: 'Ethics', RES: 'Research', OTH: 'Other AI' },
  T: { WEB: 'Web Dev', MOB: 'Mobile', DEV: 'Dev Tools', CLD: 'Cloud', SEC: 'Security', DAT: 'Data', API: 'APIs', OPS: 'DevOps', HRD: 'Hardware', OTH: 'Other Tech' },
  F: { INV: 'Investing', CRY: 'Crypto', FPA: 'FP&A', BNK: 'Banking', TAX: 'Tax', PFN: 'Personal', MKT: 'Markets', REL: 'Real Estate', ECN: 'Economics', OTH: 'Other Finance' },
  S: { NFL: 'NFL', FAN: 'Fantasy', FIT: 'Fitness', RUN: 'Running', GYM: 'Training', NBA: 'NBA', MLB: 'MLB', SOC: 'Soccer', OLY: 'Olympics', OTH: 'Other Sports' },
  H: { MED: 'Medical', MNT: 'Mental', NUT: 'Nutrition', SLP: 'Sleep', ACC: 'Access', WEL: 'Wellness', FRT: 'Fertility', AGE: 'Aging', DIS: 'Disease', OTH: 'Other Health' },
  B: { STR: 'Strategy', MNG: 'Mgmt', PRD: 'Product', MKT: 'Marketing', SAL: 'Sales', OPS: 'Ops', HRS: 'HR', STP: 'Startups', ENT: 'Enterprise', OTH: 'Other Biz' },
  E: { GAM: 'Gaming', MUS: 'Music', MOV: 'Movies', STR: 'Streaming', SOC: 'Social', POP: 'Pop Culture', POD: 'Podcasts', CEL: 'Celebs', EVT: 'Events', OTH: 'Other Ent.' },
  L: { HOM: 'Home', FAS: 'Fashion', FOD: 'Food', TRV: 'Travel', REL: 'Relations', PAR: 'Parenting', PET: 'Pets', HOB: 'Hobbies', GAR: 'Garden', OTH: 'Other Life' },
  X: { PHY: 'Physics', BIO: 'Biology', CHM: 'Chemistry', AST: 'Astronomy', ENV: 'Environment', MAT: 'Math', ENG: 'Engineering', SOC: 'Social Sci', PSY: 'Psychology', OTH: 'Other Sci' },
  C: { UXD: 'UX', GRD: 'Graphic', WRT: 'Writing', PHO: 'Photo', VID: 'Video', AUD: 'Audio', ART: 'Art', ANI: 'Animation', TYP: 'Typography', OTH: 'Other Creative' },
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  T: 'Tool', A: 'Article', V: 'Video', P: 'Paper', R: 'Repo',
  G: 'Guide', S: 'Service', C: 'Course', I: 'Image', N: 'News',
  K: 'Wiki', U: 'Other',
};

const TAG_TYPE_COLORS: Record<string, TagColor> = {
  segment: 'blue',
  category: 'pink',
  type: 'green',
  org: 'yellow',
};

export function parseRawTag(tag: string, segmentCode?: string): { label: string; color: TagColor } {
  const colonIdx = tag.indexOf(':');
  if (colonIdx === -1) {
    return { label: tag, color: 'blue' };
  }

  const prefix = tag.slice(0, colonIdx);
  const code = tag.slice(colonIdx + 1);

  let label = code;
  let color: TagColor = TAG_TYPE_COLORS[prefix] || 'blue';

  switch (prefix) {
    case 'segment':
      label = SEGMENT_LABELS[code] || code;
      color = getSegmentColor(code) as TagColor;
      break;
    case 'category':
      label = (segmentCode ? CATEGORY_LABELS[segmentCode]?.[code] : null) || code;
      color = 'pink';
      break;
    case 'type':
      label = CONTENT_TYPE_LABELS[code] || code;
      color = 'green';
      break;
    case 'org':
      if (code !== 'UNKN') {
        label = code;
        color = 'yellow';
      } else {
        label = 'Unknown';
        color = 'gray';
      }
      break;
    default:
      label = tag;
  }

  return { label, color };
}

export function formatCodesForDisplay(
  codes: string[]
): Array<{ label: string; color: GumroadColor; type: string; code: string }> {
  return codes.map(code => {
    const type = extractTypeFromCode(code);
    return {
      label: code,
      color: getMetadataCodeColor(type),
      type,
      code,
    };
  });
}

export function groupCodesByType(
  codes: string[]
): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const code of codes) {
    const type = extractTypeFromCode(code);
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(code);
  }
  return grouped;
}

function extractTypeFromCode(code: string): string {
  const match = code.match(/^([A-Z]{2,3})[-_:]/);
  if (match) return match[1];
  if (code.length <= 4 && /^[A-Z]+$/.test(code)) return 'ORG';
  return 'CON';
}
