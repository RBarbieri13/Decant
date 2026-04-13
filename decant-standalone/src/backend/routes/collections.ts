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
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler.js';

/**
 * GET /api/collections
 * Returns the full collection tree with node counts
 */
export const listCollections = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const tree = buildCollectionTree();
  res.json(tree);
});

/**
 * GET /api/collections/:id
 * Returns a single collection
 */
export const getCollection = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const collection = getCollectionById(req.params.id);
  if (!collection) {
    res.status(404).json({ error: 'Collection not found' });
    return;
  }
  res.json(collection);
});

/**
 * POST /api/collections
 * Create a new collection
 */
export const createCollection = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const collection = dbCreateCollection(req.body);
  res.status(201).json(collection);
});

/**
 * PUT /api/collections/:id
 * Update an existing collection
 */
export const updateCollection = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const collection = dbUpdateCollection(req.params.id, req.body);
    res.json(collection);
  } catch (error) {
    const msg = (error as Error).message;
    if (msg.includes('not found')) {
      throw new NotFoundError(msg);
    }
    throw new ValidationError(msg);
  }
});

/**
 * DELETE /api/collections/:id
 * Delete a collection (cascades to children and collection_nodes)
 */
export const deleteCollection = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    dbDeleteCollection(req.params.id);
    res.json({ success: true });
  } catch (error) {
    const msg = (error as Error).message;
    if (msg.includes('not found')) {
      throw new NotFoundError(msg);
    }
    throw new ValidationError(msg);
  }
});

/**
 * POST /api/collections/:id/reorder
 * Reorder children of a collection (or root-level if id is 'root')
 */
export const reorderChildren = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parentId = req.params.id === 'root' ? null : req.params.id;
  reorderCollections(parentId, req.body.orderedIds);
  res.json({ success: true });
});

/**
 * GET /api/collections/:id/nodes
 * Get all node IDs in a collection
 */
export const listCollectionNodes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const nodeIds = getCollectionNodeIds(req.params.id);
  res.json(nodeIds);
});

/**
 * POST /api/collections/:id/nodes
 * Add a node to a collection
 */
export const addNode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  dbAddNode(req.params.id, req.body.nodeId);
  res.status(201).json({ success: true });
});

/**
 * DELETE /api/collections/:id/nodes/:nodeId
 * Remove a node from a collection
 */
export const removeNode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    dbRemoveNode(req.params.id, req.params.nodeId);
    res.json({ success: true });
  } catch (error) {
    const msg = (error as Error).message;
    if (msg.includes('not found')) {
      throw new NotFoundError(msg);
    }
    throw new ValidationError(msg);
  }
});

// ============================================================
// Smart Collections (feature #13)
// ============================================================

import {
  createSmartCollection as dbCreateSmartCollection,
  updateSmartCollectionSearch,
  getSmartCollectionSearch,
  listCollectionsByType,
  type SavedSearchPayload,
} from '../database/collections.js';
import { getAllNodes as dbGetAllNodes } from '../database/nodes.js';

/**
 * POST /api/collections/smart
 * Body: { name, icon?, color?, saved_search_json }
 */
export const createSmartCollection = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { name, icon, color, saved_search_json } = req.body as {
    name?: string;
    icon?: string;
    color?: string;
    saved_search_json?: SavedSearchPayload;
  };
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  if (!saved_search_json || typeof saved_search_json !== 'object') {
    res.status(400).json({ error: 'saved_search_json is required' });
    return;
  }
  const collection = dbCreateSmartCollection(name, saved_search_json, icon, color);
  res.status(201).json(collection);
});

/**
 * PATCH /api/collections/:id/smart-search
 * Update the saved search for an existing smart collection.
 */
export const updateSmartSearch = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { saved_search_json } = req.body as { saved_search_json?: SavedSearchPayload };
  if (!saved_search_json) {
    res.status(400).json({ error: 'saved_search_json is required' });
    return;
  }
  updateSmartCollectionSearch(id, saved_search_json);
  res.json({ success: true, id });
});

/**
 * GET /api/collections/:id/resolve
 * Runs the saved search against the full node list and returns matches.
 * Implemented in-memory; fine for datasets under ~1000 items.
 */
export const resolveSmartCollection = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const search = getSmartCollectionSearch(id);
  if (!search) {
    res.status(404).json({ error: 'Not a smart collection or search not found' });
    return;
  }

  const all = dbGetAllNodes() as Array<Record<string, unknown>>;
  const matched = filterNodesBySavedSearch(all, search);
  res.json({ id, total: matched.length, items: matched });
});

/**
 * GET /api/collections?type=smart|folder|all
 * Flat list of collections filtered by type.
 */
export const listByType = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const type = (req.query.type as string) || 'all';
  if (type !== 'smart' && type !== 'folder' && type !== 'all') {
    res.status(400).json({ error: 'type must be smart, folder, or all' });
    return;
  }
  const rows = listCollectionsByType(type);
  res.json(rows);
});

function filterNodesBySavedSearch(
  nodes: Array<Record<string, unknown>>,
  search: SavedSearchPayload,
): Array<Record<string, unknown>> {
  return nodes.filter((node) => {
    if (search.titleContains) {
      const title = String(node.title ?? '').toLowerCase();
      if (!title.includes(search.titleContains.toLowerCase())) return false;
    }
    if (search.segmentIn?.length) {
      const seg = String(node.segment_code ?? '');
      if (!search.segmentIn.includes(seg)) return false;
    }
    if (search.categoryIn?.length) {
      const cat = String(node.category_code ?? '');
      if (!search.categoryIn.includes(cat)) return false;
    }
    if (search.contentTypeIn?.length) {
      const ct = String(node.content_type_code ?? '');
      if (!search.contentTypeIn.includes(ct)) return false;
    }
    if (search.surfaceMode && search.surfaceMode !== 'all') {
      if (String(node.surface_mode ?? 'reference') !== search.surfaceMode) return false;
    }
    if (search.dateFrom) {
      if (String(node.date_added ?? '') < search.dateFrom) return false;
    }
    if (search.dateTo) {
      if (String(node.date_added ?? '') > search.dateTo) return false;
    }
    if (search.tagsInclude?.length) {
      const tags = Array.isArray(node.metadata_tags) ? (node.metadata_tags as string[]) : [];
      if (!search.tagsInclude.every((t) => tags.includes(t))) return false;
    }
    return true;
  });
}
