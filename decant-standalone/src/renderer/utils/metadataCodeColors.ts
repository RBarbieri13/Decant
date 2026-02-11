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
