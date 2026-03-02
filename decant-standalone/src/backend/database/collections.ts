// ============================================================
// Collection Operations
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './connection.js';
import { withTransaction } from './transaction.js';

// ============================================================
// Types
// ============================================================

export interface CollectionRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  parent_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionTreeNode {
  id: string;
  name: string;
  icon: string;
  color: string;
  parentId: string | null;
  position: number;
  nodeCount: number;
  children: CollectionTreeNode[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCollectionInput {
  name: string;
  icon?: string;
  color?: string;
  parentId?: string | null;
}

export interface UpdateCollectionInput {
  name?: string;
  icon?: string;
  color?: string;
  parentId?: string | null;
  position?: number;
}

// ============================================================
// Read Operations
// ============================================================

/**
 * Get all collections as a flat list
 */
export function getAllCollections(): CollectionRow[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM collections
    ORDER BY parent_id NULLS FIRST, position ASC
  `).all() as CollectionRow[];
}

/**
 * Get a single collection by ID
 */
export function getCollectionById(id: string): CollectionRow | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM collections WHERE id = ?').get(id) as CollectionRow | undefined;
}

/**
 * Build a tree of all collections with node counts
 */
export function buildCollectionTree(): CollectionTreeNode[] {
  const db = getDatabase();

  // Get all collections
  const rows = db.prepare(`
    SELECT * FROM collections
    ORDER BY parent_id NULLS FIRST, position ASC
  `).all() as CollectionRow[];

  // Get node counts per collection
  const countRows = db.prepare(`
    SELECT collection_id, COUNT(*) as cnt
    FROM collection_nodes
    GROUP BY collection_id
  `).all() as Array<{ collection_id: string; cnt: number }>;

  const countMap = new Map<string, number>();
  for (const row of countRows) {
    countMap.set(row.collection_id, row.cnt);
  }

  // Build tree in-memory
  const nodeMap = new Map<string, CollectionTreeNode>();
  const roots: CollectionTreeNode[] = [];

  // First pass: create all tree nodes
  for (const row of rows) {
    nodeMap.set(row.id, {
      id: row.id,
      name: row.name,
      icon: row.icon,
      color: row.color,
      parentId: row.parent_id,
      position: row.position,
      nodeCount: countMap.get(row.id) ?? 0,
      children: [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  // Second pass: build hierarchy
  for (const row of rows) {
    const node = nodeMap.get(row.id)!;
    if (row.parent_id && nodeMap.has(row.parent_id)) {
      nodeMap.get(row.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ============================================================
// Write Operations
// ============================================================

/**
 * Create a new collection
 */
export function createCollection(input: CreateCollectionInput): CollectionRow {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  // Get next position for this parent
  const maxPos = db.prepare(
    'SELECT MAX(position) as max_pos FROM collections WHERE parent_id IS ?'
  ).get(input.parentId ?? null) as { max_pos: number | null } | undefined;
  const position = (maxPos?.max_pos ?? -1) + 1;

  db.prepare(`
    INSERT INTO collections (id, name, icon, color, parent_id, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.name,
    input.icon ?? '📁',
    input.color ?? '#2d5b47',
    input.parentId ?? null,
    position,
    now,
    now,
  );

  return getCollectionById(id)!;
}

/**
 * Update an existing collection
 */
export function updateCollection(id: string, input: UpdateCollectionInput): CollectionRow {
  const db = getDatabase();
  const now = new Date().toISOString();

  const setClauses: string[] = ['updated_at = ?'];
  const values: (string | number | null)[] = [now];

  if (input.name !== undefined) {
    setClauses.push('name = ?');
    values.push(input.name);
  }
  if (input.icon !== undefined) {
    setClauses.push('icon = ?');
    values.push(input.icon);
  }
  if (input.color !== undefined) {
    setClauses.push('color = ?');
    values.push(input.color);
  }
  if (input.parentId !== undefined) {
    setClauses.push('parent_id = ?');
    values.push(input.parentId);
  }
  if (input.position !== undefined) {
    setClauses.push('position = ?');
    values.push(input.position);
  }

  values.push(id);

  db.prepare(
    `UPDATE collections SET ${setClauses.join(', ')} WHERE id = ?`
  ).run(...values);

  const updated = getCollectionById(id);
  if (!updated) {
    throw new Error(`Collection not found: ${id}`);
  }
  return updated;
}

/**
 * Delete a collection (CASCADE handles children and collection_nodes)
 */
export function deleteCollection(id: string): void {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM collections WHERE id = ?').run(id);
  if (result.changes === 0) {
    throw new Error(`Collection not found: ${id}`);
  }
}

/**
 * Reorder children of a parent collection
 */
export function reorderCollections(parentId: string | null, orderedIds: string[]): void {
  withTransaction(() => {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE collections SET position = ?, updated_at = ? WHERE id = ?');
    const now = new Date().toISOString();

    for (let i = 0; i < orderedIds.length; i++) {
      stmt.run(i, now, orderedIds[i]);
    }
  });
}

// ============================================================
// Collection ↔ Node Operations
// ============================================================

/**
 * Get all node IDs in a collection
 */
export function getCollectionNodeIds(collectionId: string): string[] {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT node_id FROM collection_nodes WHERE collection_id = ? ORDER BY added_at DESC'
  ).all(collectionId) as Array<{ node_id: string }>;
  return rows.map(r => r.node_id);
}

/**
 * Add a node to a collection
 */
export function addNodeToCollection(collectionId: string, nodeId: string): void {
  const db = getDatabase();
  db.prepare(`
    INSERT OR IGNORE INTO collection_nodes (collection_id, node_id, added_at)
    VALUES (?, ?, datetime('now'))
  `).run(collectionId, nodeId);
}

/**
 * Remove a node from a collection
 */
export function removeNodeFromCollection(collectionId: string, nodeId: string): void {
  const db = getDatabase();
  const result = db.prepare(
    'DELETE FROM collection_nodes WHERE collection_id = ? AND node_id = ?'
  ).run(collectionId, nodeId);
  if (result.changes === 0) {
    throw new Error('Node not found in collection');
  }
}
