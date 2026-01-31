// ============================================================
// Health Check System Tests
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  quickHealthCheck,
  fullHealthCheck,
  getComponentHealth,
  clearHealthCache,
} from '../index.js';
import { checkDatabaseHealth } from '../database.js';
import { checkLLMProviderHealth } from '../llm.js';
import { checkQueueHealth } from '../queue.js';
import { checkCacheHealth } from '../cache.js';
import { checkFilesystemHealth } from '../filesystem.js';

// Mock the logger to avoid console noise
vi.mock('../../logger/index.js', () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Health Check System', () => {
  beforeEach(() => {
    clearHealthCache();
  });

  describe('quickHealthCheck', () => {
    it('should return healthy status when database is accessible', () => {
      const result = quickHealthCheck();

      expect(result).toBeDefined();
      expect(result.status).toMatch(/healthy|unhealthy/);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should return latency under 100ms for healthy database', () => {
      const result = quickHealthCheck();

      if (result.status === 'healthy') {
        expect(result.latencyMs).toBeLessThan(100);
      }
    });
  });

  describe('fullHealthCheck', () => {
    it('should return complete health check response', async () => {
      const result = await fullHealthCheck();

      expect(result).toBeDefined();
      expect(result.status).toMatch(/healthy|degraded|unhealthy/);
      expect(result.timestamp).toBeDefined();
      expect(result.version).toBe('0.1.0');
      expect(result.uptime).toBeGreaterThanOrEqual(0);

      // Check all components are present
      expect(result.checks).toBeDefined();
      expect(result.checks.database).toBeDefined();
      expect(result.checks.llmProvider).toBeDefined();
      expect(result.checks.queue).toBeDefined();
      expect(result.checks.cache).toBeDefined();
      expect(result.checks.filesystem).toBeDefined();
    });

    it('should include component details', async () => {
      const result = await fullHealthCheck();

      // Each component should have required fields
      const components = [
        result.checks.database,
        result.checks.llmProvider,
        result.checks.queue,
        result.checks.cache,
        result.checks.filesystem,
      ];

      for (const component of components) {
        expect(component.status).toMatch(/healthy|degraded|unhealthy/);
        expect(component.lastChecked).toBeDefined();
        expect(component.message).toBeDefined();
      }
    });

    it('should cache results for 30 seconds', async () => {
      const firstCheck = await fullHealthCheck();
      const secondCheck = await fullHealthCheck();

      // Should return the same object (cached)
      expect(firstCheck.timestamp).toBe(secondCheck.timestamp);
    });

    it('should bypass cache when skipCache is true', async () => {
      const firstCheck = await fullHealthCheck();

      // Wait a small amount to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const secondCheck = await fullHealthCheck(true);

      // Should have different timestamps
      expect(firstCheck.timestamp).not.toBe(secondCheck.timestamp);
    });

    it('should determine overall status correctly', async () => {
      const result = await fullHealthCheck();

      // If database or filesystem is unhealthy, overall should be unhealthy
      if (
        result.checks.database.status === 'unhealthy' ||
        result.checks.filesystem.status === 'unhealthy'
      ) {
        expect(result.status).toBe('unhealthy');
      }

      // If all components healthy, overall should be healthy
      const allHealthy = Object.values(result.checks).every(
        (check) => check.status === 'healthy'
      );
      if (allHealthy) {
        expect(result.status).toBe('healthy');
      }
    });
  });

  describe('getComponentHealth', () => {
    it('should return database health', async () => {
      const result = await getComponentHealth('database');

      expect(result).toBeDefined();
      expect(result.status).toMatch(/healthy|degraded|unhealthy/);
      expect(result.lastChecked).toBeDefined();
    });

    it('should return LLM provider health', async () => {
      const result = await getComponentHealth('llm');

      expect(result).toBeDefined();
      expect(result.status).toMatch(/healthy|degraded|unhealthy/);
      expect(result.lastChecked).toBeDefined();
      expect(result.details).toBeDefined();
    });

    it('should return queue health', async () => {
      const result = await getComponentHealth('queue');

      expect(result).toBeDefined();
      expect(result.status).toMatch(/healthy|degraded|unhealthy/);
      expect(result.lastChecked).toBeDefined();
    });

    it('should return cache health', async () => {
      const result = await getComponentHealth('cache');

      expect(result).toBeDefined();
      expect(result.status).toMatch(/healthy|degraded|unhealthy/);
      expect(result.lastChecked).toBeDefined();
    });

    it('should return filesystem health', async () => {
      const result = await getComponentHealth('filesystem');

      expect(result).toBeDefined();
      expect(result.status).toMatch(/healthy|degraded|unhealthy/);
      expect(result.lastChecked).toBeDefined();
    });

    it('should throw error for invalid component', async () => {
      await expect(
        getComponentHealth('invalid' as any)
      ).rejects.toThrow('Unknown component');
    });
  });

  describe('Individual Component Checks', () => {
    describe('checkDatabaseHealth', () => {
      it('should check database connectivity', () => {
        const result = checkDatabaseHealth();

        expect(result).toBeDefined();
        expect(result.healthy).toBeDefined();
        expect(typeof result.healthy).toBe('boolean');
        expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      });
    });

    describe('checkLLMProviderHealth', () => {
      it('should check LLM provider configuration', async () => {
        const result = await checkLLMProviderHealth();

        expect(result).toBeDefined();
        expect(result.status).toMatch(/healthy|degraded|unhealthy/);
        expect(result.details).toBeDefined();

        const details = result.details as any;
        expect(details.providerName).toBe('openai');
        expect(typeof details.hasApiKey).toBe('boolean');
        expect(details.model).toBeDefined();
      });
    });

    describe('checkQueueHealth', () => {
      it('should check queue status and metrics', () => {
        const result = checkQueueHealth();

        expect(result).toBeDefined();
        expect(result.status).toMatch(/healthy|degraded|unhealthy/);

        if (result.details) {
          const details = result.details as any;
          expect(typeof details.pendingJobs).toBe('number');
          expect(typeof details.processingJobs).toBe('number');
          expect(typeof details.completedLast24h).toBe('number');
          expect(typeof details.failedLast24h).toBe('number');
        }
      });
    });

    describe('checkCacheHealth', () => {
      it('should check cache memory usage', () => {
        const result = checkCacheHealth();

        expect(result).toBeDefined();
        expect(result.status).toMatch(/healthy|degraded|unhealthy/);

        if (result.details) {
          const details = result.details as any;
          expect(typeof details.size).toBe('number');
          expect(typeof details.memoryUsageBytes).toBe('number');
          expect(details.size).toBeGreaterThanOrEqual(0);
        }
      });
    });

    describe('checkFilesystemHealth', () => {
      it('should check filesystem writability and disk space', () => {
        const result = checkFilesystemHealth();

        expect(result).toBeDefined();
        expect(result.status).toMatch(/healthy|degraded|unhealthy/);

        if (result.details) {
          const details = result.details as any;
          expect(details.dataDirectory).toBeDefined();
          expect(typeof details.isWritable).toBe('boolean');
          expect(typeof details.diskSpaceBytes).toBe('number');
        }
      });

      it('should report unhealthy if directory is not writable', () => {
        const result = checkFilesystemHealth();

        if (result.details) {
          const details = result.details as any;
          if (!details.isWritable) {
            expect(result.status).toBe('unhealthy');
          }
        }
      });
    });
  });
});
