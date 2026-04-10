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
export async function createSmartCollection(req: Request, res: Response): Promise<void> {
  try {
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
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * PATCH /api/collections/:id/smart-search
 * Update the saved search for an existing smart collection.
 */
export async function updateSmartSearch(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { saved_search_json } = req.body as { saved_search_json?: SavedSearchPayload };
    if (!saved_search_json) {
      res.status(400).json({ error: 'saved_search_json is required' });
      return;
    }
    updateSmartCollectionSearch(id, saved_search_json);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * GET /api/collections/:id/resolve
 * Runs the saved search against the full node list and returns matches.
 * Implemented in-memory; fine for datasets under ~1000 items.
 */
export async function resolveSmartCollection(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const search = getSmartCollectionSearch(id);
    if (!search) {
      res.status(404).json({ error: 'Not a smart collection or search not found' });
      return;
    }

    const all = dbGetAllNodes() as Array<Record<string, unknown>>;
    const matched = filterNodesBySavedSearch(all, search);
    res.json({ id, total: matched.length, items: matched });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

/**
 * GET /api/collections?type=smart|folder|all
 * Flat list of collections filtered by type.
 */
export async function listByType(req: Request, res: Response): Promise<void> {
  try {
    const type = (req.query.type as string) || 'all';
    if (type !== 'smart' && type !== 'folder' && type !== 'all') {
      res.status(400).json({ error: 'type must be smart, folder, or all' });
      return;
    }
    const rows = listCollectionsByType(type);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

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
