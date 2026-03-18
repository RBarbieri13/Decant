// ============================================================
// Queue Routes (Deprecated)
// ============================================================
// The async Phase 2 processing queue has been replaced by the
// synchronous semantic profiler in the import orchestrator.
// These endpoints return stubs for backward compatibility.

import { Request, Response } from 'express';

const DEPRECATED_MSG = 'Processing queue has been replaced by synchronous import. Use POST /api/hierarchy/rebuild for hierarchy operations.';

export function getQueueStatus(_req: Request, res: Response): void {
  res.json({ deprecated: true, message: DEPRECATED_MSG, stats: { pending: 0, processing: 0, completed: 0, failed: 0 } });
}

export function listJobs(_req: Request, res: Response): void {
  res.json({ deprecated: true, message: DEPRECATED_MSG, jobs: [] });
}

export function getJobForNode(_req: Request, res: Response): void {
  res.json({ deprecated: true, message: DEPRECATED_MSG, job: null });
}

export function retryJob(_req: Request, res: Response): void {
  res.json({ deprecated: true, message: DEPRECATED_MSG });
}

export function cancelJob(_req: Request, res: Response): void {
  res.json({ deprecated: true, message: DEPRECATED_MSG });
}

export function clearCompletedJobs(_req: Request, res: Response): void {
  res.json({ deprecated: true, message: DEPRECATED_MSG });
}