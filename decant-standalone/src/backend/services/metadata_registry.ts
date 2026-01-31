// ============================================================
// Metadata Registry Service
// ============================================================
//
// High-level service for managing metadata codes and their
// associations with nodes. This service provides the main API
// for working with metadata in Decant.
//
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import {
  type MetadataCodeType,
  type RegistryEntry,
  type NodeMetadataEntry,
  type MetadataInput,
  type CodeStats,
  VALID_METADATA_CODE_TYPES,
  METADATA_TYPE_LABELS,
  normalizeCode,
  normalizeDisplayName,
  isValidMetadataType,
  getRegistryEntry,
  getOrCreateRegistryEntry,
  getCodesByType,
  getAllRegistryEntries,
  searchCodes,
  getCodeStats,
  incrementCodeUsage,
  setNodeMetadata as setNodeMetadataByType,
  addNodeMetadata,
  getNodeMetadata,
  getNodeMetadataByType,
  getNodesByMetadataCode,
  removeNodeMetadata,
  clearNodeMetadata,
  batchLoadNodeMetadata,
} from '../database/metadata.js';
import { getDatabase } from '../database/connection.js';
import { withTransaction } from '../database/transaction.js';
import { log } from '../logger/index.js';

// Re-export types and constants for convenience
export type { MetadataCodeType, RegistryEntry, NodeMetadataEntry, MetadataInput, CodeStats };
export { VALID_METADATA_CODE_TYPES, METADATA_TYPE_LABELS };

// ============================================================
// Additional Types for Phase2 Enricher Compatibility
// ============================================================

/**
 * Metadata assignment by registry ID.
 * Used by the Phase2 enricher to assign metadata directly by code ID.
 */
export interface MetadataAssignment {
  /** Registry code ID */
  codeId: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Source of the assignment (e.g., 'ai_enrichment', 'manual') */
  source: string;
}

// ============================================================
// Validation Helpers
// ============================================================

/**
 * Validation error for metadata operations
 */
export class MetadataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetadataValidationError';
  }
}

/**
 * Validate that a type string is a valid MetadataCodeType.
 * Throws if invalid.
 */
export function validateMetadataType(type: string): MetadataCodeType {
  if (!isValidMetadataType(type)) {
    throw new MetadataValidationError(
      `Invalid metadata type: ${type}. Valid types are: ${VALID_METADATA_CODE_TYPES.join(', ')}`
    );
  }
  return type;
}

/**
 * Validate that a code is non-empty and normalizable.
 * Throws if invalid.
 */
export function validateCode(code: string): string {
  if (!code || typeof code !== 'string') {
    throw new MetadataValidationError('Code must be a non-empty string');
  }

  const normalized = normalizeCode(code);
  if (normalized.length === 0) {
    throw new MetadataValidationError('Code must contain at least one alphanumeric character');
  }

  if (normalized.length > 50) {
    throw new MetadataValidationError('Code must be 50 characters or less');
  }

  return normalized;
}

/**
 * Validate metadata input array.
 * Throws if any entry is invalid.
 */
export function validateMetadataInputs(inputs: MetadataInput[]): void {
  if (!Array.isArray(inputs)) {
    throw new MetadataValidationError('Metadata inputs must be an array');
  }

  for (const input of inputs) {
    validateMetadataType(input.type);
    validateCode(input.code);

    if (input.confidence !== undefined) {
      if (typeof input.confidence !== 'number' || input.confidence < 0 || input.confidence > 1) {
        throw new MetadataValidationError('Confidence must be a number between 0 and 1');
      }
    }
  }
}

// ============================================================
// Registry Service Functions
// ============================================================

/**
 * Get or create a metadata code in the registry.
 * Automatically normalizes codes to UPPERCASE and display names to Title Case.
 *
 * @param type - The metadata type
 * @param code - The code value (will be normalized)
 * @param displayName - Optional display name (will be normalized)
 * @param description - Optional description
 * @returns The registry entry
 *
 * @example
 * ```typescript
 * // Auto-registers "ANTHROPIC" with display name "Anthropic"
 * const entry = getOrCreateCode('ORG', 'anthropic');
 *
 * // With custom display name
 * const entry = getOrCreateCode('TEC', 'NEXTJS', 'Next.js');
 * ```
 */
export function getOrCreateCode(
  type: MetadataCodeType,
  code: string,
  displayName?: string,
  description?: string
): RegistryEntry {
  validateMetadataType(type);
  const normalizedCode = validateCode(code);

  log.debug('Getting or creating metadata code', {
    type,
    code: normalizedCode,
    module: 'metadata_registry',
  });

  return getOrCreateRegistryEntry(type, normalizedCode, displayName, description);
}

/**
 * Get an existing registry entry by type and code.
 * Returns null if not found (does not auto-create).
 *
 * @param type - The metadata type
 * @param code - The code value
 * @returns The registry entry or null
 */
export function getCode(type: MetadataCodeType, code: string): RegistryEntry | null {
  validateMetadataType(type);
  const normalizedCode = validateCode(code);
  return getRegistryEntry(type, normalizedCode);
}

/**
 * Get all codes of a specific type.
 * Results are sorted by usage count (descending).
 *
 * @param type - The metadata type
 * @returns Array of registry entries
 *
 * @example
 * ```typescript
 * const technologies = getCodesByType('TEC');
 * // Returns: [{ code: 'PYTHON', displayName: 'Python', usageCount: 42 }, ...]
 * ```
 */
export { getCodesByType };

/**
 * Get all codes in the registry.
 * Results are grouped by type and sorted by usage count.
 *
 * @returns Array of all registry entries
 */
export { getAllRegistryEntries };

/**
 * Search for codes by query string.
 * Searches across code and display name fields.
 *
 * @param query - Search query
 * @param type - Optional type filter
 * @returns Matching registry entries (max 50)
 *
 * @example
 * ```typescript
 * // Search all types
 * const results = searchCodes('python');
 *
 * // Search only technologies
 * const results = searchCodes('script', 'TEC');
 * ```
 */
export function searchMetadataCodes(query: string, type?: MetadataCodeType): RegistryEntry[] {
  if (type) {
    validateMetadataType(type);
  }

  if (!query || query.trim().length === 0) {
    // Return all codes for the type if no query
    return type ? getCodesByType(type) : getAllRegistryEntries().slice(0, 50);
  }

  return searchCodes(query, type);
}

/**
 * Get usage statistics for metadata codes.
 * Returns codes with their actual node assignment counts.
 *
 * @param type - Optional type filter
 * @returns Array of code statistics
 *
 * @example
 * ```typescript
 * const stats = getCodeStats('TEC');
 * // Returns: [{ type: 'TEC', code: 'PYTHON', displayName: 'Python', count: 42 }, ...]
 * ```
 */
export { getCodeStats };

// ============================================================
// Node Metadata Service Functions
// ============================================================

/**
 * Set metadata codes for a node by registry ID.
 * This is the low-level function used by the Phase2 enricher.
 * It directly inserts node_metadata records using registry IDs.
 *
 * @param nodeId - The node ID
 * @param assignments - Array of metadata assignments by registry ID
 *
 * @example
 * ```typescript
 * setNodeMetadata('node-123', [
 *   { codeId: 'tec_python', confidence: 0.95, source: 'ai_enrichment' },
 *   { codeId: 'org_anthropic', confidence: 0.9, source: 'ai_enrichment' },
 * ]);
 * ```
 */
export function setNodeMetadata(nodeId: string, assignments: MetadataAssignment[]): void {
  if (!nodeId) {
    throw new MetadataValidationError('Node ID is required');
  }

  if (!Array.isArray(assignments) || assignments.length === 0) {
    return;
  }

  const db = getDatabase();

  withTransaction(() => {
    // Clear existing metadata for this node
    db.prepare(`DELETE FROM node_metadata WHERE node_id = ?`).run(nodeId);

    // Insert new assignments
    const insertStmt = db.prepare(`
      INSERT INTO node_metadata (id, node_id, registry_id, confidence, source)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const assignment of assignments) {
      if (!assignment.codeId) continue;

      insertStmt.run(
        uuidv4(),
        nodeId,
        assignment.codeId,
        assignment.confidence ?? 1.0,
        assignment.source || 'manual'
      );

      // Increment usage count
      incrementCodeUsage(assignment.codeId);
    }

    log.debug('Set node metadata by registry IDs', {
      nodeId,
      assignmentCount: assignments.length,
      module: 'metadata_registry',
    });
  });
}

/**
 * Set metadata codes for a node by type and code.
 * This replaces existing metadata of the same types.
 *
 * @param nodeId - The node ID
 * @param codes - Array of metadata codes to set
 *
 * @example
 * ```typescript
 * setMetadataForNode('node-123', [
 *   { type: 'ORG', code: 'ANTHROPIC' },
 *   { type: 'TEC', code: 'PYTHON', confidence: 0.95 },
 *   { type: 'DOM', code: 'AI_ML' },
 * ]);
 * ```
 */
export function setMetadataForNode(nodeId: string, codes: MetadataInput[]): void {
  if (!nodeId) {
    throw new MetadataValidationError('Node ID is required');
  }

  validateMetadataInputs(codes);

  // Extract unique types using Array.from instead of spread operator
  const uniqueTypes = Array.from(new Set(codes.map(c => c.type)));

  log.info('Setting metadata for node', {
    nodeId,
    codeCount: codes.length,
    types: uniqueTypes,
    module: 'metadata_registry',
  });

  setNodeMetadataByType(nodeId, codes);
}

/**
 * Add metadata codes to a node without replacing existing ones.
 * Useful for incrementally adding metadata.
 *
 * @param nodeId - The node ID
 * @param codes - Array of metadata codes to add
 *
 * @example
 * ```typescript
 * // Add additional tags without removing existing ones
 * addMetadataToNode('node-123', [
 *   { type: 'TEC', code: 'REACT' },
 * ]);
 * ```
 */
export function addMetadataToNode(nodeId: string, codes: MetadataInput[]): void {
  if (!nodeId) {
    throw new MetadataValidationError('Node ID is required');
  }

  validateMetadataInputs(codes);

  log.debug('Adding metadata to node', {
    nodeId,
    codeCount: codes.length,
    module: 'metadata_registry',
  });

  addNodeMetadata(nodeId, codes);
}

/**
 * Get all metadata for a node.
 *
 * @param nodeId - The node ID
 * @returns Array of metadata entries
 *
 * @example
 * ```typescript
 * const metadata = getMetadataForNode('node-123');
 * // Returns: [{ type: 'ORG', code: 'ANTHROPIC', displayName: 'Anthropic', ... }, ...]
 * ```
 */
export function getMetadataForNode(nodeId: string): NodeMetadataEntry[] {
  if (!nodeId) {
    return [];
  }
  return getNodeMetadata(nodeId);
}

/**
 * Get metadata for a node filtered by type.
 *
 * @param nodeId - The node ID
 * @param type - The metadata type to filter by
 * @returns Array of metadata entries
 *
 * @example
 * ```typescript
 * const technologies = getMetadataForNodeByType('node-123', 'TEC');
 * ```
 */
export function getMetadataForNodeByType(
  nodeId: string,
  type: MetadataCodeType
): NodeMetadataEntry[] {
  if (!nodeId) {
    return [];
  }
  validateMetadataType(type);
  return getNodeMetadataByType(nodeId, type);
}

/**
 * Find all nodes that have a specific metadata code.
 *
 * @param type - The metadata type
 * @param code - The code value
 * @returns Array of node IDs
 *
 * @example
 * ```typescript
 * // Find all nodes tagged with Python
 * const nodeIds = findNodesByCode('TEC', 'PYTHON');
 * ```
 */
export function findNodesByCode(type: MetadataCodeType, code: string): string[] {
  validateMetadataType(type);
  const normalizedCode = validateCode(code);
  return getNodesByMetadataCode(type, normalizedCode);
}

/**
 * Remove a specific metadata code from a node.
 *
 * @param nodeId - The node ID
 * @param type - The metadata type
 * @param code - The code to remove
 *
 * @example
 * ```typescript
 * removeMetadataFromNode('node-123', 'TEC', 'PYTHON');
 * ```
 */
export function removeMetadataFromNode(
  nodeId: string,
  type: MetadataCodeType,
  code: string
): void {
  if (!nodeId) {
    throw new MetadataValidationError('Node ID is required');
  }

  validateMetadataType(type);
  const normalizedCode = validateCode(code);

  log.debug('Removing metadata from node', {
    nodeId,
    type,
    code: normalizedCode,
    module: 'metadata_registry',
  });

  removeNodeMetadata(nodeId, type, normalizedCode);
}

/**
 * Clear all metadata from a node.
 *
 * @param nodeId - The node ID
 *
 * @example
 * ```typescript
 * clearMetadataFromNode('node-123');
 * ```
 */
export function clearMetadataFromNode(nodeId: string): void {
  if (!nodeId) {
    throw new MetadataValidationError('Node ID is required');
  }

  log.info('Clearing all metadata from node', {
    nodeId,
    module: 'metadata_registry',
  });

  clearNodeMetadata(nodeId);
}

/**
 * Batch load metadata for multiple nodes.
 * More efficient than calling getMetadataForNode for each node.
 *
 * @param nodeIds - Array of node IDs
 * @returns Map of node ID to metadata entries
 *
 * @example
 * ```typescript
 * const metadataMap = batchGetMetadata(['node-1', 'node-2', 'node-3']);
 * const node1Metadata = metadataMap.get('node-1') || [];
 * ```
 */
export function batchGetMetadata(nodeIds: string[]): Map<string, NodeMetadataEntry[]> {
  if (!Array.isArray(nodeIds)) {
    return new Map();
  }

  const validIds = nodeIds.filter(id => id && typeof id === 'string');
  return batchLoadNodeMetadata(validIds);
}

// ============================================================
// Convenience Functions
// ============================================================

/**
 * Get metadata for a node grouped by type.
 * Useful for displaying metadata in a categorized format.
 *
 * @param nodeId - The node ID
 * @returns Map of type to metadata entries
 *
 * @example
 * ```typescript
 * const grouped = getMetadataGroupedByType('node-123');
 * const orgs = grouped.get('ORG') || [];
 * const techs = grouped.get('TEC') || [];
 * ```
 */
export function getMetadataGroupedByType(
  nodeId: string
): Map<MetadataCodeType, NodeMetadataEntry[]> {
  const metadata = getMetadataForNode(nodeId);
  const grouped = new Map<MetadataCodeType, NodeMetadataEntry[]>();

  for (const entry of metadata) {
    const existing = grouped.get(entry.type);
    if (existing) {
      existing.push(entry);
    } else {
      grouped.set(entry.type, [entry]);
    }
  }

  return grouped;
}

/**
 * Get a human-readable label for a metadata type.
 *
 * @param type - The metadata type
 * @returns Human-readable label
 *
 * @example
 * ```typescript
 * getTypeLabel('TEC'); // "Technology"
 * getTypeLabel('ORG'); // "Organization"
 * ```
 */
export function getTypeLabel(type: MetadataCodeType): string {
  return METADATA_TYPE_LABELS[type] || type;
}

/**
 * Check if a node has a specific metadata code.
 *
 * @param nodeId - The node ID
 * @param type - The metadata type
 * @param code - The code value
 * @returns True if the node has the code
 *
 * @example
 * ```typescript
 * if (nodeHasCode('node-123', 'TEC', 'PYTHON')) {
 *   console.log('Node is tagged with Python');
 * }
 * ```
 */
export function nodeHasCode(nodeId: string, type: MetadataCodeType, code: string): boolean {
  const metadata = getMetadataForNodeByType(nodeId, type);
  const normalizedCode = normalizeCode(code);
  return metadata.some(m => m.code === normalizedCode);
}

/**
 * Get summary statistics for the metadata registry.
 *
 * @returns Summary statistics
 */
export function getRegistryStats(): {
  totalCodes: number;
  codesByType: Record<string, number>;
  topCodes: CodeStats[];
} {
  const allEntries = getAllRegistryEntries();
  const stats = getCodeStats();

  const codesByType: Record<string, number> = {};
  for (const type of VALID_METADATA_CODE_TYPES) {
    codesByType[type] = allEntries.filter(e => e.type === type).length;
  }

  return {
    totalCodes: allEntries.length,
    codesByType,
    topCodes: stats.slice(0, 10),
  };
}

// ============================================================
// Normalization Re-exports
// ============================================================

export { normalizeCode, normalizeDisplayName, isValidMetadataType };
