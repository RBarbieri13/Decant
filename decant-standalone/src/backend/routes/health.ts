// ============================================================
// Health Check Routes
// ============================================================

import { Request, Response } from 'express';
import { getDatabaseStats } from '../health/database.js';
import {
  quickHealthCheck,
  fullHealthCheck,
  getComponentHealth,
} from '../health/index.js';
import { getCircuitBreakerRegistry } from '../services/retry/circuit-breaker.js';
import { getProcessingQueue } from '../services/processing_queue.js';

/**
 * Format uptime in human-readable format.
 */
function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * GET /health - Quick health check
 * Returns basic status for simple monitoring
 */
export function healthCheck(_req: Request, res: Response): void {
  const check = quickHealthCheck();
  res.json({
    status: check.status,
    timestamp: new Date().toISOString(),
    latencyMs: check.latencyMs,
  });
}

/**
 * GET /health/live - Kubernetes liveness probe
 * Returns 200 if the process is running.
 * Used to determine if the app needs to be restarted.
 */
export function liveness(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /health/ready - Kubernetes readiness probe
 * Comprehensive readiness check with all components
 * Returns 200 only if all critical systems are healthy, 503 otherwise.
 */
export async function readiness(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const healthCheck = await fullHealthCheck();

    // Consider ready if status is healthy or degraded
    // Only return 503 if unhealthy (critical systems down)
    if (healthCheck.status === 'unhealthy') {
      res.status(503).json({
        status: 'not_ready',
        timestamp: healthCheck.timestamp,
        checks: healthCheck.checks,
      });
    } else {
      res.status(200).json({
        status: 'ready',
        timestamp: healthCheck.timestamp,
        overallStatus: healthCheck.status,
        checks: healthCheck.checks,
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed',
    });
  }
}

/**
 * GET /health/full - Full health check with all components
 * Detailed health information for all system components
 */
export async function fullHealth(_req: Request, res: Response): Promise<void> {
  try {
    const healthCheck = await fullHealthCheck();

    // Return appropriate status code based on health
    const statusCode =
      healthCheck.status === 'unhealthy'
        ? 503
        : healthCheck.status === 'degraded'
          ? 200 // Still operational, just degraded
          : 200;

    res.status(statusCode).json(healthCheck);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed',
    });
  }
}

/**
 * GET /health/component/:name - Individual component health check
 * Check specific component health
 */
export async function componentHealth(
  req: Request,
  res: Response
): Promise<void> {
  const { name } = req.params;

  const validComponents = ['database', 'llm', 'queue', 'cache', 'filesystem'];
  if (!validComponents.includes(name)) {
    res.status(400).json({
      error: 'Invalid component name',
      validComponents,
    });
    return;
  }

  try {
    const health = await getComponentHealth(
      name as 'database' | 'llm' | 'queue' | 'cache' | 'filesystem'
    );

    const statusCode = health.status === 'unhealthy' ? 503 : 200;

    res.status(statusCode).json({
      component: name,
      ...health,
    });
  } catch (error) {
    res.status(500).json({
      component: name,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Component check failed',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * GET /metrics - Application metrics
 * Returns useful metrics about the application.
 */
export function metrics(_req: Request, res: Response): void {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  const dbStats = getDatabaseStats();

  // Get circuit breaker stats
  const circuitBreakerRegistry = getCircuitBreakerRegistry();
  const circuitBreakerStats = circuitBreakerRegistry.getAllStats();

  // Get processing queue stats
  let queueStats = null;
  try {
    const queue = getProcessingQueue();
    queueStats = queue.getStats();
  } catch {
    // Queue may not be initialized
    queueStats = null;
  }

  res.json({
    uptime: Math.floor(uptime),
    uptimeHuman: formatUptime(uptime),
    database: {
      nodeCount: dbStats.nodeCount,
      deletedNodeCount: dbStats.deletedNodeCount,
      totalTags: dbStats.totalTags,
      tableSizes: dbStats.tableSizes,
      databaseSizeBytes: dbStats.databaseSizeBytes,
    },
    queue: queueStats,
    circuitBreakers: circuitBreakerStats,
    memoryUsage: {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      rss: memoryUsage.rss,
      external: memoryUsage.external,
    },
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    timestamp: new Date().toISOString(),
  });
}
