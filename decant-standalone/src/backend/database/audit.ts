// ============================================================
// Hierarchy Code Change Audit Functions
// Provides functions to log and query hierarchy code changes
// ============================================================

import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from './connection.js';

// ============================================================
// Types
// ============================================================

export type HierarchyType = 'function' | 'organization';
export type ChangeType = 'created' | 'updated' | 'moved' | 'restructured';
export type TriggeredBy = 'import' | 'user_move' | 'restructure' | 'merge';

export interface CodeChangeRecord {
  id: string;
  nodeId: string;
  hierarchyType: HierarchyType;
  oldCode: string | null;
  newCode: string;
  changeType: ChangeType;
  reason?: string;
  triggeredBy: TriggeredBy;
  relatedNodeIds?: string[];
  changedAt: string;
  metadata?: Record<string, unknown>;
}

export interface LogCodeChangeParams {
  nodeId: string;
  hierarchyType: HierarchyType;
  oldCode: string | null;
  newCode: string;
  changeType: ChangeType;
  triggeredBy: TriggeredBy;
  reason?: string;
  relatedNodeIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface GetNodeHistoryOptions {
  hierarchyType?: HierarchyType;
  limit?: number;
  offset?: number;
}

// ============================================================
// Core Functions
// ============================================================

/**
 * Logs a hierarchy code change to the audit table
 *
 * @param params - Change parameters
 * @param db - Optional database instance (uses default if not provided)
 * @returns The created change record ID
 *
 * @example
 * ```typescript
 * logCodeChange({
 *   nodeId: 'node-123',
 *   hierarchyType: 'function',
 *   oldCode: null,
 *   newCode: 'A.LLM.T.1',
 *   changeType: 'created',
 *   triggeredBy: 'import',
 *   reason: 'Initial AI classification'
 * });
 * ```
 */
export function logCodeChange(params: LogCodeChangeParams, db?: Database.Database): string {
  const database = db || getDb();
  const id = uuidv4();

  const stmt = database.prepare(`
    INSERT INTO hierarchy_code_changes (
      id,
      node_id,
      hierarchy_type,
      old_code,
      new_code,
      change_type,
      reason,
      triggered_by,
      related_node_ids,
      metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    params.nodeId,
    params.hierarchyType,
    params.oldCode,
    params.newCode,
    params.changeType,
    params.reason || null,
    params.triggeredBy,
    params.relatedNodeIds ? JSON.stringify(params.relatedNodeIds) : null,
    params.metadata ? JSON.stringify(params.metadata) : null
  );

  return id;
}

/**
 * Gets the complete change history for a specific node
 *
 * @param nodeId - Node ID to query
 * @param options - Query options
 * @param db - Optional database instance
 * @returns Array of change records, newest first
 *
 * @example
 * ```typescript
 * // Get all changes for a node
 * const history = getNodeHistory('node-123');
 *
 * // Get only function hierarchy changes
 * const functionHistory = getNodeHistory('node-123', {
 *   hierarchyType: 'function'
 * });
 *
 * // Get latest 10 changes
 * const recentChanges = getNodeHistory('node-123', { limit: 10 });
 * ```
 */
export function getNodeHistory(
  nodeId: string,
  options: GetNodeHistoryOptions = {},
  db?: Database.Database
): CodeChangeRecord[] {
  const database = db || getDb();
  const { hierarchyType, limit, offset = 0 } = options;

  let query = `
    SELECT
      id,
      node_id as nodeId,
      hierarchy_type as hierarchyType,
      old_code as oldCode,
      new_code as newCode,
      change_type as changeType,
      reason,
      triggered_by as triggeredBy,
      related_node_ids as relatedNodeIds,
      changed_at as changedAt,
      metadata
    FROM hierarchy_code_changes
    WHERE node_id = ?
  `;

  const params: any[] = [nodeId];

  if (hierarchyType) {
    query += ' AND hierarchy_type = ?';
    params.push(hierarchyType);
  }

  query += ' ORDER BY changed_at DESC';

  if (limit) {
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
  }

  const stmt = database.prepare(query);
  const rows = stmt.all(...params) as any[];

  return rows.map(row => ({
    ...row,
    relatedNodeIds: row.relatedNodeIds ? JSON.parse(row.relatedNodeIds) : undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  }));
}

/**
 * Gets recent changes across all nodes
 *
 * @param limit - Maximum number of records to return (default: 50)
 * @param db - Optional database instance
 * @returns Array of recent change records
 *
 * @example
 * ```typescript
 * // Get latest 20 changes
 * const recentChanges = getRecentChanges(20);
 * ```
 */
export function getRecentChanges(limit = 50, db?: Database.Database): CodeChangeRecord[] {
  const database = db || getDb();

  const stmt = database.prepare(`
    SELECT
      id,
      node_id as nodeId,
      hierarchy_type as hierarchyType,
      old_code as oldCode,
      new_code as newCode,
      change_type as changeType,
      reason,
      triggered_by as triggeredBy,
      related_node_ids as relatedNodeIds,
      changed_at as changedAt,
      metadata
    FROM hierarchy_code_changes
    ORDER BY changed_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(limit) as any[];

  return rows.map(row => ({
    ...row,
    relatedNodeIds: row.relatedNodeIds ? JSON.parse(row.relatedNodeIds) : undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  }));
}

/**
 * Gets changes filtered by change type
 *
 * @param changeType - Type of change to filter by
 * @param limit - Maximum number of records to return (default: 50)
 * @param db - Optional database instance
 * @returns Array of filtered change records
 *
 * @example
 * ```typescript
 * // Get all restructure operations
 * const restructures = getChangesByType('restructured', 100);
 *
 * // Get recent moves
 * const moves = getChangesByType('moved', 20);
 * ```
 */
export function getChangesByType(
  changeType: ChangeType,
  limit = 50,
  db?: Database.Database
): CodeChangeRecord[] {
  const database = db || getDb();

  const stmt = database.prepare(`
    SELECT
      id,
      node_id as nodeId,
      hierarchy_type as hierarchyType,
      old_code as oldCode,
      new_code as newCode,
      change_type as changeType,
      reason,
      triggered_by as triggeredBy,
      related_node_ids as relatedNodeIds,
      changed_at as changedAt,
      metadata
    FROM hierarchy_code_changes
    WHERE change_type = ?
    ORDER BY changed_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(changeType, limit) as any[];

  return rows.map(row => ({
    ...row,
    relatedNodeIds: row.relatedNodeIds ? JSON.parse(row.relatedNodeIds) : undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  }));
}

/**
 * Gets all changes from a restructure batch
 * Identifies batch by finding changes with the same batchId in metadata
 *
 * @param batchId - Batch ID stored in metadata.batchId
 * @param db - Optional database instance
 * @returns Array of changes from the batch
 *
 * @example
 * ```typescript
 * // Get all changes from a specific restructure operation
 * const batchChanges = getBatchChanges('batch-uuid-123');
 * ```
 */
export function getBatchChanges(batchId: string, db?: Database.Database): CodeChangeRecord[] {
  const database = db || getDb();

  // SQLite doesn't have native JSON query support in all versions,
  // so we'll use LIKE pattern matching on the metadata JSON
  const stmt = database.prepare(`
    SELECT
      id,
      node_id as nodeId,
      hierarchy_type as hierarchyType,
      old_code as oldCode,
      new_code as newCode,
      change_type as changeType,
      reason,
      triggered_by as triggeredBy,
      related_node_ids as relatedNodeIds,
      changed_at as changedAt,
      metadata
    FROM hierarchy_code_changes
    WHERE metadata LIKE ?
    ORDER BY changed_at ASC
  `);

  // Use pattern matching for batchId in JSON
  const pattern = `%"batchId":"${batchId}"%`;
  const rows = stmt.all(pattern) as any[];

  return rows.map(row => ({
    ...row,
    relatedNodeIds: row.relatedNodeIds ? JSON.parse(row.relatedNodeIds) : undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  }));
}

/**
 * Gets changes filtered by trigger source
 *
 * @param triggeredBy - Source that triggered the change
 * @param limit - Maximum number of records to return (default: 50)
 * @param db - Optional database instance
 * @returns Array of filtered change records
 *
 * @example
 * ```typescript
 * // Get all AI import changes
 * const importChanges = getChangesByTrigger('import', 100);
 *
 * // Get user-initiated moves
 * const userMoves = getChangesByTrigger('user_move', 50);
 * ```
 */
export function getChangesByTrigger(
  triggeredBy: TriggeredBy,
  limit = 50,
  db?: Database.Database
): CodeChangeRecord[] {
  const database = db || getDb();

  const stmt = database.prepare(`
    SELECT
      id,
      node_id as nodeId,
      hierarchy_type as hierarchyType,
      old_code as oldCode,
      new_code as newCode,
      change_type as changeType,
      reason,
      triggered_by as triggeredBy,
      related_node_ids as relatedNodeIds,
      changed_at as changedAt,
      metadata
    FROM hierarchy_code_changes
    WHERE triggered_by = ?
    ORDER BY changed_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(triggeredBy, limit) as any[];

  return rows.map(row => ({
    ...row,
    relatedNodeIds: row.relatedNodeIds ? JSON.parse(row.relatedNodeIds) : undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  }));
}

/**
 * Gets statistics about code changes
 *
 * @param db - Optional database instance
 * @returns Statistics object
 *
 * @example
 * ```typescript
 * const stats = getChangeStatistics();
 * console.log(`Total changes: ${stats.totalChanges}`);
 * console.log(`Import changes: ${stats.byTrigger.import}`);
 * ```
 */
export function getChangeStatistics(db?: Database.Database): {
  totalChanges: number;
  byType: Record<ChangeType, number>;
  byTrigger: Record<TriggeredBy, number>;
  byHierarchy: Record<HierarchyType, number>;
} {
  const database = db || getDb();

  // Total changes
  const totalStmt = database.prepare('SELECT COUNT(*) as count FROM hierarchy_code_changes');
  const totalResult = totalStmt.get() as { count: number };

  // By change type
  const typeStmt = database.prepare(`
    SELECT change_type, COUNT(*) as count
    FROM hierarchy_code_changes
    GROUP BY change_type
  `);
  const typeResults = typeStmt.all() as { change_type: ChangeType; count: number }[];
  const byType: Record<string, number> = {};
  typeResults.forEach(row => {
    byType[row.change_type] = row.count;
  });

  // By trigger
  const triggerStmt = database.prepare(`
    SELECT triggered_by, COUNT(*) as count
    FROM hierarchy_code_changes
    GROUP BY triggered_by
  `);
  const triggerResults = triggerStmt.all() as { triggered_by: TriggeredBy; count: number }[];
  const byTrigger: Record<string, number> = {};
  triggerResults.forEach(row => {
    byTrigger[row.triggered_by] = row.count;
  });

  // By hierarchy type
  const hierarchyStmt = database.prepare(`
    SELECT hierarchy_type, COUNT(*) as count
    FROM hierarchy_code_changes
    GROUP BY hierarchy_type
  `);
  const hierarchyResults = hierarchyStmt.all() as { hierarchy_type: HierarchyType; count: number }[];
  const byHierarchy: Record<string, number> = {};
  hierarchyResults.forEach(row => {
    byHierarchy[row.hierarchy_type] = row.count;
  });

  return {
    totalChanges: totalResult.count,
    byType: byType as Record<ChangeType, number>,
    byTrigger: byTrigger as Record<TriggeredBy, number>,
    byHierarchy: byHierarchy as Record<HierarchyType, number>,
  };
}
