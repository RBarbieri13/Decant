// ============================================================
// Audit Functions Tests
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runPendingMigrations } from '../migrations/index.js';
import {
  logCodeChange,
  getNodeHistory,
  getRecentChanges,
  getChangesByType,
  getBatchChanges,
  getChangesByTrigger,
  getChangeStatistics,
  type LogCodeChangeParams,
} from '../audit.js';
import { v4 as uuidv4 } from 'uuid';

describe('Audit Functions', () => {
  let db: Database.Database;
  let testNodeId: string;

  beforeEach(() => {
    // Create in-memory database
    db = new Database(':memory:');

    // Run migrations
    runPendingMigrations(db);

    // Create a test node
    testNodeId = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO nodes (id, title, url, source_domain)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(testNodeId, 'Test Node', 'https://example.com', 'example.com');
  });

  afterEach(() => {
    db.close();
  });

  describe('logCodeChange', () => {
    it('should log a new code assignment', () => {
      const params: LogCodeChangeParams = {
        nodeId: testNodeId,
        hierarchyType: 'function',
        oldCode: null,
        newCode: 'A.LLM.T.1',
        changeType: 'created',
        triggeredBy: 'import',
        reason: 'Initial AI classification',
      };

      const changeId = logCodeChange(params, db);
      expect(changeId).toBeDefined();
      expect(typeof changeId).toBe('string');

      // Verify it was logged
      const history = getNodeHistory(testNodeId, {}, db);
      expect(history).toHaveLength(1);
      expect(history[0].newCode).toBe('A.LLM.T.1');
      expect(history[0].oldCode).toBeNull();
      expect(history[0].changeType).toBe('created');
    });

    it('should log a code update', () => {
      // Create initial
      logCodeChange({
        nodeId: testNodeId,
        hierarchyType: 'function',
        oldCode: null,
        newCode: 'A.LLM.T.1',
        changeType: 'created',
        triggeredBy: 'import',
      }, db);

      // Update code
      logCodeChange({
        nodeId: testNodeId,
        hierarchyType: 'function',
        oldCode: 'A.LLM.T.1',
        newCode: 'A.LLM.T.2',
        changeType: 'updated',
        triggeredBy: 'user_move',
        reason: 'User moved to different position',
      }, db);

      const history = getNodeHistory(testNodeId, {}, db);
      expect(history).toHaveLength(2);
      expect(history[0].newCode).toBe('A.LLM.T.2'); // Most recent first
      expect(history[0].oldCode).toBe('A.LLM.T.1');
    });

    it('should store metadata correctly', () => {
      const metadata = {
        batchId: 'batch-123',
        affectedNodes: 5,
        executionTimeMs: 150,
      };

      logCodeChange({
        nodeId: testNodeId,
        hierarchyType: 'function',
        oldCode: null,
        newCode: 'A.LLM.T.1',
        changeType: 'created',
        triggeredBy: 'import',
        metadata,
      }, db);

      const history = getNodeHistory(testNodeId, {}, db);
      expect(history[0].metadata).toEqual(metadata);
    });

    it('should store related node IDs', () => {
      const relatedIds = ['node-1', 'node-2', 'node-3'];

      logCodeChange({
        nodeId: testNodeId,
        hierarchyType: 'function',
        oldCode: 'A.LLM.T.1',
        newCode: 'A.LLM.T.2',
        changeType: 'restructured',
        triggeredBy: 'restructure',
        relatedNodeIds: relatedIds,
      }, db);

      const history = getNodeHistory(testNodeId, {}, db);
      expect(history[0].relatedNodeIds).toEqual(relatedIds);
    });
  });

  describe('getNodeHistory', () => {
    beforeEach(() => {
      // Create some test history
      logCodeChange({
        nodeId: testNodeId,
        hierarchyType: 'function',
        oldCode: null,
        newCode: 'A.LLM.T.1',
        changeType: 'created',
        triggeredBy: 'import',
      }, db);

      logCodeChange({
        nodeId: testNodeId,
        hierarchyType: 'function',
        oldCode: 'A.LLM.T.1',
        newCode: 'A.LLM.T.2',
        changeType: 'moved',
        triggeredBy: 'user_move',
      }, db);

      logCodeChange({
        nodeId: testNodeId,
        hierarchyType: 'organization',
        oldCode: null,
        newCode: 'ANTH.LLM.T.1',
        changeType: 'created',
        triggeredBy: 'import',
      }, db);
    });

    it('should return all changes for a node', () => {
      const history = getNodeHistory(testNodeId, {}, db);
      expect(history).toHaveLength(3);
    });

    it('should filter by hierarchy type', () => {
      const functionHistory = getNodeHistory(testNodeId, {
        hierarchyType: 'function',
      }, db);

      expect(functionHistory).toHaveLength(2);
      expect(functionHistory.every(h => h.hierarchyType === 'function')).toBe(true);

      const orgHistory = getNodeHistory(testNodeId, {
        hierarchyType: 'organization',
      }, db);

      expect(orgHistory).toHaveLength(1);
      expect(orgHistory[0].hierarchyType).toBe('organization');
    });

    it('should respect limit option', () => {
      const history = getNodeHistory(testNodeId, { limit: 2 }, db);
      expect(history).toHaveLength(2);
    });

    it('should respect offset option', () => {
      const history = getNodeHistory(testNodeId, { limit: 2, offset: 1 }, db);
      expect(history).toHaveLength(2);
      // Should skip the first (most recent) record
    });

    it('should return changes in reverse chronological order', () => {
      const history = getNodeHistory(testNodeId, {}, db);
      // Most recent should be first (organization created last)
      expect(history[0].hierarchyType).toBe('organization');
      expect(history[1].changeType).toBe('moved');
      expect(history[2].changeType).toBe('created');
    });
  });

  describe('getRecentChanges', () => {
    it('should return recent changes across all nodes', () => {
      const node1 = uuidv4();
      const node2 = uuidv4();

      // Create test nodes
      db.prepare('INSERT INTO nodes (id, title, url, source_domain) VALUES (?, ?, ?, ?)')
        .run(node1, 'Node 1', 'https://example.com/1', 'example.com');
      db.prepare('INSERT INTO nodes (id, title, url, source_domain) VALUES (?, ?, ?, ?)')
        .run(node2, 'Node 2', 'https://example.com/2', 'example.com');

      // Log changes
      logCodeChange({
        nodeId: node1,
        hierarchyType: 'function',
        oldCode: null,
        newCode: 'A.LLM.T.1',
        changeType: 'created',
        triggeredBy: 'import',
      }, db);

      logCodeChange({
        nodeId: node2,
        hierarchyType: 'function',
        oldCode: null,
        newCode: 'A.AGT.T.1',
        changeType: 'created',
        triggeredBy: 'import',
      }, db);

      const recent = getRecentChanges(10, db);
      expect(recent.length).toBeGreaterThanOrEqual(2);
      expect(recent.some(c => c.nodeId === node1)).toBe(true);
      expect(recent.some(c => c.nodeId === node2)).toBe(true);
    });

    it('should respect limit parameter', () => {
      // Create multiple changes
      for (let i = 0; i < 5; i++) {
        logCodeChange({
          nodeId: testNodeId,
          hierarchyType: 'function',
          oldCode: i === 0 ? null : `A.LLM.T.${i}`,
          newCode: `A.LLM.T.${i + 1}`,
          changeType: i === 0 ? 'created' : 'updated',
          triggeredBy: 'import',
        }, db);
      }

      const recent = getRecentChanges(3, db);
      expect(recent).toHaveLength(3);
    });
  });

  describe('getChangesByType', () => {
    beforeEach(() => {
      logCodeChange({
        nodeId: testNodeId,
        hierarchyType: 'function',
        oldCode: null,
        newCode: 'A.LLM.T.1',
        changeType: 'created',
        triggeredBy: 'import',
      }, db);

      logCodeChange({
        nodeId: testNodeId,
        hierarchyType: 'function',
        oldCode: 'A.LLM.T.1',
        newCode: 'A.LLM.T.2',
        changeType: 'moved',
        triggeredBy: 'user_move',
      }, db);

      logCodeChange({
        nodeId: testNodeId,
        hierarchyType: 'function',
        oldCode: 'A.LLM.T.2',
        newCode: 'A.LLM.T.3',
        changeType: 'updated',
        triggeredBy: 'restructure',
      }, db);
    });

    it('should filter by change type', () => {
      const creates = getChangesByType('created', 50, db);
      expect(creates.every(c => c.changeType === 'created')).toBe(true);

      const moves = getChangesByType('moved', 50, db);
      expect(moves.every(c => c.changeType === 'moved')).toBe(true);

      const updates = getChangesByType('updated', 50, db);
      expect(updates.every(c => c.changeType === 'updated')).toBe(true);
    });
  });

  describe('getChangesByTrigger', () => {
    beforeEach(() => {
      logCodeChange({
        nodeId: testNodeId,
        hierarchyType: 'function',
        oldCode: null,
        newCode: 'A.LLM.T.1',
        changeType: 'created',
        triggeredBy: 'import',
      }, db);

      logCodeChange({
        nodeId: testNodeId,
        hierarchyType: 'function',
        oldCode: 'A.LLM.T.1',
        newCode: 'A.LLM.T.2',
        changeType: 'moved',
        triggeredBy: 'user_move',
      }, db);
    });

    it('should filter by trigger source', () => {
      const imports = getChangesByTrigger('import', 50, db);
      expect(imports.every(c => c.triggeredBy === 'import')).toBe(true);

      const userMoves = getChangesByTrigger('user_move', 50, db);
      expect(userMoves.every(c => c.triggeredBy === 'user_move')).toBe(true);
    });
  });

  describe('getBatchChanges', () => {
    it('should return changes from a specific batch', () => {
      const batchId = uuidv4();

      // Log multiple changes with same batchId
      for (let i = 1; i <= 3; i++) {
        const nodeId = uuidv4();
        db.prepare('INSERT INTO nodes (id, title, url, source_domain) VALUES (?, ?, ?, ?)')
          .run(nodeId, `Node ${i}`, `https://example.com/${i}`, 'example.com');

        logCodeChange({
          nodeId,
          hierarchyType: 'function',
          oldCode: null,
          newCode: `A.LLM.T.${i}`,
          changeType: 'restructured',
          triggeredBy: 'restructure',
          metadata: { batchId },
        }, db);
      }

      const batchChanges = getBatchChanges(batchId, db);
      expect(batchChanges).toHaveLength(3);
      expect(batchChanges.every(c => c.metadata?.batchId === batchId)).toBe(true);
    });
  });

  describe('getChangeStatistics', () => {
    beforeEach(() => {
      // Create diverse changes
      logCodeChange({
        nodeId: testNodeId,
        hierarchyType: 'function',
        oldCode: null,
        newCode: 'A.LLM.T.1',
        changeType: 'created',
        triggeredBy: 'import',
      }, db);

      logCodeChange({
        nodeId: testNodeId,
        hierarchyType: 'function',
        oldCode: 'A.LLM.T.1',
        newCode: 'A.LLM.T.2',
        changeType: 'moved',
        triggeredBy: 'user_move',
      }, db);

      logCodeChange({
        nodeId: testNodeId,
        hierarchyType: 'organization',
        oldCode: null,
        newCode: 'ANTH.LLM.T.1',
        changeType: 'created',
        triggeredBy: 'import',
      }, db);
    });

    it('should return correct statistics', () => {
      const stats = getChangeStatistics(db);

      expect(stats.totalChanges).toBe(3);
      expect(stats.byType.created).toBe(2);
      expect(stats.byType.moved).toBe(1);
      expect(stats.byTrigger.import).toBe(2);
      expect(stats.byTrigger.user_move).toBe(1);
      expect(stats.byHierarchy.function).toBe(2);
      expect(stats.byHierarchy.organization).toBe(1);
    });
  });
});
