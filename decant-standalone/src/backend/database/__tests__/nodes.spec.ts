// ============================================================
// Node Operations Unit Tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createNode,
  readNode,
  updateNode,
  deleteNode,
  getAllNodes,
  getNodeById,
  type CreateNodeInput,
  type UpdateNodeInput,
} from '../nodes.js';
import { getTestDatabase, resetTestDatabase } from '../../__tests__/setup.js';

describe('Node Operations', () => {
  beforeEach(() => {
    // Reset database is handled by setup.ts, but ensure clean state
    resetTestDatabase();
  });

  describe('createNode', () => {
    it('should create a node with required fields', () => {
      const input: CreateNodeInput = {
        title: 'Test Node',
        url: 'https://example.com/test',
        source_domain: 'example.com',
      };

      const node = createNode(input);

      expect(node).toBeDefined();
      expect(node.id).toBeDefined();
      expect(node.title).toBe('Test Node');
      expect(node.url).toBe('https://example.com/test');
      expect(node.source_domain).toBe('example.com');
      expect(node.is_deleted).toBe(0);
    });

    it('should create a node with all optional fields', () => {
      const input: CreateNodeInput = {
        title: 'Full Node',
        url: 'https://example.com/full',
        source_domain: 'example.com',
        company: 'Test Company',
        phrase_description: 'A test phrase',
        short_description: 'A test description',
        logo_url: 'https://example.com/logo.png',
        ai_summary: 'AI generated summary',
        extracted_fields: { author: 'John Doe' },
        metadata_tags: ['tag1', 'tag2'],
        key_concepts: ['concept1', 'concept2'],
        function_parent_id: null,
        organization_parent_id: null,
      };

      const node = createNode(input);

      expect(node.company).toBe('Test Company');
      expect(node.phrase_description).toBe('A test phrase');
      expect(node.short_description).toBe('A test description');
      expect(node.logo_url).toBe('https://example.com/logo.png');
      expect(node.ai_summary).toBe('AI generated summary');
      expect(node.extracted_fields).toEqual({ author: 'John Doe' });
      expect(node.metadata_tags).toEqual(['tag1', 'tag2']);
      expect(node.key_concepts).toEqual(['concept1', 'concept2']);
    });

    it('should throw error for duplicate URLs', () => {
      const input: CreateNodeInput = {
        title: 'First Node',
        url: 'https://example.com/unique',
        source_domain: 'example.com',
      };

      createNode(input);

      expect(() => createNode({ ...input, title: 'Second Node' })).toThrow();
    });

    it('should handle empty key_concepts array', () => {
      const input: CreateNodeInput = {
        title: 'Node without concepts',
        url: 'https://example.com/no-concepts',
        source_domain: 'example.com',
        key_concepts: [],
      };

      const node = createNode(input);

      expect(node.key_concepts).toEqual([]);
    });
  });

  describe('readNode', () => {
    it('should return a node by id', () => {
      const input: CreateNodeInput = {
        title: 'Read Test',
        url: 'https://example.com/read',
        source_domain: 'example.com',
      };

      const created = createNode(input);
      const read = readNode(created.id);

      expect(read).toEqual(created);
    });

    it('should return null for non-existent node', () => {
      const result = readNode('non-existent-id');

      expect(result).toBeNull();
    });

    it('should not return deleted nodes', () => {
      const input: CreateNodeInput = {
        title: 'Delete Test',
        url: 'https://example.com/delete-read',
        source_domain: 'example.com',
      };

      const created = createNode(input);
      deleteNode(created.id);
      const read = readNode(created.id);

      expect(read).toBeNull();
    });

    it('should parse JSON fields correctly', () => {
      const input: CreateNodeInput = {
        title: 'JSON Test',
        url: 'https://example.com/json',
        source_domain: 'example.com',
        extracted_fields: { nested: { value: 123 } },
        metadata_tags: ['a', 'b', 'c'],
      };

      const created = createNode(input);
      const read = readNode(created.id);

      expect(read?.extracted_fields).toEqual({ nested: { value: 123 } });
      expect(read?.metadata_tags).toEqual(['a', 'b', 'c']);
    });
  });

  describe('updateNode', () => {
    it('should update node title', () => {
      const input: CreateNodeInput = {
        title: 'Original Title',
        url: 'https://example.com/update',
        source_domain: 'example.com',
      };

      const created = createNode(input);
      const updateData: UpdateNodeInput = { title: 'Updated Title' };
      const updated = updateNode(created.id, updateData);

      expect(updated?.title).toBe('Updated Title');
    });

    it('should update multiple fields', () => {
      const input: CreateNodeInput = {
        title: 'Multi Update Test',
        url: 'https://example.com/multi-update',
        source_domain: 'example.com',
      };

      const created = createNode(input);
      const updateData: UpdateNodeInput = {
        title: 'New Title',
        company: 'New Company',
        short_description: 'New Description',
        metadata_tags: ['new-tag'],
      };
      const updated = updateNode(created.id, updateData);

      expect(updated?.title).toBe('New Title');
      expect(updated?.company).toBe('New Company');
      expect(updated?.short_description).toBe('New Description');
      expect(updated?.metadata_tags).toEqual(['new-tag']);
    });

    it('should update key_concepts', () => {
      const input: CreateNodeInput = {
        title: 'Concepts Update Test',
        url: 'https://example.com/concepts-update',
        source_domain: 'example.com',
        key_concepts: ['old1', 'old2'],
      };

      const created = createNode(input);
      const updateData: UpdateNodeInput = {
        key_concepts: ['new1', 'new2', 'new3'],
      };
      const updated = updateNode(created.id, updateData);

      expect(updated?.key_concepts).toEqual(['new1', 'new2', 'new3']);
    });

    it('should return unchanged node when no updates provided', () => {
      const input: CreateNodeInput = {
        title: 'No Change Test',
        url: 'https://example.com/no-change',
        source_domain: 'example.com',
      };

      const created = createNode(input);
      const updated = updateNode(created.id, {});

      expect(updated?.title).toBe('No Change Test');
    });

    it('should update parent IDs', () => {
      const parent1: CreateNodeInput = {
        title: 'Parent 1',
        url: 'https://example.com/parent1',
        source_domain: 'example.com',
      };
      const parent2: CreateNodeInput = {
        title: 'Parent 2',
        url: 'https://example.com/parent2',
        source_domain: 'example.com',
      };
      const child: CreateNodeInput = {
        title: 'Child Node',
        url: 'https://example.com/child',
        source_domain: 'example.com',
      };

      const p1 = createNode(parent1);
      const p2 = createNode(parent2);
      const c = createNode(child);

      const updated = updateNode(c.id, {
        function_parent_id: p1.id,
        organization_parent_id: p2.id,
      });

      expect(updated?.function_parent_id).toBe(p1.id);
      expect(updated?.organization_parent_id).toBe(p2.id);
    });
  });

  describe('deleteNode', () => {
    it('should soft delete a node', () => {
      const input: CreateNodeInput = {
        title: 'To Delete',
        url: 'https://example.com/to-delete',
        source_domain: 'example.com',
      };

      const created = createNode(input);
      deleteNode(created.id);

      // Node should not be readable anymore
      const read = readNode(created.id);
      expect(read).toBeNull();

      // But it should still exist in database with is_deleted = 1
      const db = getTestDatabase();
      const raw = db.prepare('SELECT * FROM nodes WHERE id = ?').get(created.id) as any;
      expect(raw).toBeDefined();
      expect(raw.is_deleted).toBe(1);
    });

    it('should not throw for non-existent node', () => {
      // Should not throw
      expect(() => deleteNode('non-existent-id')).not.toThrow();
    });
  });

  describe('getAllNodes', () => {
    it('should return all non-deleted nodes', () => {
      createNode({
        title: 'Node 1',
        url: 'https://example.com/node1',
        source_domain: 'example.com',
      });
      createNode({
        title: 'Node 2',
        url: 'https://example.com/node2',
        source_domain: 'example.com',
      });
      createNode({
        title: 'Node 3',
        url: 'https://example.com/node3',
        source_domain: 'example.com',
      });

      const nodes = getAllNodes();

      expect(nodes).toHaveLength(3);
      expect(nodes.map(n => n.title)).toEqual(
        expect.arrayContaining(['Node 1', 'Node 2', 'Node 3'])
      );
    });

    it('should not include deleted nodes', () => {
      const node1 = createNode({
        title: 'Active Node',
        url: 'https://example.com/active',
        source_domain: 'example.com',
      });
      const node2 = createNode({
        title: 'Deleted Node',
        url: 'https://example.com/deleted',
        source_domain: 'example.com',
      });

      deleteNode(node2.id);
      const nodes = getAllNodes();

      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe(node1.id);
    });

    it('should return empty array when no nodes exist', () => {
      const nodes = getAllNodes();

      expect(nodes).toEqual([]);
    });

    it('should parse JSON fields for all nodes', () => {
      createNode({
        title: 'JSON Node',
        url: 'https://example.com/json-all',
        source_domain: 'example.com',
        extracted_fields: { test: true },
        metadata_tags: ['tag1'],
        key_concepts: ['concept1'],
      });

      const nodes = getAllNodes();

      expect(nodes[0].extracted_fields).toEqual({ test: true });
      expect(nodes[0].metadata_tags).toEqual(['tag1']);
      expect(nodes[0].key_concepts).toEqual(['concept1']);
    });

    it('should order nodes by date_added descending', () => {
      // Create nodes with slight delay to ensure different timestamps
      const db = getTestDatabase();

      db.prepare(`
        INSERT INTO nodes (id, title, url, source_domain, date_added)
        VALUES (?, ?, ?, ?, ?)
      `).run('id1', 'Old Node', 'https://example.com/old', 'example.com', '2023-01-01 00:00:00');

      db.prepare(`
        INSERT INTO nodes (id, title, url, source_domain, date_added)
        VALUES (?, ?, ?, ?, ?)
      `).run('id2', 'New Node', 'https://example.com/new', 'example.com', '2024-01-01 00:00:00');

      const nodes = getAllNodes();

      expect(nodes[0].title).toBe('New Node');
      expect(nodes[1].title).toBe('Old Node');
    });
  });

  describe('getNodeById', () => {
    it('should be an alias for readNode', () => {
      const input: CreateNodeInput = {
        title: 'Alias Test',
        url: 'https://example.com/alias',
        source_domain: 'example.com',
      };

      const created = createNode(input);
      const byId = getNodeById(created.id);
      const byRead = readNode(created.id);

      expect(byId).toEqual(byRead);
    });
  });

  describe('countNodes', () => {
    it('should return 0 when no nodes exist', () => {
      const { countNodes } = require('../nodes.js');
      const count = countNodes();
      expect(count).toBe(0);
    });

    it('should return correct count of non-deleted nodes', () => {
      const { countNodes } = require('../nodes.js');
      createNode({
        title: 'Node 1',
        url: 'https://example.com/count1',
        source_domain: 'example.com',
      });
      createNode({
        title: 'Node 2',
        url: 'https://example.com/count2',
        source_domain: 'example.com',
      });
      createNode({
        title: 'Node 3',
        url: 'https://example.com/count3',
        source_domain: 'example.com',
      });

      const count = countNodes();
      expect(count).toBe(3);
    });

    it('should not count deleted nodes', () => {
      const { countNodes } = require('../nodes.js');
      const node1 = createNode({
        title: 'Active',
        url: 'https://example.com/active-count',
        source_domain: 'example.com',
      });
      const node2 = createNode({
        title: 'Deleted',
        url: 'https://example.com/deleted-count',
        source_domain: 'example.com',
      });

      deleteNode(node2.id);
      const count = countNodes();
      expect(count).toBe(1);
    });
  });

  describe('getNodesPaginated', () => {
    it('should return first page with default limit', () => {
      const { getNodesPaginated } = require('../nodes.js');
      // Create 25 nodes
      for (let i = 0; i < 25; i++) {
        createNode({
          title: `Paginated Node ${i}`,
          url: `https://example.com/page-${i}`,
          source_domain: 'example.com',
        });
      }

      const page1 = getNodesPaginated();
      expect(page1.length).toBe(20); // Default limit
    });

    it('should return correct page with custom limit', () => {
      const { getNodesPaginated } = require('../nodes.js');
      for (let i = 0; i < 15; i++) {
        createNode({
          title: `Custom Limit Node ${i}`,
          url: `https://example.com/custom-${i}`,
          source_domain: 'example.com',
        });
      }

      const page1 = getNodesPaginated({ limit: 10 });
      expect(page1.length).toBe(10);
    });

    it('should return correct page 2', () => {
      const { getNodesPaginated } = require('../nodes.js');
      for (let i = 0; i < 15; i++) {
        createNode({
          title: `Page 2 Node ${i}`,
          url: `https://example.com/page2-${i}`,
          source_domain: 'example.com',
        });
      }

      const page1 = getNodesPaginated({ page: 1, limit: 10 });
      const page2 = getNodesPaginated({ page: 2, limit: 10 });

      expect(page1.length).toBe(10);
      expect(page2.length).toBe(5);

      // Ensure no overlap
      const page1Ids = new Set(page1.map((n: any) => n.id));
      const hasOverlap = page2.some((n: any) => page1Ids.has(n.id));
      expect(hasOverlap).toBe(false);
    });

    it('should parse JSON fields correctly', () => {
      const { getNodesPaginated } = require('../nodes.js');
      createNode({
        title: 'Paginated JSON Node',
        url: 'https://example.com/pag-json',
        source_domain: 'example.com',
        extracted_fields: { test: 'data' },
        metadata_tags: ['pag-tag'],
        key_concepts: ['pag-concept'],
      });

      const nodes = getNodesPaginated({ limit: 5 });
      expect(nodes[0].extracted_fields).toEqual({ test: 'data' });
      expect(nodes[0].metadata_tags).toEqual(['pag-tag']);
      expect(nodes[0].key_concepts).toEqual(['pag-concept']);
    });

    it('should not include deleted nodes', () => {
      const { getNodesPaginated } = require('../nodes.js');
      const node1 = createNode({
        title: 'Active Pag',
        url: 'https://example.com/active-pag',
        source_domain: 'example.com',
      });
      const node2 = createNode({
        title: 'Deleted Pag',
        url: 'https://example.com/deleted-pag',
        source_domain: 'example.com',
      });

      deleteNode(node2.id);
      const nodes = getNodesPaginated({ limit: 10 });

      expect(nodes.length).toBe(1);
      expect(nodes[0].id).toBe(node1.id);
    });
  });

  describe('readNodes', () => {
    it('should return empty array for empty input', () => {
      const { readNodes } = require('../nodes.js');
      const nodes = readNodes([]);
      expect(nodes).toEqual([]);
    });

    it('should return multiple nodes by ID', () => {
      const { readNodes } = require('../nodes.js');
      const node1 = createNode({
        title: 'Multi Node 1',
        url: 'https://example.com/multi1',
        source_domain: 'example.com',
      });
      const node2 = createNode({
        title: 'Multi Node 2',
        url: 'https://example.com/multi2',
        source_domain: 'example.com',
      });
      const node3 = createNode({
        title: 'Multi Node 3',
        url: 'https://example.com/multi3',
        source_domain: 'example.com',
      });

      const nodes = readNodes([node1.id, node2.id, node3.id]);
      expect(nodes.length).toBe(3);

      const titles = nodes.map((n: any) => n.title).sort();
      expect(titles).toEqual(['Multi Node 1', 'Multi Node 2', 'Multi Node 3']);
    });

    it('should not return deleted nodes', () => {
      const { readNodes } = require('../nodes.js');
      const node1 = createNode({
        title: 'Active Multi',
        url: 'https://example.com/active-multi',
        source_domain: 'example.com',
      });
      const node2 = createNode({
        title: 'Deleted Multi',
        url: 'https://example.com/deleted-multi',
        source_domain: 'example.com',
      });

      deleteNode(node2.id);
      const nodes = readNodes([node1.id, node2.id]);

      expect(nodes.length).toBe(1);
      expect(nodes[0].id).toBe(node1.id);
    });

    it('should parse JSON fields for all nodes', () => {
      const { readNodes } = require('../nodes.js');
      const node1 = createNode({
        title: 'Multi JSON 1',
        url: 'https://example.com/multi-json1',
        source_domain: 'example.com',
        extracted_fields: { field1: 'value1' },
        metadata_tags: ['tag1'],
        key_concepts: ['concept1'],
      });
      const node2 = createNode({
        title: 'Multi JSON 2',
        url: 'https://example.com/multi-json2',
        source_domain: 'example.com',
        extracted_fields: { field2: 'value2' },
        metadata_tags: ['tag2'],
        key_concepts: ['concept2'],
      });

      const nodes = readNodes([node1.id, node2.id]);

      expect(nodes[0].extracted_fields).toBeDefined();
      expect(nodes[0].metadata_tags).toBeDefined();
      expect(nodes[0].key_concepts).toBeDefined();
      expect(nodes[1].extracted_fields).toBeDefined();
      expect(nodes[1].metadata_tags).toBeDefined();
      expect(nodes[1].key_concepts).toBeDefined();
    });

    it('should handle non-existent IDs gracefully', () => {
      const { readNodes } = require('../nodes.js');
      const node = createNode({
        title: 'Existing Node',
        url: 'https://example.com/existing',
        source_domain: 'example.com',
      });

      const nodes = readNodes([node.id, 'non-existent-id-123']);
      expect(nodes.length).toBe(1);
      expect(nodes[0].id).toBe(node.id);
    });
  });

  describe('mergeNodes', () => {
    it('should merge metadata when keepMetadata is true', () => {
      const { mergeNodes } = require('../nodes.js');
      const primary = createNode({
        title: 'Primary',
        url: 'https://example.com/merge-primary',
        source_domain: 'example.com',
        metadata_tags: ['primary-tag'],
      });
      const secondary = createNode({
        title: 'Secondary',
        url: 'https://example.com/merge-secondary',
        source_domain: 'example.com',
        metadata_tags: ['secondary-tag'],
      });

      const result = mergeNodes(primary.id, secondary.id, { keepMetadata: true });

      expect(result).toBeDefined();
      expect(result.metadata_tags).toContain('primary-tag');
      expect(result.metadata_tags).toContain('secondary-tag');
    });

    it('should not merge metadata by default', () => {
      const { mergeNodes } = require('../nodes.js');
      const primary = createNode({
        title: 'Primary No Merge',
        url: 'https://example.com/merge-primary-no',
        source_domain: 'example.com',
        metadata_tags: ['primary-only'],
      });
      const secondary = createNode({
        title: 'Secondary No Merge',
        url: 'https://example.com/merge-secondary-no',
        source_domain: 'example.com',
        metadata_tags: ['secondary-only'],
      });

      const result = mergeNodes(primary.id, secondary.id);

      expect(result).toBeDefined();
      expect(result.metadata_tags).toEqual(['primary-only']);
    });

    it('should append summary when appendSummary is true', () => {
      const { mergeNodes } = require('../nodes.js');
      const primary = createNode({
        title: 'Primary Summary',
        url: 'https://example.com/merge-primary-sum',
        source_domain: 'example.com',
        ai_summary: 'Primary summary.',
      });
      const secondary = createNode({
        title: 'Secondary Summary',
        url: 'https://example.com/merge-secondary-sum',
        source_domain: 'example.com',
        ai_summary: 'Secondary summary.',
      });

      const result = mergeNodes(primary.id, secondary.id, { appendSummary: true });

      expect(result).toBeDefined();
      expect(result.ai_summary).toContain('Primary summary.');
      expect(result.ai_summary).toContain('Secondary summary.');
    });

    it('should not append summary by default', () => {
      const { mergeNodes } = require('../nodes.js');
      const primary = createNode({
        title: 'Primary Sum No',
        url: 'https://example.com/merge-primary-sum-no',
        source_domain: 'example.com',
        ai_summary: 'Only this summary.',
      });
      const secondary = createNode({
        title: 'Secondary Sum No',
        url: 'https://example.com/merge-secondary-sum-no',
        source_domain: 'example.com',
        ai_summary: 'This should not appear.',
      });

      const result = mergeNodes(primary.id, secondary.id);

      expect(result).toBeDefined();
      expect(result.ai_summary).toBe('Only this summary.');
    });

    it('should soft-delete secondary node', () => {
      const { mergeNodes } = require('../nodes.js');
      const primary = createNode({
        title: 'Primary Delete Test',
        url: 'https://example.com/merge-primary-del',
        source_domain: 'example.com',
      });
      const secondary = createNode({
        title: 'Secondary Delete Test',
        url: 'https://example.com/merge-secondary-del',
        source_domain: 'example.com',
      });

      mergeNodes(primary.id, secondary.id);

      const secondaryAfterMerge = readNode(secondary.id);
      expect(secondaryAfterMerge).toBeNull();
    });

    it('should return null when primary node does not exist', () => {
      const { mergeNodes } = require('../nodes.js');
      const secondary = createNode({
        title: 'Secondary Only',
        url: 'https://example.com/merge-secondary-only',
        source_domain: 'example.com',
      });

      const result = mergeNodes('non-existent-id', secondary.id);
      expect(result).toBeNull();
    });

    it('should return null when secondary node does not exist', () => {
      const { mergeNodes } = require('../nodes.js');
      const primary = createNode({
        title: 'Primary Only',
        url: 'https://example.com/merge-primary-only',
        source_domain: 'example.com',
      });

      const result = mergeNodes(primary.id, 'non-existent-id');
      expect(result).toBeNull();
    });

    it('should handle merge with both options enabled', () => {
      const { mergeNodes } = require('../nodes.js');
      const primary = createNode({
        title: 'Primary Both',
        url: 'https://example.com/merge-primary-both',
        source_domain: 'example.com',
        metadata_tags: ['primary'],
        ai_summary: 'Primary.',
      });
      const secondary = createNode({
        title: 'Secondary Both',
        url: 'https://example.com/merge-secondary-both',
        source_domain: 'example.com',
        metadata_tags: ['secondary'],
        ai_summary: 'Secondary.',
      });

      const result = mergeNodes(primary.id, secondary.id, {
        keepMetadata: true,
        appendSummary: true,
      });

      expect(result).toBeDefined();
      expect(result.metadata_tags).toContain('primary');
      expect(result.metadata_tags).toContain('secondary');
      expect(result.ai_summary).toContain('Primary.');
      expect(result.ai_summary).toContain('Secondary.');
    });
  });
});
