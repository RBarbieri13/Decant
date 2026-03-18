// ============================================================
// Processing Queue Health Check (Deprecated)
// ============================================================
// The async queue has been replaced by synchronous import.
// This stub keeps the health check interface intact.

import { ComponentHealth } from './types.js';

export function checkQueueHealth(): ComponentHealth {
  return {
    status: 'healthy',
    message: 'Processing queue deprecated — imports are now synchronous',
    lastChecked: new Date().toISOString(),
    latencyMs: 0,
  };
}