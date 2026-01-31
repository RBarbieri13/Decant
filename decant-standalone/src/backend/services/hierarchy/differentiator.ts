// ============================================================
// Differentiator Service
// Finds unique differentiating attributes between nodes
// ============================================================

/**
 * Differentiator priority order (highest to lowest):
 * 1. brand - Company/product brand name
 * 2. version - Version number or release
 * 3. variant - Product variant or edition
 * 4. creator - Author or creator name
 * 5. date - Publication or creation date
 * 6. unique_id - Fallback unique identifier
 */
export type DifferentiatorType = 'brand' | 'version' | 'variant' | 'creator' | 'date' | 'unique_id';

/**
 * Priority order for differentiators (lower index = higher priority)
 */
export const DIFFERENTIATOR_PRIORITY: DifferentiatorType[] = [
  'brand',
  'version',
  'variant',
  'creator',
  'date',
  'unique_id',
];

/**
 * Node attributes used for differentiation
 */
export interface DifferentiableNode {
  id: string;
  title: string;
  company: string | null;
  source_domain: string | null;
  extracted_fields?: Record<string, unknown>;
  metadata_tags?: string[];
  date_added?: string;
  created_at?: string;
}

/**
 * Result of finding a differentiator
 */
export interface DifferentiatorResult {
  type: DifferentiatorType;
  value: string;
  nodeId: string;
}

/**
 * Group of nodes with the same differentiator value
 */
export interface DifferentiatorGroup {
  value: string;
  nodes: DifferentiableNode[];
}

/**
 * Extract brand value from a node
 * Priority: company field > extracted brand > domain name
 */
export function extractBrand(node: DifferentiableNode): string | null {
  // Check company field first
  if (node.company && node.company.trim()) {
    return normalizeDifferentiatorValue(node.company);
  }

  // Check extracted fields for brand
  if (node.extracted_fields) {
    const brandField = node.extracted_fields['brand'] || node.extracted_fields['organization'];
    if (typeof brandField === 'string' && brandField.trim()) {
      return normalizeDifferentiatorValue(brandField);
    }
  }

  // Check metadata tags for ORG tags
  if (node.metadata_tags && Array.isArray(node.metadata_tags)) {
    const orgTag = node.metadata_tags.find(tag =>
      typeof tag === 'string' && tag.startsWith('ORG:')
    );
    if (orgTag) {
      return normalizeDifferentiatorValue(orgTag.replace('ORG:', ''));
    }
  }

  // Fallback to domain name
  if (node.source_domain) {
    return normalizeDomainToBrand(node.source_domain);
  }

  return null;
}

/**
 * Extract version value from a node
 */
export function extractVersion(node: DifferentiableNode): string | null {
  // Check extracted fields for version
  if (node.extracted_fields) {
    const versionField = node.extracted_fields['version'] ||
                         node.extracted_fields['release'] ||
                         node.extracted_fields['api_version'];
    if (typeof versionField === 'string' && versionField.trim()) {
      return normalizeDifferentiatorValue(versionField);
    }
  }

  // Try to extract version from title
  const versionMatch = node.title.match(/v?(\d+(?:\.\d+)*)/i);
  if (versionMatch) {
    return versionMatch[1];
  }

  return null;
}

/**
 * Extract variant value from a node
 */
export function extractVariant(node: DifferentiableNode): string | null {
  // Check extracted fields for variant
  if (node.extracted_fields) {
    const variantField = node.extracted_fields['variant'] ||
                         node.extracted_fields['edition'] ||
                         node.extracted_fields['tier'] ||
                         node.extracted_fields['plan'];
    if (typeof variantField === 'string' && variantField.trim()) {
      return normalizeDifferentiatorValue(variantField);
    }
  }

  // Check for common variant keywords in title
  const variantPatterns = [
    /\b(pro|plus|premium|enterprise|basic|free|lite|standard|ultimate)\b/i,
    /\b(beta|alpha|preview|stable|latest)\b/i,
  ];

  for (const pattern of variantPatterns) {
    const match = node.title.match(pattern);
    if (match) {
      return normalizeDifferentiatorValue(match[1]);
    }
  }

  return null;
}

/**
 * Extract creator value from a node
 */
export function extractCreator(node: DifferentiableNode): string | null {
  // Check extracted fields for creator/author
  if (node.extracted_fields) {
    const creatorField = node.extracted_fields['author'] ||
                         node.extracted_fields['creator'] ||
                         node.extracted_fields['owner'] ||
                         node.extracted_fields['publisher'];
    if (typeof creatorField === 'string' && creatorField.trim()) {
      return normalizeDifferentiatorValue(creatorField);
    }
  }

  return null;
}

/**
 * Extract date value from a node
 */
export function extractDate(node: DifferentiableNode): string | null {
  // Check extracted fields for date
  if (node.extracted_fields) {
    const dateField = node.extracted_fields['date'] ||
                      node.extracted_fields['published_date'] ||
                      node.extracted_fields['release_date'];
    if (typeof dateField === 'string' && dateField.trim()) {
      return normalizeDateValue(dateField);
    }
  }

  // Use date_added or created_at as fallback
  const dateValue = node.date_added || node.created_at;
  if (dateValue) {
    return normalizeDateValue(dateValue);
  }

  return null;
}

/**
 * Extract unique ID from a node (always available as fallback)
 */
export function extractUniqueId(node: DifferentiableNode): string {
  // Use first 8 characters of the UUID
  return node.id.substring(0, 8);
}

/**
 * Extract a differentiator value from a node based on type
 */
export function extractDifferentiator(
  node: DifferentiableNode,
  type: DifferentiatorType
): string | null {
  switch (type) {
    case 'brand':
      return extractBrand(node);
    case 'version':
      return extractVersion(node);
    case 'variant':
      return extractVariant(node);
    case 'creator':
      return extractCreator(node);
    case 'date':
      return extractDate(node);
    case 'unique_id':
      return extractUniqueId(node);
    default:
      return null;
  }
}

/**
 * Find the best differentiator that can distinguish between all nodes in a group
 * Returns the differentiator type and groups of nodes by that differentiator
 */
export function findBestDifferentiator(
  nodes: DifferentiableNode[]
): { type: DifferentiatorType; groups: DifferentiatorGroup[] } {
  if (nodes.length === 0) {
    return { type: 'unique_id', groups: [] };
  }

  if (nodes.length === 1) {
    return {
      type: 'unique_id',
      groups: [{ value: extractUniqueId(nodes[0]), nodes: [nodes[0]] }],
    };
  }

  // Try each differentiator in priority order
  for (const diffType of DIFFERENTIATOR_PRIORITY) {
    const groups = groupNodesByDifferentiator(nodes, diffType);

    // If this differentiator creates more groups than 1, it's useful
    // We want to minimize the largest group size
    if (groups.length > 1 || diffType === 'unique_id') {
      return { type: diffType, groups };
    }
  }

  // Fallback to unique_id (should always work)
  return {
    type: 'unique_id',
    groups: groupNodesByDifferentiator(nodes, 'unique_id'),
  };
}

/**
 * Group nodes by a specific differentiator type
 */
export function groupNodesByDifferentiator(
  nodes: DifferentiableNode[],
  type: DifferentiatorType
): DifferentiatorGroup[] {
  const groupMap = new Map<string, DifferentiableNode[]>();

  for (const node of nodes) {
    let value = extractDifferentiator(node, type);

    // If no value found and not unique_id, use a placeholder
    if (value === null) {
      if (type === 'unique_id') {
        value = extractUniqueId(node);
      } else {
        value = '__unknown__';
      }
    }

    const existing = groupMap.get(value);
    if (existing) {
      existing.push(node);
    } else {
      groupMap.set(value, [node]);
    }
  }

  // Convert to array and sort by value for consistent ordering
  const groups: DifferentiatorGroup[] = [];
  for (const [value, groupNodes] of groupMap) {
    groups.push({ value, nodes: groupNodes });
  }

  // Sort groups by value for deterministic ordering
  groups.sort((a, b) => a.value.localeCompare(b.value));

  return groups;
}

/**
 * Get all differentiator values for a node
 */
export function getAllDifferentiators(node: DifferentiableNode): Record<DifferentiatorType, string | null> {
  return {
    brand: extractBrand(node),
    version: extractVersion(node),
    variant: extractVariant(node),
    creator: extractCreator(node),
    date: extractDate(node),
    unique_id: extractUniqueId(node),
  };
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Normalize a differentiator value for consistent comparison
 */
function normalizeDifferentiatorValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Normalize a domain name to a brand identifier
 */
function normalizeDomainToBrand(domain: string): string {
  // Remove common prefixes and suffixes
  let brand = domain
    .toLowerCase()
    .replace(/^(www\.|api\.|docs\.|blog\.)/i, '')
    .replace(/\.(com|org|net|io|ai|dev|app|co|us|uk|de|fr)$/i, '');

  // Convert to brand format
  return normalizeDifferentiatorValue(brand);
}

/**
 * Normalize a date value to YYYYMMDD format
 */
function normalizeDateValue(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString.replace(/[^0-9]/g, '').substring(0, 8);
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}${month}${day}`;
  } catch {
    return dateString.replace(/[^0-9]/g, '').substring(0, 8);
  }
}
