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
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';

/**
 * GET /api/user-tags
 * Returns all user tags ordered by position
 */
export const listUserTags = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const tags = getAllUserTags();
  res.json(tags);
});

/**
 * GET /api/user-tags/:id
 * Returns a single user tag
 */
export const getUserTag = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const tag = getUserTagById(req.params.id);
  if (!tag) {
    res.status(404).json({ error: 'User tag not found' });
    return;
  }
  res.json(tag);
});

/**
 * POST /api/user-tags
 * Create a new user tag
 */
export const createUserTag = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const tag = dbCreateUserTag(req.body);
    res.status(201).json(tag);
  } catch (error) {
    const msg = (error as Error).message;
    if (msg.includes('Maximum') || msg.includes('UNIQUE')) {
      throw new ValidationError(msg);
    }
    throw error;
  }
});

/**
 * PUT /api/user-tags/:id
 * Update an existing user tag
 */
export const updateUserTag = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const tag = dbUpdateUserTag(req.params.id, req.body);
    res.json(tag);
  } catch (error) {
    const msg = (error as Error).message;
    if (msg.includes('not found')) {
      throw new NotFoundError(msg);
    }
    throw new ValidationError(msg);
  }
});

/**
 * DELETE /api/user-tags/:id
 * Delete a user tag (cascades to node assignments)
 */
export const deleteUserTag = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    dbDeleteUserTag(req.params.id);
    res.json({ success: true });
  } catch (error) {
    const msg = (error as Error).message;
    if (msg.includes('not found')) {
      throw new NotFoundError(msg);
    }
    throw error;
  }
});

/**
 * GET /api/nodes/:id/user-tags
 * Get all user tags assigned to a node
 */
export const getNodeUserTags = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const tags = getTagsForNode(req.params.id);
  res.json(tags);
});

/**
 * POST /api/nodes/:id/user-tags
 * Assign a tag to a node
 */
export const assignNodeTag = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  dbAssignTag(req.params.id, req.body.tagId);
  res.status(201).json({ success: true });
});

/**
 * PUT /api/nodes/:id/user-tags
 * Set all tags on a node (replaces existing)
 */
export const setNodeUserTags = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  dbSetNodeTags(req.params.id, req.body.tagIds);
  res.json({ success: true });
});

/**
 * DELETE /api/nodes/:id/user-tags/:tagId
 * Remove a tag from a node
 */
export const removeNodeTag = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    dbRemoveTag(req.params.id, req.params.tagId);
    res.json({ success: true });
  } catch (error) {
    const msg = (error as Error).message;
    if (msg.includes('not found') || msg.includes('not assigned')) {
      throw new NotFoundError(msg);
    }
    throw new ValidationError(msg);
  }
});
