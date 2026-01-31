// ============================================================
// Audit Routes Tests
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../../__tests__/test-app.js';
import { initializeDatabase, closeDatabase } from '../../database/index.js';
import { createNode } from '../../database/nodes.js';
import { logCodeChange } from '../../database/audit.js';

describe('Audit Routes', () => {
  let app: Express.Application;

  beforeAll(() => {
    initializeDatabase();
    app = createTestApp();
  });

  afterAll(() => {
    closeDatabase();
  });

  describe('GET /api/nodes/:id/history', () => {
    it('should return 404 for non-existent node', async () => {
      const res = await request(app).get('/api/nodes/non-existent-id/history');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Node not found');
    });

    it('should return empty history for node with no changes', async () => {
      const node = createNode({
        title: 'Test Node',
        url: 'https://example.com/test-history',
        source_domain: 'example.com',
      });

      const res = await request(app).get(`/api/nodes/${node.id}/history`);
      expect(res.status).toBe(200);
      expect(res.body.nodeId).toBe(node.id);
      expect(res.body.changes).toEqual([]);
    });

    it('should return history with changes', async () => {
      const node = createNode({
        title: 'Test Node With History',
        url: 'https://example.com/test-history-2',
        source_domain: 'example.com',
      });

      // Log some changes
      logCodeChange({
        nodeId: node.id as string,
        hierarchyType: 'function',
        oldCode: null,
        newCode: 'A.LLM.T.1',
        changeType: 'created',
        triggeredBy: 'import',
        reason: 'Initial AI classification',
      });

      logCodeChange({
        nodeId: node.id as string,
        hierarchyType: 'function',
        oldCode: 'A.LLM.T.1',
        newCode: 'A.LLM.T.2',
        changeType: 'updated',
        triggeredBy: 'user_move',
        reason: 'Manual correction',
      });

      const res = await request(app).get(`/api/nodes/${node.id}/history`);
      expect(res.status).toBe(200);
      expect(res.body.nodeId).toBe(node.id);
      expect(res.body.changes).toHaveLength(2);
      expect(res.body.changes[0].newCode).toBe('A.LLM.T.2'); // Most recent first
      expect(res.body.changes[1].newCode).toBe('A.LLM.T.1');
    });

    it('should filter history by hierarchy type', async () => {
      const node = createNode({
        title: 'Test Node Multi-Hierarchy',
        url: 'https://example.com/test-history-3',
        source_domain: 'example.com',
      });

      logCodeChange({
        nodeId: node.id as string,
        hierarchyType: 'function',
        oldCode: null,
        newCode: 'A.LLM.T.1',
        changeType: 'created',
        triggeredBy: 'import',
      });

      logCodeChange({
        nodeId: node.id as string,
        hierarchyType: 'organization',
        oldCode: null,
        newCode: 'ANTH.LLM.T.1',
        changeType: 'created',
        triggeredBy: 'import',
      });

      const res = await request(app).get(
        `/api/nodes/${node.id}/history?hierarchyType=function`
      );
      expect(res.status).toBe(200);
      expect(res.body.changes).toHaveLength(1);
      expect(res.body.changes[0].hierarchyType).toBe('function');
    });

    it('should respect limit parameter', async () => {
      const node = createNode({
        title: 'Test Node Pagination',
        url: 'https://example.com/test-history-4',
        source_domain: 'example.com',
      });

      // Create 5 changes
      for (let i = 1; i <= 5; i++) {
        logCodeChange({
          nodeId: node.id as string,
          hierarchyType: 'function',
          oldCode: i === 1 ? null : `A.LLM.T.${i - 1}`,
          newCode: `A.LLM.T.${i}`,
          changeType: i === 1 ? 'created' : 'updated',
          triggeredBy: 'import',
        });
      }

      const res = await request(app).get(`/api/nodes/${node.id}/history?limit=3`);
      expect(res.status).toBe(200);
      expect(res.body.changes).toHaveLength(3);
    });
  });

  describe('GET /api/audit/recent', () => {
    it('should return recent changes', async () => {
      const res = await request(app).get('/api/audit/recent?limit=10');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('changes');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.changes)).toBe(true);
    });

    it('should reject invalid limit', async () => {
      const res = await request(app).get('/api/audit/recent?limit=1000');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid limit parameter');
    });
  });

  describe('GET /api/audit/stats', () => {
    it('should return audit statistics', async () => {
      const res = await request(app).get('/api/audit/stats');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalChanges');
      expect(res.body).toHaveProperty('byType');
      expect(res.body).toHaveProperty('byTrigger');
      expect(res.body).toHaveProperty('byHierarchy');
      expect(typeof res.body.totalChanges).toBe('number');
    });
  });
});
