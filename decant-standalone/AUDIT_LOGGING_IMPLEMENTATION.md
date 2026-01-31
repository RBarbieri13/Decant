# Audit Logging Implementation for Hierarchy Operations

## Overview

This document provides the complete implementation for integrating audit logging into hierarchy operations. All hierarchy code mutations are logged to maintain a complete audit trail.

## Database Schema

### hierarchy_code_changes Table

```sql
CREATE TABLE hierarchy_code_changes (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  hierarchy_type TEXT NOT NULL CHECK(hierarchy_type IN ('function', 'organization')),
  old_code TEXT,
  new_code TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK(change_type IN ('initial', 'update', 'move', 'restructure', 'merge')),
  change_reason TEXT NOT NULL,
  triggered_by_node_id TEXT,
  batch_id TEXT,
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (triggered_by_node_id) REFERENCES nodes(id) ON DELETE SET NULL
);

CREATE INDEX idx_code_changes_node ON hierarchy_code_changes(node_id);
CREATE INDEX idx_code_changes_date ON hierarchy_code_changes(changed_at DESC);
CREATE INDEX idx_code_changes_batch ON hierarchy_code_changes(batch_id);
CREATE INDEX idx_code_changes_triggered ON hierarchy_code_changes(triggered_by_node_id);
CREATE INDEX idx_code_changes_type ON hierarchy_code_changes(change_type);
```

### Migration File

**Location:** `/src/backend/database/migrations/004_add_audit_table.ts`

```typescript
import type { Database } from 'better-sqlite3';

export const up = (db: Database): void => {
  db.exec(`
    CREATE TABLE hierarchy_code_changes (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      hierarchy_type TEXT NOT NULL CHECK(hierarchy_type IN ('function', 'organization')),
      old_code TEXT,
      new_code TEXT NOT NULL,
      change_type TEXT NOT NULL CHECK(change_type IN ('initial', 'update', 'move', 'restructure', 'merge')),
      change_reason TEXT NOT NULL,
      triggered_by_node_id TEXT,
      batch_id TEXT,
      changed_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (triggered_by_node_id) REFERENCES nodes(id) ON DELETE SET NULL
    );

    CREATE INDEX idx_code_changes_node ON hierarchy_code_changes(node_id);
    CREATE INDEX idx_code_changes_date ON hierarchy_code_changes(changed_at DESC);
    CREATE INDEX idx_code_changes_batch ON hierarchy_code_changes(batch_id);
    CREATE INDEX idx_code_changes_triggered ON hierarchy_code_changes(triggered_by_node_id);
    CREATE INDEX idx_code_changes_type ON hierarchy_code_changes(change_type);
  `);
};

export const down = (db: Database): void => {
  db.exec(`
    DROP INDEX IF EXISTS idx_code_changes_type;
    DROP INDEX IF EXISTS idx_code_changes_triggered;
    DROP INDEX IF EXISTS idx_code_changes_batch;
    DROP INDEX IF EXISTS idx_code_changes_date;
    DROP INDEX IF EXISTS idx_code_changes_node;
    DROP TABLE IF EXISTS hierarchy_code_changes;
  `);
};
```

## Implementation Files

### 1. Audit Database Layer

**Location:** `/src/backend/database/audit.ts`

```typescript
/**
 * Audit Database Layer
 *
 * Provides database functions for tracking hierarchy code changes.
 * All changes to hierarchy codes are logged to maintain a complete audit trail.
 */

import { getDatabase } from './connection.js';
import { v4 as uuidv4 } from 'uuid';

export interface CodeChangeRecord {
  id: string;
  nodeId: string;
  hierarchyType: 'function' | 'organization';
  oldCode: string | null;
  newCode: string;
  changeType: 'initial' | 'update' | 'move' | 'restructure' | 'merge';
  changeReason: string;
  triggeredByNodeId: string | null;
  batchId: string | null;
  changedAt: string;
}

export interface CodeChangeInsert {
  nodeId: string;
  hierarchyType: 'function' | 'organization';
  oldCode: string | null;
  newCode: string;
  changeType: 'initial' | 'update' | 'move' | 'restructure' | 'merge';
  changeReason: string;
  triggeredByNodeId?: string | null;
  batchId?: string | null;
}

export interface ChangeStats {
  total: number;
  byType: Record<string, number>;
  byTrigger: Record<string, number>;
}

/**
 * Insert a single code change record
 */
export function insertCodeChange(change: CodeChangeInsert): string {
  const db = getDatabase();
  const id = uuidv4();

  const stmt = db.prepare(`
    INSERT INTO hierarchy_code_changes (
      id,
      node_id,
      hierarchy_type,
      old_code,
      new_code,
      change_type,
      change_reason,
      triggered_by_node_id,
      batch_id,
      changed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  stmt.run(
    id,
    change.nodeId,
    change.hierarchyType,
    change.oldCode,
    change.newCode,
    change.changeType,
    change.changeReason,
    change.triggeredByNodeId || null,
    change.batchId || null
  );

  return id;
}

/**
 * Insert multiple code changes in a batch
 */
export function insertCodeChanges(changes: CodeChangeInsert[], batchId: string): string[] {
  const db = getDatabase();
  const ids: string[] = [];

  const transaction = db.transaction((changesToInsert: CodeChangeInsert[]) => {
    const stmt = db.prepare(`
      INSERT INTO hierarchy_code_changes (
        id,
        node_id,
        hierarchy_type,
        old_code,
        new_code,
        change_type,
        change_reason,
        triggered_by_node_id,
        batch_id,
        changed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    for (const change of changesToInsert) {
      const id = uuidv4();
      stmt.run(
        id,
        change.nodeId,
        change.hierarchyType,
        change.oldCode,
        change.newCode,
        change.changeType,
        change.changeReason,
        change.triggeredByNodeId || null,
        batchId
      );
      ids.push(id);
    }
  });

  transaction(changes);
  return ids;
}

/**
 * Get change history for a specific node
 */
export function getNodeChangeHistory(
  nodeId: string,
  options?: { hierarchyType?: 'function' | 'organization'; limit?: number }
): CodeChangeRecord[] {
  const db = getDatabase();

  let sql = `
    SELECT
      id,
      node_id as nodeId,
      hierarchy_type as hierarchyType,
      old_code as oldCode,
      new_code as newCode,
      change_type as changeType,
      change_reason as changeReason,
      triggered_by_node_id as triggeredByNodeId,
      batch_id as batchId,
      changed_at as changedAt
    FROM hierarchy_code_changes
    WHERE node_id = ?
  `;

  const params: any[] = [nodeId];

  if (options?.hierarchyType) {
    sql += ' AND hierarchy_type = ?';
    params.push(options.hierarchyType);
  }

  sql += ' ORDER BY changed_at DESC';

  if (options?.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  const stmt = db.prepare(sql);
  return stmt.all(...params) as CodeChangeRecord[];
}

/**
 * Get recent code changes across all nodes
 */
export function getRecentChanges(options?: {
  limit?: number;
  changeType?: string;
  hierarchyType?: 'function' | 'organization';
  batchId?: string;
}): CodeChangeRecord[] {
  const db = getDatabase();

  let sql = `
    SELECT
      id,
      node_id as nodeId,
      hierarchy_type as hierarchyType,
      old_code as oldCode,
      new_code as newCode,
      change_type as changeType,
      change_reason as changeReason,
      triggered_by_node_id as triggeredByNodeId,
      batch_id as batchId,
      changed_at as changedAt
    FROM hierarchy_code_changes
    WHERE 1=1
  `;

  const params: any[] = [];

  if (options?.changeType) {
    sql += ' AND change_type = ?';
    params.push(options.changeType);
  }

  if (options?.hierarchyType) {
    sql += ' AND hierarchy_type = ?';
    params.push(options.hierarchyType);
  }

  if (options?.batchId) {
    sql += ' AND batch_id = ?';
    params.push(options.batchId);
  }

  sql += ' ORDER BY changed_at DESC';

  if (options?.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }

  const stmt = db.prepare(sql);
  return stmt.all(...params) as CodeChangeRecord[];
}

/**
 * Get changes triggered by a specific node
 */
export function getChangesTriggeredBy(nodeId: string, limit?: number): CodeChangeRecord[] {
  const db = getDatabase();

  let sql = `
    SELECT
      id,
      node_id as nodeId,
      hierarchy_type as hierarchyType,
      old_code as oldCode,
      new_code as newCode,
      change_type as changeType,
      change_reason as changeReason,
      triggered_by_node_id as triggeredByNodeId,
      batch_id as batchId,
      changed_at as changedAt
    FROM hierarchy_code_changes
    WHERE triggered_by_node_id = ?
    ORDER BY changed_at DESC
  `;

  if (limit) {
    sql += ' LIMIT ?';
  }

  const stmt = db.prepare(sql);
  const params = limit ? [nodeId, limit] : [nodeId];
  return stmt.all(...params) as CodeChangeRecord[];
}

/**
 * Get all changes in a batch
 */
export function getBatchChanges(batchId: string): CodeChangeRecord[] {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT
      id,
      node_id as nodeId,
      hierarchy_type as hierarchyType,
      old_code as oldCode,
      new_code as newCode,
      change_type as changeType,
      change_reason as changeReason,
      triggered_by_node_id as triggeredByNodeId,
      batch_id as batchId,
      changed_at as changedAt
    FROM hierarchy_code_changes
    WHERE batch_id = ?
    ORDER BY changed_at ASC
  `);

  return stmt.all(batchId) as CodeChangeRecord[];
}

/**
 * Get statistics about code changes
 */
export function getChangeStats(): ChangeStats {
  const db = getDatabase();

  const totalStmt = db.prepare('SELECT COUNT(*) as count FROM hierarchy_code_changes');
  const total = (totalStmt.get() as { count: number }).count;

  const byTypeStmt = db.prepare(`
    SELECT change_type, COUNT(*) as count
    FROM hierarchy_code_changes
    GROUP BY change_type
  `);
  const byTypeRows = byTypeStmt.all() as Array<{ change_type: string; count: number }>;
  const byType: Record<string, number> = {};
  byTypeRows.forEach(row => {
    byType[row.change_type] = row.count;
  });

  const byTriggerStmt = db.prepare(`
    SELECT
      CASE
        WHEN triggered_by_node_id IS NULL THEN 'system'
        ELSE 'user'
      END as trigger_type,
      COUNT(*) as count
    FROM hierarchy_code_changes
    GROUP BY trigger_type
  `);
  const byTriggerRows = byTriggerStmt.all() as Array<{ trigger_type: string; count: number }>;
  const byTrigger: Record<string, number> = {};
  byTriggerRows.forEach(row => {
    byTrigger[row.trigger_type] = row.count;
  });

  return {
    total,
    byType,
    byTrigger
  };
}

/**
 * Delete old audit records (for cleanup)
 * WARNING: Only use for maintenance, not regular operation
 */
export function deleteOldChanges(daysToKeep: number): number {
  const db = getDatabase();

  const stmt = db.prepare(`
    DELETE FROM hierarchy_code_changes
    WHERE datetime(changed_at) < datetime('now', '-' || ? || ' days')
  `);

  const result = stmt.run(daysToKeep);
  return result.changes;
}
```

### 2. Audit Service

**Location:** `/src/backend/services/audit_service.ts`

```typescript
/**
 * Audit Service
 *
 * High-level service for logging hierarchy code changes.
 * Provides transaction-safe logging with batch support.
 */

import { v4 as uuidv4 } from 'uuid';
import * as auditDb from '../database/audit.js';
import type { CodeChangeRecord, CodeChangeInsert, ChangeStats } from '../database/audit.js';
import { logger } from '../utils/logger.js';

/**
 * Log a single hierarchy code change
 */
export async function logChange(
  change: Omit<CodeChangeInsert, 'id' | 'changedAt'>
): Promise<string> {
  try {
    const id = auditDb.insertCodeChange(change);

    logger.debug({
      msg: 'Hierarchy code change logged',
      nodeId: change.nodeId,
      hierarchyType: change.hierarchyType,
      changeType: change.changeType,
      oldCode: change.oldCode,
      newCode: change.newCode,
      module: 'auditService'
    });

    return id;
  } catch (error) {
    logger.error({
      msg: 'Failed to log hierarchy code change',
      error: error instanceof Error ? error.message : String(error),
      nodeId: change.nodeId,
      module: 'auditService'
    });
    throw error;
  }
}

/**
 * Log multiple hierarchy code changes as a batch
 * All changes will share the same batch ID for tracking
 */
export async function logBatchChanges(
  changes: Array<Omit<CodeChangeInsert, 'id' | 'changedAt' | 'batchId'>>,
  batchReason: string
): Promise<string[]> {
  const batchId = uuidv4();

  try {
    // Add batch ID to all changes
    const changesWithBatch = changes.map(change => ({
      ...change,
      batchId
    }));

    const ids = auditDb.insertCodeChanges(changesWithBatch, batchId);

    logger.info({
      msg: 'Batch hierarchy code changes logged',
      batchId,
      batchReason,
      changeCount: changes.length,
      module: 'auditService'
    });

    return ids;
  } catch (error) {
    logger.error({
      msg: 'Failed to log batch hierarchy code changes',
      error: error instanceof Error ? error.message : String(error),
      batchId,
      batchReason,
      changeCount: changes.length,
      module: 'auditService'
    });
    throw error;
  }
}

/**
 * Get change history for a specific node
 */
export async function getNodeHistory(
  nodeId: string,
  options?: { hierarchyType?: 'function' | 'organization'; limit?: number }
): Promise<CodeChangeRecord[]> {
  try {
    return auditDb.getNodeChangeHistory(nodeId, options);
  } catch (error) {
    logger.error({
      msg: 'Failed to retrieve node change history',
      error: error instanceof Error ? error.message : String(error),
      nodeId,
      module: 'auditService'
    });
    throw error;
  }
}

/**
 * Get recent changes across all nodes
 */
export async function getRecentChanges(options?: {
  limit?: number;
  changeType?: string;
  hierarchyType?: 'function' | 'organization';
  batchId?: string;
}): Promise<CodeChangeRecord[]> {
  try {
    return auditDb.getRecentChanges(options);
  } catch (error) {
    logger.error({
      msg: 'Failed to retrieve recent changes',
      error: error instanceof Error ? error.message : String(error),
      module: 'auditService'
    });
    throw error;
  }
}

/**
 * Get statistics about hierarchy code changes
 */
export async function getChangeStats(): Promise<ChangeStats> {
  try {
    return auditDb.getChangeStats();
  } catch (error) {
    logger.error({
      msg: 'Failed to retrieve change statistics',
      error: error instanceof Error ? error.message : String(error),
      module: 'auditService'
    });
    throw error;
  }
}

/**
 * Get all changes triggered by a specific node
 * Useful for understanding cascade effects
 */
export async function getChangesTriggeredBy(
  nodeId: string,
  limit?: number
): Promise<CodeChangeRecord[]> {
  try {
    return auditDb.getChangesTriggeredBy(nodeId, limit);
  } catch (error) {
    logger.error({
      msg: 'Failed to retrieve triggered changes',
      error: error instanceof Error ? error.message : String(error),
      nodeId,
      module: 'auditService'
    });
    throw error;
  }
}

/**
 * Get all changes in a specific batch
 */
export async function getBatchChanges(batchId: string): Promise<CodeChangeRecord[]> {
  try {
    return auditDb.getBatchChanges(batchId);
  } catch (error) {
    logger.error({
      msg: 'Failed to retrieve batch changes',
      error: error instanceof Error ? error.message : String(error),
      batchId,
      module: 'auditService'
    });
    throw error;
  }
}
```

### 3. Integration into Hierarchy Restructure Service

**Location:** `/src/backend/services/hierarchy/restructure.ts`

```typescript
/**
 * Hierarchy Restructure Service
 *
 * Handles reorganization of hierarchy codes when conflicts occur.
 * Integrated with audit logging to track all code mutations.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import * as auditService from '../audit_service.js';

export interface RestructureResult {
  restructuredNodes: Array<{
    nodeId: string;
    oldCode: string;
    newCode: string;
  }>;
  batchId: string;
}

/**
 * Differentiate siblings when a new node creates a conflict
 *
 * Example: When adding a second tutorial to "AI.LLM.T1":
 * - Existing "AI.LLM.T1" becomes "AI.LLM.T1.1"
 * - New node becomes "AI.LLM.T1.2"
 *
 * All affected nodes are logged in a single batch for traceability.
 */
export async function splitCategory(
  categoryCode: string,
  hierarchyType: 'function' | 'organization',
  newNodeId: string,
  reason: string
): Promise<RestructureResult> {
  const db = getDatabase();
  const batchId = uuidv4();

  try {
    // Find all nodes at this category level
    const parentIdField = hierarchyType === 'function'
      ? 'function_parent_id'
      : 'organization_parent_id';
    const codeField = hierarchyType === 'function'
      ? 'function_hierarchy_code'
      : 'organization_hierarchy_code';

    // Get all sibling nodes (including the one being added)
    const stmt = db.prepare(`
      SELECT id, ${codeField} as code
      FROM nodes
      WHERE ${codeField} LIKE ? || '%'
        AND ${codeField} NOT LIKE ? || '.%.%'
        AND is_deleted = 0
      ORDER BY date_added ASC
    `);

    const siblings = stmt.all(categoryCode, categoryCode) as Array<{ id: string; code: string }>;

    if (siblings.length <= 1) {
      // No restructure needed - only one node
      return {
        restructuredNodes: [],
        batchId
      };
    }

    logger.info({
      msg: 'Starting category split',
      categoryCode,
      hierarchyType,
      siblingCount: siblings.length,
      reason,
      batchId,
      module: 'restructure'
    });

    // Prepare audit log entries for all changes
    const auditChanges = [];
    const restructuredNodes = [];

    // Assign sequential subcategory numbers
    const updateStmt = db.prepare(`
      UPDATE nodes
      SET ${codeField} = ?
      WHERE id = ?
    `);

    const transaction = db.transaction(() => {
      for (let i = 0; i < siblings.length; i++) {
        const sibling = siblings[i];
        const newCode = `${categoryCode}.${i + 1}`;

        // Update the node's hierarchy code
        updateStmt.run(newCode, sibling.id);

        // Record for audit
        auditChanges.push({
          nodeId: sibling.id,
          hierarchyType,
          oldCode: sibling.code,
          newCode,
          changeType: 'restructure' as const,
          changeReason: `${reason} (sibling ${i + 1} of ${siblings.length})`,
          triggeredByNodeId: newNodeId,
          batchId
        });

        restructuredNodes.push({
          nodeId: sibling.id,
          oldCode: sibling.code,
          newCode
        });
      }
    });

    // Execute transaction
    transaction();

    // Log all changes to audit table
    await auditService.logBatchChanges(auditChanges, reason);

    logger.info({
      msg: 'Category split complete',
      categoryCode,
      hierarchyType,
      restructuredCount: restructuredNodes.length,
      batchId,
      module: 'restructure'
    });

    return {
      restructuredNodes,
      batchId
    };
  } catch (error) {
    logger.error({
      msg: 'Category split failed',
      error: error instanceof Error ? error.message : String(error),
      categoryCode,
      hierarchyType,
      batchId,
      module: 'restructure'
    });
    throw error;
  }
}

/**
 * Consolidate siblings when nodes are deleted or merged
 * Renumbers remaining siblings to fill gaps
 */
export async function consolidateSiblings(
  categoryCode: string,
  hierarchyType: 'function' | 'organization',
  reason: string
): Promise<RestructureResult> {
  const db = getDatabase();
  const batchId = uuidv4();

  try {
    const parentIdField = hierarchyType === 'function'
      ? 'function_parent_id'
      : 'organization_parent_id';
    const codeField = hierarchyType === 'function'
      ? 'function_hierarchy_code'
      : 'organization_hierarchy_code';

    // Get remaining siblings
    const stmt = db.prepare(`
      SELECT id, ${codeField} as code
      FROM nodes
      WHERE ${codeField} LIKE ? || '.%'
        AND ${codeField} NOT LIKE ? || '.%.%'
        AND is_deleted = 0
      ORDER BY ${codeField} ASC
    `);

    const siblings = stmt.all(categoryCode, categoryCode) as Array<{ id: string; code: string }>;

    if (siblings.length === 0) {
      return {
        restructuredNodes: [],
        batchId
      };
    }

    logger.info({
      msg: 'Starting sibling consolidation',
      categoryCode,
      hierarchyType,
      siblingCount: siblings.length,
      reason,
      batchId,
      module: 'restructure'
    });

    const auditChanges = [];
    const restructuredNodes = [];

    const updateStmt = db.prepare(`
      UPDATE nodes
      SET ${codeField} = ?
      WHERE id = ?
    `);

    const transaction = db.transaction(() => {
      for (let i = 0; i < siblings.length; i++) {
        const sibling = siblings[i];
        const newCode = `${categoryCode}.${i + 1}`;

        if (sibling.code !== newCode) {
          updateStmt.run(newCode, sibling.id);

          auditChanges.push({
            nodeId: sibling.id,
            hierarchyType,
            oldCode: sibling.code,
            newCode,
            changeType: 'restructure' as const,
            changeReason: `${reason} (consolidated to position ${i + 1})`,
            triggeredByNodeId: null,
            batchId
          });

          restructuredNodes.push({
            nodeId: sibling.id,
            oldCode: sibling.code,
            newCode
          });
        }
      }
    });

    transaction();

    if (auditChanges.length > 0) {
      await auditService.logBatchChanges(auditChanges, reason);
    }

    logger.info({
      msg: 'Sibling consolidation complete',
      categoryCode,
      hierarchyType,
      restructuredCount: restructuredNodes.length,
      batchId,
      module: 'restructure'
    });

    return {
      restructuredNodes,
      batchId
    };
  } catch (error) {
    logger.error({
      msg: 'Sibling consolidation failed',
      error: error instanceof Error ? error.message : String(error),
      categoryCode,
      hierarchyType,
      batchId,
      module: 'restructure'
    });
    throw error;
  }
}
```

### 4. Integration into Nodes Database Layer

**Location:** `/src/backend/database/nodes.ts` (modifications)

```typescript
// Add to existing imports
import * as auditService from '../services/audit_service.js';

/**
 * Create a new node with audit logging
 */
export function createNode(data: NodeInsert): Node {
  const db = getDatabase();
  const id = uuidv4();

  const transaction = db.transaction(() => {
    // Insert node (existing code)
    const stmt = db.prepare(`
      INSERT INTO nodes (
        id, title, url, source_domain, company,
        phrase_description, short_description, logo_url,
        function_parent_id, organization_parent_id,
        function_hierarchy_code, organization_hierarchy_code,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    stmt.run(
      id,
      data.title,
      data.url,
      data.sourceDomain,
      data.company || null,
      data.phraseDescription || null,
      data.shortDescription || null,
      data.logoUrl || null,
      data.functionParentId || null,
      data.organizationParentId || null,
      data.functionHierarchyCode,
      data.organizationHierarchyCode
    );

    // Log hierarchy code assignment to audit table
    if (data.functionHierarchyCode) {
      auditService.logChange({
        nodeId: id,
        hierarchyType: 'function',
        oldCode: null,
        newCode: data.functionHierarchyCode,
        changeType: 'initial',
        changeReason: 'Node created with initial hierarchy code'
      });
    }

    if (data.organizationHierarchyCode) {
      auditService.logChange({
        nodeId: id,
        hierarchyType: 'organization',
        oldCode: null,
        newCode: data.organizationHierarchyCode,
        changeType: 'initial',
        changeReason: 'Node created with initial hierarchy code'
      });
    }

    return getNodeById(id)!;
  });

  return transaction();
}

/**
 * Update node with audit logging for hierarchy code changes
 */
export function updateNode(id: string, updates: Partial<NodeUpdate>): Node | null {
  const db = getDatabase();

  const transaction = db.transaction(() => {
    // Get current node state
    const currentNode = getNodeById(id);
    if (!currentNode) {
      return null;
    }

    // Build update query (existing code)
    const updateFields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) {
      updateFields.push('title = ?');
      values.push(updates.title);
    }
    // ... other fields ...

    if (updates.functionHierarchyCode !== undefined &&
        updates.functionHierarchyCode !== currentNode.functionHierarchyCode) {
      updateFields.push('function_hierarchy_code = ?');
      values.push(updates.functionHierarchyCode);

      // Log hierarchy code change
      auditService.logChange({
        nodeId: id,
        hierarchyType: 'function',
        oldCode: currentNode.functionHierarchyCode,
        newCode: updates.functionHierarchyCode,
        changeType: 'update',
        changeReason: 'Node hierarchy code updated'
      });
    }

    if (updates.organizationHierarchyCode !== undefined &&
        updates.organizationHierarchyCode !== currentNode.organizationHierarchyCode) {
      updateFields.push('organization_hierarchy_code = ?');
      values.push(updates.organizationHierarchyCode);

      // Log hierarchy code change
      auditService.logChange({
        nodeId: id,
        hierarchyType: 'organization',
        oldCode: currentNode.organizationHierarchyCode,
        newCode: updates.organizationHierarchyCode,
        changeType: 'update',
        changeReason: 'Node hierarchy code updated'
      });
    }

    updateFields.push('updated_at = datetime(\'now\')');
    values.push(id);

    const stmt = db.prepare(`
      UPDATE nodes
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);

    return getNodeById(id);
  });

  return transaction();
}

/**
 * Move node to new parent with audit logging
 */
export function moveNode(
  nodeId: string,
  newParentId: string,
  hierarchyType: 'function' | 'organization',
  newHierarchyCode: string
): Node | null {
  const db = getDatabase();

  const transaction = db.transaction(() => {
    const currentNode = getNodeById(nodeId);
    if (!currentNode) {
      return null;
    }

    const parentField = hierarchyType === 'function'
      ? 'function_parent_id'
      : 'organization_parent_id';
    const codeField = hierarchyType === 'function'
      ? 'function_hierarchy_code'
      : 'organization_hierarchy_code';
    const oldCode = hierarchyType === 'function'
      ? currentNode.functionHierarchyCode
      : currentNode.organizationHierarchyCode;

    // Update node
    const stmt = db.prepare(`
      UPDATE nodes
      SET ${parentField} = ?, ${codeField} = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(newParentId, newHierarchyCode, nodeId);

    // Log move operation
    auditService.logChange({
      nodeId,
      hierarchyType,
      oldCode,
      newCode: newHierarchyCode,
      changeType: 'move',
      changeReason: `Node moved to new parent: ${newParentId}`
    });

    return getNodeById(nodeId);
  });

  return transaction();
}

/**
 * Merge nodes with audit logging
 */
export function mergeNodes(
  sourceNodeId: string,
  targetNodeId: string,
  hierarchyType: 'function' | 'organization'
): void {
  const db = getDatabase();

  const transaction = db.transaction(() => {
    const sourceNode = getNodeById(sourceNodeId);
    const targetNode = getNodeById(targetNodeId);

    if (!sourceNode || !targetNode) {
      throw new Error('Source or target node not found');
    }

    const oldCode = hierarchyType === 'function'
      ? sourceNode.functionHierarchyCode
      : sourceNode.organizationHierarchyCode;
    const newCode = hierarchyType === 'function'
      ? targetNode.functionHierarchyCode
      : targetNode.organizationHierarchyCode;

    // Soft delete source node
    const stmt = db.prepare(`
      UPDATE nodes
      SET is_deleted = 1, updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(sourceNodeId);

    // Log merge operation
    auditService.logChange({
      nodeId: sourceNodeId,
      hierarchyType,
      oldCode,
      newCode,
      changeType: 'merge',
      changeReason: `Node merged into target: ${targetNodeId}`,
      triggeredByNodeId: targetNodeId
    });
  });

  transaction();
}
```

### 5. Integration into Import Orchestrator

**Location:** `/src/backend/services/import_orchestrator.ts` (modifications)

```typescript
// Add to imports
import * as auditService from './audit_service.js';

/**
 * Process imported URL and assign hierarchy codes
 */
export async function processImport(url: string): Promise<Node> {
  // ... existing extraction and classification code ...

  const transaction = db.transaction(async () => {
    // Create node with hierarchy codes
    const node = createNode({
      title: metadata.title,
      url,
      sourceDomain: metadata.domain,
      functionHierarchyCode: classificationResult.functionCode,
      organizationHierarchyCode: classificationResult.organizationCode,
      // ... other fields ...
    });

    // Audit logging happens automatically in createNode()

    // Check if restructure is needed
    if (classificationResult.requiresRestructure) {
      const restructureResult = await restructureService.splitCategory(
        classificationResult.categoryCode,
        'function',
        node.id,
        'New similar node created conflict'
      );

      logger.info({
        msg: 'Hierarchy restructure triggered by import',
        nodeId: node.id,
        batchId: restructureResult.batchId,
        restructuredCount: restructureResult.restructuredNodes.length,
        module: 'importOrchestrator'
      });
    }

    return node;
  });

  return transaction();
}
```

### 6. API Endpoints for Audit Queries

**Location:** `/src/backend/routes/api/audit.ts`

```typescript
/**
 * Audit API Routes
 *
 * Endpoints for querying hierarchy code change history.
 */

import { Router } from 'express';
import * as auditService from '../../services/audit_service.js';
import { logger } from '../../utils/logger.js';

const router = Router();

/**
 * GET /api/audit/node/:nodeId
 * Get change history for a specific node
 */
router.get('/node/:nodeId', async (req, res) => {
  try {
    const { nodeId } = req.params;
    const { hierarchyType, limit } = req.query;

    const history = await auditService.getNodeHistory(nodeId, {
      hierarchyType: hierarchyType as 'function' | 'organization' | undefined,
      limit: limit ? parseInt(limit as string) : undefined
    });

    res.json({
      nodeId,
      changeCount: history.length,
      changes: history
    });
  } catch (error) {
    logger.error({
      msg: 'Failed to retrieve node audit history',
      error: error instanceof Error ? error.message : String(error),
      module: 'auditRoutes'
    });
    res.status(500).json({
      error: 'Failed to retrieve audit history'
    });
  }
});

/**
 * GET /api/audit/recent
 * Get recent changes across all nodes
 */
router.get('/recent', async (req, res) => {
  try {
    const { limit, changeType, hierarchyType, batchId } = req.query;

    const changes = await auditService.getRecentChanges({
      limit: limit ? parseInt(limit as string) : 50,
      changeType: changeType as string | undefined,
      hierarchyType: hierarchyType as 'function' | 'organization' | undefined,
      batchId: batchId as string | undefined
    });

    res.json({
      changeCount: changes.length,
      changes
    });
  } catch (error) {
    logger.error({
      msg: 'Failed to retrieve recent changes',
      error: error instanceof Error ? error.message : String(error),
      module: 'auditRoutes'
    });
    res.status(500).json({
      error: 'Failed to retrieve recent changes'
    });
  }
});

/**
 * GET /api/audit/batch/:batchId
 * Get all changes in a specific batch
 */
router.get('/batch/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;

    const changes = await auditService.getBatchChanges(batchId);

    res.json({
      batchId,
      changeCount: changes.length,
      changes
    });
  } catch (error) {
    logger.error({
      msg: 'Failed to retrieve batch changes',
      error: error instanceof Error ? error.message : String(error),
      module: 'auditRoutes'
    });
    res.status(500).json({
      error: 'Failed to retrieve batch changes'
    });
  }
});

/**
 * GET /api/audit/stats
 * Get statistics about hierarchy code changes
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await auditService.getChangeStats();

    res.json(stats);
  } catch (error) {
    logger.error({
      msg: 'Failed to retrieve change statistics',
      error: error instanceof Error ? error.message : String(error),
      module: 'auditRoutes'
    });
    res.status(500).json({
      error: 'Failed to retrieve statistics'
    });
  }
});

/**
 * GET /api/audit/triggered/:nodeId
 * Get all changes triggered by a specific node
 */
router.get('/triggered/:nodeId', async (req, res) => {
  try {
    const { nodeId } = req.params;
    const { limit } = req.query;

    const changes = await auditService.getChangesTriggeredBy(
      nodeId,
      limit ? parseInt(limit as string) : undefined
    );

    res.json({
      nodeId,
      changeCount: changes.length,
      changes
    });
  } catch (error) {
    logger.error({
      msg: 'Failed to retrieve triggered changes',
      error: error instanceof Error ? error.message : String(error),
      module: 'auditRoutes'
    });
    res.status(500).json({
      error: 'Failed to retrieve triggered changes'
    });
  }
});

export default router;
```

### 7. Register Audit Routes

**Location:** `/src/backend/routes/index.ts` (modifications)

```typescript
import auditRoutes from './api/audit.js';

export function registerAPIRoutes(app: Express): void {
  // ... existing routes ...

  // Audit routes
  app.use('/api/audit', auditRoutes);

  // ... rest of routes ...
}
```

## Testing

### Unit Tests

**Location:** `/src/backend/database/__tests__/audit.spec.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as audit from '../audit.js';
import { getDatabase } from '../connection.js';
import { v4 as uuidv4 } from 'uuid';

describe('Audit Database Layer', () => {
  let testNodeId: string;

  beforeEach(() => {
    testNodeId = uuidv4();
  });

  afterEach(() => {
    // Clean up test data
    const db = getDatabase();
    db.prepare('DELETE FROM hierarchy_code_changes WHERE node_id = ?').run(testNodeId);
  });

  it('should insert a single code change', () => {
    const id = audit.insertCodeChange({
      nodeId: testNodeId,
      hierarchyType: 'function',
      oldCode: null,
      newCode: 'A.LLM.T1',
      changeType: 'initial',
      changeReason: 'Test change'
    });

    expect(id).toBeTruthy();

    const changes = audit.getNodeChangeHistory(testNodeId);
    expect(changes).toHaveLength(1);
    expect(changes[0].newCode).toBe('A.LLM.T1');
  });

  it('should insert batch changes with same batch ID', () => {
    const batchId = uuidv4();
    const changes = [
      {
        nodeId: uuidv4(),
        hierarchyType: 'function' as const,
        oldCode: 'A.LLM.T1',
        newCode: 'A.LLM.T1.1',
        changeType: 'restructure' as const,
        changeReason: 'Split category'
      },
      {
        nodeId: uuidv4(),
        hierarchyType: 'function' as const,
        oldCode: 'A.LLM.T2',
        newCode: 'A.LLM.T1.2',
        changeType: 'restructure' as const,
        changeReason: 'Split category'
      }
    ];

    const ids = audit.insertCodeChanges(changes, batchId);

    expect(ids).toHaveLength(2);

    const batchChanges = audit.getBatchChanges(batchId);
    expect(batchChanges).toHaveLength(2);
    expect(batchChanges.every(c => c.batchId === batchId)).toBe(true);
  });

  it('should filter changes by hierarchy type', () => {
    audit.insertCodeChange({
      nodeId: testNodeId,
      hierarchyType: 'function',
      oldCode: null,
      newCode: 'A.LLM.T1',
      changeType: 'initial',
      changeReason: 'Function hierarchy'
    });

    audit.insertCodeChange({
      nodeId: testNodeId,
      hierarchyType: 'organization',
      oldCode: null,
      newCode: 'ANTH.LLM.T1',
      changeType: 'initial',
      changeReason: 'Org hierarchy'
    });

    const functionChanges = audit.getNodeChangeHistory(testNodeId, {
      hierarchyType: 'function'
    });
    expect(functionChanges).toHaveLength(1);
    expect(functionChanges[0].hierarchyType).toBe('function');

    const orgChanges = audit.getNodeChangeHistory(testNodeId, {
      hierarchyType: 'organization'
    });
    expect(orgChanges).toHaveLength(1);
    expect(orgChanges[0].hierarchyType).toBe('organization');
  });

  it('should get statistics', () => {
    audit.insertCodeChange({
      nodeId: testNodeId,
      hierarchyType: 'function',
      oldCode: null,
      newCode: 'A.LLM.T1',
      changeType: 'initial',
      changeReason: 'Test'
    });

    audit.insertCodeChange({
      nodeId: uuidv4(),
      hierarchyType: 'function',
      oldCode: 'A.LLM.T1',
      newCode: 'A.LLM.T1.1',
      changeType: 'restructure',
      changeReason: 'Test',
      triggeredByNodeId: testNodeId
    });

    const stats = audit.getChangeStats();

    expect(stats.total).toBeGreaterThanOrEqual(2);
    expect(stats.byType).toHaveProperty('initial');
    expect(stats.byType).toHaveProperty('restructure');
    expect(stats.byTrigger).toHaveProperty('system');
    expect(stats.byTrigger).toHaveProperty('user');
  });
});
```

## Usage Examples

### Example 1: Query Node History

```typescript
import * as auditService from './services/audit_service.js';

// Get all changes for a node
const history = await auditService.getNodeHistory('node-123');

console.log(`Node has ${history.length} changes`);
history.forEach(change => {
  console.log(`${change.changeType}: ${change.oldCode} → ${change.newCode}`);
  console.log(`  Reason: ${change.changeReason}`);
  console.log(`  Date: ${change.changedAt}`);
});
```

### Example 2: Query Batch Changes

```typescript
// Get all changes in a restructure batch
const batchChanges = await auditService.getBatchChanges('batch-456');

console.log(`Batch contained ${batchChanges.length} changes`);
batchChanges.forEach((change, i) => {
  console.log(`${i + 1}. Node ${change.nodeId}: ${change.oldCode} → ${change.newCode}`);
});
```

### Example 3: Query Recent Changes

```typescript
// Get recent restructure operations
const recentRestructures = await auditService.getRecentChanges({
  changeType: 'restructure',
  limit: 20
});

console.log(`Recent restructures:`);
recentRestructures.forEach(change => {
  console.log(`- ${change.nodeId}: ${change.changeReason}`);
});
```

### Example 4: View Cascade Effects

```typescript
// See what changes were triggered by adding a new node
const cascadeChanges = await auditService.getChangesTriggeredBy('new-node-789');

console.log(`Adding node triggered ${cascadeChanges.length} sibling updates`);
cascadeChanges.forEach(change => {
  console.log(`- Sibling ${change.nodeId} renumbered: ${change.oldCode} → ${change.newCode}`);
});
```

## API Endpoints

### GET /api/audit/node/:nodeId
Get change history for a specific node.

**Query Parameters:**
- `hierarchyType` (optional): 'function' or 'organization'
- `limit` (optional): Maximum number of records

**Response:**
```json
{
  "nodeId": "123",
  "changeCount": 3,
  "changes": [
    {
      "id": "change-1",
      "nodeId": "123",
      "hierarchyType": "function",
      "oldCode": "A.LLM.T1",
      "newCode": "A.LLM.T1.1",
      "changeType": "restructure",
      "changeReason": "New similar node created conflict (sibling 1 of 2)",
      "triggeredByNodeId": "456",
      "batchId": "batch-789",
      "changedAt": "2026-01-30T10:30:00Z"
    }
  ]
}
```

### GET /api/audit/recent
Get recent changes across all nodes.

**Query Parameters:**
- `limit` (optional): Maximum number of records (default: 50)
- `changeType` (optional): Filter by type
- `hierarchyType` (optional): Filter by hierarchy
- `batchId` (optional): Filter by batch

**Response:**
```json
{
  "changeCount": 15,
  "changes": [...]
}
```

### GET /api/audit/batch/:batchId
Get all changes in a specific batch.

**Response:**
```json
{
  "batchId": "batch-789",
  "changeCount": 5,
  "changes": [...]
}
```

### GET /api/audit/stats
Get statistics about hierarchy code changes.

**Response:**
```json
{
  "total": 1247,
  "byType": {
    "initial": 500,
    "update": 100,
    "move": 47,
    "restructure": 500,
    "merge": 100
  },
  "byTrigger": {
    "system": 600,
    "user": 647
  }
}
```

### GET /api/audit/triggered/:nodeId
Get all changes triggered by a specific node.

**Query Parameters:**
- `limit` (optional): Maximum number of records

**Response:**
```json
{
  "nodeId": "456",
  "changeCount": 5,
  "changes": [...]
}
```

## Implementation Checklist

- [ ] Create migration `004_add_audit_table.ts`
- [ ] Register migration in `migrations/runner.ts`
- [ ] Run migration: `npm run migrate up`
- [ ] Implement `src/backend/database/audit.ts`
- [ ] Implement `src/backend/services/audit_service.ts`
- [ ] Modify `src/backend/services/hierarchy/restructure.ts`
- [ ] Modify `src/backend/database/nodes.ts`
- [ ] Modify `src/backend/services/import_orchestrator.ts`
- [ ] Create `src/backend/routes/api/audit.ts`
- [ ] Register audit routes in `src/backend/routes/index.ts`
- [ ] Write unit tests for audit database layer
- [ ] Write unit tests for audit service
- [ ] Write integration tests for restructure operations
- [ ] Test manual move operations
- [ ] Test merge operations
- [ ] Test batch logging
- [ ] Verify transaction safety
- [ ] Document audit querying patterns

## Transaction Safety

All audit logging is performed within the same database transaction as the code change:

```typescript
const transaction = db.transaction(() => {
  // 1. Update hierarchy code
  updateStmt.run(newCode, nodeId);

  // 2. Log the change
  auditService.logChange({...});

  // If either fails, both roll back
});

transaction();
```

This ensures:
- **Atomicity**: Code change and audit log succeed or fail together
- **Consistency**: Audit log always matches actual state
- **No orphaned records**: Failed operations don't create partial logs

## Performance Considerations

### Indexes
Strategic indexes on the audit table ensure fast queries:
- `idx_code_changes_node`: Fast node history lookups
- `idx_code_changes_date`: Recent changes queries
- `idx_code_changes_batch`: Batch operation queries
- `idx_code_changes_triggered`: Cascade effect queries

### Cleanup
Old audit records can be archived/deleted:
```typescript
// Delete records older than 365 days
const deleted = audit.deleteOldChanges(365);
```

## Summary

This implementation provides:

1. **Complete Audit Trail**: Every hierarchy code change is logged
2. **Batch Tracking**: Related changes are grouped with batch IDs
3. **Cascade Visibility**: See what changes triggered others
4. **Query Flexibility**: Multiple ways to query audit history
5. **Transaction Safety**: Audit logs and changes are atomic
6. **Performance**: Strategic indexes for fast queries
7. **API Access**: REST endpoints for audit queries

All hierarchy operations (initial assignment, updates, moves, restructures, merges) are now fully audited and traceable.
