// ============================================================
// Health Check Orchestrator
// Coordinates all health checks and manages caching
// ============================================================

import { checkDatabaseHealth } from './database.js';
import { checkLLMProviderHealth } from './llm.js';
import { checkQueueHealth } from './queue.js';
import { checkCacheHealth } from './cache.js';
import { checkFilesystemHealth } from './filesystem.js';
import { log } from '../logger/index.js';
import {
  HealthCheckResponse,
  HealthStatus,
  ComponentHealth,
} from './types.js';

// Version from package.json
const VERSION = '0.1.0';

// Cache for health check results
interface CachedHealthCheck {
  result: HealthCheckResponse;
  expiresAt: number;
}

let cachedFullCheck: CachedHealthCheck | null = null;
const FULL_CHECK_CACHE_TTL_MS = 30 * 1000; // 30 seconds

/**
 * Determine overall system health status from component statuses
 * Logic:
 * - healthy: All checks pass
 * - degraded: Some non-critical checks fail (LLM, cache)
 * - unhealthy: Critical checks fail (database, filesystem)
 */
function determineOverallStatus(checks: {
  database: ComponentHealth;
  llmProvider: ComponentHealth;
  queue: ComponentHealth;
  cache: ComponentHealth;
  filesystem: ComponentHealth;
}): HealthStatus {
  // Critical components: database, filesystem
  if (
    checks.database.status === 'unhealthy' ||
    checks.filesystem.status === 'unhealthy'
  ) {
    return 'unhealthy';
  }

  // Queue unhealthy also makes system unhealthy
  if (checks.queue.status === 'unhealthy') {
    return 'unhealthy';
  }

  // Any degraded component makes system degraded
  if (
    checks.database.status === 'degraded' ||
    checks.llmProvider.status === 'degraded' ||
    checks.queue.status === 'degraded' ||
    checks.cache.status === 'degraded' ||
    checks.filesystem.status === 'degraded'
  ) {
    return 'degraded';
  }

  return 'healthy';
}

/**
 * Perform a quick database-only health check
 * Used for basic liveness/readiness checks
 */
export function quickHealthCheck(): {
  status: HealthStatus;
  latencyMs: number;
} {
  const result = checkDatabaseHealth();
  return {
    status: result.healthy ? 'healthy' : 'unhealthy',
    latencyMs: result.latencyMs || 0,
  };
}

/**
 * Perform comprehensive health check of all components
 * Results are cached for 30 seconds to avoid excessive checks
 */
export async function fullHealthCheck(
  skipCache: boolean = false
): Promise<HealthCheckResponse> {
  // Check cache first
  if (!skipCache && cachedFullCheck && Date.now() < cachedFullCheck.expiresAt) {
    log.debug('Returning cached health check result', { module: 'health' });
    return cachedFullCheck.result;
  }

  const startTime = Date.now();
  log.debug('Performing full health check', { module: 'health' });

  try {
    // Run all health checks
    // Database and filesystem are synchronous
    const databaseResult = checkDatabaseHealth();
    const queueResult = checkQueueHealth();
    const cacheResult = checkCacheHealth();
    const filesystemResult = checkFilesystemHealth();

    // LLM provider check is async
    const llmProviderResult = await checkLLMProviderHealth();

    // Convert database health to ComponentHealth format
    const databaseHealth: ComponentHealth = {
      status: databaseResult.healthy ? 'healthy' : 'unhealthy',
      latencyMs: databaseResult.latencyMs,
      message: databaseResult.error || 'Database operational',
      lastChecked: new Date().toISOString(),
    };

    const checks = {
      database: databaseHealth,
      llmProvider: llmProviderResult,
      queue: queueResult,
      cache: cacheResult,
      filesystem: filesystemResult,
    };

    const result: HealthCheckResponse = {
      status: determineOverallStatus(checks),
      timestamp: new Date().toISOString(),
      version: VERSION,
      uptime: Math.floor(process.uptime()),
      checks,
    };

    // Cache the result
    cachedFullCheck = {
      result,
      expiresAt: Date.now() + FULL_CHECK_CACHE_TTL_MS,
    };

    log.debug('Full health check completed', {
      status: result.status,
      durationMs: Date.now() - startTime,
      module: 'health',
    });

    return result;
  } catch (error) {
    log.error('Full health check failed', { err: error, module: 'health' });

    // Return unhealthy status on unexpected error
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: VERSION,
      uptime: Math.floor(process.uptime()),
      checks: {
        database: {
          status: 'unhealthy',
          message: 'Health check system error',
          lastChecked: new Date().toISOString(),
        },
        llmProvider: {
          status: 'unhealthy',
          message: 'Health check system error',
          lastChecked: new Date().toISOString(),
        },
        queue: {
          status: 'unhealthy',
          message: 'Health check system error',
          lastChecked: new Date().toISOString(),
        },
        cache: {
          status: 'unhealthy',
          message: 'Health check system error',
          lastChecked: new Date().toISOString(),
        },
        filesystem: {
          status: 'unhealthy',
          message: 'Health check system error',
          lastChecked: new Date().toISOString(),
        },
      },
    };
  }
}

/**
 * Clear cached health check results
 * Useful for testing or forced refresh
 */
export function clearHealthCache(): void {
  cachedFullCheck = null;
  log.debug('Health check cache cleared', { module: 'health' });
}

/**
 * Get individual component health checks
 */
export async function getComponentHealth(
  component: 'database' | 'llm' | 'queue' | 'cache' | 'filesystem'
): Promise<ComponentHealth> {
  switch (component) {
    case 'database': {
      const result = checkDatabaseHealth();
      return {
        status: result.healthy ? 'healthy' : 'unhealthy',
        latencyMs: result.latencyMs,
        message: result.error || 'Database operational',
        lastChecked: new Date().toISOString(),
      };
    }
    case 'llm':
      return checkLLMProviderHealth();
    case 'queue':
      return checkQueueHealth();
    case 'cache':
      return checkCacheHealth();
    case 'filesystem':
      return checkFilesystemHealth();
    default:
      throw new Error(`Unknown component: ${component}`);
  }
}
