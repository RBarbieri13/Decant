// ============================================================
// Node Routes Integration Tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createTestApp } from '../../__tests__/test-app.js';
import { createNode } from '../../database/nodes.js';
import { resetTestDatabase } from '../../__tests__/setup.js';

interface TestNode {
  id: string;
  title: string;
  url: string;
  source_domain: string;
  [key: string]: unknown;
}

describe('Node API Routes', () => {
  const app = createTestApp();

  beforeEach(() => {
    resetTestDatabase();
  });

  describe('GET /api/nodes', () => {
    it('should return all nodes', async () => {
      createNode({
        title: 'Test Node 1',
        url: 'https://example.com/node1',
        source_domain: 'example.com',
      });
      createNode({
        title: 'Test Node 2',
        url: 'https://example.com/node2',
        source_domain: 'example.com',
      });

      const response = await request(app).get('/api/nodes');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should return empty array when no nodes exist', async () => {
      const response = await request(app).get('/api/nodes');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should not return deleted nodes', async () => {
      const node = createNode({
        title: 'Active Node',
        url: 'https://example.com/active',
        source_domain: 'example.com',
      });
      const deletedNode = createNode({
        title: 'Deleted Node',
        url: 'https://example.com/deleted',
        source_domain: 'example.com',
      });

      // Delete the second node
      await request(app).delete(`/api/nodes/${deletedNode.id}`);

      const response = await request(app).get('/api/nodes');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(node.id);
    });
  });

  describe('GET /api/nodes/:id', () => {
    it('should return a specific node', async () => {
      const node = createNode({
        title: 'Specific Node',
        url: 'https://example.com/specific',
        source_domain: 'example.com',
      });

      const response = await request(app).get(`/api/nodes/${node.id}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(node.id);
      expect(response.body.title).toBe('Specific Node');
    });

    it('should return 404 for non-existent node', async () => {
      const nonExistentId = uuidv4();
      const response = await request(app).get(`/api/nodes/${nonExistentId}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await request(app).get('/api/nodes/not-a-uuid');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for deleted node', async () => {
      const node = createNode({
        title: 'To Delete',
        url: 'https://example.com/to-delete',
        source_domain: 'example.com',
      });

      await request(app).delete(`/api/nodes/${node.id}`);
      const response = await request(app).get(`/api/nodes/${node.id}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/nodes', () => {
    it('should create a new node', async () => {
      const response = await request(app)
        .post('/api/nodes')
        .send({
          title: 'New Node',
          url: 'https://example.com/new',
          source_domain: 'example.com',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('New Node');
    });

    it('should create a node with all fields', async () => {
      const response = await request(app)
        .post('/api/nodes')
        .send({
          title: 'Full Node',
          url: 'https://example.com/full',
          source_domain: 'example.com',
          company: 'Test Co',
          phrase_description: 'A test phrase',
          short_description: 'A longer description',
          logo_url: 'https://example.com/logo.png',
          ai_summary: 'AI summary',
          extracted_fields: { key: 'value' },
          metadata_tags: ['tag1', 'tag2'],
          key_concepts: ['concept1'],
        });

      expect(response.status).toBe(201);
      expect(response.body.company).toBe('Test Co');
      expect(response.body.metadata_tags).toEqual(['tag1', 'tag2']);
      expect(response.body.key_concepts).toEqual(['concept1']);
    });

    it('should return 400 for duplicate URL', async () => {
      await request(app)
        .post('/api/nodes')
        .send({
          title: 'First Node',
          url: 'https://example.com/duplicate',
          source_domain: 'example.com',
        });

      const response = await request(app)
        .post('/api/nodes')
        .send({
          title: 'Second Node',
          url: 'https://example.com/duplicate',
          source_domain: 'example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/nodes/:id', () => {
    it('should update a node', async () => {
      const node = createNode({
        title: 'Original Title',
        url: 'https://example.com/update',
        source_domain: 'example.com',
      });

      const response = await request(app)
        .put(`/api/nodes/${node.id}`)
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Title');
    });

    it('should update multiple fields', async () => {
      const node = createNode({
        title: 'Multi Update',
        url: 'https://example.com/multi-update',
        source_domain: 'example.com',
      });

      const response = await request(app)
        .put(`/api/nodes/${node.id}`)
        .send({
          title: 'New Title',
          company: 'New Company',
          short_description: 'New Description',
        });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('New Title');
      expect(response.body.company).toBe('New Company');
      expect(response.body.short_description).toBe('New Description');
    });

    it('should preserve unupdated fields', async () => {
      const node = createNode({
        title: 'Preserve Fields',
        url: 'https://example.com/preserve',
        source_domain: 'example.com',
        company: 'Original Company',
      });

      const response = await request(app)
        .put(`/api/nodes/${node.id}`)
        .send({ title: 'New Title Only' });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('New Title Only');
      expect(response.body.company).toBe('Original Company');
    });
  });

  describe('DELETE /api/nodes/:id', () => {
    it('should soft delete a node', async () => {
      const node = createNode({
        title: 'To Delete',
        url: 'https://example.com/delete',
        source_domain: 'example.com',
      });

      const response = await request(app).delete(`/api/nodes/${node.id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify node is not returned anymore
      const getResponse = await request(app).get(`/api/nodes/${node.id}`);
      expect(getResponse.status).toBe(404);
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await request(app).delete('/api/nodes/not-a-uuid');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/nodes/:id/merge', () => {
    it('should merge two nodes', async () => {
      const primary = createNode({
        title: 'Primary Node',
        url: 'https://example.com/primary',
        source_domain: 'example.com',
        metadata_tags: ['primary-tag'],
      });
      const secondary = createNode({
        title: 'Secondary Node',
        url: 'https://example.com/secondary',
        source_domain: 'example.com',
        metadata_tags: ['secondary-tag'],
      });

      const response = await request(app)
        .post(`/api/nodes/${primary.id}/merge`)
        .send({
          secondaryId: secondary.id,
          options: { keepMetadata: true },
        });

      expect(response.status).toBe(200);
      expect(response.body.metadata_tags).toContain('primary-tag');
      expect(response.body.metadata_tags).toContain('secondary-tag');
    });

    it('should delete secondary node after merge', async () => {
      const primary = createNode({
        title: 'Primary',
        url: 'https://example.com/pri',
        source_domain: 'example.com',
      });
      const secondary = createNode({
        title: 'Secondary',
        url: 'https://example.com/sec',
        source_domain: 'example.com',
      });

      await request(app)
        .post(`/api/nodes/${primary.id}/merge`)
        .send({ secondaryId: secondary.id });

      const getResponse = await request(app).get(`/api/nodes/${secondary.id}`);
      expect(getResponse.status).toBe(404);
    });

    it('should return 400 when secondaryId is missing', async () => {
      const primary = createNode({
        title: 'Primary Only',
        url: 'https://example.com/primary-only',
        source_domain: 'example.com',
      });

      const response = await request(app)
        .post(`/api/nodes/${primary.id}/merge`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 when primary node does not exist', async () => {
      const secondary = createNode({
        title: 'Secondary',
        url: 'https://example.com/sec2',
        source_domain: 'example.com',
      });
      const nonExistentId = uuidv4();

      const response = await request(app)
        .post(`/api/nodes/${nonExistentId}/merge`)
        .send({ secondaryId: secondary.id });

      expect(response.status).toBe(404);
    });

    it('should append summaries when option is set', async () => {
      const primary = createNode({
        title: 'Primary',
        url: 'https://example.com/p',
        source_domain: 'example.com',
        ai_summary: 'Primary summary.',
      });
      const secondary = createNode({
        title: 'Secondary',
        url: 'https://example.com/s',
        source_domain: 'example.com',
        ai_summary: 'Secondary summary.',
      });

      const response = await request(app)
        .post(`/api/nodes/${primary.id}/merge`)
        .send({
          secondaryId: secondary.id,
          options: { appendSummary: true },
        });

      expect(response.status).toBe(200);
      expect(response.body.ai_summary).toContain('Primary summary.');
      expect(response.body.ai_summary).toContain('Secondary summary.');
    });
  });

  describe('POST /api/nodes/:id/move', () => {
    it('should move node to function parent', async () => {
      const parent = createNode({
        title: 'Parent',
        url: 'https://example.com/move-parent',
        source_domain: 'example.com',
      });
      const child = createNode({
        title: 'Child',
        url: 'https://example.com/move-child',
        source_domain: 'example.com',
      });

      const response = await request(app)
        .post(`/api/nodes/${child.id}/move`)
        .send({
          targetParentId: parent.id,
          targetHierarchy: 'function',
        });

      expect(response.status).toBe(200);
      expect(response.body.function_parent_id).toBe(parent.id);
      expect(response.body.organization_parent_id).toBeNull();
    });

    it('should move node to organization parent', async () => {
      const parent = createNode({
        title: 'Org Parent',
        url: 'https://example.com/org-parent',
        source_domain: 'example.com',
      });
      const child = createNode({
        title: 'Org Child',
        url: 'https://example.com/org-child',
        source_domain: 'example.com',
      });

      const response = await request(app)
        .post(`/api/nodes/${child.id}/move`)
        .send({
          targetParentId: parent.id,
          targetHierarchy: 'organization',
        });

      expect(response.status).toBe(200);
      expect(response.body.organization_parent_id).toBe(parent.id);
      expect(response.body.function_parent_id).toBeNull();
    });

    it('should return 404 for non-existent node', async () => {
      const nonExistentId = uuidv4();
      const response = await request(app)
        .post(`/api/nodes/${nonExistentId}/move`)
        .send({
          targetParentId: uuidv4(),
          targetHierarchy: 'function',
        });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/nodes/:id/related', () => {
    it('should return related nodes with similarity scores', async () => {
      const { setSimilarity } = await import('../../database/similarity.js');

      const node1 = createNode({
        title: 'Node 1',
        url: 'https://example.com/node1',
        source_domain: 'example.com',
        metadata_tags: ['tag1', 'tag2'],
        extracted_fields: {
          contentType: 'A',
          segment: 'Tech',
          category: 'AI',
        },
      }) as TestNode;

      const node2 = createNode({
        title: 'Node 2',
        url: 'https://example.com/node2',
        source_domain: 'example.com',
        metadata_tags: ['tag1', 'tag3'],
        extracted_fields: {
          contentType: 'V',
          segment: 'Tech',
          category: 'ML',
        },
      }) as TestNode;

      const node3 = createNode({
        title: 'Node 3',
        url: 'https://example.com/node3',
        source_domain: 'example.com',
        metadata_tags: ['tag2', 'tag4'],
        extracted_fields: {
          contentType: 'A',
          segment: 'Finance',
          category: 'Crypto',
        },
      }) as TestNode;

      // Set similarity scores
      setSimilarity(node1.id, node2.id, 0.85);
      setSimilarity(node1.id, node3.id, 0.45);

      const response = await request(app).get(`/api/nodes/${node1.id}/related`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('nodeId', node1.id);
      expect(response.body).toHaveProperty('related');
      expect(response.body.related).toBeInstanceOf(Array);
      expect(response.body.related.length).toBe(2);

      // Verify first related node (highest similarity)
      const firstRelated = response.body.related[0];
      expect(firstRelated.node.id).toBe(node2.id);
      expect(firstRelated.node.title).toBe('Node 2');
      expect(firstRelated.similarityScore).toBe(85); // 0.85 * 100
      expect(firstRelated.sharedAttributes).toContain('tag1');
      expect(firstRelated.node.contentType).toBe('V');
      expect(firstRelated.node.segment).toBe('Tech');
      expect(firstRelated.node.category).toBe('ML');

      // Verify second related node
      const secondRelated = response.body.related[1];
      expect(secondRelated.node.id).toBe(node3.id);
      expect(secondRelated.similarityScore).toBe(45); // 0.45 * 100
      expect(secondRelated.sharedAttributes).toContain('tag2');
    });

    it('should return empty array when no related nodes exist', async () => {
      const node = createNode({
        title: 'Isolated Node',
        url: 'https://example.com/isolated',
        source_domain: 'example.com',
      }) as TestNode;

      const response = await request(app).get(`/api/nodes/${node.id}/related`);

      expect(response.status).toBe(200);
      expect(response.body.nodeId).toBe(node.id);
      expect(response.body.related).toEqual([]);
    });

    it('should respect the limit parameter', async () => {
      const { setSimilarity } = await import('../../database/similarity.js');

      const node1 = createNode({
        title: 'Node 1',
        url: 'https://example.com/n1',
        source_domain: 'example.com',
      }) as TestNode;

      // Create 10 related nodes
      Array.from({ length: 10 }, (_, i) => {
        const node = createNode({
          title: `Related ${i}`,
          url: `https://example.com/related${i}`,
          source_domain: 'example.com',
        }) as TestNode;
        setSimilarity(node1.id, node.id, 0.9 - i * 0.05);
        return node;
      });

      // Request only 3 related nodes
      const response = await request(app).get(`/api/nodes/${node1.id}/related?limit=3`);

      expect(response.status).toBe(200);
      expect(response.body.related.length).toBe(3);

      // Verify they are ordered by similarity (highest first)
      expect(response.body.related[0].similarityScore).toBe(90); // 0.9
      expect(response.body.related[1].similarityScore).toBe(85); // 0.85
      expect(response.body.related[2].similarityScore).toBe(80); // 0.8
    });

    it('should return 404 for non-existent node', async () => {
      const nonExistentId = uuidv4();
      const response = await request(app).get(`/api/nodes/${nonExistentId}/related`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await request(app).get('/api/nodes/not-a-uuid/related');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should include shared metadata tags in response', async () => {
      const { setSimilarity } = await import('../../database/similarity.js');

      const node1 = createNode({
        title: 'Source Node',
        url: 'https://example.com/source',
        source_domain: 'example.com',
        metadata_tags: ['AI', 'ML', 'Python', 'Research', 'OpenAI'],
      }) as TestNode;

      const node2 = createNode({
        title: 'Similar Node',
        url: 'https://example.com/similar',
        source_domain: 'example.com',
        metadata_tags: ['AI', 'ML', 'Research', 'Tutorial'],
      }) as TestNode;

      setSimilarity(node1.id, node2.id, 0.75);

      const response = await request(app).get(`/api/nodes/${node1.id}/related`);

      expect(response.status).toBe(200);
      expect(response.body.related.length).toBe(1);

      const related = response.body.related[0];
      expect(related.sharedAttributes).toContain('AI');
      expect(related.sharedAttributes).toContain('ML');
      expect(related.sharedAttributes).toContain('Research');
      expect(related.sharedAttributes.length).toBeLessThanOrEqual(5); // Limited to 5
    });

    it('should include logo_url and phrase_description if available', async () => {
      const { setSimilarity } = await import('../../database/similarity.js');

      const node1 = createNode({
        title: 'Node 1',
        url: 'https://example.com/n1',
        source_domain: 'example.com',
      }) as TestNode;

      const node2 = createNode({
        title: 'Node 2',
        url: 'https://example.com/n2',
        source_domain: 'example.com',
        logo_url: 'https://example.com/logo.png',
        phrase_description: 'A cool description',
      }) as TestNode;

      setSimilarity(node1.id, node2.id, 0.8);

      const response = await request(app).get(`/api/nodes/${node1.id}/related`);

      expect(response.status).toBe(200);
      const related = response.body.related[0];
      expect(related.node.logo_url).toBe('https://example.com/logo.png');
      expect(related.node.phrase_description).toBe('A cool description');
    });
  });
});
