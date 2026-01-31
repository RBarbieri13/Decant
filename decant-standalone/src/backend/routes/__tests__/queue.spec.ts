// ============================================================
// Queue Routes Integration Tests
// ============================================================

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createTestApp } from '../../__tests__/test-app.js';
import { getTestDatabase, resetTestDatabase } from '../../__tests__/setup.js';

// Add processing_queue table to test database
function ensureQueueTable(): void {
  const db = getTestDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS processing_queue (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      phase TEXT NOT NULL DEFAULT 'phase2',
      status TEXT NOT NULL DEFAULT 'pending',
      priority INTEGER DEFAULT 0,
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 3,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME,
      FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_queue_status_priority
      ON processing_queue(status, priority DESC, created_at ASC);
  `);
}

// Mock the processing queue service
vi.mock('../../services/processing_queue.js', () => {
  let mockJobs: any[] = [];
  let isActive = false;
  
  return {
    getProcessingQueue: () => ({
      getStats: () => ({
        pending: mockJobs.filter(j => j.status === 'pending').length,
        processing: mockJobs.filter(j => j.status === 'processing').length,
        complete: mockJobs.filter(j => j.status === 'complete').length,
        failed: mockJobs.filter(j => j.status === 'failed').length,
      }),
      isActive: () => isActive,
      getJob: (id: string) => mockJobs.find(j => j.id === id) || null,
      getJobsForNode: (nodeId: string) => mockJobs.filter(j => j.node_id === nodeId),
      enqueue: (nodeId: string, options?: any) => {
        const id = uuidv4();
        mockJobs.push({
          id,
          node_id: nodeId,
          phase: options?.phase || 'phase2',
          status: 'pending',
          attempts: 0,
          max_attempts: options?.maxAttempts || 3,
          error_message: null,
          created_at: new Date().toISOString(),
          processed_at: null,
          priority: options?.priority || 0,
        });
        return id;
      },
      // Test helpers
      _setActive: (active: boolean) => { isActive = active; },
      _addJob: (job: any) => { mockJobs.push(job); },
      _reset: () => { mockJobs = []; isActive = false; },
      _getJobs: () => mockJobs,
    }),
    enqueueForEnrichment: vi.fn(),
  };
});

import { getProcessingQueue } from '../../services/processing_queue.js';
import { createNode } from '../../database/nodes.js';

describe('Queue API Routes', () => {
  const app = createTestApp();

  beforeEach(() => {
    resetTestDatabase();
    ensureQueueTable();
    const queue = getProcessingQueue() as any;
    queue._reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // GET /api/queue/status - Queue Statistics
  // ============================================================
  
  describe('GET /api/queue/status', () => {
    it('should return queue statistics with all counts', async () => {
      const queue = getProcessingQueue() as any;
      
      // Add jobs with different statuses
      queue._addJob({ id: uuidv4(), node_id: uuidv4(), status: 'pending', phase: 'phase2', attempts: 0, max_attempts: 3, error_message: null, created_at: new Date().toISOString(), processed_at: null });
      queue._addJob({ id: uuidv4(), node_id: uuidv4(), status: 'pending', phase: 'phase2', attempts: 0, max_attempts: 3, error_message: null, created_at: new Date().toISOString(), processed_at: null });
      queue._addJob({ id: uuidv4(), node_id: uuidv4(), status: 'processing', phase: 'phase2', attempts: 1, max_attempts: 3, error_message: null, created_at: new Date().toISOString(), processed_at: null });
      queue._addJob({ id: uuidv4(), node_id: uuidv4(), status: 'complete', phase: 'phase2', attempts: 1, max_attempts: 3, error_message: null, created_at: new Date().toISOString(), processed_at: new Date().toISOString() });
      queue._addJob({ id: uuidv4(), node_id: uuidv4(), status: 'failed', phase: 'phase2', attempts: 3, max_attempts: 3, error_message: 'Test error', created_at: new Date().toISOString(), processed_at: new Date().toISOString() });

      const response = await request(app).get('/api/queue/status');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('pending', 2);
      expect(response.body).toHaveProperty('processing', 1);
      expect(response.body).toHaveProperty('complete', 1);
      expect(response.body).toHaveProperty('failed', 1);
      expect(response.body).toHaveProperty('isRunning');
    });

    it('should return zeros when queue is empty', async () => {
      const response = await request(app).get('/api/queue/status');

      expect(response.status).toBe(200);
      expect(response.body.pending).toBe(0);
      expect(response.body.processing).toBe(0);
      expect(response.body.complete).toBe(0);
      expect(response.body.failed).toBe(0);
    });

    it('should indicate queue running state correctly', async () => {
      const queue = getProcessingQueue() as any;
      queue._setActive(true);

      const response = await request(app).get('/api/queue/status');

      expect(response.status).toBe(200);
      expect(response.body.isRunning).toBe(true);
    });
  });

  // ============================================================
  // GET /api/queue/jobs - List Jobs with Filtering
  // ============================================================
  
  describe('GET /api/queue/jobs', () => {
    it('should return paginated list of jobs', async () => {
      const db = getTestDatabase();
      const nodeId = uuidv4();
      
      // Create a node first
      db.prepare(`
        INSERT INTO nodes (id, title, url, source_domain)
        VALUES (?, 'Test Node', 'https://example.com/test', 'example.com')
      `).run(nodeId);

      // Add jobs directly to database
      const job1Id = uuidv4();
      const job2Id = uuidv4();
      db.prepare(`
        INSERT INTO processing_queue (id, node_id, phase, status, priority, attempts, max_attempts)
        VALUES (?, ?, 'phase2', 'pending', 0, 0, 3)
      `).run(job1Id, nodeId);
      db.prepare(`
        INSERT INTO processing_queue (id, node_id, phase, status, priority, attempts, max_attempts)
        VALUES (?, ?, 'phase2', 'complete', 0, 1, 3)
      `).run(job2Id, nodeId);

      const response = await request(app).get('/api/queue/jobs');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jobs');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(Array.isArray(response.body.jobs)).toBe(true);
    });

    it('should filter jobs by status', async () => {
      const db = getTestDatabase();
      const nodeId = uuidv4();
      
      db.prepare(`
        INSERT INTO nodes (id, title, url, source_domain)
        VALUES (?, 'Test Node', 'https://example.com/filter', 'example.com')
      `).run(nodeId);

      db.prepare(`
        INSERT INTO processing_queue (id, node_id, phase, status, priority, attempts, max_attempts)
        VALUES (?, ?, 'phase2', 'pending', 0, 0, 3)
      `).run(uuidv4(), nodeId);
      db.prepare(`
        INSERT INTO processing_queue (id, node_id, phase, status, priority, attempts, max_attempts)
        VALUES (?, ?, 'phase2', 'failed', 0, 3, 3)
      `).run(uuidv4(), nodeId);

      const response = await request(app)
        .get('/api/queue/jobs')
        .query({ status: 'pending' });

      expect(response.status).toBe(200);
      expect(response.body.jobs.every((j: any) => j.status === 'pending')).toBe(true);
    });

    it('should respect pagination parameters', async () => {
      const db = getTestDatabase();
      const nodeId = uuidv4();
      
      db.prepare(`
        INSERT INTO nodes (id, title, url, source_domain)
        VALUES (?, 'Test Node', 'https://example.com/paginate', 'example.com')
      `).run(nodeId);

      // Add multiple jobs
      for (let i = 0; i < 10; i++) {
        db.prepare(`
          INSERT INTO processing_queue (id, node_id, phase, status, priority, attempts, max_attempts)
          VALUES (?, ?, 'phase2', 'pending', 0, 0, 3)
        `).run(uuidv4(), nodeId);
      }

      const response = await request(app)
        .get('/api/queue/jobs')
        .query({ limit: '5', offset: '0' });

      expect(response.status).toBe(200);
      expect(response.body.jobs.length).toBe(5);
      expect(response.body.limit).toBe(5);
      expect(response.body.page).toBe(1);
    });

    it('should return 400 for invalid limit parameter', async () => {
      const response = await request(app)
        .get('/api/queue/jobs')
        .query({ limit: 'not-a-number' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid status parameter', async () => {
      const response = await request(app)
        .get('/api/queue/jobs')
        .query({ status: 'invalid-status' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  // ============================================================
  // GET /api/queue/jobs/:nodeId - Get Job for Node
  // ============================================================
  
  describe('GET /api/queue/jobs/:nodeId', () => {
    it('should return job for a specific node', async () => {
      const queue = getProcessingQueue() as any;
      const nodeId = uuidv4();
      const jobId = uuidv4();

      queue._addJob({
        id: jobId,
        node_id: nodeId,
        phase: 'phase2',
        status: 'pending',
        attempts: 0,
        max_attempts: 3,
        error_message: null,
        created_at: new Date().toISOString(),
        processed_at: null,
      });

      const response = await request(app).get(`/api/queue/jobs/${nodeId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('job');
      expect(response.body.job.nodeId).toBe(nodeId);
    });

    it('should return null job when no job exists for node', async () => {
      const nonExistentNodeId = uuidv4();

      const response = await request(app).get(`/api/queue/jobs/${nonExistentNodeId}`);

      expect(response.status).toBe(200);
      expect(response.body.job).toBeNull();
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await request(app).get('/api/queue/jobs/not-a-uuid');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  // ============================================================
  // POST /api/queue/retry/:jobId - Retry Failed Job
  // ============================================================
  
  describe('POST /api/queue/retry/:jobId', () => {
    it('should retry a failed job', async () => {
      const db = getTestDatabase();
      const nodeId = uuidv4();
      const jobId = uuidv4();

      // Create node
      db.prepare(`
        INSERT INTO nodes (id, title, url, source_domain)
        VALUES (?, 'Test Node', 'https://example.com/retry', 'example.com')
      `).run(nodeId);

      // Create failed job
      db.prepare(`
        INSERT INTO processing_queue (id, node_id, phase, status, attempts, max_attempts, error_message)
        VALUES (?, ?, 'phase2', 'failed', 3, 3, 'Test error')
      `).run(jobId, nodeId);

      // Mock queue to return the job
      const queue = getProcessingQueue() as any;
      queue._addJob({
        id: jobId,
        node_id: nodeId,
        phase: 'phase2',
        status: 'failed',
        attempts: 3,
        max_attempts: 3,
        error_message: 'Test error',
        created_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
      });

      const response = await request(app).post(`/api/queue/retry/${jobId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('retry');
    });

    it('should return 404 for non-existent job', async () => {
      const nonExistentJobId = uuidv4();

      const response = await request(app).post(`/api/queue/retry/${nonExistentJobId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 when trying to retry non-failed job', async () => {
      const queue = getProcessingQueue() as any;
      const jobId = uuidv4();

      queue._addJob({
        id: jobId,
        node_id: uuidv4(),
        phase: 'phase2',
        status: 'pending', // Not failed
        attempts: 0,
        max_attempts: 3,
        error_message: null,
        created_at: new Date().toISOString(),
        processed_at: null,
      });

      const response = await request(app).post(`/api/queue/retry/${jobId}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('failed');
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await request(app).post('/api/queue/retry/not-a-uuid');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  // ============================================================
  // DELETE /api/queue/jobs/:jobId - Cancel/Remove Job
  // ============================================================
  
  describe('DELETE /api/queue/jobs/:jobId', () => {
    it('should cancel a pending job', async () => {
      const db = getTestDatabase();
      const nodeId = uuidv4();
      const jobId = uuidv4();

      // Create node
      db.prepare(`
        INSERT INTO nodes (id, title, url, source_domain)
        VALUES (?, 'Test Node', 'https://example.com/cancel', 'example.com')
      `).run(nodeId);

      // Create pending job
      db.prepare(`
        INSERT INTO processing_queue (id, node_id, phase, status, attempts, max_attempts)
        VALUES (?, ?, 'phase2', 'pending', 0, 3)
      `).run(jobId, nodeId);

      // Mock queue
      const queue = getProcessingQueue() as any;
      queue._addJob({
        id: jobId,
        node_id: nodeId,
        phase: 'phase2',
        status: 'pending',
        attempts: 0,
        max_attempts: 3,
        error_message: null,
        created_at: new Date().toISOString(),
        processed_at: null,
      });

      const response = await request(app).delete(`/api/queue/jobs/${jobId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent job', async () => {
      const nonExistentJobId = uuidv4();

      const response = await request(app).delete(`/api/queue/jobs/${nonExistentJobId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 when trying to cancel processing job', async () => {
      const queue = getProcessingQueue() as any;
      const jobId = uuidv4();

      queue._addJob({
        id: jobId,
        node_id: uuidv4(),
        phase: 'phase2',
        status: 'processing', // Currently processing
        attempts: 1,
        max_attempts: 3,
        error_message: null,
        created_at: new Date().toISOString(),
        processed_at: null,
      });

      const response = await request(app).delete(`/api/queue/jobs/${jobId}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('processing');
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await request(app).delete('/api/queue/jobs/not-a-uuid');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  // ============================================================
  // POST /api/queue/clear - Clear Completed Jobs
  // ============================================================
  
  describe('POST /api/queue/clear', () => {
    it('should clear all completed jobs', async () => {
      const db = getTestDatabase();
      const nodeId = uuidv4();

      // Create node
      db.prepare(`
        INSERT INTO nodes (id, title, url, source_domain)
        VALUES (?, 'Test Node', 'https://example.com/clear', 'example.com')
      `).run(nodeId);

      // Create completed jobs
      db.prepare(`
        INSERT INTO processing_queue (id, node_id, phase, status, attempts, max_attempts, processed_at)
        VALUES (?, ?, 'phase2', 'complete', 1, 3, datetime('now'))
      `).run(uuidv4(), nodeId);
      db.prepare(`
        INSERT INTO processing_queue (id, node_id, phase, status, attempts, max_attempts, processed_at)
        VALUES (?, ?, 'phase2', 'complete', 1, 3, datetime('now'))
      `).run(uuidv4(), nodeId);

      const response = await request(app).post('/api/queue/clear');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('cleared');
      expect(response.body.cleared).toBeGreaterThanOrEqual(0);
    });

    it('should clear completed jobs older than specified date', async () => {
      const db = getTestDatabase();
      const nodeId = uuidv4();

      db.prepare(`
        INSERT INTO nodes (id, title, url, source_domain)
        VALUES (?, 'Test Node', 'https://example.com/clear-old', 'example.com')
      `).run(nodeId);

      // Create completed job with old date
      db.prepare(`
        INSERT INTO processing_queue (id, node_id, phase, status, attempts, max_attempts, processed_at)
        VALUES (?, ?, 'phase2', 'complete', 1, 3, datetime('now', '-2 days'))
      `).run(uuidv4(), nodeId);

      const cutoffDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
      
      const response = await request(app)
        .post('/api/queue/clear')
        .send({ olderThan: cutoffDate });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('cleared');
    });

    it('should return 400 for invalid date format', async () => {
      const response = await request(app)
        .post('/api/queue/clear')
        .send({ olderThan: 'not-a-date' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return cleared: 0 when no completed jobs exist', async () => {
      const response = await request(app).post('/api/queue/clear');

      expect(response.status).toBe(200);
      expect(response.body.cleared).toBe(0);
    });
  });
});
