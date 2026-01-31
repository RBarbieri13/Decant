// ============================================================
// Health Check Types
// Common types for health check system
// ============================================================

/**
 * Component health status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Individual component health details
 */
export interface ComponentHealth {
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
  lastChecked: string;
  details?: Record<string, any>;
}

/**
 * Queue-specific health details
 */
export interface QueueHealthDetails {
  pendingJobs: number;
  processingJobs: number;
  completedLast24h: number;
  failedLast24h: number;
  avgProcessingTimeMs: number;
}

/**
 * Cache-specific health details
 */
export interface CacheHealthDetails {
  size: number;
  memoryUsageBytes: number;
  hitRate?: number;
}

/**
 * LLM Provider-specific health details
 */
export interface LLMProviderHealthDetails {
  providerName: string;
  hasApiKey: boolean;
  model: string;
}

/**
 * Filesystem-specific health details
 */
export interface FilesystemHealthDetails {
  dataDirectory: string;
  isWritable: boolean;
  diskSpaceBytes: number;
  databaseSizeBytes?: number;
}

/**
 * Complete health check response
 */
export interface HealthCheckResponse {
  status: HealthStatus;
  timestamp: string;
  version: string;
  uptime: number; // seconds
  checks: {
    database: ComponentHealth;
    llmProvider: ComponentHealth;
    queue: ComponentHealth;
    cache: ComponentHealth;
    filesystem: ComponentHealth;
  };
}
