// ============================================================
// Queue Status and Management API Routes
// ============================================================

import { Request, Response } from 'express';
import { z } from 'zod';
import {
  getProcessingQueue,
  type ProcessingJob,
} from '../services/processing_queue.js';
import { getDatabase } from '../database/connection.js';
import { log } from '../logger/index.js';

// ============================================================
// Validation Schemas
// ============================================================

/**
 * Schema for job list query parameters
 */
export const JobListQuerySchema = z.object({
  status: z
    .enum(['pending', 'processing', 'complete', 'failed'])
    .optional(),
  limit: z
    .string()
    .regex(/^\d+$/, 'Limit must be a number')
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50))
    .pipe(z.number().min(1).max(500)),
  offset: z
    .string()
    .regex(/^\d+$/, 'Offset must be a number')
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0))
    .pipe(z.number().min(0)),
});

/**
 * Schema for clear completed jobs body
 */
export const ClearCompletedSchema = z.object({
  olderThan: z
    .string()
    .datetime({ message: 'olderThan must be a valid ISO date string' })
    .optional(),
});

/**
 * Schema for job ID parameter
 */
export const JobIdParamSchema = z.object({
  jobId: z.string().uuid('Job ID must be a valid UUID'),
});

/**
 * Schema for node ID parameter
 */
export const NodeIdParamSchema = z.object({
  nodeId: z.string().uuid('Node ID must be a valid UUID'),
});

// ============================================================
// Response Types
// ============================================================

interface QueueStatusResponse {
  pending: number;
  processing: number;
  complete: number;
  failed: number;
  isRunning: boolean;
}

interface JobListItem {
  id: string;
  nodeId: string;
  phase: string;
  status: string;
  attempts: number;
  errorMessage: string | null;
  createdAt: string;
  processedAt: string | null;
}

interface JobListResponse {
  jobs: JobListItem[];
  total: number;
  page: number;
  limit: number;
}

interface JobDetailResponse {
  job: JobListItem | null;
}

interface SuccessResponse {
  success: boolean;
  message?: string;
}

interface ClearResponse {
  cleared: number;
}

interface ErrorResponse {
  error: string;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Transform a ProcessingJob to the API response format
 */
function transformJob(job: ProcessingJob): JobListItem {
  return {
    id: job.id,
    nodeId: job.node_id,
    phase: job.phase,
    status: job.status,
    attempts: job.attempts,
    errorMessage: job.error_message,
    createdAt: job.created_at,
    processedAt: job.processed_at,
  };
}

/**
 * Format Zod error issues into a single error message
 */
function formatZodErrors(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join(', ');
}

// ============================================================
// Route Handlers
// ============================================================

/**
 * GET /api/queue/status
 * Get queue statistics
 */
export async function getQueueStatus(
  _req: Request,
  res: Response<QueueStatusResponse>
): Promise<void> {
  try {
    const queue = getProcessingQueue();
    const stats = queue.getStats();

    res.json({
      pending: stats.pending,
      processing: stats.processing,
      complete: stats.complete,
      failed: stats.failed,
      isRunning: queue.isActive(),
    });
  } catch (error) {
    log.error('Failed to get queue status', {
      error: error instanceof Error ? error.message : String(error),
      module: 'queue-routes',
    });
    throw error;
  }
}

/**
 * GET /api/queue/jobs
 * List jobs with optional filters
 */
export async function listJobs(
  req: Request,
  res: Response<JobListResponse | ErrorResponse>
): Promise<void> {
  try {
    // Validate query parameters
    const parseResult = JobListQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({
        error: formatZodErrors(parseResult.error),
      });
      return;
    }

    const { status, limit, offset } = parseResult.data;
    const db = getDatabase();

    // Build query with optional status filter
    let countSql = 'SELECT COUNT(*) as total FROM processing_queue';
    let querySql = `
      SELECT * FROM processing_queue
    `;
    const params: (string | number)[] = [];

    if (status) {
      countSql += ' WHERE status = ?';
      querySql += ' WHERE status = ?';
      params.push(status);
    }

    querySql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

    // Get total count
    const countResult = db
      .prepare(countSql)
      .get(...params.slice(0, status ? 1 : 0)) as { total: number };

    // Get paginated jobs
    const jobs = db
      .prepare(querySql)
      .all(...params, limit, offset) as ProcessingJob[];

    const page = Math.floor(offset / limit) + 1;

    res.json({
      jobs: jobs.map(transformJob),
      total: countResult.total,
      page,
      limit,
    });
  } catch (error) {
    log.error('Failed to list jobs', {
      error: error instanceof Error ? error.message : String(error),
      module: 'queue-routes',
    });
    throw error;
  }
}

/**
 * GET /api/queue/jobs/:nodeId
 * Get job for a specific node
 */
export async function getJobForNode(
  req: Request,
  res: Response<JobDetailResponse | ErrorResponse>
): Promise<void> {
  try {
    // Validate node ID parameter
    const parseResult = NodeIdParamSchema.safeParse(req.params);
    if (!parseResult.success) {
      res.status(400).json({
        error: formatZodErrors(parseResult.error),
      });
      return;
    }

    const { nodeId } = parseResult.data;
    const queue = getProcessingQueue();
    const jobs = queue.getJobsForNode(nodeId);

    // Return the most recent job for this node
    const job = jobs.length > 0 ? jobs[0] : null;

    res.json({
      job: job ? transformJob(job) : null,
    });
  } catch (error) {
    log.error('Failed to get job for node', {
      error: error instanceof Error ? error.message : String(error),
      nodeId: req.params.nodeId,
      module: 'queue-routes',
    });
    throw error;
  }
}

/**
 * POST /api/queue/retry/:jobId
 * Retry a failed job
 */
export async function retryJob(
  req: Request,
  res: Response<SuccessResponse | ErrorResponse>
): Promise<void> {
  try {
    // Validate job ID parameter
    const parseResult = JobIdParamSchema.safeParse(req.params);
    if (!parseResult.success) {
      res.status(400).json({
        error: formatZodErrors(parseResult.error),
      });
      return;
    }

    const { jobId } = parseResult.data;
    const queue = getProcessingQueue();

    // Get the job first to verify it exists and is in failed state
    const job = queue.getJob(jobId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: 'Job not found',
      });
      return;
    }

    if (job.status !== 'failed') {
      res.status(400).json({
        success: false,
        message: `Cannot retry job with status '${job.status}'. Only failed jobs can be retried.`,
      });
      return;
    }

    // Reset the job for retry
    const db = getDatabase();
    db.prepare(
      `
      UPDATE processing_queue
      SET status = 'pending',
          attempts = 0,
          error_message = NULL
      WHERE id = ?
    `
    ).run(jobId);

    log.info('Job reset for retry', {
      jobId,
      nodeId: job.node_id,
      module: 'queue-routes',
    });

    res.json({
      success: true,
      message: 'Job queued for retry',
    });
  } catch (error) {
    log.error('Failed to retry job', {
      error: error instanceof Error ? error.message : String(error),
      jobId: req.params.jobId,
      module: 'queue-routes',
    });
    throw error;
  }
}

/**
 * DELETE /api/queue/jobs/:jobId
 * Cancel/remove a job
 */
export async function cancelJob(
  req: Request,
  res: Response<SuccessResponse | ErrorResponse>
): Promise<void> {
  try {
    // Validate job ID parameter
    const parseResult = JobIdParamSchema.safeParse(req.params);
    if (!parseResult.success) {
      res.status(400).json({
        error: formatZodErrors(parseResult.error),
      });
      return;
    }

    const { jobId } = parseResult.data;
    const queue = getProcessingQueue();

    // Get the job first to verify it exists
    const job = queue.getJob(jobId);

    if (!job) {
      res.status(404).json({
        success: false,
        message: 'Job not found',
      });
      return;
    }

    // Cannot cancel jobs that are currently processing
    if (job.status === 'processing') {
      res.status(400).json({
        success: false,
        message: 'Cannot cancel a job that is currently processing',
      });
      return;
    }

    // Delete the job
    const db = getDatabase();
    const result = db
      .prepare('DELETE FROM processing_queue WHERE id = ?')
      .run(jobId);

    if (result.changes === 0) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete job',
      });
      return;
    }

    log.info('Job cancelled/removed', {
      jobId,
      nodeId: job.node_id,
      previousStatus: job.status,
      module: 'queue-routes',
    });

    res.json({
      success: true,
    });
  } catch (error) {
    log.error('Failed to cancel job', {
      error: error instanceof Error ? error.message : String(error),
      jobId: req.params.jobId,
      module: 'queue-routes',
    });
    throw error;
  }
}

/**
 * POST /api/queue/clear
 * Clear completed jobs (optionally older than a specified date)
 */
export async function clearCompletedJobs(
  req: Request,
  res: Response<ClearResponse | ErrorResponse>
): Promise<void> {
  try {
    // Validate request body
    const parseResult = ClearCompletedSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: formatZodErrors(parseResult.error),
      });
      return;
    }

    const { olderThan } = parseResult.data;
    const db = getDatabase();

    let sql = "DELETE FROM processing_queue WHERE status = 'complete'";
    const params: string[] = [];

    if (olderThan) {
      sql += ' AND processed_at < ?';
      params.push(olderThan);
    }

    const result = db.prepare(sql).run(...params);

    log.info('Completed jobs cleared', {
      cleared: result.changes,
      olderThan: olderThan || 'all',
      module: 'queue-routes',
    });

    res.json({
      cleared: result.changes,
    });
  } catch (error) {
    log.error('Failed to clear completed jobs', {
      error: error instanceof Error ? error.message : String(error),
      module: 'queue-routes',
    });
    throw error;
  }
}
