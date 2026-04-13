// ============================================================
// Node API Routes
// ============================================================

import { Request, Response } from 'express';
import {
  createNode as dbCreateNode,
  readNode,
  readNodes,
  updateNode as dbUpdateNode,
  deleteNode as dbDeleteNode,
  getAllNodes as dbGetAllNodes,
  getNodesPaginated,
  countNodes,
  mergeNodes as dbMergeNodes,
  updateSurfaceMode,
} from '../database/nodes.js';
import {
  validatePaginationParams,
  buildPaginatedResponse,
} from '../types/pagination.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * GET /api/nodes
 * Supports optional pagination via query params: ?page=1&limit=20
 * If no pagination params are provided, returns all nodes (backward compatible)
 * If pagination params are provided, returns paginated response with metadata
 */
export const getAllNodes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { page, limit } = req.query;

  // Check if pagination was requested
  const hasPaginationParams = page !== undefined || limit !== undefined;

  if (hasPaginationParams) {
    // Validate and normalize pagination parameters
    const pagination = validatePaginationParams(
      page as string | undefined,
      limit as string | undefined
    );

    // Get paginated data and total count
    const nodes = getNodesPaginated(pagination);
    const total = countNodes();

    // Return paginated response
    res.json(buildPaginatedResponse(nodes, total, pagination.page, pagination.limit));
  } else {
    // Safety cap: if total exceeds 500, return paginated response instead of unbounded
    const total = countNodes();
    if (total <= 500) {
      const nodes = dbGetAllNodes();
      res.json(nodes);
    } else {
      const pagination = { page: 1, limit: 500 };
      const nodes = getNodesPaginated(pagination);
      res.json(buildPaginatedResponse(nodes, total, pagination.page, pagination.limit));
    }
  }
});

export const getNode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const node = readNode(req.params.id);
  if (!node) {
    res.status(404).json({ error: 'Node not found' });
    return;
  }
  res.json(node);
});

export const createNode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const node = dbCreateNode(req.body);
  res.status(201).json(node);
});

export const updateNode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const node = dbUpdateNode(req.params.id, req.body);
  res.json(node);
});

export const deleteNode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  dbDeleteNode(req.params.id);
  res.json({ success: true });
});

export const mergeNodes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id: primaryId } = req.params;
  const { secondaryId, options } = req.body;

  if (!secondaryId) {
    res.status(400).json({ error: 'secondaryId is required' });
    return;
  }

  // Use database-level merge function which handles everything atomically
  // within a transaction (update primary + delete secondary)
  const updated = dbMergeNodes(primaryId, secondaryId, options);

  if (!updated) {
    res.status(404).json({ error: 'One or both nodes not found' });
    return;
  }

  res.json(updated);
});

export const moveNode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id: nodeId } = req.params;
  const { targetParentId, targetHierarchy } = req.body;

  const node = readNode(nodeId);
  if (!node) {
    res.status(404).json({ error: 'Node not found' });
    return;
  }

  // Update parent reference based on hierarchy
  const updateData: any = {};
  if (targetHierarchy === 'function') {
    updateData.function_parent_id = targetParentId;
    updateData.organization_parent_id = null;
  } else {
    updateData.organization_parent_id = targetParentId;
    updateData.function_parent_id = null;
  }

  const updated = dbUpdateNode(nodeId, updateData);
  res.json(updated);
});

export const getRelatedNodes = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id: nodeId } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;

  // Validate nodeId exists
  const node = readNode(nodeId);
  if (!node) {
    res.status(404).json({ error: 'Node not found' });
    return;
  }

  // Get similar nodes from similarity database
  const { getSimilarNodes } = await import('../database/similarity.js');
  const similarNodes = getSimilarNodes(nodeId, limit);

  if (similarNodes.length === 0) {
    res.json({
      nodeId,
      related: [],
    });
    return;
  }

  // Batch load full node details
  const nodeIds = similarNodes.map(s => s.node_id);
  const nodes = readNodes(nodeIds) as Record<string, any>[];

  // Build response with node details and similarity scores
  const related = similarNodes.map((sim, index) => {
    const relatedNode = nodes[index];
    if (!relatedNode) return null;

    // Extract metadata from node
    const extractedFields = (relatedNode.extracted_fields as Record<string, any>) || {};
    const metadataTags = (relatedNode.metadata_tags as string[]) || [];

    // Get shared metadata codes by comparing with source node
    const sourceMetadataTags = ((node.metadata_tags as string[]) || []);
    const sharedAttributes = metadataTags.filter(tag =>
      sourceMetadataTags.includes(tag)
    ).slice(0, 5); // Limit to 5 for display

    return {
      node: {
        id: relatedNode.id as string,
        title: relatedNode.title as string,
        url: (relatedNode.url as string) || '',
        segment: extractedFields.segment || '',
        category: extractedFields.category || '',
        contentType: extractedFields.contentType || '',
        logo_url: relatedNode.logo_url as string | undefined,
        phrase_description: relatedNode.phrase_description as string | undefined,
      },
      similarityScore: Math.round((sim.similarity_score as number) * 100), // Convert 0-1 to 0-100
      sharedAttributes,
    };
  }).filter(Boolean); // Remove any null entries

  res.json({
    nodeId,
    related,
  });
});

export const getBacklinks = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id: nodeId } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

  // Validate nodeId exists
  const node = readNode(nodeId);
  if (!node) {
    res.status(404).json({ error: 'Node not found' });
    return;
  }

  // Get similar nodes from similarity database - these are "backlinks" in the sense
  // that they reference/relate to this node through similarity scores
  const { getSimilarNodes } = await import('../database/similarity.js');
  const similarNodes = getSimilarNodes(nodeId, limit);

  if (similarNodes.length === 0) {
    res.json({
      nodeId,
      backlinks: [],
    });
    return;
  }

  // Batch load full node details
  const nodeIds = similarNodes.map(s => s.node_id);
  const nodes = readNodes(nodeIds) as Record<string, any>[];

  // Build response with backlink details
  const backlinks = similarNodes.map((sim, index) => {
    const backlinkNode = nodes[index];
    if (!backlinkNode) return null;

    // Extract metadata from node
    const extractedFields = (backlinkNode.extracted_fields as Record<string, any>) || {};
    const metadataTags = (backlinkNode.metadata_tags as string[]) || [];

    // Get shared metadata codes by comparing with source node
    const sourceMetadataTags = ((node.metadata_tags as string[]) || []);
    const sharedAttributes = metadataTags.filter(tag =>
      sourceMetadataTags.includes(tag)
    );

    // Determine reference type based on similarity score and shared attributes
    let referenceType: 'similar' | 'sibling' | 'related' | 'manual' = 'related';
    const score = sim.similarity_score as number;

    if (score >= 0.8) {
      referenceType = 'similar';
    } else if (score >= 0.6 && sharedAttributes.length >= 3) {
      referenceType = 'sibling';
    } else if (sim.computation_method === 'manual') {
      referenceType = 'manual';
    }

    return {
      node: {
        id: backlinkNode.id as string,
        title: backlinkNode.title as string,
        segment: extractedFields.segment || '',
        category: extractedFields.category || '',
        contentType: extractedFields.contentType || '',
        logo_url: backlinkNode.logo_url as string | undefined,
        phrase_description: backlinkNode.phrase_description as string | undefined,
      },
      referenceType,
      strength: Math.round(score * 100), // Convert 0-1 to 0-100
      sharedAttributes: sharedAttributes.slice(0, 5), // Limit to 5 for display
      computedAt: sim.computed_at,
    };
  }).filter(Boolean); // Remove any null entries

  // Group backlinks by reference type
  const grouped = backlinks.reduce((acc: any, backlink: any) => {
    const type = backlink.referenceType;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(backlink);
    return acc;
  }, {});

  res.json({
    nodeId,
    backlinks,
    grouped,
    total: backlinks.length,
  });
});

/**
 * PATCH /api/nodes/:id/surface-mode
 * Flip a node between read_later and reference surfacing modes (feature #17).
 */
export const setSurfaceMode = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { surface_mode } = req.body as { surface_mode?: string };

  if (surface_mode !== 'read_later' && surface_mode !== 'reference') {
    res.status(400).json({ error: 'surface_mode must be "read_later" or "reference"' });
    return;
  }

  const node = readNode(id);
  if (!node) {
    res.status(404).json({ error: 'Node not found' });
    return;
  }

  updateSurfaceMode(id, surface_mode);
  res.json({ nodeId: id, surfaceMode: surface_mode, updatedAt: new Date().toISOString() });
});
