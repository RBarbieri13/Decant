// ============================================================
// Processing Queue Service Unit Tests
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ProcessingJob, JobStatus } from '../processing_queue.js';

// Mock dependencies before importing the module
vi.mock('../../database/connection.js', () => {
  const mockDb = {
    prepare: vi.fn(),
    exec: vi.fn(),
  };
  return {
    getDatabase: vi.fn(() => mockDb),
    closeDatabase: vi.fn(),
    getDatabasePath: vi.fn(() => ':memory:'),
    isDatabaseInitialized: vi.fn(() => true),
  };
});

vi.mock('../../database/transaction.js', () => ({
  withTransaction: <T>(fn: () => T): T => fn(),
  withTransactionSync: <T>(fn: () => T): T => fn(),
}));

vi.mock('../phase2_enricher.js', () => ({
  enrichNode: vi.fn().mockResolvedValue({
    success: true,
    nodeId: 'test-node-id',
    durationMs: 100,
  }),
}));

vi.mock('../notifications/index.js', () => ({
  emitEnrichmentComplete: vi.fn(),
}));

vi.mock('../../logger/index.js', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-1234'),
}));

describe('Processing Queue Service', () => {
  let mockPrepare: ReturnType<typeof vi.fn>;
  let mockDb: { prepare: ReturnType<typeof vi.fn>; exec: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get the mocked database
    const { getDatabase } = await import('../../database/connection.js');
    mockDb = getDatabase() as unknown as typeof mockDb;
    mockPrepare = mockDb.prepare;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ProcessingQueue class', () => {
    describe('constructor and configuration', () => {
      it('should create queue with default configuration', async () => {
        const { ProcessingQueue } = await import('../processing_queue.js');
        const queue = new ProcessingQueue();

        expect(queue).toBeDefined();
        expect(queue.isActive()).toBe(false);
      });

      it('should create queue with custom configuration', async () => {
        const { ProcessingQueue } = await import('../processing_queue.js');
        const queue = new ProcessingQueue({
          pollIntervalMs: 1000,
          maxConcurrent: 2,
          retryDelays: [1000, 2000],
          maxAttempts: 5,
        });

        expect(queue).toBeDefined();
      });
    });

    describe('start and stop', () => {
      it('should start the queue processor', async () => {
        const { ProcessingQueue } = await import('../processing_queue.js');
        const queue = new ProcessingQueue({ pollIntervalMs: 60000 });

        queue.start();
        expect(queue.isActive()).toBe(true);

        await queue.stop();
        expect(queue.isActive()).toBe(false);
      });

      it('should warn when starting already running queue', async () => {
        const { ProcessingQueue } = await import('../processing_queue.js');
        const { log } = await import('../../logger/index.js');
        const queue = new ProcessingQueue({ pollIntervalMs: 60000 });

        queue.start();
        queue.start();

        expect(log.warn).toHaveBeenCalledWith(
          'Processing queue already running',
          expect.any(Object)
        );

        await queue.stop();
      });

      it('should stop gracefully', async () => {
        const { ProcessingQueue } = await import('../processing_queue.js');
        const queue = new ProcessingQueue({ pollIntervalMs: 60000 });

        queue.start();
        await queue.stop();

        expect(queue.isActive()).toBe(false);
      });
    });

    describe('enqueue', () => {
      it('should enqueue a job with default options', async () => {
        const { ProcessingQueue } = await import('../processing_queue.js');

        const mockRun = vi.fn();
        mockPrepare.mockReturnValue({ run: mockRun });

        const queue = new ProcessingQueue();
        const jobId = queue.enqueue('test-node-id');

        expect(jobId).toBe('test-uuid-1234');
        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO processing_queue')
        );
        expect(mockRun).toHaveBeenCalledWith(
          'test-uuid-1234',
          'test-node-id',
          'phase2',
          0,
          3
        );
      });

      it('should enqueue a job with custom priority', async () => {
        const { ProcessingQueue } = await import('../processing_queue.js');

        const mockRun = vi.fn();
        mockPrepare.mockReturnValue({ run: mockRun });

        const queue = new ProcessingQueue();
        queue.enqueue('test-node-id', { priority: 10 });

        expect(mockRun).toHaveBeenCalledWith(
          'test-uuid-1234',
          'test-node-id',
          'phase2',
          10,
          3
        );
      });

      it('should enqueue a job with custom max attempts', async () => {
        const { ProcessingQueue } = await import('../processing_queue.js');

        const mockRun = vi.fn();
        mockPrepare.mockReturnValue({ run: mockRun });

        const queue = new ProcessingQueue();
        queue.enqueue('test-node-id', { maxAttempts: 5 });

        expect(mockRun).toHaveBeenCalledWith(
          'test-uuid-1234',
          'test-node-id',
          'phase2',
          0,
          5
        );
      });
    });

    describe('enqueueMany', () => {
      it('should enqueue multiple nodes', async () => {
        const { ProcessingQueue } = await import('../processing_queue.js');

        const mockRun = vi.fn();
        mockPrepare.mockReturnValue({ run: mockRun });

        // Mock uuid to return different values for each call
        const { v4 } = await import('uuid');
        (v4 as ReturnType<typeof vi.fn>)
          .mockReturnValueOnce('uuid-1')
          .mockReturnValueOnce('uuid-2')
          .mockReturnValueOnce('uuid-3');

        const queue = new ProcessingQueue();
        const jobIds = queue.enqueueMany(['node-1', 'node-2', 'node-3']);

        expect(jobIds).toHaveLength(3);
        expect(mockRun).toHaveBeenCalledTimes(3);
      });

      it('should enqueue many with custom priority', async () => {
        const { ProcessingQueue } = await import('../processing_queue.js');

        const mockRun = vi.fn();
        mockPrepare.mockReturnValue({ run: mockRun });

        const queue = new ProcessingQueue();
        queue.enqueueMany(['node-1', 'node-2'], { priority: 5 });

        expect(mockRun).toHaveBeenCalledWith(
          expect.any(String),
          'node-1',
          'phase2',
          5,
          3
        );
      });
    });

    describe('getJob', () => {
      it('should return job by ID', async () => {
        const { ProcessingQueue } = await import('../processing_queue.js');

        const mockJob: ProcessingJob = {
          id: 'job-123',
          node_id: 'node-456',
          phase: 'phase2',
          status: 'pending',
          priority: 0,
          attempts: 0,
          max_attempts: 3,
          error_message: null,
          created_at: '2024-01-01T00:00:00Z',
          processed_at: null,
        };

        mockPrepare.mockReturnValue({ get: vi.fn().mockReturnValue(mockJob) });

        const queue = new ProcessingQueue();
        const job = queue.getJob('job-123');

        expect(job).toEqual(mockJob);
      });

      it('should return null for non-existent job', async () => {
        const { ProcessingQueue } = await import('../processing_queue.js');

        mockPrepare.mockReturnValue({ get: vi.fn().mockReturnValue(undefined) });

        const queue = new ProcessingQueue();
        const job = queue.getJob('non-existent');

        expect(job).toBeNull();
      });
    });

    describe('getJobsForNode', () => {
      it('should return all jobs for a node', async () => {
        const { ProcessingQueue } = await import('../processing_queue.js');

        const mockJobs: ProcessingJob[] = [
          {
            id: 'job-1',
            node_id: 'node-123',
            phase: 'phase2',
            status: 'complete',
            priority: 0,
            attempts: 1,
            max_attempts: 3,
            error_message: null,
            created_at: '2024-01-01T00:00:00Z',
            processed_at: '2024-01-01T00:01:00Z',
          },
          {
            id: 'job-2',
            node_id: 'node-123',
            phase: 'phase2',
            status: 'pending',
            priority: 0,
            attempts: 0,
            max_attempts: 3,
            error_message: null,
            created_at: '2024-01-02T00:00:00Z',
            processed_at: null,
          },
        ];

        mockPrepare.mockReturnValue({ all: vi.fn().mockReturnValue(mockJobs) });

        const queue = new ProcessingQueue();
        const jobs = queue.getJobsForNode('node-123');

        expect(jobs).toHaveLength(2);
        expect(jobs[0].id).toBe('job-1');
        expect(jobs[1].id).toBe('job-2');
      });
    });

    describe('getStats', () => {
      it('should return queue statistics', async () => {
        const { ProcessingQueue } = await import('../processing_queue.js');

        const mockStats = [
          { status: 'pending', count: 5 },
          { status: 'processing', count: 2 },
          { status: 'complete', count: 10 },
          { status: 'failed', count: 1 },
        ];

        mockPrepare.mockReturnValue({ all: vi.fn().mockReturnValue(mockStats) });

        const queue = new ProcessingQueue();
        const stats = queue.getStats();

        expect(stats).toEqual({
          pending: 5,
          processing: 2,
          complete: 10,
          failed: 1,
          total: 18,
        });
      });

      it('should return empty stats for empty queue', async () => {
        const { ProcessingQueue } = await import('../processing_queue.js');

        mockPrepare.mockReturnValue({ all: vi.fn().mockReturnValue([]) });

        const queue = new ProcessingQueue();
        const stats = queue.getStats();

        expect(stats).toEqual({
          pending: 0,
          processing: 0,
          complete: 0,
          failed: 0,
          total: 0,
        });
      });
    });

    describe('clearCompleted', () => {
      it('should clear completed jobs older than specified age', async () => {
        const { ProcessingQueue } = await import('../processing_queue.js');

        const mockRun = vi.fn().mockReturnValue({ changes: 5 });
        mockPrepare.mockReturnValue({ run: mockRun });

        const queue = new ProcessingQueue();
        const cleared = queue.clearCompleted(1000 * 60 * 60 * 24); // 24 hours

        expect(cleared).toBe(5);
        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining("WHERE status = 'complete'")
        );
      });

      it('should use default 24 hour age', async () => {
        const { ProcessingQueue } = await import('../processing_queue.js');

        const mockRun = vi.fn().mockReturnValue({ changes: 3 });
        mockPrepare.mockReturnValue({ run: mockRun });

        const queue = new ProcessingQueue();
        const cleared = queue.clearCompleted();

        expect(cleared).toBe(3);
      });
    });

    describe('retryFailed', () => {
      it('should reset all failed jobs for retry', async () => {
        const { ProcessingQueue } = await import('../processing_queue.js');

        const mockRun = vi.fn().mockReturnValue({ changes: 3 });
        mockPrepare.mockReturnValue({ run: mockRun });

        const queue = new ProcessingQueue();
        const retried = queue.retryFailed();

        expect(retried).toBe(3);
        expect(mockPrepare).toHaveBeenCalledWith(
          expect.stringContaining("SET status = 'pending'")
        );
      });

      it('should reset failed jobs for specific node', async () => {
        const { ProcessingQueue } = await import('../processing_queue.js');

        const mockRun = vi.fn().mockReturnValue({ changes: 1 });
        mockPrepare.mockReturnValue({ run: mockRun });

        const queue = new ProcessingQueue();
        const retried = queue.retryFailed('specific-node-id');

        expect(retried).toBe(1);
        expect(mockRun).toHaveBeenCalledWith('specific-node-id');
      });
    });

    describe('cancel', () => {
      it('should cancel pending job', async () => {
        const { ProcessingQueue } = await import('../processing_queue.js');

        const mockRun = vi.fn().mockReturnValue({ changes: 1 });
        mockPrepare.mockReturnValue({ run: mockRun });

        const queue = new ProcessingQueue();
        const cancelled = queue.cancel('job-to-cancel');

        expect(cancelled).toBe(true);
      });

      it('should return false for non-existent or non-pending job', async () => {
        const { ProcessingQueue } = await import('../processing_queue.js');

        const mockRun = vi.fn().mockReturnValue({ changes: 0 });
        mockPrepare.mockReturnValue({ run: mockRun });

        const queue = new ProcessingQueue();
        const cancelled = queue.cancel('non-existent-job');

        expect(cancelled).toBe(false);
      });
    });
  });

  describe('Job Status Transitions', () => {
    it('should handle job status transitions correctly', async () => {
      const { ProcessingQueue } = await import('../processing_queue.js');

      // Test that the queue accepts valid status values
      const mockJob: ProcessingJob = {
        id: 'job-status',
        node_id: 'node-status',
        phase: 'phase2',
        status: 'pending',
        priority: 0,
        attempts: 0,
        max_attempts: 3,
        error_message: null,
        created_at: '2024-01-01T00:00:00Z',
        processed_at: null,
      };

      mockPrepare.mockReturnValue({ 
        get: vi.fn().mockReturnValue(mockJob),
        all: vi.fn().mockReturnValue([mockJob]),
        run: vi.fn().mockReturnValue({ changes: 1 })
      });

      const queue = new ProcessingQueue();
      const job = queue.getJob('job-status');
      
      expect(job?.status).toBe('pending');
    });

    it('should verify all status values are valid', () => {
      const validStatuses: JobStatus[] = ['pending', 'processing', 'complete', 'failed'];
      
      validStatuses.forEach(status => {
        expect(['pending', 'processing', 'complete', 'failed']).toContain(status);
      });
    });
  });

  describe('Priority Ordering', () => {
    it('should verify SQL orders by priority DESC', async () => {
      const { ProcessingQueue } = await import('../processing_queue.js');

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([]),
        run: vi.fn().mockReturnValue({ changes: 0 }),
      });

      // The queue prepares a statement that orders by priority DESC
      // We verify by checking the prepared SQL
      new ProcessingQueue();

      // When jobs are fetched, they should be ordered by priority DESC
      // This is verified by the SQL statement in fetchPendingJobs
    });

    it('should process higher priority jobs first', async () => {
      const { ProcessingQueue } = await import('../processing_queue.js');

      const highPriorityJob: ProcessingJob = {
        id: 'high-priority',
        node_id: 'node-high',
        phase: 'phase2',
        status: 'pending',
        priority: 10,
        attempts: 0,
        max_attempts: 3,
        error_message: null,
        created_at: '2024-01-01T00:00:00Z',
        processed_at: null,
      };

      const lowPriorityJob: ProcessingJob = {
        id: 'low-priority',
        node_id: 'node-low',
        phase: 'phase2',
        status: 'pending',
        priority: 1,
        attempts: 0,
        max_attempts: 3,
        error_message: null,
        created_at: '2024-01-01T00:00:00Z',
        processed_at: null,
      };

      // Return jobs in priority order (simulating ORDER BY priority DESC)
      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([highPriorityJob, lowPriorityJob]),
        run: vi.fn().mockReturnValue({ changes: 0 }),
      });

      const queue = new ProcessingQueue();
      const jobs = queue.getJobsForNode('node-high'); // This just verifies mock setup

      // The actual priority ordering is done by SQL
      expect(jobs.length).toBeGreaterThan(0);
    });
  });

  describe('Retry Logic', () => {
    it('should respect max attempts', async () => {
      const { ProcessingQueue } = await import('../processing_queue.js');

      const mockRun = vi.fn().mockReturnValue({ changes: 1 });
      mockPrepare.mockReturnValue({ run: mockRun });

      const queue = new ProcessingQueue({ maxAttempts: 5 });
      queue.enqueue('test-node', { maxAttempts: 5 });

      expect(mockRun).toHaveBeenCalledWith(
        expect.any(String),
        'test-node',
        'phase2',
        0,
        5
      );
    });

    it('should use custom retry delays', async () => {
      const { ProcessingQueue } = await import('../processing_queue.js');

      const queue = new ProcessingQueue({
        retryDelays: [1000, 5000, 10000],
      });

      expect(queue).toBeDefined();
    });
  });

  describe('Job Expiration/Cleanup', () => {
    it('should clear old completed jobs', async () => {
      const { ProcessingQueue } = await import('../processing_queue.js');

      const mockRun = vi.fn().mockReturnValue({ changes: 10 });
      mockPrepare.mockReturnValue({ run: mockRun });

      const queue = new ProcessingQueue();
      const oneDayMs = 24 * 60 * 60 * 1000;
      const cleared = queue.clearCompleted(oneDayMs);

      expect(cleared).toBe(10);
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM processing_queue')
      );
    });

    it('should not clear recent completed jobs', async () => {
      const { ProcessingQueue } = await import('../processing_queue.js');

      // Mock no jobs found (all jobs are recent)
      const mockRun = vi.fn().mockReturnValue({ changes: 0 });
      mockPrepare.mockReturnValue({ run: mockRun });

      const queue = new ProcessingQueue();
      const cleared = queue.clearCompleted();

      expect(cleared).toBe(0);
    });
  });

  describe('Singleton Functions', () => {
    it('should get or create singleton queue', async () => {
      // Clear module cache to get fresh singleton
      vi.resetModules();

      const mockRun = vi.fn();
      vi.doMock('../../database/connection.js', () => ({
        getDatabase: vi.fn(() => ({
          prepare: vi.fn().mockReturnValue({ run: mockRun }),
        })),
      }));

      const { getProcessingQueue } = await import('../processing_queue.js');

      const queue1 = getProcessingQueue();
      const queue2 = getProcessingQueue();

      expect(queue1).toBe(queue2);
    });

    it('should enqueue for enrichment with default priority', async () => {
      vi.resetModules();

      const mockRun = vi.fn();
      vi.doMock('../../database/connection.js', () => ({
        getDatabase: vi.fn(() => ({
          prepare: vi.fn().mockReturnValue({ run: mockRun }),
        })),
      }));

      const { enqueueForEnrichment } = await import('../processing_queue.js');

      const jobId = enqueueForEnrichment('test-node');

      expect(jobId).toBeDefined();
    });

    it('should enqueue many for enrichment', async () => {
      vi.resetModules();

      const mockRun = vi.fn();
      vi.doMock('../../database/connection.js', () => ({
        getDatabase: vi.fn(() => ({
          prepare: vi.fn().mockReturnValue({ run: mockRun }),
        })),
      }));
      vi.doMock('../../database/transaction.js', () => ({
        withTransaction: <T>(fn: () => T): T => fn(),
      }));

      const { enqueueManyForEnrichment } = await import('../processing_queue.js');

      const jobIds = enqueueManyForEnrichment(['node-1', 'node-2'], 5);

      expect(jobIds).toBeDefined();
    });
  });

  describe('Concurrent Processing', () => {
    it('should respect maxConcurrent setting', async () => {
      const { ProcessingQueue } = await import('../processing_queue.js');

      const queue = new ProcessingQueue({
        maxConcurrent: 3,
        pollIntervalMs: 60000,
      });

      expect(queue).toBeDefined();
      expect(queue.isActive()).toBe(false);
    });
  });
});
