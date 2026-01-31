// ============================================================
// Taxonomy Operations Unit Tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { getSegments, getOrganizations, getTree } from '../taxonomy.js';
import { createNode } from '../nodes.js';
import { getTestDatabase, resetTestDatabase } from '../../__tests__/setup.js';

describe('Taxonomy Operations', () => {
  beforeEach(() => {
    resetTestDatabase();
  });

  describe('getSegments', () => {
    it('should create and return default segments if none exist', () => {
      const segments = getSegments();

      expect(segments.length).toBeGreaterThan(0);
      expect(segments[0]).toHaveProperty('id');
      expect(segments[0]).toHaveProperty('name');
      expect(segments[0]).toHaveProperty('code');
      expect(segments[0]).toHaveProperty('color');
    });

    it('should return consistent segments on subsequent calls', () => {
      const firstCall = getSegments();
      const secondCall = getSegments();

      expect(firstCall.length).toBe(secondCall.length);
      expect(firstCall[0].id).toBe(secondCall[0].id);
    });

    it('should include expected default segments', () => {
      const segments = getSegments();
      const codes = segments.map(s => s.code);

      expect(codes).toContain('AI_ML');
      expect(codes).toContain('DEV_TOOLS');
      expect(codes).toContain('BIZ_PROD');
    });

    it('should return custom segments if they exist', () => {
      const db = getTestDatabase();
      db.prepare(`
        INSERT INTO segments (id, name, code, color)
        VALUES (?, ?, ?, ?)
      `).run('custom-id', 'Custom Segment', 'CUSTOM', '#FF0000');

      const segments = getSegments();

      expect(segments).toHaveLength(1);
      expect(segments[0].code).toBe('CUSTOM');
    });
  });

  describe('getOrganizations', () => {
    it('should create and return default organizations if none exist', () => {
      const orgs = getOrganizations();

      expect(orgs.length).toBeGreaterThan(0);
      expect(orgs[0]).toHaveProperty('id');
      expect(orgs[0]).toHaveProperty('name');
      expect(orgs[0]).toHaveProperty('code');
      expect(orgs[0]).toHaveProperty('color');
    });

    it('should return consistent organizations on subsequent calls', () => {
      const firstCall = getOrganizations();
      const secondCall = getOrganizations();

      expect(firstCall.length).toBe(secondCall.length);
      expect(firstCall[0].id).toBe(secondCall[0].id);
    });

    it('should include expected default organizations', () => {
      const orgs = getOrganizations();
      const codes = orgs.map(o => o.code);

      expect(codes).toContain('WORK');
      expect(codes).toContain('LEARNING');
      expect(codes).toContain('PROJECTS');
    });

    it('should return custom organizations if they exist', () => {
      const db = getTestDatabase();
      db.prepare(`
        INSERT INTO organizations (id, name, code, color)
        VALUES (?, ?, ?, ?)
      `).run('custom-org-id', 'Custom Org', 'CUSTOM_ORG', '#00FF00');

      const orgs = getOrganizations();

      expect(orgs).toHaveLength(1);
      expect(orgs[0].code).toBe('CUSTOM_ORG');
    });
  });

  describe('getTree', () => {
    describe('function view', () => {
      it('should return tree structure with taxonomy', () => {
        const tree = getTree('function');

        expect(tree).toHaveProperty('taxonomy');
        expect(tree).toHaveProperty('root');
        expect(Array.isArray(tree.taxonomy)).toBe(true);
        expect(Array.isArray(tree.root)).toBe(true);
      });

      it('should include root nodes without function_parent_id', () => {
        createNode({
          title: 'Root Node',
          url: 'https://example.com/root',
          source_domain: 'example.com',
        });

        const tree = getTree('function');

        expect(tree.root).toHaveLength(1);
        expect(tree.root[0].title).toBe('Root Node');
      });

      it('should include children with function_parent_id', () => {
        const parent = createNode({
          title: 'Parent',
          url: 'https://example.com/parent',
          source_domain: 'example.com',
        });

        createNode({
          title: 'Child',
          url: 'https://example.com/child',
          source_domain: 'example.com',
          function_parent_id: parent.id,
        });

        const tree = getTree('function');

        expect(tree.root).toHaveLength(1);
        expect(tree.root[0].children).toHaveLength(1);
        expect(tree.root[0].children[0].title).toBe('Child');
      });

      it('should build nested hierarchy correctly', () => {
        const grandparent = createNode({
          title: 'Grandparent',
          url: 'https://example.com/gp',
          source_domain: 'example.com',
        });

        const parent = createNode({
          title: 'Parent',
          url: 'https://example.com/p',
          source_domain: 'example.com',
          function_parent_id: grandparent.id,
        });

        createNode({
          title: 'Child',
          url: 'https://example.com/c',
          source_domain: 'example.com',
          function_parent_id: parent.id,
        });

        const tree = getTree('function');

        expect(tree.root[0].title).toBe('Grandparent');
        expect(tree.root[0].children[0].title).toBe('Parent');
        expect(tree.root[0].children[0].children[0].title).toBe('Child');
      });

      it('should not include deleted nodes', () => {
        const node = createNode({
          title: 'To Delete',
          url: 'https://example.com/delete-tree',
          source_domain: 'example.com',
        });

        const db = getTestDatabase();
        db.prepare('UPDATE nodes SET is_deleted = 1 WHERE id = ?').run(node.id);

        const tree = getTree('function');

        expect(tree.root).toHaveLength(0);
      });

      it('should parse JSON fields in tree nodes', () => {
        createNode({
          title: 'JSON Tree Node',
          url: 'https://example.com/json-tree',
          source_domain: 'example.com',
          extracted_fields: { test: 'value' },
          metadata_tags: ['tree-tag'],
          key_concepts: ['tree-concept'],
        });

        const tree = getTree('function');

        expect(tree.root[0].extracted_fields).toEqual({ test: 'value' });
        expect(tree.root[0].metadata_tags).toEqual(['tree-tag']);
        expect(tree.root[0].key_concepts).toEqual(['tree-concept']);
      });
    });

    describe('organization view', () => {
      it('should return tree based on organization_parent_id', () => {
        const parent = createNode({
          title: 'Org Parent',
          url: 'https://example.com/org-parent',
          source_domain: 'example.com',
        });

        createNode({
          title: 'Org Child',
          url: 'https://example.com/org-child',
          source_domain: 'example.com',
          organization_parent_id: parent.id,
        });

        const tree = getTree('organization');

        expect(tree.root).toHaveLength(1);
        expect(tree.root[0].children).toHaveLength(1);
        expect(tree.root[0].children[0].title).toBe('Org Child');
      });

      it('should keep function view separate from organization view', () => {
        const funcParent = createNode({
          title: 'Function Parent',
          url: 'https://example.com/func-parent',
          source_domain: 'example.com',
        });

        const orgParent = createNode({
          title: 'Org Parent',
          url: 'https://example.com/org-parent2',
          source_domain: 'example.com',
        });

        createNode({
          title: 'Dual Child',
          url: 'https://example.com/dual-child',
          source_domain: 'example.com',
          function_parent_id: funcParent.id,
          organization_parent_id: orgParent.id,
        });

        const funcTree = getTree('function');
        const orgTree = getTree('organization');

        // In function view, child is under funcParent
        const funcChild = funcTree.root.find((n: any) => n.title === 'Function Parent');
        expect(funcChild?.children.some((c: any) => c.title === 'Dual Child')).toBe(true);

        // In organization view, child is under orgParent
        const orgChild = orgTree.root.find((n: any) => n.title === 'Org Parent');
        expect(orgChild?.children.some((c: any) => c.title === 'Dual Child')).toBe(true);
      });
    });
  });
});
