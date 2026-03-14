// ============================================================
// User Tag Operations
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './connection.js';
import { withTransaction } from './transaction.js';

// ============================================================
// Types
// ============================================================

export interface UserTagRow {
  id: string;
  name: string;
  color: string;
  emblem: string;
  position: number;
  created_at: string;
}

export interface CreateUserTagInput {
  name: string;
  color?: string;
  emblem?: string;
}

export interface UpdateUserTagInput {
  name?: string;
  color?: string;
  emblem?: string;
  position?: number;
}

// ============================================================
// Tag CRUD
// ============================================================

export function getAllUserTags(): UserTagRow[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM user_tags ORDER BY position ASC, created_at ASC').all() as UserTagRow[];
}

export function getUserTagById(id: string): UserTagRow | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM user_tags WHERE id = ?').get(id) as UserTagRow | undefined;
}

export function createUserTag(input: CreateUserTagInput): UserTagRow {
  const db = getDatabase();
  const id = uuidv4();

  // Get next position
  const maxPos = db.prepare('SELECT MAX(position) as max_pos FROM user_tags').get() as { max_pos: number | null } | undefined;
  const position = (maxPos?.max_pos ?? -1) + 1;

  // Enforce max 20 tags
  const count = db.prepare('SELECT COUNT(*) as cnt FROM user_tags').get() as { cnt: number };
  if (count.cnt >= 20) {
    throw new Error('Maximum of 20 user tags allowed');
  }

  db.prepare(`
    INSERT INTO user_tags (id, name, color, emblem, position)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, input.name, input.color ?? '#6b7280', input.emblem ?? '🏷', position);

  return getUserTagById(id)!;
}

export function updateUserTag(id: string, input: UpdateUserTagInput): UserTagRow {
  const db = getDatabase();

  const setClauses: string[] = [];
  const values: (string | number)[] = [];

  if (input.name !== undefined) {
    setClauses.push('name = ?');
    values.push(input.name);
  }
  if (input.color !== undefined) {
    setClauses.push('color = ?');
    values.push(input.color);
  }
  if (input.emblem !== undefined) {
    setClauses.push('emblem = ?');
    values.push(input.emblem);
  }
  if (input.position !== undefined) {
    setClauses.push('position = ?');
    values.push(input.position);
  }

  if (setClauses.length === 0) {
    throw new Error('At least one field must be provided for update');
  }

  values.push(id);
  db.prepare(`UPDATE user_tags SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

  const updated = getUserTagById(id);
  if (!updated) throw new Error(`User tag not found: ${id}`);
  return updated;
}

export function deleteUserTag(id: string): void {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM user_tags WHERE id = ?').run(id);
  if (result.changes === 0) {
    throw new Error(`User tag not found: ${id}`);
  }
}

// ============================================================
// Node ↔ Tag Assignment
// ============================================================

export function getTagsForNode(nodeId: string): UserTagRow[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT ut.* FROM user_tags ut
    JOIN node_user_tags nut ON nut.tag_id = ut.id
    WHERE nut.node_id = ?
    ORDER BY ut.position ASC
  `).all(nodeId) as UserTagRow[];
}

export function getTagsForNodes(nodeIds: string[]): Map<string, UserTagRow[]> {
  if (nodeIds.length === 0) return new Map();

  const db = getDatabase();
  const placeholders = nodeIds.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT nut.node_id, ut.id, ut.name, ut.color, ut.emblem, ut.position, ut.created_at
    FROM node_user_tags nut
    JOIN user_tags ut ON ut.id = nut.tag_id
    WHERE nut.node_id IN (${placeholders})
    ORDER BY ut.position ASC
  `).all(...nodeIds) as (UserTagRow & { node_id: string })[];

  const result = new Map<string, UserTagRow[]>();
  for (const row of rows) {
    const nodeId = row.node_id;
    if (!result.has(nodeId)) result.set(nodeId, []);
    result.get(nodeId)!.push({
      id: row.id,
      name: row.name,
      color: row.color,
      emblem: row.emblem,
      position: row.position,
      created_at: row.created_at,
    });
  }
  return result;
}

export function assignTagToNode(nodeId: string, tagId: string): void {
  const db = getDatabase();
  db.prepare(`
    INSERT OR IGNORE INTO node_user_tags (node_id, tag_id)
    VALUES (?, ?)
  `).run(nodeId, tagId);
}

export function removeTagFromNode(nodeId: string, tagId: string): void {
  const db = getDatabase();
  const result = db.prepare(
    'DELETE FROM node_user_tags WHERE node_id = ? AND tag_id = ?'
  ).run(nodeId, tagId);
  if (result.changes === 0) {
    throw new Error('Tag not assigned to this node');
  }
}

export function setNodeTags(nodeId: string, tagIds: string[]): void {
  withTransaction(() => {
    const db = getDatabase();
    db.prepare('DELETE FROM node_user_tags WHERE node_id = ?').run(nodeId);
    const stmt = db.prepare('INSERT INTO node_user_tags (node_id, tag_id) VALUES (?, ?)');
    for (const tagId of tagIds) {
      stmt.run(nodeId, tagId);
    }
  });
}
