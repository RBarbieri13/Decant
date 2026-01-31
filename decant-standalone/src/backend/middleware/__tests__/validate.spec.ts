// ============================================================
// Validation Middleware Tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createTestApp } from '../../__tests__/test-app.js';
import { resetTestDatabase } from '../../__tests__/setup.js';
import { createNode } from '../../database/nodes.js';

describe('Validation Middleware', () => {
  const app = createTestApp();

  beforeEach(() => {
    resetTestDatabase();
  });

  // ============================================================
  // Body Validation Tests
  // ============================================================

  describe('validateBody - CreateNodeSchema', () => {
    it('should accept valid node creation request', async () => {
      const response = await request(app)
        .post('/api/nodes')
        .send({
          title: 'Valid Node',
          url: 'https://example.com/valid',
          source_domain: 'example.com',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
    });

    it('should reject request with missing required fields', async () => {
      const response = await request(app)
        .post('/api/nodes')
        .send({
          title: 'Missing URL',
          // url is missing
          source_domain: 'example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: expect.stringContaining('url'),
            message: expect.any(String),
          }),
        ])
      );
    });

    it('should reject request with invalid URL format', async () => {
      const response = await request(app)
        .post('/api/nodes')
        .send({
          title: 'Invalid URL',
          url: 'not-a-valid-url',
          source_domain: 'example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'url',
            message: 'Must be a valid URL',
          }),
        ])
      );
    });

    it('should reject request with title exceeding max length', async () => {
      const longTitle = 'a'.repeat(501);
      const response = await request(app)
        .post('/api/nodes')
        .send({
          title: longTitle,
          url: 'https://example.com/long-title',
          source_domain: 'example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'title',
            message: expect.stringContaining('500'),
          }),
        ])
      );
    });

    it('should reject request with empty title', async () => {
      const response = await request(app)
        .post('/api/nodes')
        .send({
          title: '',
          url: 'https://example.com/empty-title',
          source_domain: 'example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'title',
            message: 'Title is required',
          }),
        ])
      );
    });

    it('should reject request with invalid UUID for parent_id', async () => {
      const response = await request(app)
        .post('/api/nodes')
        .send({
          title: 'Invalid Parent',
          url: 'https://example.com/invalid-parent',
          source_domain: 'example.com',
          function_parent_id: 'not-a-uuid',
        });

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'function_parent_id',
            message: expect.stringContaining('UUID'),
          }),
        ])
      );
    });

    it('should accept valid optional fields', async () => {
      const response = await request(app)
        .post('/api/nodes')
        .send({
          title: 'Full Node',
          url: 'https://example.com/full',
          source_domain: 'example.com',
          company: 'Test Company',
          phrase_description: 'A test phrase',
          short_description: 'A test description',
          logo_url: 'https://example.com/logo.png',
          ai_summary: 'AI generated summary',
          metadata_tags: ['tag1', 'tag2'],
          key_concepts: ['concept1'],
          function_parent_id: uuidv4(),
        });

      expect(response.status).toBe(201);
      expect(response.body.company).toBe('Test Company');
    });
  });

  describe('validateBody - UpdateNodeSchema', () => {
    it('should accept valid update request', async () => {
      const node = createNode({
        title: 'Original',
        url: 'https://example.com/update-test',
        source_domain: 'example.com',
      });

      const response = await request(app)
        .put(`/api/nodes/${node.id}`)
        .send({
          title: 'Updated Title',
        });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Title');
    });

    it('should reject update with no fields', async () => {
      const node = createNode({
        title: 'Test',
        url: 'https://example.com/no-fields',
        source_domain: 'example.com',
      });

      const response = await request(app)
        .put(`/api/nodes/${node.id}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: 'At least one field must be provided for update',
          }),
        ])
      );
    });

    it('should reject update with empty title', async () => {
      const node = createNode({
        title: 'Test',
        url: 'https://example.com/empty-update',
        source_domain: 'example.com',
      });

      const response = await request(app)
        .put(`/api/nodes/${node.id}`)
        .send({
          title: '',
        });

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'title',
            message: expect.stringContaining('empty'),
          }),
        ])
      );
    });
  });

  describe('validateBody - ImportUrlSchema', () => {
    it('should reject import with missing URL', async () => {
      const response = await request(app)
        .post('/api/import')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'url',
            message: 'URL is required',
          }),
        ])
      );
    });

    it('should reject import with invalid URL', async () => {
      const response = await request(app)
        .post('/api/import')
        .send({
          url: 'not-a-url',
        });

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'url',
            message: 'Must be a valid URL',
          }),
        ])
      );
    });

    it('should reject import with non-http protocol', async () => {
      const response = await request(app)
        .post('/api/import')
        .send({
          url: 'ftp://example.com/file',
        });

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'url',
            message: 'URL must use http or https protocol',
          }),
        ])
      );
    });
  });

  describe('validateBody - MergeNodesSchema', () => {
    it('should reject merge without secondaryId', async () => {
      const node = createNode({
        title: 'Primary',
        url: 'https://example.com/primary',
        source_domain: 'example.com',
      });

      const response = await request(app)
        .post(`/api/nodes/${node.id}/merge`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: expect.stringContaining('secondaryId'),
          }),
        ])
      );
    });

    it('should reject merge with invalid UUID', async () => {
      const node = createNode({
        title: 'Primary',
        url: 'https://example.com/primary2',
        source_domain: 'example.com',
      });

      const response = await request(app)
        .post(`/api/nodes/${node.id}/merge`)
        .send({
          secondaryId: 'not-a-uuid',
        });

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'secondaryId',
            message: expect.stringContaining('UUID'),
          }),
        ])
      );
    });
  });

  describe('validateBody - MoveNodeSchema', () => {
    it('should reject move without targetHierarchy', async () => {
      const node = createNode({
        title: 'Test',
        url: 'https://example.com/move-test',
        source_domain: 'example.com',
      });

      const response = await request(app)
        .post(`/api/nodes/${node.id}/move`)
        .send({
          targetParentId: uuidv4(),
        });

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: expect.stringContaining('targetHierarchy'),
          }),
        ])
      );
    });

    it('should reject move with invalid hierarchy value', async () => {
      const node = createNode({
        title: 'Test',
        url: 'https://example.com/move-test2',
        source_domain: 'example.com',
      });

      const response = await request(app)
        .post(`/api/nodes/${node.id}/move`)
        .send({
          targetParentId: uuidv4(),
          targetHierarchy: 'invalid',
        });

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'targetHierarchy',
            message: expect.stringContaining('function'),
          }),
        ])
      );
    });
  });

  // ============================================================
  // Query Validation Tests
  // ============================================================

  describe('validateQuery - SearchQuerySchema', () => {
    it('should accept valid search query', async () => {
      createNode({
        title: 'Test Search',
        url: 'https://example.com/search',
        source_domain: 'example.com',
      });

      const response = await request(app)
        .get('/api/search')
        .query({ q: 'test' });

      expect(response.status).toBe(200);
    });

    it('should reject search without query parameter', async () => {
      const response = await request(app)
        .get('/api/search');

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'q',
            message: expect.stringContaining('required'),
          }),
        ])
      );
    });

    it('should reject search with empty query', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: '' });

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'q',
            message: expect.stringContaining('required'),
          }),
        ])
      );
    });

    it('should reject search with query exceeding max length', async () => {
      const longQuery = 'a'.repeat(501);
      const response = await request(app)
        .get('/api/search')
        .query({ q: longQuery });

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'q',
            message: expect.stringContaining('500'),
          }),
        ])
      );
    });

    it('should transform and validate limit parameter', async () => {
      createNode({
        title: 'Test',
        url: 'https://example.com/test',
        source_domain: 'example.com',
      });

      const response = await request(app)
        .get('/api/search')
        .query({ q: 'test', limit: '10' });

      expect(response.status).toBe(200);
    });

    it('should reject invalid limit parameter', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: 'test', limit: 'not-a-number' });

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'limit',
            message: expect.stringContaining('number'),
          }),
        ])
      );
    });

    it('should reject limit exceeding maximum', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ q: 'test', limit: '101' });

      expect(response.status).toBe(400);
    });
  });

  // ============================================================
  // Params Validation Tests
  // ============================================================

  describe('validateParams - UuidParamSchema', () => {
    it('should accept valid UUID in params', async () => {
      const node = createNode({
        title: 'Test',
        url: 'https://example.com/uuid-test',
        source_domain: 'example.com',
      });

      const response = await request(app)
        .get(`/api/nodes/${node.id}`);

      expect(response.status).toBe(200);
    });

    it('should reject invalid UUID in params', async () => {
      const response = await request(app)
        .get('/api/nodes/not-a-uuid');

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'id',
            message: expect.stringContaining('UUID'),
          }),
        ])
      );
    });

    it('should reject DELETE with invalid UUID', async () => {
      const response = await request(app)
        .delete('/api/nodes/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'id',
            message: expect.stringContaining('UUID'),
          }),
        ])
      );
    });
  });

  describe('validateParams - HierarchyViewParamSchema', () => {
    it('should accept valid hierarchy view', async () => {
      const response = await request(app)
        .get('/api/hierarchy/tree/function');

      expect(response.status).toBe(200);
    });

    it('should reject invalid hierarchy view', async () => {
      const response = await request(app)
        .get('/api/hierarchy/tree/invalid');

      expect(response.status).toBe(400);
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'view',
            message: expect.stringContaining('function'),
          }),
        ])
      );
    });
  });

  // ============================================================
  // Combined Validation Tests
  // ============================================================

  describe('validate - Combined params and body', () => {
    it('should validate both params and body together', async () => {
      const node = createNode({
        title: 'Test',
        url: 'https://example.com/combined',
        source_domain: 'example.com',
      });

      const response = await request(app)
        .put(`/api/nodes/${node.id}`)
        .send({
          title: 'Updated',
        });

      expect(response.status).toBe(200);
    });

    it('should report errors from both params and body', async () => {
      const response = await request(app)
        .put('/api/nodes/invalid-uuid')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.details.length).toBeGreaterThan(0);

      // Should have error about invalid UUID
      const hasParamError = response.body.details.some(
        (err: any) => err.field.includes('params.id')
      );

      // Should have error about empty body
      const hasBodyError = response.body.details.some(
        (err: any) => err.field.includes('body') || err.message.includes('one field')
      );

      expect(hasParamError || hasBodyError).toBe(true);
    });
  });

  // ============================================================
  // Error Format Tests
  // ============================================================

  describe('Error Response Format', () => {
    it('should return consistent error format', async () => {
      const response = await request(app)
        .post('/api/nodes')
        .send({
          title: '', // Invalid
          url: 'not-a-url', // Invalid
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
      expect(response.body).toHaveProperty('details');
      expect(Array.isArray(response.body.details)).toBe(true);

      response.body.details.forEach((detail: any) => {
        expect(detail).toHaveProperty('field');
        expect(detail).toHaveProperty('message');
        expect(typeof detail.field).toBe('string');
        expect(typeof detail.message).toBe('string');
      });
    });

    it('should include all validation errors', async () => {
      const response = await request(app)
        .post('/api/nodes')
        .send({
          title: '', // Empty
          url: 'invalid-url', // Invalid format
          source_domain: '', // Empty
        });

      expect(response.status).toBe(400);
      expect(response.body.details.length).toBeGreaterThanOrEqual(2);
    });
  });
});
