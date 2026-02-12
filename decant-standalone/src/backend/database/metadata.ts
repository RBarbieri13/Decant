// ============================================================
// Node Metadata Database Operations
// ============================================================
//
// This module handles the database operations for node metadata,
// linking nodes to metadata codes from the registry.
//
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './connection.js';
import { withTransaction } from './transaction.js';
import { log } from '../logger/index.js';

/**
 * Metadata code types supported by the system.
 * Each type represents a different facet of categorization.
 */
export type MetadataCodeType =
  | 'SEG'  // Segment (primary hierarchy classification)
  | 'CAT'  // Category (sub-classification within segment)
  | 'TYP'  // Content Type (what kind of content)
  | 'ORG'  // Organization (company/entity)
  | 'DOM'  // Domain (field of expertise)
  | 'FNC'  // Function/Capability (what it does)
  | 'TEC'  // Technology (programming language, framework, tool)
  | 'CON'  // Concept/Theme (abstract ideas)
  | 'IND'  // Industry (sector)
  | 'AUD'  // Audience (target users)
  | 'PRC'  // Pricing (cost model)
  | 'LIC'  // License (software license)
  | 'LNG'  // Language (human language)
  | 'PLT'; // Platform (deployment target)

/**
 * Valid metadata code types for validation
 */
export const VALID_METADATA_CODE_TYPES: MetadataCodeType[] = [
  'SEG', 'CAT', 'TYP', 'ORG', 'DOM', 'FNC', 'TEC', 'CON', 'IND', 'AUD', 'PRC', 'LIC', 'LNG', 'PLT'
];

/**
 * Human-readable labels for each metadata type
 */
export const METADATA_TYPE_LABELS: Record<MetadataCodeType, string> = {
  SEG: 'Segment',
  CAT: 'Category',
  TYP: 'Content Type',
  ORG: 'Organization',
  DOM: 'Domain',
  FNC: 'Function/Capability',
  TEC: 'Technology',
  CON: 'Concept/Theme',
  IND: 'Industry',
  AUD: 'Audience',
  PRC: 'Pricing',
  LIC: 'License',
  LNG: 'Language',
  PLT: 'Platform',
};

/**
 * Registry entry from the metadata_code_registry table
 */
export interface RegistryEntry {
  id: string;
  type: MetadataCodeType;
  code: string;
  displayName: string;
  description?: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Node metadata entry from the node_metadata junction table
 */
export interface NodeMetadataEntry {
  id: string;
  nodeId: string;
  registryId: string;
  type: MetadataCodeType;
  code: string;
  displayName: string;
  confidence: number;
  source: string;
  createdAt: string;
}

/**
 * Input for setting metadata on a node
 */
export interface MetadataInput {
  type: MetadataCodeType;
  code: string;
  confidence?: number;
}

/**
 * Code statistics result
 */
export interface CodeStats {
  type: MetadataCodeType;
  code: string;
  displayName: string;
  count: number;
}

// ============================================================
// Normalization Helpers
// ============================================================

/**
 * Normalize a code to UPPERCASE, trimmed
 */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
}

/**
 * Normalize a display name to Title Case, trimmed
 */
export function normalizeDisplayName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Validate that a type is a valid MetadataCodeType
 */
export function isValidMetadataType(type: string): type is MetadataCodeType {
  return VALID_METADATA_CODE_TYPES.includes(type as MetadataCodeType);
}

// ============================================================
// Registry Operations
// ============================================================

/**
 * Get a registry entry by type and code.
 * Returns null if not found.
 */
export function getRegistryEntry(type: MetadataCodeType, code: string): RegistryEntry | null {
  const db = getDatabase();
  const normalizedCode = normalizeCode(code);

  const row = db.prepare(`
    SELECT id, type, code, display_name, description, usage_count, created_at, updated_at
    FROM metadata_code_registry
    WHERE type = ? AND code = ?
  `).get(type, normalizedCode) as any;

  if (!row) return null;

  return {
    id: row.id,
    type: row.type as MetadataCodeType,
    code: row.code,
    displayName: row.display_name,
    description: row.description,
    usageCount: row.usage_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get or create a registry entry.
 * Auto-registers new codes with normalized values.
 *
 * @param type - The metadata type
 * @param code - The code value (will be normalized to UPPERCASE)
 * @param displayName - Optional display name (will be normalized to Title Case)
 * @param description - Optional description
 * @returns The registry entry (existing or newly created)
 */
export function getOrCreateRegistryEntry(
  type: MetadataCodeType,
  code: string,
  displayName?: string,
  description?: string
): RegistryEntry {
  const db = getDatabase();
  const normalizedCode = normalizeCode(code);
  const normalizedDisplayName = displayName
    ? normalizeDisplayName(displayName)
    : normalizeDisplayName(code.replace(/_/g, ' '));

  // Check if entry exists
  const existing = getRegistryEntry(type, normalizedCode);
  if (existing) {
    return existing;
  }

  // Create new entry
  const id = uuidv4();

  db.prepare(`
    INSERT INTO metadata_code_registry (id, type, code, display_name, description, usage_count)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(id, type, normalizedCode, normalizedDisplayName, description || null);

  log.debug('Created new metadata registry entry', {
    type,
    code: normalizedCode,
    displayName: normalizedDisplayName,
    module: 'metadata',
  });

  return {
    id,
    type,
    code: normalizedCode,
    displayName: normalizedDisplayName,
    description,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get all registry entries of a specific type.
 * Results are sorted by usage count (descending) then by display name.
 */
export function getCodesByType(type: MetadataCodeType): RegistryEntry[] {
  const db = getDatabase();

  const rows = db.prepare(`
    SELECT id, type, code, display_name, description, usage_count, created_at, updated_at
    FROM metadata_code_registry
    WHERE type = ?
    ORDER BY usage_count DESC, display_name ASC
  `).all(type) as any[];

  return rows.map(row => ({
    id: row.id,
    type: row.type as MetadataCodeType,
    code: row.code,
    displayName: row.display_name,
    description: row.description,
    usageCount: row.usage_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Get all registry entries.
 * Results are sorted by type, then by usage count (descending).
 */
export function getAllRegistryEntries(): RegistryEntry[] {
  const db = getDatabase();

  const rows = db.prepare(`
    SELECT id, type, code, display_name, description, usage_count, created_at, updated_at
    FROM metadata_code_registry
    ORDER BY type ASC, usage_count DESC, display_name ASC
  `).all() as any[];

  return rows.map(row => ({
    id: row.id,
    type: row.type as MetadataCodeType,
    code: row.code,
    displayName: row.display_name,
    description: row.description,
    usageCount: row.usage_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Search registry entries by query string.
 * Searches across code and display_name fields.
 *
 * @param query - Search query string
 * @param type - Optional type filter
 * @returns Matching registry entries
 */
export function searchCodes(query: string, type?: MetadataCodeType): RegistryEntry[] {
  const db = getDatabase();
  const searchPattern = `%${query.trim()}%`;

  let sql = `
    SELECT id, type, code, display_name, description, usage_count, created_at, updated_at
    FROM metadata_code_registry
    WHERE (code LIKE ? OR display_name LIKE ?)
  `;
  const params: any[] = [searchPattern, searchPattern];

  if (type) {
    sql += ` AND type = ?`;
    params.push(type);
  }

  sql += ` ORDER BY usage_count DESC, display_name ASC LIMIT 50`;

  const rows = db.prepare(sql).all(...params) as any[];

  return rows.map(row => ({
    id: row.id,
    type: row.type as MetadataCodeType,
    code: row.code,
    displayName: row.display_name,
    description: row.description,
    usageCount: row.usage_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Increment the usage count for a registry entry.
 * Called when a code is assigned to a node.
 */
export function incrementCodeUsage(registryId: string): void {
  const db = getDatabase();

  db.prepare(`
    UPDATE metadata_code_registry
    SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(registryId);
}

/**
 * Decrement the usage count for a registry entry.
 * Called when a code is removed from a node.
 */
export function decrementCodeUsage(registryId: string): void {
  const db = getDatabase();

  db.prepare(`
    UPDATE metadata_code_registry
    SET usage_count = MAX(0, usage_count - 1), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(registryId);
}

/**
 * Get usage statistics for codes.
 * Returns codes with their actual node counts.
 *
 * @param type - Optional type filter
 * @returns Array of code statistics
 */
export function getCodeStats(type?: MetadataCodeType): CodeStats[] {
  const db = getDatabase();

  let sql = `
    SELECT r.type, r.code, r.display_name, COUNT(nm.id) as count
    FROM metadata_code_registry r
    LEFT JOIN node_metadata nm ON r.id = nm.registry_id
  `;
  const params: any[] = [];

  if (type) {
    sql += ` WHERE r.type = ?`;
    params.push(type);
  }

  sql += `
    GROUP BY r.id
    HAVING count > 0
    ORDER BY count DESC, r.display_name ASC
  `;

  const rows = db.prepare(sql).all(...params) as any[];

  return rows.map(row => ({
    type: row.type as MetadataCodeType,
    code: row.code,
    displayName: row.display_name,
    count: row.count,
  }));
}

// ============================================================
// Node Metadata Operations
// ============================================================

/**
 * Set metadata codes for a node.
 * Replaces existing metadata of the same types with new values.
 * Handles usage count tracking automatically.
 *
 * @param nodeId - The node ID
 * @param codes - Array of metadata codes to set
 */
export function setNodeMetadata(
  nodeId: string,
  codes: MetadataInput[]
): void {
  const db = getDatabase();

  withTransaction(() => {
    // Get types being updated
    const typesBeingSet = new Set(codes.map(c => c.type));

    // Get existing metadata for these types (to decrement usage counts)
    const existingForTypes: { registryId: string }[] = [];
    if (typesBeingSet.size > 0) {
      const typesList = Array.from(typesBeingSet);
      const placeholders = typesList.map(() => '?').join(', ');
      const rows = db.prepare(`
        SELECT nm.registry_id
        FROM node_metadata nm
        JOIN metadata_code_registry r ON nm.registry_id = r.id
        WHERE nm.node_id = ? AND r.type IN (${placeholders})
      `).all(nodeId, ...typesList) as { registry_id: string }[];

      existingForTypes.push(...rows.map(r => ({ registryId: r.registry_id })));
    }

    // Decrement usage counts for removed codes
    for (const existing of existingForTypes) {
      decrementCodeUsage(existing.registryId);
    }

    // Delete existing metadata for these types
    if (typesBeingSet.size > 0) {
      const typesList = Array.from(typesBeingSet);
      const placeholders = typesList.map(() => '?').join(', ');
      db.prepare(`
        DELETE FROM node_metadata
        WHERE node_id = ? AND registry_id IN (
          SELECT id FROM metadata_code_registry WHERE type IN (${placeholders})
        )
      `).run(nodeId, ...typesList);
    }

    // Insert new metadata
    const insertStmt = db.prepare(`
      INSERT INTO node_metadata (id, node_id, registry_id, confidence, source)
      VALUES (?, ?, ?, ?, 'ai')
    `);

    for (const input of codes) {
      // Get or create registry entry
      const entry = getOrCreateRegistryEntry(input.type, input.code);

      // Insert node metadata link
      insertStmt.run(
        uuidv4(),
        nodeId,
        entry.id,
        input.confidence ?? 1.0
      );

      // Increment usage count
      incrementCodeUsage(entry.id);
    }

    log.debug('Set node metadata', {
      nodeId,
      codeCount: codes.length,
      types: Array.from(typesBeingSet),
      module: 'metadata',
    });
  });
}

/**
 * Add metadata codes to a node without replacing existing ones.
 * Useful for incrementally adding metadata.
 *
 * @param nodeId - The node ID
 * @param codes - Array of metadata codes to add
 */
export function addNodeMetadata(
  nodeId: string,
  codes: MetadataInput[]
): void {
  const db = getDatabase();

  withTransaction(() => {
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO node_metadata (id, node_id, registry_id, confidence, source)
      VALUES (?, ?, ?, ?, 'ai')
    `);

    for (const input of codes) {
      // Get or create registry entry
      const entry = getOrCreateRegistryEntry(input.type, input.code);

      // Check if already linked
      const existing = db.prepare(`
        SELECT id FROM node_metadata WHERE node_id = ? AND registry_id = ?
      `).get(nodeId, entry.id);

      if (!existing) {
        // Insert node metadata link
        insertStmt.run(
          uuidv4(),
          nodeId,
          entry.id,
          input.confidence ?? 1.0
        );

        // Increment usage count
        incrementCodeUsage(entry.id);
      }
    }

    log.debug('Added node metadata', {
      nodeId,
      codeCount: codes.length,
      module: 'metadata',
    });
  });
}

/**
 * Get all metadata for a node.
 * Returns metadata entries with registry details.
 */
export function getNodeMetadata(nodeId: string): NodeMetadataEntry[] {
  const db = getDatabase();

  const rows = db.prepare(`
    SELECT
      nm.id,
      nm.node_id,
      nm.registry_id,
      nm.confidence,
      nm.source,
      nm.created_at,
      r.type,
      r.code,
      r.display_name
    FROM node_metadata nm
    JOIN metadata_code_registry r ON nm.registry_id = r.id
    WHERE nm.node_id = ?
    ORDER BY r.type ASC, r.display_name ASC
  `).all(nodeId) as any[];

  return rows.map(row => ({
    id: row.id,
    nodeId: row.node_id,
    registryId: row.registry_id,
    type: row.type as MetadataCodeType,
    code: row.code,
    displayName: row.display_name,
    confidence: row.confidence,
    source: row.source,
    createdAt: row.created_at,
  }));
}

/**
 * Get metadata for a node filtered by type.
 */
export function getNodeMetadataByType(
  nodeId: string,
  type: MetadataCodeType
): NodeMetadataEntry[] {
  const db = getDatabase();

  const rows = db.prepare(`
    SELECT
      nm.id,
      nm.node_id,
      nm.registry_id,
      nm.confidence,
      nm.source,
      nm.created_at,
      r.type,
      r.code,
      r.display_name
    FROM node_metadata nm
    JOIN metadata_code_registry r ON nm.registry_id = r.id
    WHERE nm.node_id = ? AND r.type = ?
    ORDER BY r.display_name ASC
  `).all(nodeId, type) as any[];

  return rows.map(row => ({
    id: row.id,
    nodeId: row.node_id,
    registryId: row.registry_id,
    type: row.type as MetadataCodeType,
    code: row.code,
    displayName: row.display_name,
    confidence: row.confidence,
    source: row.source,
    createdAt: row.created_at,
  }));
}

/**
 * Get all nodes that have a specific metadata code.
 *
 * @param type - The metadata type
 * @param code - The code value
 * @returns Array of node IDs
 */
export function getNodesByMetadataCode(type: MetadataCodeType, code: string): string[] {
  const db = getDatabase();
  const normalizedCode = normalizeCode(code);

  const rows = db.prepare(`
    SELECT nm.node_id
    FROM node_metadata nm
    JOIN metadata_code_registry r ON nm.registry_id = r.id
    WHERE r.type = ? AND r.code = ?
  `).all(type, normalizedCode) as { node_id: string }[];

  return rows.map(row => row.node_id);
}

/**
 * Remove a specific metadata code from a node.
 *
 * @param nodeId - The node ID
 * @param type - The metadata type
 * @param code - The code value to remove
 */
export function removeNodeMetadata(
  nodeId: string,
  type: MetadataCodeType,
  code: string
): void {
  const db = getDatabase();
  const normalizedCode = normalizeCode(code);

  withTransaction(() => {
    // Get the registry entry ID
    const entry = getRegistryEntry(type, normalizedCode);
    if (!entry) return;

    // Check if the link exists
    const existing = db.prepare(`
      SELECT id FROM node_metadata WHERE node_id = ? AND registry_id = ?
    `).get(nodeId, entry.id) as { id: string } | undefined;

    if (existing) {
      // Delete the link
      db.prepare(`
        DELETE FROM node_metadata WHERE id = ?
      `).run(existing.id);

      // Decrement usage count
      decrementCodeUsage(entry.id);

      log.debug('Removed node metadata', {
        nodeId,
        type,
        code: normalizedCode,
        module: 'metadata',
      });
    }
  });
}

/**
 * Clear all metadata for a node.
 *
 * @param nodeId - The node ID
 */
export function clearNodeMetadata(nodeId: string): void {
  const db = getDatabase();

  withTransaction(() => {
    // Get all registry IDs for this node
    const existing = db.prepare(`
      SELECT registry_id FROM node_metadata WHERE node_id = ?
    `).all(nodeId) as { registry_id: string }[];

    // Decrement usage counts
    for (const row of existing) {
      decrementCodeUsage(row.registry_id);
    }

    // Delete all metadata links
    db.prepare(`
      DELETE FROM node_metadata WHERE node_id = ?
    `).run(nodeId);

    log.debug('Cleared all node metadata', {
      nodeId,
      removedCount: existing.length,
      module: 'metadata',
    });
  });
}

/**
 * Batch load metadata for multiple nodes.
 * Efficient for loading metadata when listing nodes.
 *
 * @param nodeIds - Array of node IDs
 * @returns Map of node ID to metadata entries
 */
export function batchLoadNodeMetadata(
  nodeIds: string[]
): Map<string, NodeMetadataEntry[]> {
  const result = new Map<string, NodeMetadataEntry[]>();

  if (nodeIds.length === 0) return result;

  const db = getDatabase();
  const placeholders = nodeIds.map(() => '?').join(', ');

  const rows = db.prepare(`
    SELECT
      nm.id,
      nm.node_id,
      nm.registry_id,
      nm.confidence,
      nm.source,
      nm.created_at,
      r.type,
      r.code,
      r.display_name
    FROM node_metadata nm
    JOIN metadata_code_registry r ON nm.registry_id = r.id
    WHERE nm.node_id IN (${placeholders})
    ORDER BY nm.node_id, r.type ASC, r.display_name ASC
  `).all(...nodeIds) as any[];

  // Group by node ID
  for (const row of rows) {
    const entry: NodeMetadataEntry = {
      id: row.id,
      nodeId: row.node_id,
      registryId: row.registry_id,
      type: row.type as MetadataCodeType,
      code: row.code,
      displayName: row.display_name,
      confidence: row.confidence,
      source: row.source,
      createdAt: row.created_at,
    };

    const existing = result.get(row.node_id);
    if (existing) {
      existing.push(entry);
    } else {
      result.set(row.node_id, [entry]);
    }
  }

  return result;
}
