// ============================================================
// Cache Health Check
// ============================================================

import { stats as getCacheStats } from '../cache/index.js';
import { log } from '../logger/index.js';
import { ComponentHealth, CacheHealthDetails } from './types.js';

const MEMORY_WARNING_MB = 100;
const MEMORY_CRITICAL_MB = 200;

/**
 * Estimate memory usage of cache entries
 * Rough estimation based on JSON serialization
 */
function estimateMemoryUsage(): number {
  try {
    const stats = getCacheStats();
    // Rough estimate: average 1KB per cache entry
    // More accurate would require actual serialization
    return stats.size * 1024;
  } catch {
    return 0;
  }
}

/**
 * Check cache health
 * Warning if memory > 100MB, critical if > 200MB
 */
export function checkCacheHealth(): ComponentHealth {
  const startTime = Date.now();
  const lastChecked = new Date().toISOString();

  try {
    const stats = getCacheStats();
    const memoryUsageBytes = estimateMemoryUsage();
    const memoryUsageMB = memoryUsageBytes / (1024 * 1024);

    const details: CacheHealthDetails = {
      size: stats.size,
      memoryUsageBytes,
      // Hit rate calculation would require tracking hits/misses
      // Can be added by extending cache module
    };

    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    let message: string;

    if (memoryUsageMB >= MEMORY_CRITICAL_MB) {
      status = 'unhealthy';
      message = `Cache memory usage critical: ${memoryUsageMB.toFixed(2)}MB`;
    } else if (memoryUsageMB >= MEMORY_WARNING_MB) {
      status = 'degraded';
      message = `Cache memory usage high: ${memoryUsageMB.toFixed(2)}MB`;
    } else {
      status = 'healthy';
      message = `Cache operational (${stats.size} entries, ${memoryUsageMB.toFixed(2)}MB)`;
    }

    return {
      status,
      message,
      lastChecked,
      latencyMs: Date.now() - startTime,
      details,
    };
  } catch (error) {
    log.error('Cache health check failed', { err: error, module: 'health' });

    return {
      status: 'degraded',
      message:
        error instanceof Error ? error.message : 'Cache health check failed',
      lastChecked,
      latencyMs: Date.now() - startTime,
    };
  }
}
