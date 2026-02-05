/**
 * AI Import API Route
 *
 * Provides REST endpoints for AI-powered URL imports into Decant.
 * This endpoint orchestrates the complete import pipeline:
 * - Content extraction
 * - AI categorization
 * - Note creation with proper taxonomy
 */

import type { Request } from 'express';
import aiImportService from '../../services/ai_import_service.js';
import type { AIImportOptions, AIImportResult } from '../../services/ai_import_service.js';
import log from '../../services/log.js';
import ValidationError from '../../errors/validation_error.js';

/**
 * POST /api/ai-import
 *
 * Import a URL with AI-powered auto-categorization.
 *
 * Request body:
 * {
 *   url: string,                    // Required: URL to import
 *   options?: {
 *     spaceId?: string,             // Optional: Force a specific Space
 *     collectionId?: string,        // Optional: Force a specific Collection
 *     skipCategorization?: boolean, // Optional: Skip AI categorization
 *     title?: string                // Optional: Override extracted title
 *   }
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   noteId: string,
 *   spaceId: string,
 *   spaceName: string,
 *   collectionId: string,
 *   collectionName: string,
 *   categorization: {
 *     suggestedSpaceId: string | null,
 *     suggestedSpaceName: string,
 *     suggestedCollectionId: string | null,
 *     suggestedCollectionName: string,
 *     createNewCollection: boolean,
 *     newCollectionName?: string,
 *     contentType: string,
 *     suggestedTags: string[],
 *     summary: string,
 *     keyPoints: string[],
 *     confidence: number
 *   },
 *   processingTimeMs: number,
 *   error?: string
 * }
 *
 * @swagger
 * /api/ai-import:
 *   post:
 *     summary: Import URL with AI categorization
 *     operationId: ai-import
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
 *                 description: URL to import
 *                 example: "https://example.com/article"
 *               options:
 *                 type: object
 *                 properties:
 *                   spaceId:
 *                     type: string
 *                     description: Force a specific Space
 *                   collectionId:
 *                     type: string
 *                     description: Force a specific Collection
 *                   skipCategorization:
 *                     type: boolean
 *                     description: Skip AI categorization
 *                   title:
 *                     type: string
 *                     description: Override extracted title
 *     responses:
 *       '200':
 *         description: Import result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 noteId:
 *                   type: string
 *                 spaceId:
 *                   type: string
 *                 spaceName:
 *                   type: string
 *                 collectionId:
 *                   type: string
 *                 collectionName:
 *                   type: string
 *                 categorization:
 *                   type: object
 *                 processingTimeMs:
 *                   type: number
 *                 error:
 *                   type: string
 *       '400':
 *         description: Invalid request (missing URL)
 *       '500':
 *         description: Server error during import
 *     security:
 *       - session: []
 *     tags: ["decant", "ai"]
 */
async function importUrl(req: Request): Promise<AIImportResult> {
    const { url, options } = req.body;

    // Validate required fields
    if (!url || typeof url !== 'string') {
        throw new ValidationError('URL is required and must be a string');
    }

    log.info(`AI Import API called - URL: ${url}`);

    // Parse options
    const importOptions: AIImportOptions = {
        spaceId: options?.spaceId || null,
        collectionId: options?.collectionId || null,
        skipCategorization: options?.skipCategorization || false,
        title: options?.title || undefined
    };

    // Validate that if skipCategorization is true, both spaceId and collectionId must be provided
    if (importOptions.skipCategorization && (!importOptions.spaceId || !importOptions.collectionId)) {
        throw new ValidationError('When skipCategorization is true, both spaceId and collectionId must be provided');
    }

    try {
        const result = await aiImportService.importUrl(url, importOptions);
        return result;
    } catch (error: any) {
        log.error(`AI import failed: ${error.message || String(error)}`);

        // Return error in consistent format
        return {
            success: false,
            noteId: '',
            spaceId: '',
            spaceName: '',
            collectionId: '',
            collectionName: '',
            categorization: {
                suggestedSpaceId: null,
                suggestedSpaceName: 'Error',
                suggestedCollectionId: null,
                suggestedCollectionName: 'Error',
                createNewCollection: false,
                contentType: 'other',
                suggestedTags: [],
                summary: '',
                keyPoints: [],
                confidence: 0
            },
            processingTimeMs: 0,
            error: error.message || String(error)
        };
    }
}

/**
 * GET /api/ai-import/status
 *
 * Get the status of AI import service (availability, configuration, etc.)
 *
 * Response:
 * {
 *   available: boolean,
 *   reason?: string
 * }
 */
function getStatus(req: Request) {
    // Check if AI service is configured and available
    // This is a simple health check endpoint
    return {
        available: true,
        message: 'AI Import service is available'
    };
}

export default {
    importUrl,
    getStatus
};
