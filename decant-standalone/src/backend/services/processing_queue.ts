// ============================================================
// Processing Queue Service
// SQLite-backed background job queue for Phase 2 enrichment
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/connection.js';
import { withTransaction } from '../database/transaction.js';
import { log } from '../logger/index.js';
import { enrichNode, type EnrichmentResult } from './phase2_enricher.js';
import { emitEnrichmentComplete } from './notifications/index.js';
import { withRetry, RetryPresets } from './retry/index.js';
import { readNode } from '../database/nodes.js';

/**
 * Job status values
 */
export type JobStatus = 'pending' | 'processing' | 'complete' | 'failed';

/**
 * Job phase values
 */
export type JobPhase = 'phase2';

/**
 * Processing job record
 */
export interface ProcessingJob {
  id: string;
  node_id: string;
  phase: JobPhase;
  status: JobStatus;
  priority: number;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  pollIntervalMs?: number;
  maxConcurrent?: number;
  retryDelays?: number[];
  maxAttempts?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<QueueConfig> = {
  pollIntervalMs: 5000,
  maxConcurrent: 1,
  retryDelays: [30000, 60000, 120000], // 30s, 60s, 120s (informational, actual retry uses withRetry)
  maxAttempts: 3,
};

/**
 * Retry options for job execution
 */
const JOB_RETRY_OPTIONS = {
  ...RetryPresets.STANDARD,
  context: 'processing-queue-job',
};

/**
 * Processing Queue Manager
 * Handles background job processing with SQLite persistence
 */
export class ProcessingQueue {
  private config: Required<QueueConfig>;
  private pollTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private isRunning = false;
  private activeJobs = 0;

  constructor(config?: QueueConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the queue processor
   */
  start(): void {
    if (this.isRunning) {
      log.warn('Processing queue already running', {
        module: 'processing-queue',
      });
      return;
    }

    this.isRunning = true;
    log.info('Processing queue started', {
      pollIntervalMs: this.config.pollIntervalMs,
      maxConcurrent: this.config.maxConcurrent,
      module: 'processing-queue',
    });

    // Start polling
    this.schedulePoll();
  }

  /**
   * Stop the queue processor gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    log.info('Stopping processing queue...', { module: 'processing-queue' });
    this.isRunning = false;

    // Clear the poll timer
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    // Wait for active jobs to complete (with timeout)
    const maxWaitMs = 30000;
    const startWait = Date.now();
    while (this.activeJobs > 0 && Date.now() - startWait < maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (this.activeJobs > 0) {
      log.warn('Processing queue stopped with active jobs', {
        activeJobs: this.activeJobs,
        module: 'processing-queue',
      });
    } else {
      log.info('Processing queue stopped gracefully', {
        module: 'processing-queue',
      });
    }
  }

  /**
   * Schedule the next poll
   */
  private schedulePoll(): void {
    if (!this.isRunning) {
      return;
    }

    this.pollTimer = setTimeout(() => {
      this.poll();
    }, this.config.pollIntervalMs);
  }

  /**
   * Poll for and process pending jobs
   */
  private async poll(): Promise<void> {
    if (!this.isRunning || this.isProcessing) {
      this.schedulePoll();
      return;
    }

    this.isProcessing = true;

    try {
      // Get available slots
      const availableSlots = this.config.maxConcurrent - this.activeJobs;
      if (availableSlots <= 0) {
        return;
      }

      // Fetch pending jobs
      const jobs = this.fetchPendingJobs(availableSlots);

      if (jobs.length > 0) {
        log.debug(`Processing ${jobs.length} job(s)`, {
          jobIds: jobs.map((j) => j.id),
          module: 'processing-queue',
        });

        // Process jobs concurrently
        await Promise.all(jobs.map((job) => this.processJob(job)));
      }
    } catch (error) {
      log.error('Queue poll error', {
        error: error instanceof Error ? error.message : String(error),
        module: 'processing-queue',
      });
    } finally {
      this.isProcessing = false;
      this.schedulePoll();
    }
  }

  /**
   * Fetch pending jobs that are ready for processing
   */
  private fetchPendingJobs(limit: number): ProcessingJob[] {
    const db = getDatabase();

    // Get jobs that are:
    // - Status is 'pending'
    // - Haven't exceeded max attempts
    // - Order by priority (higher first), then created_at
    const jobs = db
      .prepare(
        `
      SELECT * FROM processing_queue
      WHERE status = 'pending'
        AND attempts < max_attempts
      ORDER BY priority DESC, created_at ASC
      LIMIT ?
    `
      )
      .all(limit) as ProcessingJob[];

    // Mark them as processing
    if (jobs.length > 0) {
      const ids = jobs.map((j) => j.id);
      const placeholders = ids.map(() => '?').join(', ');
      db.prepare(
        `
        UPDATE processing_queue
        SET status = 'processing'
        WHERE id IN (${placeholders})
      `
      ).run(...ids);
    }

    return jobs;
  }

  /**
   * Process a single job
   */
  private async processJob(job: ProcessingJob): Promise<void> {
    this.activeJobs++;

    const startTime = Date.now();
    log.debug(`Processing job ${job.id}`, {
      nodeId: job.node_id,
      phase: job.phase,
      attempt: job.attempts + 1,
      module: 'processing-queue',
    });

    try {
      // Perform the enrichment
      const result = await this.executeJob(job);

      if (result.success) {
        // Mark as complete
        this.markJobComplete(job.id);
        log.info(`Job ${job.id} completed`, {
          nodeId: job.node_id,
          durationMs: Date.now() - startTime,
          module: 'processing-queue',
        });

        // Read updated node to get hierarchy codes
        const updatedNode = readNode(job.node_id) as any;

        // Emit notification for successful enrichment with hierarchy updates
        const hierarchyUpdates = updatedNode ? {
          segmentCode: updatedNode.segment_code,
          categoryCode: updatedNode.category_code,
          contentTypeCode: updatedNode.content_type_code,
          title: updatedNode.title,
          functionCode: updatedNode.function_hierarchy_code,
          organizationCode: updatedNode.organization_hierarchy_code,
        } : undefined;

        emitEnrichmentComplete(job.node_id, true, hierarchyUpdates);
      } else {
        // Handle failure
        await this.handleJobFailure(job, result.error || 'Unknown error');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await this.handleJobFailure(job, errorMessage);
    } finally {
      this.activeJobs--;
    }
  }

  /**
   * Execute the job based on its phase
   * Wrapped with retry logic to handle transient failures
   */
  private async executeJob(job: ProcessingJob): Promise<EnrichmentResult> {
    return withRetry(
      async () => {
        switch (job.phase) {
          case 'phase2':
            return enrichNode(job.node_id);
          default:
            return {
              success: false,
              nodeId: job.node_id,
              error: `Unknown phase: ${job.phase}`,
              durationMs: 0,
            };
        }
      },
      {
        ...JOB_RETRY_OPTIONS,
        // Override max attempts based on job config
        maxAttempts: Math.min(job.max_attempts - job.attempts, 3),
        onRetry: (error, attempt, delayMs) => {
          log.debug('Job execution retry', {
            jobId: job.id,
            nodeId: job.node_id,
            attempt,
            delayMs,
            error: error.message,
            module: 'processing-queue',
          });
        },
      }
    );
  }

  /**
   * Handle job failure with retry logic
   */
  private async handleJobFailure(
    job: ProcessingJob,
    errorMessage: string
  ): Promise<void> {
    const attempts = job.attempts + 1;
    const db = getDatabase();

    if (attempts >= job.max_attempts) {
      // Mark as permanently failed
      db.prepare(
        `
        UPDATE processing_queue
        SET status = 'failed',
            attempts = ?,
            error_message = ?,
            processed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      ).run(attempts, errorMessage, job.id);

      log.error(`Job ${job.id} failed permanently`, {
        nodeId: job.node_id,
        attempts,
        error: errorMessage,
        module: 'processing-queue',
      });

      // Emit notification for failed enrichment
      emitEnrichmentComplete(job.node_id, false, undefined, errorMessage);
    } else {
      // Schedule for retry
      const retryDelay =
        this.config.retryDelays[attempts - 1] ||
        this.config.retryDelays[this.config.retryDelays.length - 1];

      db.prepare(
        `
        UPDATE processing_queue
        SET status = 'pending',
            attempts = ?,
            error_message = ?
        WHERE id = ?
      `
      ).run(attempts, errorMessage, job.id);

      log.warn(`Job ${job.id} will retry in ${retryDelay}ms`, {
        nodeId: job.node_id,
        attempt: attempts,
        maxAttempts: job.max_attempts,
        error: errorMessage,
        module: 'processing-queue',
      });

      // Note: The job will be picked up on the next poll cycle
      // The retry delay is informational; actual retry happens on next poll
    }
  }

  /**
   * Mark a job as complete
   */
  private markJobComplete(jobId: string): void {
    const db = getDatabase();
    db.prepare(
      `
      UPDATE processing_queue
      SET status = 'complete',
          processed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    ).run(jobId);
  }

  /**
   * Add a job to the queue
   */
  enqueue(
    nodeId: string,
    options?: {
      phase?: JobPhase;
      priority?: number;
      maxAttempts?: number;
    }
  ): string {
    const db = getDatabase();
    const id = uuidv4();

    db.prepare(
      `
      INSERT INTO processing_queue (id, node_id, phase, priority, max_attempts)
      VALUES (?, ?, ?, ?, ?)
    `
    ).run(
      id,
      nodeId,
      options?.phase || 'phase2',
      options?.priority || 0,
      options?.maxAttempts || this.config.maxAttempts
    );

    log.debug(`Job ${id} enqueued`, {
      nodeId,
      phase: options?.phase || 'phase2',
      priority: options?.priority || 0,
      module: 'processing-queue',
    });

    return id;
  }

  /**
   * Enqueue multiple nodes
   */
  enqueueMany(
    nodeIds: string[],
    options?: {
      phase?: JobPhase;
      priority?: number;
      maxAttempts?: number;
    }
  ): string[] {
    const db = getDatabase();
    const ids: string[] = [];

    withTransaction(() => {
      const stmt = db.prepare(`
        INSERT INTO processing_queue (id, node_id, phase, priority, max_attempts)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const nodeId of nodeIds) {
        const id = uuidv4();
        stmt.run(
          id,
          nodeId,
          options?.phase || 'phase2',
          options?.priority || 0,
          options?.maxAttempts || this.config.maxAttempts
        );
        ids.push(id);
      }
    });

    log.info(`Enqueued ${ids.length} jobs`, {
      phase: options?.phase || 'phase2',
      module: 'processing-queue',
    });

    return ids;
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): ProcessingJob | null {
    const db = getDatabase();
    return (
      (db
        .prepare('SELECT * FROM processing_queue WHERE id = ?')
        .get(jobId) as ProcessingJob) || null
    );
  }

  /**
   * Get jobs for a node
   */
  getJobsForNode(nodeId: string): ProcessingJob[] {
    const db = getDatabase();
    return db
      .prepare(
        'SELECT * FROM processing_queue WHERE node_id = ? ORDER BY created_at DESC'
      )
      .all(nodeId) as ProcessingJob[];
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    pending: number;
    processing: number;
    complete: number;
    failed: number;
    total: number;
  } {
    const db = getDatabase();
    const stats = db
      .prepare(
        `
      SELECT
        status,
        COUNT(*) as count
      FROM processing_queue
      GROUP BY status
    `
      )
      .all() as { status: JobStatus; count: number }[];

    const result = {
      pending: 0,
      processing: 0,
      complete: 0,
      failed: 0,
      total: 0,
    };

    for (const { status, count } of stats) {
      result[status] = count;
      result.total += count;
    }

    return result;
  }

  /**
   * Clear completed jobs older than specified age
   */
  clearCompleted(olderThanMs: number = 24 * 60 * 60 * 1000): number {
    const db = getDatabase();
    const cutoff = new Date(Date.now() - olderThanMs).toISOString();

    const result = db
      .prepare(
        `
      DELETE FROM processing_queue
      WHERE status = 'complete'
        AND processed_at < ?
    `
      )
      .run(cutoff);

    if (result.changes > 0) {
      log.info(`Cleared ${result.changes} completed jobs`, {
        module: 'processing-queue',
      });
    }

    return result.changes;
  }

  /**
   * Retry failed jobs
   */
  retryFailed(nodeId?: string): number {
    const db = getDatabase();

    let sql = `
      UPDATE processing_queue
      SET status = 'pending',
          attempts = 0,
          error_message = NULL
      WHERE status = 'failed'
    `;
    const params: string[] = [];

    if (nodeId) {
      sql += ' AND node_id = ?';
      params.push(nodeId);
    }

    const result = db.prepare(sql).run(...params);

    if (result.changes > 0) {
      log.info(`Reset ${result.changes} failed jobs for retry`, {
        nodeId,
        module: 'processing-queue',
      });
    }

    return result.changes;
  }

  /**
   * Cancel pending jobs
   */
  cancel(jobId: string): boolean {
    const db = getDatabase();
    const result = db
      .prepare(
        `
      DELETE FROM processing_queue
      WHERE id = ?
        AND status = 'pending'
    `
      )
      .run(jobId);

    return result.changes > 0;
  }

  /**
   * Check if queue is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

// ============================================================
// Singleton Instance and Server Integration
// ============================================================

let queueInstance: ProcessingQueue | null = null;

/**
 * Get or create the singleton queue instance
 */
export function getProcessingQueue(config?: QueueConfig): ProcessingQueue {
  if (!queueInstance) {
    queueInstance = new ProcessingQueue(config);
  }
  return queueInstance;
}

/**
 * Start the processing queue (call on server startup)
 */
export function startProcessingQueue(config?: QueueConfig): ProcessingQueue {
  const queue = getProcessingQueue(config);
  queue.start();
  return queue;
}

/**
 * Stop the processing queue (call on server shutdown)
 */
export async function stopProcessingQueue(): Promise<void> {
  if (queueInstance) {
    await queueInstance.stop();
  }
}

/**
 * Enqueue a node for Phase 2 enrichment
 */
export function enqueueForEnrichment(
  nodeId: string,
  priority: number = 0
): string {
  const queue = getProcessingQueue();
  return queue.enqueue(nodeId, { phase: 'phase2', priority });
}

/**
 * Enqueue multiple nodes for Phase 2 enrichment
 */
export function enqueueManyForEnrichment(
  nodeIds: string[],
  priority: number = 0
): string[] {
  const queue = getProcessingQueue();
  return queue.enqueueMany(nodeIds, { phase: 'phase2', priority });
}
