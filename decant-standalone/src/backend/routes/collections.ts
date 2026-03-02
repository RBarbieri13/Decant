// ============================================================
// Collection API Routes
// ============================================================

import { Request, Response } from 'express';
import {
  buildCollectionTree,
  getCollectionById,
  createCollection as dbCreateCollection,
  updateCollection as dbUpdateCollection,
  deleteCollection as dbDeleteCollection,
  reorderCollections,
  getCollectionNodeIds,
  addNodeToCollection as dbAddNode,
  removeNodeFromCollection as dbRemoveNode,
} from '../database/collections.js';

/**
 * GET /api/collections
 * Returns the full collection tree with node counts
 */
export async function listCollections(_req: Request, res: Response): Promise<void> {
  try {
    const tree = buildCollectionTree();
    res.json(tree);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * GET /api/collections/:id
 * Returns a single collection
 */
export async function getCollection(req: Request, res: Response): Promise<void> {
  try {
    const collection = getCollectionById(req.params.id);
    if (!collection) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }
    res.json(collection);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * POST /api/collections
 * Create a new collection
 */
export async function createCollection(req: Request, res: Response): Promise<void> {
  try {
    const collection = dbCreateCollection(req.body);
    res.status(201).json(collection);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

/**
 * PUT /api/collections/:id
 * Update an existing collection
 */
export async function updateCollection(req: Request, res: Response): Promise<void> {
  try {
    const collection = dbUpdateCollection(req.params.id, req.body);
    res.json(collection);
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
 * DELETE /api/collections/:id
 * Delete a collection (cascades to children and collection_nodes)
 */
export async function deleteCollection(req: Request, res: Response): Promise<void> {
  try {
    dbDeleteCollection(req.params.id);
    res.json({ success: true });
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
 * POST /api/collections/:id/reorder
 * Reorder children of a collection (or root-level if id is 'root')
 */
export async function reorderChildren(req: Request, res: Response): Promise<void> {
  try {
    const parentId = req.params.id === 'root' ? null : req.params.id;
    reorderCollections(parentId, req.body.orderedIds);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

/**
 * GET /api/collections/:id/nodes
 * Get all node IDs in a collection
 */
export async function listCollectionNodes(req: Request, res: Response): Promise<void> {
  try {
    const nodeIds = getCollectionNodeIds(req.params.id);
    res.json(nodeIds);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * POST /api/collections/:id/nodes
 * Add a node to a collection
 */
export async function addNode(req: Request, res: Response): Promise<void> {
  try {
    dbAddNode(req.params.id, req.body.nodeId);
    res.status(201).json({ success: true });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

/**
 * DELETE /api/collections/:id/nodes/:nodeId
 * Remove a node from a collection
 */
export async function removeNode(req: Request, res: Response): Promise<void> {
  try {
    dbRemoveNode(req.params.id, req.params.nodeId);
    res.json({ success: true });
  } catch (error) {
    const msg = (error as Error).message;
    if (msg.includes('not found')) {
      res.status(404).json({ error: msg });
    } else {
      res.status(400).json({ error: msg });
    }
  }
}
