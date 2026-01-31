// ============================================================
// Database Health Check
// ============================================================

import { getDatabase } from '../database/connection.js';
import { log } from '../logger/index.js';

export interface DatabaseHealthResult {
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

const HEALTH_CHECK_TIMEOUT_MS = 5000;

/**
 * Check database health by executing a simple query.
 * Returns health status with latency or error information.
 */
export function checkDatabaseHealth(): DatabaseHealthResult {
  const startTime = Date.now();

  try {
    const db = getDatabase();

    // Use a simple query with a timeout mechanism
    // better-sqlite3 is synchronous, so we measure execution time
    const result = db.prepare('SELECT 1 as health_check').get();

    const latencyMs = Date.now() - startTime;

    // Check if query took too long (simulated timeout)
    if (latencyMs > HEALTH_CHECK_TIMEOUT_MS) {
      return {
        healthy: false,
        latencyMs,
        error: `Query exceeded timeout threshold (${HEALTH_CHECK_TIMEOUT_MS}ms)`,
      };
    }

    if (!result) {
      return {
        healthy: false,
        latencyMs,
        error: 'Health check query returned no result',
      };
    }

    return {
      healthy: true,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return {
      healthy: false,
      latencyMs,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Get the count of nodes in the database.
 * Returns -1 if there's an error.
 */
export function getNodeCount(): number {
  try {
    const db = getDatabase();
    const result = db.prepare('SELECT COUNT(*) as count FROM nodes WHERE is_deleted = 0').get() as { count: number } | undefined;
    return result?.count ?? 0;
  } catch (error) {
    log.error('Error getting node count', { err: error, module: 'health' });
    return -1;
  }
}

export interface DatabaseStats {
  nodeCount: number;
  deletedNodeCount: number;
  totalTags: number;
  tableSizes: {
    nodes: number;
    tags: number;
    node_tags: number;
  };
  databaseSizeBytes?: number;
}

/**
 * Get comprehensive database statistics.
 * Returns detailed stats about nodes, tags, and table sizes.
 */
export function getDatabaseStats(): DatabaseStats {
  try {
    const db = getDatabase();

    // Get node counts
    const nodeCountResult = db.prepare('SELECT COUNT(*) as count FROM nodes WHERE is_deleted = 0').get() as { count: number };
    const deletedNodeCountResult = db.prepare('SELECT COUNT(*) as count FROM nodes WHERE is_deleted = 1').get() as { count: number };

    // Get tag count
    const tagCountResult = db.prepare('SELECT COUNT(*) as count FROM tags').get() as { count: number };

    // Get table sizes (row counts)
    const nodesTableSize = db.prepare('SELECT COUNT(*) as count FROM nodes').get() as { count: number };
    const tagsTableSize = db.prepare('SELECT COUNT(*) as count FROM tags').get() as { count: number };
    const nodeTagsTableSize = db.prepare('SELECT COUNT(*) as count FROM node_tags').get() as { count: number };

    // Get database file size
    let databaseSizeBytes: number | undefined;
    try {
      const pageSizeResult = db.pragma('page_size', { simple: true }) as number;
      const pageCountResult = db.pragma('page_count', { simple: true }) as number;
      databaseSizeBytes = pageSizeResult * pageCountResult;
    } catch (err) {
      log.warn('Unable to calculate database size', { err, module: 'health' });
    }

    return {
      nodeCount: nodeCountResult.count,
      deletedNodeCount: deletedNodeCountResult.count,
      totalTags: tagCountResult.count,
      tableSizes: {
        nodes: nodesTableSize.count,
        tags: tagsTableSize.count,
        node_tags: nodeTagsTableSize.count,
      },
      databaseSizeBytes,
    };
  } catch (error) {
    log.error('Error getting database stats', { err: error, module: 'health' });
    return {
      nodeCount: -1,
      deletedNodeCount: -1,
      totalTags: -1,
      tableSizes: {
        nodes: -1,
        tags: -1,
        node_tags: -1,
      },
    };
  }
}
