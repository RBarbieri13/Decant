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
import { importLimiter, settingsLimiter } from '../middleware/rateLimit.js';
import { enqueueManyForEnrichment } from '../services/processing_queue.js';
import { getDatabase } from '../database/connection.js';
import { getNotificationService, type NotificationEvent } from '../services/notifications/index.js';
import { log } from '../logger/index.js';
import { metricsEndpoint } from '../services/metrics/index.js';

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

  // GET /api/nodes/:id/history - Get node audit history
  app.get('/api/nodes/:id/history', validateParams(UuidParamSchema), auditRoutes.getNodeAuditHistory);

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

  // POST /api/admin/backfill-subcategories - Re-enqueue all nodes missing subcategory_label
  app.post('/api/admin/backfill-subcategories', (_req: Request, res: Response) => {
    try {
      const db = getDatabase();
      const rows = db.prepare(
        `SELECT id FROM nodes WHERE subcategory_label IS NULL AND is_deleted = 0`
      ).all() as { id: string }[];

      if (rows.length === 0) {
        res.json({ queued: 0, message: 'All nodes already have subcategory labels' });
        return;
      }

      const nodeIds = rows.map(r => r.id);
      enqueueManyForEnrichment(nodeIds, 1);

      log.info(`Backfill: queued ${nodeIds.length} nodes for subcategory enrichment`, { module: 'admin' });
      res.json({ queued: nodeIds.length, message: `Queued ${nodeIds.length} nodes for subcategory enrichment` });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      log.error('Backfill subcategories failed', { error: msg, module: 'admin' });
      res.status(500).json({ error: msg });
    }
  });

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
