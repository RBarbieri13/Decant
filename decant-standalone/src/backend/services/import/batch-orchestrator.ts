// ============================================================
// Batch Import Orchestrator
// Handles importing multiple URLs concurrently with real-time
// progress updates via Server-Sent Events
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { log } from '../../logger/index.js';
import { getImportOrchestrator, validateAndNormalizeUrl, type ImportResult, type ImportError } from './orchestrator.js';
import { getImportCache, normalizeUrlForCache } from './cache.js';
import { getNotificationService } from '../notifications/index.js';
import { readNode } from '../../database/nodes.js';
import type {
  BatchImportItem,
  BatchImportItemStatus,
  BatchImportOptions,
  BatchImportState,
  BatchImportStats,
  BatchImportProgressEvent,
  BatchImportCompleteEvent,
  AIClassification,
} from '../../../shared/types.js';

// ============================================================
// Constants
// ============================================================

const DEFAULT_MAX_CONCURRENT = 2;
const DEFAULT_OPTIONS: BatchImportOptions = {
  autoClassify: true,
  skipDuplicates: true,
  showInTreeWhenDone: true,
  maxConcurrent: DEFAULT_MAX_CONCURRENT,
};

// ============================================================
// Batch Import Manager
// ============================================================

/**
 * Manages batch import operations with concurrent processing
 * and real-time progress updates
 */
class BatchImportManager {
  private activeBatches: Map<string, BatchImportState> = new Map();
  private processingQueues: Map<string, Set<string>> = new Map(); // batchId -> processing itemIds

  /**
   * Start a new batch import
   */
  async startBatch(urls: string[], options: Partial<BatchImportOptions> = {}): Promise<BatchImportState> {
    const batchId = uuidv4();
    const mergedOptions: BatchImportOptions = { ...DEFAULT_OPTIONS, ...options };

    log.info('Starting batch import', {
      batchId,
      urlCount: urls.length,
      options: mergedOptions,
      module: 'batch-import',
    });

    // Create initial batch state with items
    const items: BatchImportItem[] = urls.map((url, index) => ({
      id: uuidv4(),
      url: url.trim(),
      lineNumber: index + 1,
      status: 'queued' as BatchImportItemStatus,
      progress: 0,
    }));

    const state: BatchImportState = {
      batchId,
      items,
      options: mergedOptions,
      status: 'importing',
      startedAt: new Date().toISOString(),
    };

    this.activeBatches.set(batchId, state);
    this.processingQueues.set(batchId, new Set());

    // Start processing (non-blocking)
    this.processQueue(batchId);

    return state;
  }

  /**
   * Cancel a batch import
   */
  cancelBatch(batchId: string): boolean {
    const state = this.activeBatches.get(batchId);
    if (!state) {
      return false;
    }

    log.info('Cancelling batch import', { batchId, module: 'batch-import' });

    state.status = 'cancelled';
    state.completedAt = new Date().toISOString();

    // Mark queued items as cancelled (processing items will complete)
    state.items.forEach(item => {
      if (item.status === 'queued') {
        item.status = 'failed';
        item.error = 'Import cancelled';
      }
    });

    this.emitComplete(batchId);
    return true;
  }

  /**
   * Get batch state
   */
  getBatchState(batchId: string): BatchImportState | null {
    return this.activeBatches.get(batchId) || null;
  }

  /**
   * Calculate batch statistics
   */
  calculateStats(items: BatchImportItem[]): BatchImportStats {
    return {
      total: items.length,
      imported: items.filter(i => i.status === 'imported').length,
      processing: items.filter(i =>
        ['validating', 'fetching', 'classifying', 'saving'].includes(i.status)
      ).length,
      queued: items.filter(i => i.status === 'queued').length,
      failed: items.filter(i => i.status === 'failed').length,
      duplicates: items.filter(i => i.status === 'duplicate').length,
    };
  }

  // ============================================================
  // Private Methods
  // ============================================================

  /**
   * Process the import queue for a batch
   */
  private async processQueue(batchId: string): Promise<void> {
    const state = this.activeBatches.get(batchId);
    if (!state || state.status === 'cancelled' || state.status === 'paused') {
      return;
    }

    const processingSet = this.processingQueues.get(batchId)!;
    const maxConcurrent = state.options.maxConcurrent || DEFAULT_MAX_CONCURRENT;

    // Find items to process
    const queuedItems = state.items.filter(
      item => item.status === 'queued' && !processingSet.has(item.id)
    );

    // Calculate how many more we can start
    const availableSlots = maxConcurrent - processingSet.size;
    const itemsToStart = queuedItems.slice(0, availableSlots);

    // Start processing each item
    for (const item of itemsToStart) {
      processingSet.add(item.id);
      this.processItem(batchId, item.id).finally(() => {
        processingSet.delete(item.id);
        this.checkQueueStatus(batchId);
      });
    }
  }

  /**
   * Process a single import item
   */
  private async processItem(batchId: string, itemId: string): Promise<void> {
    const state = this.activeBatches.get(batchId);
    if (!state) return;

    const item = state.items.find(i => i.id === itemId);
    if (!item) return;

    const startTime = Date.now();

    try {
      // Phase 1: Validate URL
      this.updateItemStatus(batchId, item, 'validating', 10, 'Validating URL...');

      let validatedUrl: string;
      try {
        validatedUrl = validateAndNormalizeUrl(item.url);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid URL';
        throw new Error(message);
      }

      // Phase 2: Check for duplicates
      if (state.options.skipDuplicates) {
        const cache = getImportCache();
        const normalizedUrl = normalizeUrlForCache(validatedUrl);
        const cached = cache.get(normalizedUrl);

        if (cached) {
          // Verify node still exists
          const existingNode = readNode(cached.nodeId);
          if (existingNode) {
            this.updateItemStatus(batchId, item, 'duplicate', 100, 'Already imported');
            item.nodeId = cached.nodeId;
            item.title = existingNode.title as string | undefined;
            item.classification = {
              segment: cached.classification.segment,
              category: cached.classification.category,
              contentType: cached.classification.contentType,
              organization: cached.classification.organization,
              confidence: cached.classification.confidence,
              reasoning: '',
            };
            item.completedAt = new Date().toISOString();
            this.emitProgress(batchId, item);
            return;
          }
        }
      }

      // Phase 3: Fetch content
      this.updateItemStatus(batchId, item, 'fetching', 30, 'Fetching content...');

      // Phase 4: Classify (if enabled)
      if (state.options.autoClassify) {
        this.updateItemStatus(batchId, item, 'classifying', 50, 'Classifying with AI...');
      }

      // Phase 5: Save to database
      this.updateItemStatus(batchId, item, 'saving', 80, 'Saving to database...');

      // Use the existing orchestrator for the actual import
      const orchestrator = getImportOrchestrator();
      const result = await orchestrator.import({ url: validatedUrl });

      if (!result.success) {
        const errorResult = result as ImportError;
        throw new Error(errorResult.error);
      }

      const successResult = result as ImportResult;

      // Update item with success
      item.status = 'imported';
      item.progress = 100;
      item.nodeId = successResult.nodeId;
      item.title = successResult.metadata.title;
      item.favicon = successResult.metadata.favicon || undefined;
      item.classification = {
        segment: successResult.classification.segment,
        category: successResult.classification.category,
        contentType: successResult.classification.contentType,
        organization: successResult.classification.organization,
        confidence: successResult.classification.confidence,
        reasoning: '',
      };
      item.completedAt = new Date().toISOString();

      log.info('Batch import item completed', {
        batchId,
        itemId,
        nodeId: successResult.nodeId,
        durationMs: Date.now() - startTime,
        module: 'batch-import',
      });

      this.emitProgress(batchId, item);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      item.status = 'failed';
      item.progress = 0;
      item.error = message;
      item.completedAt = new Date().toISOString();

      log.warn('Batch import item failed', {
        batchId,
        itemId,
        url: item.url,
        error: message,
        durationMs: Date.now() - startTime,
        module: 'batch-import',
      });

      this.emitProgress(batchId, item);
    }
  }

  /**
   * Update item status and emit progress event
   */
  private updateItemStatus(
    batchId: string,
    item: BatchImportItem,
    status: BatchImportItemStatus,
    progress: number,
    message?: string
  ): void {
    item.status = status;
    item.progress = progress;
    if (!item.startedAt && status !== 'queued') {
      item.startedAt = new Date().toISOString();
    }
    this.emitProgress(batchId, item);
  }

  /**
   * Check if batch is complete and handle completion
   */
  private checkQueueStatus(batchId: string): void {
    const state = this.activeBatches.get(batchId);
    if (!state) return;

    const processingSet = this.processingQueues.get(batchId)!;

    // Check if there are more items to process
    const hasQueued = state.items.some(item => item.status === 'queued');
    const hasProcessing = processingSet.size > 0;

    if (hasQueued && state.status === 'importing') {
      // Continue processing
      this.processQueue(batchId);
    } else if (!hasQueued && !hasProcessing) {
      // All done
      state.status = 'complete';
      state.completedAt = new Date().toISOString();

      log.info('Batch import complete', {
        batchId,
        stats: this.calculateStats(state.items),
        module: 'batch-import',
      });

      this.emitComplete(batchId);

      // Clean up after a delay (keep state for client to retrieve)
      setTimeout(() => {
        this.activeBatches.delete(batchId);
        this.processingQueues.delete(batchId);
      }, 60000); // Keep for 1 minute
    }
  }

  /**
   * Emit progress event via SSE
   */
  private emitProgress(batchId: string, item: BatchImportItem): void {
    const notificationService = getNotificationService();

    const event: BatchImportProgressEvent = {
      type: 'batch_import_progress',
      batchId,
      itemId: item.id,
      url: item.url,
      status: item.status,
      progress: item.progress,
      nodeId: item.nodeId,
      title: item.title,
      favicon: item.favicon,
      classification: item.classification,
      error: item.error,
    };

    notificationService.emit(event as any);
  }

  /**
   * Emit batch complete event via SSE
   */
  private emitComplete(batchId: string): void {
    const state = this.activeBatches.get(batchId);
    if (!state) return;

    const notificationService = getNotificationService();

    const event: BatchImportCompleteEvent = {
      type: 'batch_import_complete',
      batchId,
      stats: this.calculateStats(state.items),
    };

    notificationService.emit(event as any);
  }
}

// ============================================================
// Singleton Instance
// ============================================================

let batchManager: BatchImportManager | null = null;

/**
 * Get the singleton batch import manager instance
 */
export function getBatchImportManager(): BatchImportManager {
  if (!batchManager) {
    batchManager = new BatchImportManager();
    log.info('Batch import manager initialized', { module: 'batch-import' });
  }
  return batchManager;
}

/**
 * Reset the batch import manager (useful for testing)
 */
export function resetBatchImportManager(): void {
  batchManager = null;
}

// ============================================================
// Convenience Functions
// ============================================================

/**
 * Start a batch import
 */
export async function startBatchImport(
  urls: string[],
  options?: Partial<BatchImportOptions>
): Promise<BatchImportState> {
  const manager = getBatchImportManager();
  return manager.startBatch(urls, options);
}

/**
 * Cancel a batch import
 */
export function cancelBatchImport(batchId: string): boolean {
  const manager = getBatchImportManager();
  return manager.cancelBatch(batchId);
}

/**
 * Get batch state
 */
export function getBatchState(batchId: string): BatchImportState | null {
  const manager = getBatchImportManager();
  return manager.getBatchState(batchId);
}
