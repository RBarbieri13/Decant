// ============================================================
// Node Operations
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './connection.js';
import { withTransaction } from './transaction.js';
import {
  PaginationParams,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  calculateOffset,
} from '../types/pagination.js';
import * as cache from '../cache/index.js';

export interface CreateNodeInput {
  title: string;
  url: string;
  source_domain: string;
  company?: string;
  phrase_description?: string;
  short_description?: string;
  logo_url?: string;
  ai_summary?: string;
  extracted_fields?: Record<string, unknown>;
  metadata_tags?: string[];
  key_concepts?: string[];
  function_parent_id?: string | null;
  organization_parent_id?: string | null;
}

export interface UpdateNodeInput {
  title?: string;
  company?: string;
  phrase_description?: string;
  short_description?: string;
  logo_url?: string;
  ai_summary?: string;
  extracted_fields?: Record<string, unknown>;
  metadata_tags?: string[];
  key_concepts?: string[];
  function_parent_id?: string | null;
  organization_parent_id?: string | null;
}

/**
 * Input for Phase 2 enrichment updates
 * All fields that the Phase 2 enricher should populate
 */
export interface Phase2UpdateInput {
  /** Cleaned/improved title (max 500 chars) */
  title?: string;
  /** Organization behind the content */
  company?: string;
  /** Ultra-brief tagline (max 100 chars) */
  phrase_description?: string;
  /** 1-3 sentences (max 500 chars) */
  short_description?: string;
  /** Longer AI-generated summary */
  ai_summary?: string;
  /** Array of lowercase tags (max 20) */
  key_concepts?: string[];
  /** Extract favicon or logo from page */
  logo_url?: string;
  /** Basic tag array */
  metadata_tags?: string[];
  /** Descriptor string for full-text search */
  descriptor_string?: string;
  /** Metadata codes for faceted classification */
  metadata_codes?: Record<string, string[]>;
}

/**
 * Input for batch updating hierarchy codes on multiple nodes
 */
export interface HierarchyCodeUpdate {
  /** Node ID to update */
  nodeId: string;
  /** New function hierarchy code (null to clear) */
  functionCode?: string | null;
  /** New organization hierarchy code (null to clear) */
  organizationCode?: string | null;
  /** New segment code */
  segmentCode?: string | null;
  /** New category code */
  categoryCode?: string | null;
  /** New content type code */
  contentTypeCode?: string | null;
}

/**
 * Result of a batch hierarchy code update
 */
export interface BatchUpdateResult {
  /** Number of nodes successfully updated */
  updatedCount: number;
  /** Node IDs that were updated */
  updatedNodeIds: string[];
  /** Any errors encountered (nodeId -> error message) */
  errors: Map<string, string>;
}

export function createNode(data: CreateNodeInput): unknown {
  const db = getDatabase();
  const id = uuidv4();

  // Wrap entire node creation in a transaction
  // If any insert fails, the entire operation rolls back
  const result = withTransaction(() => {
    const stmt = db.prepare(`
      INSERT INTO nodes (
        id, title, url, source_domain, company, phrase_description,
        short_description, logo_url, ai_summary, extracted_fields,
        metadata_tags, function_parent_id, organization_parent_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.title,
      data.url,
      data.source_domain,
      data.company || null,
      data.phrase_description || null,
      data.short_description || null,
      data.logo_url || null,
      data.ai_summary || null,
      JSON.stringify(data.extracted_fields || {}),
      JSON.stringify(data.metadata_tags || []),
      data.function_parent_id || null,
      data.organization_parent_id || null
    );

    // Insert key concepts (within same transaction)
    if (data.key_concepts && data.key_concepts.length > 0) {
      const conceptStmt = db.prepare(`
        INSERT INTO key_concepts (id, node_id, concept) VALUES (?, ?, ?)
      `);
      for (const concept of data.key_concepts) {
        conceptStmt.run(uuidv4(), id, concept);
      }
    }

    return readNode(id);
  });

  // Invalidate tree cache after successful creation
  cache.invalidate('tree:*');

  return result;
}

export function readNode(id: string): Record<string, unknown> | null {
  const db = getDatabase();

  const node = db.prepare(`
    SELECT * FROM nodes WHERE id = ? AND is_deleted = 0
  `).get(id) as Record<string, unknown> | undefined;

  if (!node) return null;

  const concepts = db.prepare(`
    SELECT concept FROM key_concepts WHERE node_id = ?
  `).all(id) as Array<{ concept: string }>;

  return {
    ...node,
    extracted_fields: JSON.parse((node.extracted_fields as string) || '{}'),
    metadata_tags: JSON.parse((node.metadata_tags as string) || '[]'),
    key_concepts: concepts.map(c => c.concept),
  };
}

export function updateNode(id: string, data: UpdateNodeInput): unknown {
  const db = getDatabase();

  const updates: string[] = [];
  const values: unknown[] = [];

  if (data.title !== undefined) {
    updates.push('title = ?');
    values.push(data.title);
  }
  if (data.company !== undefined) {
    updates.push('company = ?');
    values.push(data.company);
  }
  if (data.phrase_description !== undefined) {
    updates.push('phrase_description = ?');
    values.push(data.phrase_description);
  }
  if (data.short_description !== undefined) {
    updates.push('short_description = ?');
    values.push(data.short_description);
  }
  if (data.logo_url !== undefined) {
    updates.push('logo_url = ?');
    values.push(data.logo_url);
  }
  if (data.ai_summary !== undefined) {
    updates.push('ai_summary = ?');
    values.push(data.ai_summary);
  }
  if (data.extracted_fields !== undefined) {
    updates.push('extracted_fields = ?');
    values.push(JSON.stringify(data.extracted_fields));
  }
  if (data.metadata_tags !== undefined) {
    updates.push('metadata_tags = ?');
    values.push(JSON.stringify(data.metadata_tags));
  }
  if (data.function_parent_id !== undefined) {
    updates.push('function_parent_id = ?');
    values.push(data.function_parent_id);
  }
  if (data.organization_parent_id !== undefined) {
    updates.push('organization_parent_id = ?');
    values.push(data.organization_parent_id);
  }

  // If no updates to the node itself and no key_concepts update, just return current state
  if (updates.length === 0 && data.key_concepts === undefined) {
    return readNode(id);
  }

  // Wrap entire update operation in a transaction
  // This ensures node update and key_concepts update are atomic
  const result = withTransaction(() => {
    // Update node fields if any
    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      const sql = `UPDATE nodes SET ${updates.join(', ')} WHERE id = ?`;
      db.prepare(sql).run(...values);
    }

    // Update key concepts if provided (within same transaction)
    if (data.key_concepts !== undefined) {
      db.prepare('DELETE FROM key_concepts WHERE node_id = ?').run(id);
      const conceptStmt = db.prepare(`
        INSERT INTO key_concepts (id, node_id, concept) VALUES (?, ?, ?)
      `);
      for (const concept of data.key_concepts) {
        conceptStmt.run(uuidv4(), id, concept);
      }
    }

    return readNode(id);
  });

  // Invalidate tree cache if parent relationships changed
  if (data.function_parent_id !== undefined || data.organization_parent_id !== undefined) {
    cache.invalidate('tree:*');
  }

  return result;
}

/**
 * Update a node with Phase 2 enrichment data.
 * This function merges extracted_fields instead of replacing them,
 * ensuring existing data is preserved while adding Phase 2 metadata.
 *
 * @param id - Node ID to update
 * @param data - Phase 2 enrichment data
 * @returns Updated node or null if not found
 */
export function updateNodePhase2(id: string, data: Phase2UpdateInput): unknown {
  const db = getDatabase();

  // First, read the existing node to get current extracted_fields
  const existingNode = readNode(id);
  if (!existingNode) {
    return null;
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  // 1. Title - Cleaned/improved title (max 500 chars)
  if (data.title !== undefined) {
    updates.push('title = ?');
    values.push(data.title.slice(0, 500));
  }

  // 2. Company - Organization behind the content
  if (data.company !== undefined) {
    updates.push('company = ?');
    values.push(data.company.slice(0, 200));
  }

  // 3. Phrase Description - Ultra-brief tagline (max 100 chars)
  if (data.phrase_description !== undefined) {
    updates.push('phrase_description = ?');
    values.push(data.phrase_description.slice(0, 100));
  }

  // 4. Short Description - 1-3 sentences (max 500 chars)
  if (data.short_description !== undefined) {
    updates.push('short_description = ?');
    values.push(data.short_description.slice(0, 500));
  }

  // 5. AI Summary - Longer AI-generated summary
  if (data.ai_summary !== undefined) {
    updates.push('ai_summary = ?');
    values.push(data.ai_summary.slice(0, 2000));
  }

  // 7. Logo URL - Extract favicon or logo from page
  if (data.logo_url !== undefined) {
    updates.push('logo_url = ?');
    values.push(data.logo_url);
  }

  // 8. Metadata Tags - Basic tag array
  if (data.metadata_tags !== undefined) {
    updates.push('metadata_tags = ?');
    values.push(JSON.stringify(data.metadata_tags.slice(0, 10)));
  }

  // Merge extracted_fields with existing data
  // This ensures we don't lose any existing Phase 1 or other data
  const existingFields = (existingNode.extracted_fields as Record<string, unknown>) || {};
  const mergedExtractedFields: Record<string, unknown> = {
    ...existingFields,
    // Add Phase 2 specific fields
    phase2Completed: true,
    phase2CompletedAt: new Date().toISOString(),
    phase2Version: '2.0',
  };

  // 9. Descriptor String - Concatenated searchable text
  if (data.descriptor_string !== undefined) {
    mergedExtractedFields.descriptorString = data.descriptor_string;
  }

  // Add metadata codes if provided
  if (data.metadata_codes !== undefined) {
    mergedExtractedFields.metadataCodes = data.metadata_codes;
  }

  updates.push('extracted_fields = ?');
  values.push(JSON.stringify(mergedExtractedFields));

  // Always update timestamp
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  // Wrap in transaction with key_concepts update
  const result = withTransaction(() => {
    // Update node fields
    const sql = `UPDATE nodes SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...values);

    // 6. Key Concepts - Array of lowercase tags (max 20)
    if (data.key_concepts !== undefined) {
      db.prepare('DELETE FROM key_concepts WHERE node_id = ?').run(id);
      const conceptStmt = db.prepare(`
        INSERT INTO key_concepts (id, node_id, concept) VALUES (?, ?, ?)
      `);
      const concepts = data.key_concepts.slice(0, 20);
      for (const concept of concepts) {
        const normalizedConcept = concept.toLowerCase().trim();
        if (normalizedConcept.length > 0) {
          conceptStmt.run(uuidv4(), id, normalizedConcept);
        }
      }
    }

    return readNode(id);
  });

  return result;
}

export function deleteNode(id: string): void {
  const db = getDatabase();
  db.prepare('UPDATE nodes SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

  // Invalidate tree cache after deletion
  cache.invalidate('tree:*');
}

export function getAllNodes(): unknown[] {
  const db = getDatabase();

  // Step 1: Get all nodes in one query
  const nodes = db.prepare(`
    SELECT * FROM nodes WHERE is_deleted = 0 ORDER BY date_added DESC
  `).all() as Array<Record<string, unknown>>;

  if (nodes.length === 0) return [];

  // Step 2: Collect all node IDs
  const nodeIds = nodes.map(n => n.id as string);

  // Step 3: Batch load all key concepts in one query
  const conceptsMap = batchLoadKeyConcepts(nodeIds);

  // Step 4: Map over nodes and attach concepts from the Map
  return nodes.map(node => ({
    ...node,
    extracted_fields: JSON.parse((node.extracted_fields as string) || '{}'),
    metadata_tags: JSON.parse((node.metadata_tags as string) || '[]'),
    key_concepts: conceptsMap.get(node.id as string) || [],
  }));
}

/**
 * Batch load key concepts for multiple nodes in a single query.
 * Returns a Map of nodeId -> concept[]
 */
export function batchLoadKeyConcepts(nodeIds: string[]): Map<string, string[]> {
  const conceptsMap = new Map<string, string[]>();

  if (nodeIds.length === 0) return conceptsMap;

  const db = getDatabase();

  // Use placeholders for the IN clause
  const placeholders = nodeIds.map(() => '?').join(', ');
  const concepts = db.prepare(`
    SELECT node_id, concept FROM key_concepts WHERE node_id IN (${placeholders})
  `).all(...nodeIds) as { node_id: string; concept: string }[];

  // Build the Map: nodeId -> concept[]
  for (const { node_id, concept } of concepts) {
    const existing = conceptsMap.get(node_id);
    if (existing) {
      existing.push(concept);
    } else {
      conceptsMap.set(node_id, [concept]);
    }
  }

  return conceptsMap;
}

/**
 * Efficiently load multiple nodes by ID with batch-loaded key concepts.
 * This avoids N+1 queries when loading multiple nodes.
 */
export function readNodes(ids: string[]): unknown[] {
  if (ids.length === 0) return [];

  const db = getDatabase();

  // Step 1: Load all requested nodes in one query
  const placeholders = ids.map(() => '?').join(', ');
  const nodes = db.prepare(`
    SELECT * FROM nodes WHERE id IN (${placeholders}) AND is_deleted = 0
  `).all(...ids) as Array<Record<string, unknown>>;

  if (nodes.length === 0) return [];

  // Step 2: Batch load all key concepts
  const nodeIds = nodes.map(n => n.id as string);
  const conceptsMap = batchLoadKeyConcepts(nodeIds);

  // Step 3: Transform and return
  return nodes.map(node => ({
    ...node,
    extracted_fields: JSON.parse((node.extracted_fields as string) || '{}'),
    metadata_tags: JSON.parse((node.metadata_tags as string) || '[]'),
    key_concepts: conceptsMap.get(node.id as string) || [],
  }));
}

export function getNodeById(id: string): unknown {
  return readNode(id);
}

/**
 * Count total number of non-deleted nodes
 */
export function countNodes(): number {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM nodes WHERE is_deleted = 0
  `).get() as { count: number };
  return result.count;
}

/**
 * Get nodes with pagination support
 * @param options - Optional pagination parameters (page and limit)
 * @returns Array of nodes for the requested page
 */
export function getNodesPaginated(options?: Partial<PaginationParams>): unknown[] {
  const db = getDatabase();

  const page = options?.page ?? DEFAULT_PAGE;
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const offset = calculateOffset(page, limit);

  // Step 1: Get paginated nodes
  const nodes = db.prepare(`
    SELECT * FROM nodes
    WHERE is_deleted = 0
    ORDER BY date_added DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as Array<Record<string, unknown>>;

  if (nodes.length === 0) return [];

  // Step 2: Collect all node IDs
  const nodeIds = nodes.map(n => n.id as string);

  // Step 3: Batch load all key concepts in one query
  const conceptsMap = batchLoadKeyConcepts(nodeIds);

  // Step 4: Map over nodes and attach concepts from the Map
  return nodes.map(node => ({
    ...node,
    extracted_fields: JSON.parse((node.extracted_fields as string) || '{}'),
    metadata_tags: JSON.parse((node.metadata_tags as string) || '[]'),
    key_concepts: conceptsMap.get(node.id as string) || [],
  }));
}

/**
 * Merge options for combining two nodes
 */
export interface MergeNodesOptions {
  keepMetadata?: boolean;
  appendSummary?: boolean;
}

/**
 * Merge two nodes atomically within a transaction.
 * The secondary node's data is optionally merged into the primary node,
 * then the secondary node is soft-deleted.
 *
 * @param primaryId - The ID of the node to keep
 * @param secondaryId - The ID of the node to merge and delete
 * @param options - Options for how to merge the data
 * @returns The updated primary node, or null if either node doesn't exist
 */
export function mergeNodes(
  primaryId: string,
  secondaryId: string,
  options?: MergeNodesOptions
): unknown {
  const db = getDatabase();

  // Wrap the entire merge operation in a transaction
  // This ensures the primary update and secondary delete are atomic
  return withTransaction(() => {
    // Get both nodes
    const primaryNode = readNode(primaryId);
    const secondaryNode = readNode(secondaryId);

    if (!primaryNode || !secondaryNode) {
      return null;
    }

    // Prepare merged data
    const mergedData: Record<string, unknown> = {};

    // Optionally merge metadata tags
    if (options?.keepMetadata && secondaryNode.metadata_tags) {
      mergedData.metadata_tags = [
        ...((primaryNode.metadata_tags as string[]) || []),
        ...(secondaryNode.metadata_tags as string[]),
      ];
    }

    // Optionally append AI summary
    if (options?.appendSummary && secondaryNode.ai_summary) {
      mergedData.ai_summary =
        ((primaryNode.ai_summary as string) || '') + '\n' + secondaryNode.ai_summary;
    }

    // Update the primary node if there are changes
    if (Object.keys(mergedData).length > 0) {
      // Perform direct update within transaction (not calling updateNode to avoid nested transaction)
      const updates: string[] = [];
      const values: unknown[] = [];

      if (mergedData.metadata_tags !== undefined) {
        updates.push('metadata_tags = ?');
        values.push(JSON.stringify(mergedData.metadata_tags));
      }
      if (mergedData.ai_summary !== undefined) {
        updates.push('ai_summary = ?');
        values.push(mergedData.ai_summary);
      }

      if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(primaryId);
        const sql = `UPDATE nodes SET ${updates.join(', ')} WHERE id = ?`;
        db.prepare(sql).run(...values);
      }
    }

    // Soft-delete the secondary node
    db.prepare(
      'UPDATE nodes SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(secondaryId);

    // Invalidate tree cache after merge
    cache.invalidate('tree:*');

    // Return the updated primary node
    return readNode(primaryId);
  });
}

// ============================================================
// Batch Hierarchy Code Operations
// ============================================================

/**
 * Batch update hierarchy codes for multiple nodes atomically.
 * All updates are performed in a single transaction - if any update fails,
 * all changes are rolled back.
 *
 * This function is designed to be called by the hierarchy restructure service
 * when conflicts need to be resolved by updating multiple nodes at once.
 *
 * @param updates - Array of hierarchy code updates to apply
 * @returns Result with count of updated nodes and any errors
 *
 * @example
 * ```typescript
 * const updates: HierarchyCodeUpdate[] = [
 *   { nodeId: 'abc123', functionCode: 'A.LLM.T.1', organizationCode: 'ANTH.LLM.T.1' },
 *   { nodeId: 'def456', functionCode: 'A.LLM.T.2', organizationCode: 'OAIA.LLM.T.1' },
 * ];
 *
 * const result = batchUpdateHierarchyCodes(updates);
 * console.log(`Updated ${result.updatedCount} nodes`);
 * ```
 */
export function batchUpdateHierarchyCodes(updates: HierarchyCodeUpdate[]): BatchUpdateResult {
  const db = getDatabase();
  const result: BatchUpdateResult = {
    updatedCount: 0,
    updatedNodeIds: [],
    errors: new Map(),
  };

  if (updates.length === 0) {
    return result;
  }

  // Validate all node IDs exist before starting transaction
  const nodeIds = updates.map(u => u.nodeId);
  const placeholders = nodeIds.map(() => '?').join(', ');
  const existingNodes = db.prepare(`
    SELECT id FROM nodes WHERE id IN (${placeholders}) AND is_deleted = 0
  `).all(...nodeIds) as Array<{ id: string }>;

  const existingNodeIds = new Set(existingNodes.map(n => n.id));
  const missingNodeIds = nodeIds.filter(id => !existingNodeIds.has(id));

  // Record errors for missing nodes
  for (const missingId of missingNodeIds) {
    result.errors.set(missingId, `Node not found: ${missingId}`);
  }

  // Filter to only valid updates
  const validUpdates = updates.filter(u => existingNodeIds.has(u.nodeId));

  if (validUpdates.length === 0) {
    return result;
  }

  // Execute all updates in a transaction
  withTransaction(() => {
    // Prepare statements for different update combinations
    const fullUpdateStmt = db.prepare(`
      UPDATE nodes SET
        function_hierarchy_code = ?,
        organization_hierarchy_code = ?,
        segment_code = ?,
        category_code = ?,
        content_type_code = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const hierarchyOnlyStmt = db.prepare(`
      UPDATE nodes SET
        function_hierarchy_code = ?,
        organization_hierarchy_code = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    for (const update of validUpdates) {
      try {
        // Check which fields are being updated
        const hasClassificationCodes =
          update.segmentCode !== undefined ||
          update.categoryCode !== undefined ||
          update.contentTypeCode !== undefined;

        if (hasClassificationCodes) {
          // Full update including classification codes
          fullUpdateStmt.run(
            update.functionCode ?? null,
            update.organizationCode ?? null,
            update.segmentCode ?? null,
            update.categoryCode ?? null,
            update.contentTypeCode ?? null,
            update.nodeId
          );
        } else {
          // Only update hierarchy codes
          hierarchyOnlyStmt.run(
            update.functionCode ?? null,
            update.organizationCode ?? null,
            update.nodeId
          );
        }

        result.updatedCount++;
        result.updatedNodeIds.push(update.nodeId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.set(update.nodeId, `Update failed: ${message}`);
      }
    }
  });

  // Invalidate tree cache after batch update
  if (result.updatedCount > 0) {
    cache.invalidate('tree:*');
  }

  return result;
}

/**
 * Update a single node's hierarchy codes.
 * This is a convenience wrapper around batchUpdateHierarchyCodes for single-node updates.
 *
 * @param nodeId - The node ID to update
 * @param functionCode - New function hierarchy code
 * @param organizationCode - New organization hierarchy code
 * @returns True if update succeeded, false otherwise
 */
export function updateNodeHierarchyCodes(
  nodeId: string,
  functionCode: string | null,
  organizationCode: string | null
): boolean {
  const result = batchUpdateHierarchyCodes([
    { nodeId, functionCode, organizationCode },
  ]);

  return result.updatedCount === 1;
}

/**
 * Clear hierarchy codes for a node.
 * Useful when a node is being reclassified and needs fresh codes generated.
 *
 * @param nodeId - The node ID to clear codes for
 * @returns True if update succeeded, false otherwise
 */
export function clearNodeHierarchyCodes(nodeId: string): boolean {
  return updateNodeHierarchyCodes(nodeId, null, null);
}

/**
 * Get nodes that have duplicate hierarchy codes.
 * This is useful for debugging and validation.
 *
 * @param hierarchyType - Which hierarchy type to check ('function' or 'organization')
 * @returns Array of code/nodeIds pairs where duplicates exist
 */
export function findDuplicateHierarchyCodes(
  hierarchyType: 'function' | 'organization'
): Array<{ code: string; nodeIds: string[] }> {
  const db = getDatabase();
  const codeColumn = hierarchyType === 'function'
    ? 'function_hierarchy_code'
    : 'organization_hierarchy_code';

  const duplicates = db.prepare(`
    SELECT ${codeColumn} as code, GROUP_CONCAT(id) as node_ids
    FROM nodes
    WHERE is_deleted = 0
      AND ${codeColumn} IS NOT NULL
    GROUP BY ${codeColumn}
    HAVING COUNT(*) > 1
  `).all() as Array<{ code: string; node_ids: string }>;

  return duplicates.map(d => ({
    code: d.code,
    nodeIds: d.node_ids.split(','),
  }));
}

/**
 * Get nodes at a specific hierarchy position.
 * Useful for finding siblings that may need restructuring.
 *
 * @param segmentCode - Segment code
 * @param categoryCode - Category code
 * @param contentTypeCode - Content type code
 * @param parentId - Parent node ID (null for root nodes)
 * @param hierarchyType - Which hierarchy's parent to check
 * @returns Array of node IDs at this position
 */
export function getNodesAtPosition(
  segmentCode: string | null,
  categoryCode: string | null,
  contentTypeCode: string | null,
  parentId: string | null,
  hierarchyType: 'function' | 'organization'
): string[] {
  const db = getDatabase();
  const parentField = hierarchyType === 'function'
    ? 'function_parent_id'
    : 'organization_parent_id';

  const nodes = db.prepare(`
    SELECT id FROM nodes
    WHERE is_deleted = 0
      AND (segment_code = ? OR (segment_code IS NULL AND ? IS NULL))
      AND (category_code = ? OR (category_code IS NULL AND ? IS NULL))
      AND (content_type_code = ? OR (content_type_code IS NULL AND ? IS NULL))
      AND (${parentField} = ? OR (${parentField} IS NULL AND ? IS NULL))
  `).all(
    segmentCode, segmentCode,
    categoryCode, categoryCode,
    contentTypeCode, contentTypeCode,
    parentId, parentId
  ) as Array<{ id: string }>;

  return nodes.map(n => n.id);
}

/**
 * Get nodes that need Phase 2 enrichment.
 * Returns nodes that haven't been enriched yet or failed previous enrichment.
 *
 * @param limit - Maximum number of nodes to return
 * @returns Array of node IDs needing enrichment
 */
export function getNodesNeedingPhase2Enrichment(limit: number = 50): string[] {
  const db = getDatabase();

  // Find nodes where Phase 2 hasn't been completed
  // Check extracted_fields JSON for phase2Completed flag
  const nodes = db.prepare(`
    SELECT id FROM nodes
    WHERE is_deleted = 0
      AND (
        extracted_fields IS NULL
        OR json_extract(extracted_fields, '$.phase2Completed') IS NULL
        OR json_extract(extracted_fields, '$.phase2Completed') = 0
      )
    ORDER BY date_added DESC
    LIMIT ?
  `).all(limit) as Array<{ id: string }>;

  return nodes.map(n => n.id);
}
