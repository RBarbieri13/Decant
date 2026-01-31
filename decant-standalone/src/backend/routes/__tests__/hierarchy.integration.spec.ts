// ============================================================
// Hierarchy Routes Integration Tests
// Tests tree building, code-based queries, path lookups
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createTestApp } from '../../__tests__/test-app.js';
import { getTestDatabase, resetTestDatabase } from '../../__tests__/setup.js';
import { createNode } from '../../database/nodes.js';
import * as cache from '../../cache/index.js';

// Mock hierarchy cache to return null (so getTree falls back to parent_id based tree building)
// and avoid the function_hierarchy_code column that doesn't exist in test schema
vi.mock('../../cache/hierarchy_cache.js', () => ({
  getTree: vi.fn().mockReturnValue(null),
  setTree: vi.fn(),
  invalidateView: vi.fn(),
  clearAll: vi.fn(),
  getStats: vi.fn().mockReturnValue({
    function: { size: 0, keys: [] },
    organization: { size: 0, keys: [] },
  }),
  invalidateForMutations: vi.fn(),
}));

// Add the missing columns to the test database schema before tests run
function ensureHierarchyColumns(): void {
  const db = getTestDatabase();
  try {
    // Check if columns exist by trying to select them
    db.prepare('SELECT function_hierarchy_code, organization_hierarchy_code FROM nodes LIMIT 1').get();
  } catch {
    // Columns don't exist, add them
    try {
      db.exec('ALTER TABLE nodes ADD COLUMN function_hierarchy_code TEXT');
    } catch { /* may already exist */ }
    try {
      db.exec('ALTER TABLE nodes ADD COLUMN organization_hierarchy_code TEXT');
    } catch { /* may already exist */ }
  }
}

describe('Hierarchy Routes Integration', () => {
  const app = createTestApp();

  beforeEach(() => {
    resetTestDatabase();
    ensureHierarchyColumns();
    cache.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    cache.clear();
  });

  // ============================================================
  // GET /api/hierarchy/tree/:view - Tree Building Tests
  // ============================================================

  describe('GET /api/hierarchy/tree/:view', () => {
    describe('function hierarchy tree', () => {
      it('should return tree structure with taxonomy and root', async () => {
        const response = await request(app).get('/api/hierarchy/tree/function');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('taxonomy');
        expect(response.body).toHaveProperty('root');
        expect(Array.isArray(response.body.taxonomy)).toBe(true);
        expect(Array.isArray(response.body.root)).toBe(true);
      });

      it('should return root nodes without function_parent_id', async () => {
        createNode({
          title: 'Root Node 1',
          url: 'https://example.com/root1',
          source_domain: 'example.com',
        });

        createNode({
          title: 'Root Node 2',
          url: 'https://example.com/root2',
          source_domain: 'example.com',
        });

        cache.clear();

        const response = await request(app).get('/api/hierarchy/tree/function');

        expect(response.status).toBe(200);
        expect(response.body.root.length).toBe(2);
      });

      it('should build parent-child relationships correctly', async () => {
        const parent = createNode({
          title: 'Parent Node',
          url: 'https://example.com/parent',
          source_domain: 'example.com',
        });

        createNode({
          title: 'Child Node',
          url: 'https://example.com/child',
          source_domain: 'example.com',
          function_parent_id: parent.id,
        });

        cache.clear();

        const response = await request(app).get('/api/hierarchy/tree/function');

        expect(response.status).toBe(200);
        expect(response.body.root.length).toBe(1);
        expect(response.body.root[0].title).toBe('Parent Node');
        expect(response.body.root[0].children.length).toBe(1);
        expect(response.body.root[0].children[0].title).toBe('Child Node');
      });

      it('should build deeply nested hierarchies', async () => {
        const level1 = createNode({
          title: 'Level 1',
          url: 'https://example.com/l1',
          source_domain: 'example.com',
        });

        const level2 = createNode({
          title: 'Level 2',
          url: 'https://example.com/l2',
          source_domain: 'example.com',
          function_parent_id: level1.id,
        });

        const level3 = createNode({
          title: 'Level 3',
          url: 'https://example.com/l3',
          source_domain: 'example.com',
          function_parent_id: level2.id,
        });

        createNode({
          title: 'Level 4',
          url: 'https://example.com/l4',
          source_domain: 'example.com',
          function_parent_id: level3.id,
        });

        cache.clear();

        const response = await request(app).get('/api/hierarchy/tree/function');

        expect(response.status).toBe(200);

        // Verify nested structure
        const root = response.body.root[0];
        expect(root.title).toBe('Level 1');
        expect(root.children[0].title).toBe('Level 2');
        expect(root.children[0].children[0].title).toBe('Level 3');
        expect(root.children[0].children[0].children[0].title).toBe('Level 4');
      });

      it('should not include deleted nodes', async () => {
        const db = getTestDatabase();

        const node = createNode({
          title: 'Deleted Node',
          url: 'https://example.com/deleted',
          source_domain: 'example.com',
        });

        db.prepare('UPDATE nodes SET is_deleted = 1 WHERE id = ?').run(node.id);
        cache.clear();

        const response = await request(app).get('/api/hierarchy/tree/function');

        expect(response.status).toBe(200);
        expect(response.body.root.length).toBe(0);
      });

      it('should include key_concepts in tree nodes', async () => {
        createNode({
          title: 'Node with Concepts',
          url: 'https://example.com/concepts',
          source_domain: 'example.com',
          key_concepts: ['concept1', 'concept2'],
        });

        cache.clear();

        const response = await request(app).get('/api/hierarchy/tree/function');

        expect(response.status).toBe(200);
        expect(response.body.root.length).toBe(1);
        expect(response.body.root[0].key_concepts).toEqual(['concept1', 'concept2']);
      });
    });

    describe('organization hierarchy tree', () => {
      it('should return tree based on organization_parent_id', async () => {
        const orgParent = createNode({
          title: 'Org Parent',
          url: 'https://example.com/org-parent',
          source_domain: 'example.com',
        });

        createNode({
          title: 'Org Child',
          url: 'https://example.com/org-child',
          source_domain: 'example.com',
          organization_parent_id: orgParent.id,
        });

        cache.clear();

        const response = await request(app).get('/api/hierarchy/tree/organization');

        expect(response.status).toBe(200);
        expect(response.body.root.length).toBe(1);
        expect(response.body.root[0].title).toBe('Org Parent');
        expect(response.body.root[0].children[0].title).toBe('Org Child');
      });
    });

    describe('validation', () => {
      it('should return 400 for invalid view parameter', async () => {
        const response = await request(app).get('/api/hierarchy/tree/invalid');

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      });

      it('should accept "function" view', async () => {
        const response = await request(app).get('/api/hierarchy/tree/function');

        expect(response.status).toBe(200);
      });

      it('should accept "organization" view', async () => {
        const response = await request(app).get('/api/hierarchy/tree/organization');

        expect(response.status).toBe(200);
      });
    });
  });

  // ============================================================
  // GET /api/hierarchy/segments - Segments
  // ============================================================

  describe('GET /api/hierarchy/segments', () => {
    it('should return segments (functional taxonomy)', async () => {
      const response = await request(app).get('/api/hierarchy/segments');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should include default segments when none exist', async () => {
      const response = await request(app).get('/api/hierarchy/segments');

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('code');
    });

    it('should return custom segments when they exist', async () => {
      const db = getTestDatabase();
      const id = uuidv4();

      db.prepare(`
        INSERT INTO segments (id, name, code, color)
        VALUES (?, ?, ?, ?)
      `).run(id, 'Custom Segment', 'CUSTOM_SEG', '#123456');

      const response = await request(app).get('/api/hierarchy/segments');

      expect(response.status).toBe(200);
      expect(response.body.some((s: any) => s.code === 'CUSTOM_SEG')).toBe(true);
    });
  });

  // ============================================================
  // GET /api/hierarchy/organizations - Organizations
  // ============================================================

  describe('GET /api/hierarchy/organizations', () => {
    it('should return organizations (organizational taxonomy)', async () => {
      const response = await request(app).get('/api/hierarchy/organizations');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should include default organizations when none exist', async () => {
      const response = await request(app).get('/api/hierarchy/organizations');

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('code');
    });

    it('should return custom organizations when they exist', async () => {
      const db = getTestDatabase();
      const id = uuidv4();

      db.prepare(`
        INSERT INTO organizations (id, name, code, color)
        VALUES (?, ?, ?, ?)
      `).run(id, 'Custom Org', 'CUSTOM_ORG', '#654321');

      const response = await request(app).get('/api/hierarchy/organizations');

      expect(response.status).toBe(200);
      expect(response.body.some((o: any) => o.code === 'CUSTOM_ORG')).toBe(true);
    });
  });

  // ============================================================
  // Node Move Operations
  // ============================================================

  describe('POST /api/nodes/:id/move', () => {
    it('should move node to new parent in function hierarchy', async () => {
      const parent1 = createNode({
        title: 'Original Parent',
        url: 'https://example.com/op',
        source_domain: 'example.com',
      });

      const parent2 = createNode({
        title: 'New Parent',
        url: 'https://example.com/np',
        source_domain: 'example.com',
      });

      const child = createNode({
        title: 'Moveable Child',
        url: 'https://example.com/mc',
        source_domain: 'example.com',
        function_parent_id: parent1.id,
      });

      cache.clear();

      // Verify initial state
      let response = await request(app).get('/api/hierarchy/tree/function');
      expect(response.status).toBe(200);

      let originalParent = response.body.root.find((n: any) => n.title === 'Original Parent');
      expect(originalParent).toBeDefined();
      expect(originalParent.children.some((c: any) => c.title === 'Moveable Child')).toBe(true);

      // Move the child
      const moveResponse = await request(app)
        .post(`/api/nodes/${child.id}/move`)
        .send({
          targetParentId: parent2.id,
          targetHierarchy: 'function',
        });

      expect(moveResponse.status).toBe(200);

      // Clear cache to get fresh data
      cache.clear();

      // Verify the move
      response = await request(app).get('/api/hierarchy/tree/function');
      expect(response.status).toBe(200);

      // Original parent should not have the child
      originalParent = response.body.root.find((n: any) => n.title === 'Original Parent');
      expect(originalParent?.children?.length || 0).toBe(0);

      // New parent should have the child
      const newParent = response.body.root.find((n: any) => n.title === 'New Parent');
      expect(newParent?.children?.some((c: any) => c.title === 'Moveable Child')).toBe(true);
    });

    it('should move node to root (null parent)', async () => {
      const parent = createNode({
        title: 'Parent',
        url: 'https://example.com/parent-move',
        source_domain: 'example.com',
      });

      const child = createNode({
        title: 'Child to Root',
        url: 'https://example.com/ctr',
        source_domain: 'example.com',
        function_parent_id: parent.id,
      });

      cache.clear();

      // Move to root
      const moveResponse = await request(app)
        .post(`/api/nodes/${child.id}/move`)
        .send({
          targetParentId: null,
          targetHierarchy: 'function',
        });

      expect(moveResponse.status).toBe(200);

      // Clear cache
      cache.clear();

      // Verify child is now at root level
      const response = await request(app).get('/api/hierarchy/tree/function');
      expect(response.status).toBe(200);

      const rootTitles = response.body.root.map((n: any) => n.title);
      expect(rootTitles).toContain('Child to Root');
    });

    it('should validate targetHierarchy parameter', async () => {
      const node = createNode({
        title: 'Test Node',
        url: 'https://example.com/test-move',
        source_domain: 'example.com',
      });

      const response = await request(app)
        .post(`/api/nodes/${node.id}/move`)
        .send({
          targetParentId: null,
          targetHierarchy: 'invalid',
        });

      expect(response.status).toBe(400);
    });
  });

  // ============================================================
  // Performance Tests
  // ============================================================

  describe('Performance', () => {
    it('should handle moderate number of nodes', async () => {
      // Create 20 nodes
      for (let i = 0; i < 20; i++) {
        createNode({
          title: `Node ${i}`,
          url: `https://example.com/perf-${i}`,
          source_domain: 'example.com',
        });
      }

      cache.clear();

      const startTime = Date.now();
      const response = await request(app).get('/api/hierarchy/tree/function');
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(response.body.root.length).toBe(20);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle hierarchical data', async () => {
      // Create a tree structure: 3 roots, each with 3 children
      for (let i = 0; i < 3; i++) {
        const parent = createNode({
          title: `Root ${i}`,
          url: `https://example.com/root-perf-${i}`,
          source_domain: 'example.com',
        });

        for (let j = 0; j < 3; j++) {
          createNode({
            title: `Child ${i}-${j}`,
            url: `https://example.com/child-perf-${i}-${j}`,
            source_domain: 'example.com',
            function_parent_id: parent.id,
          });
        }
      }

      cache.clear();

      const startTime = Date.now();
      const response = await request(app).get('/api/hierarchy/tree/function');
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(response.body.root.length).toBe(3);
      expect(duration).toBeLessThan(2000);

      // Verify structure
      for (const root of response.body.root) {
        expect(root.children.length).toBe(3);
      }
    });
  });
});
