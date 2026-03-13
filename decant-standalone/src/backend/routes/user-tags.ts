// ============================================================
// User Tag API Routes
// ============================================================

import { Request, Response } from 'express';
import {
  getAllUserTags,
  getUserTagById,
  createUserTag as dbCreateUserTag,
  updateUserTag as dbUpdateUserTag,
  deleteUserTag as dbDeleteUserTag,
  getTagsForNode,
  assignTagToNode as dbAssignTag,
  removeTagFromNode as dbRemoveTag,
  setNodeTags as dbSetNodeTags,
} from '../database/user_tags.js';

/**
 * GET /api/user-tags
 * Returns all user tags ordered by position
 */
export async function listUserTags(_req: Request, res: Response): Promise<void> {
  try {
    const tags = getAllUserTags();
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * GET /api/user-tags/:id
 * Returns a single user tag
 */
export async function getUserTag(req: Request, res: Response): Promise<void> {
  try {
    const tag = getUserTagById(req.params.id);
    if (!tag) {
      res.status(404).json({ error: 'User tag not found' });
      return;
    }
    res.json(tag);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * POST /api/user-tags
 * Create a new user tag
 */
export async function createUserTag(req: Request, res: Response): Promise<void> {
  try {
    const tag = dbCreateUserTag(req.body);
    res.status(201).json(tag);
  } catch (error) {
    const msg = (error as Error).message;
    if (msg.includes('Maximum') || msg.includes('UNIQUE')) {
      res.status(400).json({ error: msg });
    } else {
      res.status(500).json({ error: msg });
    }
  }
}

/**
 * PUT /api/user-tags/:id
 * Update an existing user tag
 */
export async function updateUserTag(req: Request, res: Response): Promise<void> {
  try {
    const tag = dbUpdateUserTag(req.params.id, req.body);
    res.json(tag);
  } catch (error) {
    const msg = (error as Error).message;
    if (msg.includes('not found')) {
      res.status(404).json({ error: msg });
    } else {
      res.status(400).json({ error: msg });
    }
  }
}

/**
 * DELETE /api/user-tags/:id
 * Delete a user tag (cascades to node assignments)
 */
export async function deleteUserTag(req: Request, res: Response): Promise<void> {
  try {
    dbDeleteUserTag(req.params.id);
    res.json({ success: true });
  } catch (error) {
    const msg = (error as Error).message;
    if (msg.includes('not found')) {
      res.status(404).json({ error: msg });
    } else {
      res.status(500).json({ error: msg });
    }
  }
}

/**
 * GET /api/nodes/:id/user-tags
 * Get all user tags assigned to a node
 */
export async function getNodeUserTags(req: Request, res: Response): Promise<void> {
  try {
    const tags = getTagsForNode(req.params.id);
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * POST /api/nodes/:id/user-tags
 * Assign a tag to a node
 */
export async function assignNodeTag(req: Request, res: Response): Promise<void> {
  try {
    dbAssignTag(req.params.id, req.body.tagId);
    res.status(201).json({ success: true });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

/**
 * PUT /api/nodes/:id/user-tags
 * Set all tags on a node (replaces existing)
 */
export async function setNodeUserTags(req: Request, res: Response): Promise<void> {
  try {
    dbSetNodeTags(req.params.id, req.body.tagIds);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

/**
 * DELETE /api/nodes/:id/user-tags/:tagId
 * Remove a tag from a node
 */
export async function removeNodeTag(req: Request, res: Response): Promise<void> {
  try {
    dbRemoveTag(req.params.id, req.params.tagId);
    res.json({ success: true });
  } catch (error) {
    const msg = (error as Error).message;
    if (msg.includes('not found') || msg.includes('not assigned')) {
      res.status(404).json({ error: msg });
    } else {
      res.status(400).json({ error: msg });
    }
  }
}
