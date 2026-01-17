/**
 * Decant API Routes
 *
 * REST API endpoints for Decant resource management and AI-powered metadata extraction
 */

import type { Request, Response } from "express";
import log from "../../services/log.js";
import {
    resourceService,
    metadataExtractor,
    aiProvider,
} from "../../services/decant/index.js";
import type {
    MetadataExtractionRequest,
    CreateResourceRequest,
    UpdateResourceRequest,
} from "../../services/decant/types.js";
import {
    FUNCTION_HIERARCHIES,
    ORGANIZATION_HIERARCHIES,
} from "../../services/decant/types.js";

/**
 * @swagger
 * /api/decant/extract:
 *   post:
 *     summary: Extract metadata from a URL using AI
 *     operationId: decant-extract-metadata
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 description: The URL to analyze
 *               forceRefresh:
 *                 type: boolean
 *                 description: Force re-extraction even if cached
 *               context:
 *                 type: string
 *                 description: Additional context to help AI extraction
 *     responses:
 *       200:
 *         description: Metadata extracted successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 *     security:
 *       - session: []
 *     tags: ["decant"]
 */
async function extractMetadata(req: Request, res: Response) {
    const { url, forceRefresh, context } = req.body as MetadataExtractionRequest;

    if (!url) {
        return [400, { success: false, error: 'URL is required' }];
    }

    // Validate URL format
    try {
        new URL(url);
    } catch {
        return [400, { success: false, error: 'Invalid URL format' }];
    }

    log.info(`Decant: Extracting metadata for URL: ${url}`);

    const result = await metadataExtractor.extractMetadata({
        url,
        forceRefresh,
        context,
    });

    if (!result.success) {
        return [500, result];
    }

    return result;
}

/**
 * @swagger
 * /api/decant/resources:
 *   get:
 *     summary: List all Decant resources
 *     operationId: decant-list-resources
 *     parameters:
 *       - name: category
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *         description: Search query
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of results
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset for pagination
 *     responses:
 *       200:
 *         description: List of resources
 *     security:
 *       - session: []
 *     tags: ["decant"]
 */
async function listResources(req: Request, res: Response) {
    const { category, search, limit, offset } = req.query;

    const result = await resourceService.listResources({
        category: category as string | undefined,
        search: search as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    return result;
}

/**
 * @swagger
 * /api/decant/resources:
 *   post:
 *     summary: Create a new resource from a URL
 *     operationId: decant-create-resource
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *               metadata:
 *                 type: object
 *               userNotes:
 *                 type: string
 *               customTags:
 *                 type: array
 *                 items:
 *                   type: string
 *               createNote:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Resource created successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 *     security:
 *       - session: []
 *     tags: ["decant"]
 */
async function createResource(req: Request, res: Response) {
    const request = req.body as CreateResourceRequest;

    if (!request.url) {
        return [400, { success: false, error: 'URL is required' }];
    }

    // Validate URL format
    try {
        new URL(request.url);
    } catch {
        return [400, { success: false, error: 'Invalid URL format' }];
    }

    log.info(`Decant: Creating resource for URL: ${request.url}`);

    try {
        const resource = await resourceService.createResource(request);
        return [201, { success: true, resource }];
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        log.error(`Decant: Failed to create resource: ${message}`);
        return [500, { success: false, error: message }];
    }
}

/**
 * @swagger
 * /api/decant/resources/{resourceId}:
 *   get:
 *     summary: Get a specific resource
 *     operationId: decant-get-resource
 *     parameters:
 *       - name: resourceId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Resource details
 *       404:
 *         description: Resource not found
 *     security:
 *       - session: []
 *     tags: ["decant"]
 */
async function getResource(req: Request, res: Response) {
    const { resourceId } = req.params;

    const resource = await resourceService.getResource(resourceId);

    if (!resource) {
        return [404, { success: false, error: 'Resource not found' }];
    }

    return { success: true, resource };
}

/**
 * @swagger
 * /api/decant/resources/{resourceId}:
 *   put:
 *     summary: Update a resource
 *     operationId: decant-update-resource
 *     parameters:
 *       - name: resourceId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               metadata:
 *                 type: object
 *               userNotes:
 *                 type: string
 *               customTags:
 *                 type: array
 *                 items:
 *                   type: string
 *               isFavorite:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Resource updated
 *       404:
 *         description: Resource not found
 *     security:
 *       - session: []
 *     tags: ["decant"]
 */
async function updateResource(req: Request, res: Response) {
    const { resourceId } = req.params;
    const updates = req.body as UpdateResourceRequest;

    const resource = await resourceService.updateResource(resourceId, updates);

    if (!resource) {
        return [404, { success: false, error: 'Resource not found' }];
    }

    return { success: true, resource };
}

/**
 * @swagger
 * /api/decant/resources/{resourceId}:
 *   delete:
 *     summary: Delete a resource
 *     operationId: decant-delete-resource
 *     parameters:
 *       - name: resourceId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Resource deleted
 *       404:
 *         description: Resource not found
 *     security:
 *       - session: []
 *     tags: ["decant"]
 */
async function deleteResource(req: Request, res: Response) {
    const { resourceId } = req.params;

    const deleted = await resourceService.deleteResource(resourceId);

    if (!deleted) {
        return [404, { success: false, error: 'Resource not found' }];
    }

    return [204, ''];
}

/**
 * @swagger
 * /api/decant/resources/{resourceId}/refresh:
 *   post:
 *     summary: Refresh metadata for a resource
 *     operationId: decant-refresh-resource
 *     parameters:
 *       - name: resourceId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Metadata refreshed
 *       404:
 *         description: Resource not found
 *       500:
 *         description: Refresh failed
 *     security:
 *       - session: []
 *     tags: ["decant"]
 */
async function refreshResource(req: Request, res: Response) {
    const { resourceId } = req.params;

    try {
        const resource = await resourceService.refreshResourceMetadata(resourceId);

        if (!resource) {
            return [404, { success: false, error: 'Resource not found' }];
        }

        return { success: true, resource };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return [500, { success: false, error: message }];
    }
}

/**
 * @swagger
 * /api/decant/categories:
 *   get:
 *     summary: Get categories with resource counts
 *     operationId: decant-get-categories
 *     responses:
 *       200:
 *         description: List of categories
 *     security:
 *       - session: []
 *     tags: ["decant"]
 */
async function getCategories(req: Request, res: Response) {
    const categories = await resourceService.getCategories();
    return { success: true, categories };
}

/**
 * @swagger
 * /api/decant/search:
 *   get:
 *     summary: Search resources
 *     operationId: decant-search-resources
 *     parameters:
 *       - name: q
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - name: categories
 *         in: query
 *         schema:
 *           type: string
 *         description: Comma-separated category filter
 *       - name: tags
 *         in: query
 *         schema:
 *           type: string
 *         description: Comma-separated tag filter
 *       - name: functionCodes
 *         in: query
 *         schema:
 *           type: string
 *         description: Comma-separated function code filter
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Search results
 *     security:
 *       - session: []
 *     tags: ["decant"]
 */
async function searchResources(req: Request, res: Response) {
    const { q, categories, tags, functionCodes, limit } = req.query;

    if (!q) {
        return [400, { success: false, error: 'Search query (q) is required' }];
    }

    const resources = await resourceService.searchResources(q as string, {
        categories: categories ? (categories as string).split(',') : undefined,
        tags: tags ? (tags as string).split(',') : undefined,
        functionCodes: functionCodes ? (functionCodes as string).split(',') : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    return { success: true, resources, count: resources.length };
}

/**
 * @swagger
 * /api/decant/hierarchies:
 *   get:
 *     summary: Get hierarchy definitions
 *     operationId: decant-get-hierarchies
 *     responses:
 *       200:
 *         description: Hierarchy definitions
 *     security:
 *       - session: []
 *     tags: ["decant"]
 */
async function getHierarchies(req: Request, res: Response) {
    return {
        success: true,
        functionHierarchies: FUNCTION_HIERARCHIES,
        organizationHierarchies: ORGANIZATION_HIERARCHIES,
    };
}

/**
 * @swagger
 * /api/decant/ai/test:
 *   post:
 *     summary: Test AI provider connection
 *     operationId: decant-test-ai
 *     responses:
 *       200:
 *         description: Connection test result
 *     security:
 *       - session: []
 *     tags: ["decant"]
 */
async function testAIConnection(req: Request, res: Response) {
    const result = await aiProvider.testConnection();
    return result.success ? result : [500, result];
}

/**
 * @swagger
 * /api/decant/cache/stats:
 *   get:
 *     summary: Get cache statistics
 *     operationId: decant-cache-stats
 *     responses:
 *       200:
 *         description: Cache statistics
 *     security:
 *       - session: []
 *     tags: ["decant"]
 */
async function getCacheStats(req: Request, res: Response) {
    const stats = metadataExtractor.getCacheStats();
    return { success: true, ...stats };
}

/**
 * @swagger
 * /api/decant/cache/clear:
 *   post:
 *     summary: Clear metadata cache
 *     operationId: decant-cache-clear
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 description: Specific URL to clear, or omit to clear all
 *     responses:
 *       200:
 *         description: Cache cleared
 *     security:
 *       - session: []
 *     tags: ["decant"]
 */
async function clearCache(req: Request, res: Response) {
    const { url } = req.body || {};

    metadataExtractor.clearCache(url);

    return { success: true, message: url ? `Cleared cache for ${url}` : 'Cleared all cache' };
}

export default {
    // Metadata extraction
    extractMetadata,

    // Resource CRUD
    listResources,
    createResource,
    getResource,
    updateResource,
    deleteResource,
    refreshResource,

    // Categories and search
    getCategories,
    searchResources,
    getHierarchies,

    // AI and cache management
    testAIConnection,
    getCacheStats,
    clearCache,
};
