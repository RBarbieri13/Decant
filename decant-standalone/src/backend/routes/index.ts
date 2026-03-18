// ============================================================
// API Routes
// ============================================================

import { Express, Request, Response } from 'express';
import * as nodeRoutes from './nodes.js';
import * as hierarchyRoutes from './hierarchy.js';
import * as searchRoutes from './search.js';
import * as importRoutes from './import.js';
import * as batchImportRoutes from './batch-import.js';
import * as healthRoutes from './health.js';
import * as backupRoutes from './backup.js';
import * as queueRoutes from './queue.js';
import * as auditRoutes from './audit.js';
import * as reclassifyRoutes from './reclassify.js';
import * as collectionRoutes from './collections.js';
import * as userTagRoutes from './user-tags.js';
import * as imessageRoutes from './imessage.js';
import * as summaryRoutes from './summary.js';
import * as dynamicHierarchyRoutes from './dynamic-hierarchy.js';
import { getSegmentLabels, getCategoryLabels } from '../database/taxonomy_ops.js';
import { importLimiter, settingsLimiter } from '../middleware/rateLimit.js';
// NOTE: processing_queue.js removed — admin routes now use hierarchy engine
import { getDatabase } from '../database/connection.js';
import { importUrl as orchestratorImportUrl } from '../services/import/orchestrator.js';
import { getNotificationService, type NotificationEvent } from '../services/notifications/index.js';
import { log } from '../logger/index.js';
import { metricsEndpoint } from '../services/metrics/index.js';
import * as appCache from '../cache/index.js';

// Validation middleware
import { validateBody, validateQuery, validateParams, validate } from '../middleware/validate.js';

// Validation schemas
import {
  CreateNodeSchema,
  UpdateNodeSchema,
  ImportUrlSchema,
  SetApiKeySchema,
  SearchQuerySchema,
  FilteredSearchSchema,
  MoveNodeSchema,
  MergeNodesSchema,
  UuidParamSchema,
  HierarchyViewParamSchema,
  CreateCollectionSchema,
  UpdateCollectionSchema,
  AddNodeToCollectionSchema,
  CreateUserTagSchema,
  UpdateUserTagSchema,
  AssignUserTagSchema,
  SetNodeTagsSchema,
} from '../validation/schemas.js';

/**
 * Register health check routes (NOT rate limited)
 * These should be registered BEFORE the global rate limiter
 */
export function registerHealthRoutes(app: Express): void {
  app.get('/health', healthRoutes.healthCheck);
  app.get('/health/live', healthRoutes.liveness);
  app.get('/health/ready', healthRoutes.readiness);
  app.get('/health/full', healthRoutes.fullHealth);
  app.get('/health/component/:name', healthRoutes.componentHealth);
  app.get('/metrics', metricsEndpoint);

  // Lightweight health check for Chrome extension (no rate limit, instant response)
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ success: true, app: 'decant', ready: true });
  });
}

/**
 * Register API routes (rate limited and validated)
 * These are registered AFTER the global rate limiter
 */
export function registerAPIRoutes(app: Express): void {
  // ============================================================
  // Node routes
  // ============================================================

  // GET /api/nodes - Get all nodes (no validation needed)
  app.get('/api/nodes', nodeRoutes.getAllNodes);

  // GET /api/nodes/:id - Get single node
  app.get('/api/nodes/:id', validateParams(UuidParamSchema), nodeRoutes.getNode);

  // POST /api/nodes - Create new node
  app.post('/api/nodes', validateBody(CreateNodeSchema), nodeRoutes.createNode);

  // PUT /api/nodes/:id - Update existing node
  app.put(
    '/api/nodes/:id',
    validate({ params: UuidParamSchema, body: UpdateNodeSchema }),
    nodeRoutes.updateNode
  );

  // DELETE /api/nodes/:id - Delete node
  app.delete('/api/nodes/:id', validateParams(UuidParamSchema), nodeRoutes.deleteNode);

  // POST /api/nodes/:id/merge - Merge two nodes
  app.post(
    '/api/nodes/:id/merge',
    validate({ params: UuidParamSchema, body: MergeNodesSchema }),
    nodeRoutes.mergeNodes
  );

  // POST /api/nodes/:id/move - Move node to new parent
  app.post(
    '/api/nodes/:id/move',
    validate({ params: UuidParamSchema, body: MoveNodeSchema }),
    nodeRoutes.moveNode
  );

  // GET /api/nodes/:id/related - Get related/similar nodes
  app.get('/api/nodes/:id/related', validateParams(UuidParamSchema), nodeRoutes.getRelatedNodes);

  // GET /api/nodes/:id/backlinks - Get nodes that reference/link to this node
  app.get('/api/nodes/:id/backlinks', validateParams(UuidParamSchema), nodeRoutes.getBacklinks);

  // POST /api/nodes/reclassify - Reclassify all nodes using AI
  app.post('/api/nodes/reclassify', reclassifyRoutes.reclassifyAll);

  // POST /api/nodes/:id/reclassify - Reclassify a single node using AI
  app.post('/api/nodes/:id/reclassify', validateParams(UuidParamSchema), reclassifyRoutes.reclassifyNode);

  // GET /api/nodes/:id/history - Get node audit history
  app.get('/api/nodes/:id/history', validateParams(UuidParamSchema), auditRoutes.getNodeAuditHistory);

  // GET /api/nodes/:id/summary - Get cached AI summary for node
  app.get('/api/nodes/:id/summary', validateParams(UuidParamSchema), summaryRoutes.getNodeSummary);

  // POST /api/nodes/:id/summary/generate - Generate or regenerate AI summary
  app.post('/api/nodes/:id/summary/generate', validateParams(UuidParamSchema), summaryRoutes.generateSummary);

  // ============================================================
  // Hierarchy routes
  // ============================================================

  // GET /api/hierarchy/tree/:view - Get hierarchy tree for a view
  app.get(
    '/api/hierarchy/tree/:view',
    validateParams(HierarchyViewParamSchema),
    hierarchyRoutes.getHierarchyTree
  );

  // GET /api/hierarchy/segments - Get all segments (no validation needed)
  app.get('/api/hierarchy/segments', hierarchyRoutes.getSegments);

  // GET /api/hierarchy/organizations - Get all organizations (no validation needed)
  app.get('/api/hierarchy/organizations', hierarchyRoutes.getOrganizations);

  // GET /api/taxonomy/labels - Get current segment and category display labels
  app.get('/api/taxonomy/labels', (_req: Request, res: Response) => {
    try {
      res.json({
        segments: getSegmentLabels(),
        categories: getCategoryLabels(),
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // ============================================================
  // Dynamic Hierarchy routes
  // ============================================================

  // GET /api/hierarchy/dynamic/tree - Dynamic hierarchy tree (N-deep recursive)
  app.get('/api/hierarchy/dynamic/tree', dynamicHierarchyRoutes.getDynamicTree);

  // GET /api/hierarchy/dynamic/stats - Hierarchy statistics
  app.get('/api/hierarchy/dynamic/stats', dynamicHierarchyRoutes.getHierarchyStats);

  // POST /api/hierarchy/rebuild - Full global refinement (user-clickable)
  app.post('/api/hierarchy/rebuild', dynamicHierarchyRoutes.rebuildHierarchy);

  // POST /api/hierarchy/rebuild-full - Complete rebuild from scratch
  app.post('/api/hierarchy/rebuild-full', dynamicHierarchyRoutes.rebuildFullHierarchy);

  // POST /api/hierarchy/node/:id/move - Move node to different branch
  app.post('/api/hierarchy/node/:id/move', validateParams(UuidParamSchema), dynamicHierarchyRoutes.moveNodeToBranch);

  // ============================================================
  // Search routes
  // ============================================================

  // GET /api/search - Search nodes
  app.get('/api/search', validateQuery(SearchQuerySchema), searchRoutes.search);

  // GET /api/search/advanced - Advanced search with filters and facets
  app.get('/api/search/advanced', validateQuery(SearchQuerySchema), searchRoutes.searchAdvanced);

  // POST /api/search/filtered - Filtered search with comprehensive filter support
  app.post('/api/search/filtered', validateBody(FilteredSearchSchema), searchRoutes.searchFiltered);

  // ============================================================
  // Import routes (with stricter rate limiting for expensive AI calls)
  // ============================================================

  // POST /api/import - Import URL with AI classification
  app.post('/api/import', importLimiter, validateBody(ImportUrlSchema), importRoutes.importUrl);

  // ============================================================
  // Batch Import routes
  // ============================================================

  // POST /api/batch-import - Start batch import of multiple URLs
  app.post('/api/batch-import', importLimiter, batchImportRoutes.startBatch);

  // POST /api/batch-import/:batchId/cancel - Cancel a batch import
  app.post('/api/batch-import/:batchId/cancel', batchImportRoutes.cancelBatch);

  // GET /api/batch-import/:batchId - Get batch import status
  app.get('/api/batch-import/:batchId', batchImportRoutes.getBatchStatus);

  // ============================================================
  // iMessage routes
  // ============================================================

  // POST /api/imessage/extract-urls - Extract recent URLs from self-texts
  app.post('/api/imessage/extract-urls', imessageRoutes.extractUrls);

  // ============================================================
  // Settings routes (with rate limiting for sensitive endpoints)
  // ============================================================

  // POST /api/settings/api-key - Set OpenAI API key
  app.post(
    '/api/settings/api-key',
    settingsLimiter,
    validateBody(SetApiKeySchema),
    importRoutes.setApiKeyEndpoint
  );

  // GET /api/settings/api-key/status - Check API key status (no validation needed)
  app.get('/api/settings/api-key/status', settingsLimiter, importRoutes.getApiKeyStatus);

  // DELETE /api/settings/api-key - Delete stored API key
  app.delete('/api/settings/api-key', settingsLimiter, importRoutes.deleteApiKeyEndpoint);

  // ============================================================
  // Backup routes
  // ============================================================

  // POST /api/backup - Create a new backup
  app.post('/api/backup', backupRoutes.createBackup);

  // GET /api/backups - List all backups
  app.get('/api/backups', backupRoutes.listBackups);

  // POST /api/restore - Restore from backup
  app.post('/api/restore', backupRoutes.restoreBackup);

  // DELETE /api/backups/:filename - Delete a backup file
  app.delete('/api/backups/:filename', backupRoutes.deleteBackupFile);

  // ============================================================
  // Export/Import routes
  // ============================================================

  // GET /api/export - Export all data as JSON
  app.get('/api/export', backupRoutes.exportDataAsJson);

  // POST /api/import/json - Import data from JSON
  app.post('/api/import/json', backupRoutes.importDataFromJson);

  // ============================================================
  // Queue routes (background job processing)
  // ============================================================

  // GET /api/queue/status - Get queue statistics
  app.get('/api/queue/status', queueRoutes.getQueueStatus);

  // GET /api/queue/jobs - List jobs with optional filters
  app.get('/api/queue/jobs', queueRoutes.listJobs);

  // GET /api/queue/jobs/:nodeId - Get job for specific node
  app.get('/api/queue/jobs/:nodeId', queueRoutes.getJobForNode);

  // POST /api/queue/retry/:jobId - Retry a failed job
  app.post('/api/queue/retry/:jobId', queueRoutes.retryJob);

  // DELETE /api/queue/jobs/:jobId - Cancel/remove a job
  app.delete('/api/queue/jobs/:jobId', queueRoutes.cancelJob);

  // POST /api/queue/clear - Clear completed jobs
  app.post('/api/queue/clear', queueRoutes.clearCompletedJobs);

  // ============================================================
  // Admin routes (one-time operations)
  // ============================================================

  // POST /api/admin/rebuild-hierarchy - Alias for hierarchy rebuild (admin convenience)
  app.post('/api/admin/rebuild-hierarchy', async (_req: Request, res: Response) => {
    try {
      const { getHierarchyEngine, hasHierarchyEngine } = await import('../services/hierarchy/hierarchy_engine.js');
      if (!hasHierarchyEngine()) {
        res.status(503).json({ error: 'Hierarchy engine not initialized' });
        return;
      }
      const result = await getHierarchyEngine().buildFullHierarchy();
      appCache.invalidate('tree:*');
      res.json({ success: true, ...result });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error('Admin rebuild-hierarchy failed', { error: msg, module: 'admin' });
      res.status(500).json({ error: msg });
    }
  });

  // POST /api/admin/rescrape-poor-quality - Re-import nodes with minimal extraction quality
  app.post('/api/admin/rescrape-poor-quality', async (_req: Request, res: Response) => {
    try {
      const db = getDatabase();
      const rows = db.prepare(
        `SELECT id, url FROM nodes WHERE (extraction_quality = 'minimal' OR extraction_quality IS NULL) AND is_deleted = 0`
      ).all() as { id: string; url: string }[];

      if (rows.length === 0) {
        res.json({ count: 0, message: 'No nodes with minimal extraction quality found' });
        return;
      }

      // Re-queue each node for import with forceRefresh
      let queued = 0;
      const errors: string[] = [];

      for (const row of rows) {
        try {
          await orchestratorImportUrl(row.url, { forceRefresh: true });
          queued++;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          errors.push(`${row.id}: ${msg}`);
        }
      }

      log.info('Rescrape poor quality completed', {
        queued,
        total: rows.length,
        errors: errors.length,
        module: 'admin',
      });

      res.json({
        count: queued,
        message: `Queued ${queued} nodes for re-scraping`,
        ...(errors.length > 0 && { errors }),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error('Rescrape poor quality failed', { error: msg, module: 'admin' });
      res.status(500).json({ error: msg });
    }
  });

  // ============================================================
  // Collection routes
  // ============================================================

  // GET /api/collections - Get collection tree
  app.get('/api/collections', collectionRoutes.listCollections);

  // GET /api/collections/:id - Get single collection
  app.get('/api/collections/:id', validateParams(UuidParamSchema), collectionRoutes.getCollection);

  // POST /api/collections - Create new collection
  app.post('/api/collections', validateBody(CreateCollectionSchema), collectionRoutes.createCollection);

  // PUT /api/collections/:id - Update collection
  app.put(
    '/api/collections/:id',
    validate({ params: UuidParamSchema, body: UpdateCollectionSchema }),
    collectionRoutes.updateCollection
  );

  // DELETE /api/collections/:id - Delete collection
  app.delete('/api/collections/:id', validateParams(UuidParamSchema), collectionRoutes.deleteCollection);

  // POST /api/collections/:id/reorder - Reorder children
  app.post('/api/collections/:id/reorder', collectionRoutes.reorderChildren);

  // GET /api/collections/:id/nodes - Get nodes in collection
  app.get('/api/collections/:id/nodes', validateParams(UuidParamSchema), collectionRoutes.listCollectionNodes);

  // POST /api/collections/:id/nodes - Add node to collection
  app.post(
    '/api/collections/:id/nodes',
    validate({ params: UuidParamSchema, body: AddNodeToCollectionSchema }),
    collectionRoutes.addNode
  );

  // DELETE /api/collections/:id/nodes/:nodeId - Remove node from collection
  app.delete('/api/collections/:id/nodes/:nodeId', collectionRoutes.removeNode);

  // ============================================================
  // User Tag routes
  // ============================================================

  // GET /api/user-tags - Get all user tags
  app.get('/api/user-tags', userTagRoutes.listUserTags);

  // GET /api/user-tags/:id - Get single user tag
  app.get('/api/user-tags/:id', validateParams(UuidParamSchema), userTagRoutes.getUserTag);

  // POST /api/user-tags - Create new user tag
  app.post('/api/user-tags', validateBody(CreateUserTagSchema), userTagRoutes.createUserTag);

  // PUT /api/user-tags/:id - Update user tag
  app.put(
    '/api/user-tags/:id',
    validate({ params: UuidParamSchema, body: UpdateUserTagSchema }),
    userTagRoutes.updateUserTag
  );

  // DELETE /api/user-tags/:id - Delete user tag
  app.delete('/api/user-tags/:id', validateParams(UuidParamSchema), userTagRoutes.deleteUserTag);

  // GET /api/nodes/:id/user-tags - Get tags for a node
  app.get('/api/nodes/:id/user-tags', validateParams(UuidParamSchema), userTagRoutes.getNodeUserTags);

  // POST /api/nodes/:id/user-tags - Assign tag to node
  app.post(
    '/api/nodes/:id/user-tags',
    validate({ params: UuidParamSchema, body: AssignUserTagSchema }),
    userTagRoutes.assignNodeTag
  );

  // PUT /api/nodes/:id/user-tags - Set all tags on node
  app.put(
    '/api/nodes/:id/user-tags',
    validate({ params: UuidParamSchema, body: SetNodeTagsSchema }),
    userTagRoutes.setNodeUserTags
  );

  // DELETE /api/nodes/:id/user-tags/:tagId - Remove tag from node
  app.delete('/api/nodes/:id/user-tags/:tagId', userTagRoutes.removeNodeTag);

  // ============================================================
  // Audit routes
  // ============================================================

  // GET /api/audit/recent - Get recent audit changes
  app.get('/api/audit/recent', auditRoutes.getRecentAuditChanges);

  // GET /api/audit/stats - Get audit statistics
  app.get('/api/audit/stats', auditRoutes.getAuditStatistics);

  // ============================================================
  // Server-Sent Events (SSE) for real-time notifications
  // ============================================================

  // GET /api/events - SSE endpoint for real-time updates
  app.get('/api/events', handleSSEConnection);
}

// ============================================================
// SSE Handler
// ============================================================

/**
 * SSE connection handler for real-time notifications
 */
function handleSSEConnection(req: Request, res: Response): void {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection event
  sendSSEEvent(res, 'connected', { timestamp: new Date().toISOString() });

  log.info('SSE client connected', { module: 'sse' });

  // Subscribe to notification service
  const notificationService = getNotificationService();
  const unsubscribe = notificationService.subscribeAll((event: NotificationEvent) => {
    sendSSEEvent(res, event.type, event);
  });

  // Keep-alive ping every 30 seconds
  const pingInterval = setInterval(() => {
    sendSSEEvent(res, 'ping', { timestamp: new Date().toISOString() });
  }, 30000);

  // Clean up on client disconnect
  req.on('close', () => {
    log.info('SSE client disconnected', { module: 'sse' });
    clearInterval(pingInterval);
    unsubscribe();
  });

  // Handle errors
  req.on('error', (error) => {
    log.error('SSE connection error', {
      error: error.message,
      module: 'sse',
    });
    clearInterval(pingInterval);
    unsubscribe();
  });
}

/**
 * Send an SSE event to the client
 */
function sendSSEEvent(res: Response, eventType: string, data: unknown): void {
  try {
    res.write(`event: ${eventType}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (error) {
    log.error('Failed to send SSE event', {
      eventType,
      error: error instanceof Error ? error.message : String(error),
      module: 'sse',
    });
  }
}
