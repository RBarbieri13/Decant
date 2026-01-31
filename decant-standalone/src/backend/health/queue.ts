// ============================================================
// Processing Queue Health Check
// ============================================================

import { getProcessingQueue } from '../services/processing_queue.js';
import { getDatabase } from '../database/connection.js';
import { log } from '../logger/index.js';
import { ComponentHealth, QueueHealthDetails } from './types.js';

const WARNING_THRESHOLD = 100;
const UNHEALTHY_THRESHOLD = 500;

/**
 * Check processing queue health
 * Warning if backlog > 100, unhealthy if > 500
 */
export function checkQueueHealth(): ComponentHealth {
  const startTime = Date.now();
  const lastChecked = new Date().toISOString();

  try {
    const queue = getProcessingQueue();
    const stats = queue.getStats();

    // Calculate jobs processed in last 24 hours
    const db = getDatabase();
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const completedLast24h = (
      db
        .prepare(
          `SELECT COUNT(*) as count FROM processing_queue
           WHERE status = 'complete' AND processed_at > ?`
        )
        .get(last24h) as { count: number }
    ).count;

    const failedLast24h = (
      db
        .prepare(
          `SELECT COUNT(*) as count FROM processing_queue
           WHERE status = 'failed' AND processed_at > ?`
        )
        .get(last24h) as { count: number }
    ).count;

    // Calculate average processing time for last 100 completed jobs
    const avgProcessingTime = db
      .prepare(
        `SELECT AVG(
          (julianday(processed_at) - julianday(created_at)) * 24 * 60 * 60 * 1000
        ) as avg_ms
        FROM processing_queue
        WHERE status = 'complete' AND processed_at IS NOT NULL
        ORDER BY processed_at DESC
        LIMIT 100`
      )
      .get() as { avg_ms: number | null };

    const details: QueueHealthDetails = {
      pendingJobs: stats.pending,
      processingJobs: stats.processing,
      completedLast24h,
      failedLast24h,
      avgProcessingTimeMs: Math.round(avgProcessingTime?.avg_ms || 0),
    };

    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    let message: string;

    if (stats.pending >= UNHEALTHY_THRESHOLD) {
      status = 'unhealthy';
      message = `Queue backlog critical: ${stats.pending} pending jobs`;
    } else if (stats.pending >= WARNING_THRESHOLD) {
      status = 'degraded';
      message = `Queue backlog high: ${stats.pending} pending jobs`;
    } else if (!queue.isActive()) {
      status = 'degraded';
      message = 'Queue processor not running';
    } else {
      status = 'healthy';
      message = 'Queue processing normally';
    }

    return {
      status,
      message,
      lastChecked,
      latencyMs: Date.now() - startTime,
      details,
    };
  } catch (error) {
    log.error('Queue health check failed', { err: error, module: 'health' });

    return {
      status: 'unhealthy',
      message:
        error instanceof Error ? error.message : 'Queue health check failed',
      lastChecked,
      latencyMs: Date.now() - startTime,
    };
  }
}
