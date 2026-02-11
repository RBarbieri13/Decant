// ============================================================
// Metadata Code Color Mapping Utility
// ============================================================
// Maps metadata code types to Gumroad color system for visual differentiation

import { GumroadColor } from '../../shared/types';

/**
 * Metadata code type prefixes
 * These are the first 3 characters of metadata codes (e.g., "ORG:", "FNC:", "TEC:")
 */
export type MetadataCodeType =
  | 'ORG' // Organization/Company (e.g., "ORG:OpenAI")
  | 'DOM' // Domain/Field (e.g., "DOM:Machine Learning")
  | 'FNC' // Function/Use Case (e.g., "FNC:Text Generation")
  | 'TEC' // Technology/Stack (e.g., "TEC:Python")
  | 'CON' // Concepts/Topics (e.g., "CON:Neural Networks")
  | 'IND' // Industry/Vertical (e.g., "IND:Healthcare")
  | 'AUD' // Audience/User Type (e.g., "AUD:Developers")
  | 'PRC' // Pricing/Model (e.g., "PRC:Freemium")
  | 'PLT'; // Platform/Environment (e.g., "PLT:Web")

/**
 * Map metadata code types to Gumroad colors
 * Distributes 9 types across 4 colors for visual distinction
 */
const CODE_TYPE_COLOR_MAP: Record<MetadataCodeType, GumroadColor> = {
  ORG: 'yellow',  // Organization - yellow (distinctive for companies/brands)
  DOM: 'blue',    // Domain - blue (academic/professional feel)
  FNC: 'pink',    // Function - pink (action-oriented)
  TEC: 'green',   // Technology - green (technical/code feel)
  CON: 'blue',    // Concepts - blue (knowledge/learning)
  IND: 'yellow',  // Industry - yellow (business/vertical)
  AUD: 'pink',    // Audience - pink (people-focused)
  PRC: 'green',   // Pricing - green (money/value)
  PLT: 'green',   // Platform - green (infrastructure)
};

/**
 * Get Gumroad color for a metadata code type
 * @param codeType - Three-letter code type (ORG, FNC, TEC, etc.)
 * @returns Gumroad color (pink, yellow, blue, green) or default gray
 */
export function getMetadataCodeColor(codeType: string): GumroadColor {
  const type = codeType.toUpperCase().substring(0, 3) as MetadataCodeType;
  return CODE_TYPE_COLOR_MAP[type] || 'blue'; // Default to blue if unknown
}

/**
 * Extract code type from a full metadata code
 * Example: "ORG:OpenAI" -> "ORG"
 * Example: "FNC:Text Generation" -> "FNC"
 */
export function extractCodeType(code: string): string {
  if (!code) return '';

  // Handle codes with colon separator (e.g., "ORG:OpenAI")
  if (code.includes(':')) {
    return code.split(':')[0].toUpperCase();
  }

  // Handle codes with underscore separator (e.g., "ORG_OpenAI")
  if (code.includes('_')) {
    return code.split('_')[0].toUpperCase();
  }

  // Handle codes with dash separator (e.g., "ORG-OpenAI")
  if (code.includes('-')) {
    return code.split('-')[0].toUpperCase();
  }

  // No separator found - return first 3 characters
  return code.substring(0, 3).toUpperCase();
}

/**
 * Get color for a full metadata code
 * Convenience function that extracts type and returns color
 * Example: "ORG:OpenAI" -> "yellow"
 */
export function getCodeColor(code: string): GumroadColor {
  const type = extractCodeType(code);
  return getMetadataCodeColor(type);
}

/**
 * Group metadata codes by type
 * Returns object with code types as keys and arrays of codes as values
 * Example: { ORG: ["ORG:OpenAI", "ORG:Anthropic"], FNC: ["FNC:Chatbot"] }
 */
export function groupCodesByType(codes: string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};

  for (const code of codes) {
    const type = extractCodeType(code);

    if (!grouped[type]) {
      grouped[type] = [];
    }

    grouped[type].push(code);
  }

  return grouped;
}

/**
 * Get display label from metadata code
 * Removes prefix and returns clean label
 * Example: "ORG:OpenAI" -> "OpenAI"
 * Example: "FNC:Text Generation" -> "Text Generation"
 */
export function getCodeLabel(code: string): string {
  if (!code) return '';

  // Handle codes with colon separator
  if (code.includes(':')) {
    return code.split(':')[1] || code;
  }

  // Handle codes with underscore separator
  if (code.includes('_')) {
    const parts = code.split('_');
    return parts.slice(1).join(' ') || code;
  }

  // Handle codes with dash separator
  if (code.includes('-')) {
    const parts = code.split('-');
    return parts.slice(1).join(' ') || code;
  }

  // No separator - return as-is
  return code;
}

/**
 * Format metadata codes for display with colors
 * Returns array of objects with label, type, and color
 */
export interface FormattedCode {
  code: string;
  type: string;
  label: string;
  color: GumroadColor;
}

export function formatCodesForDisplay(codes: string[]): FormattedCode[] {
  return codes.map(code => ({
    code,
    type: extractCodeType(code),
    label: getCodeLabel(code),
    color: getCodeColor(code),
  }));
}
