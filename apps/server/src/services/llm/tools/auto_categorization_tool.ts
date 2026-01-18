/**
 * Auto-Categorization Tool
 *
 * This tool analyzes content and determines optimal placement in the Decant
 * taxonomy (Spaces → Collections → Items). It uses AI to suggest the best
 * Space, Collection, tags, and generates a summary.
 */

import type { Tool, ToolHandler } from './tool_interfaces.js';
import log from '../../log.js';
import attributes from '../../attributes.js';
import aiServiceManager from '../ai_service_manager.js';
import { SEARCH_CONSTANTS } from '../constants/search_constants.js';

/**
 * Content types supported by Decant
 */
export type ContentType =
    | 'youtube'
    | 'article'
    | 'podcast'
    | 'paper'
    | 'github'
    | 'tweet'
    | 'image'
    | 'tool'
    | 'website'
    | 'other';

/**
 * Result of auto-categorization
 */
export interface AutoCategorizationResult {
    suggestedSpaceId: string | null;
    suggestedSpaceName: string;
    suggestedCollectionId: string | null;
    suggestedCollectionName: string;
    createNewCollection: boolean;
    newCollectionName?: string;
    contentType: ContentType;
    suggestedTags: string[];
    summary: string;
    keyPoints: string[];
    confidence: number;
}

/**
 * Taxonomy structure for AI context
 */
interface TaxonomySpace {
    noteId: string;
    title: string;
    description?: string;
    collections: TaxonomyCollection[];
}

interface TaxonomyCollection {
    noteId: string;
    title: string;
    itemCount: number;
}

/**
 * Definition of the auto-categorization tool
 */
export const autoCategorizationToolDefinition: Tool = {
    type: 'function',
    function: {
        name: 'auto_categorize',
        description: 'Analyze content and determine optimal placement in the Decant taxonomy (Spaces → Collections → Items). Returns suggested Space, Collection, tags, summary, and confidence score.',
        parameters: {
            type: 'object',
            properties: {
                title: {
                    type: 'string',
                    description: 'Title of the content to categorize'
                },
                url: {
                    type: 'string',
                    description: 'Source URL of the content'
                },
                content: {
                    type: 'string',
                    description: 'Text content or excerpt to analyze for categorization'
                },
                contentType: {
                    type: 'string',
                    description: 'Optional pre-detected content type (youtube, article, podcast, paper, github, tweet, image, tool, website, other)',
                    enum: ['youtube', 'article', 'podcast', 'paper', 'github', 'tweet', 'image', 'tool', 'website', 'other']
                }
            },
            required: ['title', 'content']
        }
    }
};

/**
 * Auto-categorization tool implementation
 */
export class AutoCategorizationTool implements ToolHandler {
    public definition: Tool = autoCategorizationToolDefinition;

    /**
     * Execute the auto-categorization tool
     */
    public async execute(args: {
        title: string,
        url?: string,
        content: string,
        contentType?: ContentType
    }): Promise<string | object> {
        const startTime = Date.now();

        try {
            const { title, url, content, contentType } = args;

            log.info(`Executing auto_categorize tool - Title: "${title}", URL: ${url || 'none'}`);

            // 1. Get existing taxonomy
            const taxonomy = await this.getTaxonomy();
            log.info(`Found ${taxonomy.length} Spaces in taxonomy`);

            // 2. Detect content type if not provided
            const detectedContentType = contentType || this.detectContentType(url || '', title);

            // 3. Build AI prompt and get categorization
            const categorization = await this.aiCategorize(
                title,
                url || '',
                content,
                detectedContentType,
                taxonomy
            );

            const duration = Date.now() - startTime;
            log.info(`Auto-categorization completed in ${duration}ms with confidence ${categorization.confidence}`);

            return {
                success: true,
                ...categorization,
                processingTimeMs: duration
            };

        } catch (error: any) {
            log.error(`Error executing auto_categorize tool: ${error.message || String(error)}`);
            return `Error: ${error.message || String(error)}`;
        }
    }

    /**
     * Get the current Decant taxonomy (Spaces and Collections)
     */
    private async getTaxonomy(): Promise<TaxonomySpace[]> {
        const taxonomy: TaxonomySpace[] = [];

        // Find all Space notes (notes with #decantType=space)
        const spaceNotes = attributes.getNotesWithLabel('decantType', 'space');

        for (const spaceNote of spaceNotes) {
            if (!spaceNote || spaceNote.isDeleted) continue;

            const space: TaxonomySpace = {
                noteId: spaceNote.noteId,
                title: spaceNote.title,
                description: spaceNote.getLabelValue('description') || undefined,
                collections: []
            };

            // Find all Collection notes that are children of this Space
            const childNotes = spaceNote.getChildNotes();
            for (const childNote of childNotes) {
                if (childNote.isDeleted) continue;

                const decantType = childNote.getLabelValue('decantType');
                if (decantType === 'collection') {
                    // Count items in this collection
                    const itemCount = childNote.getChildNotes().filter(
                        n => !n.isDeleted && n.getLabelValue('decantType') === 'item'
                    ).length;

                    space.collections.push({
                        noteId: childNote.noteId,
                        title: childNote.title,
                        itemCount
                    });
                }
            }

            taxonomy.push(space);
        }

        return taxonomy;
    }

    /**
     * Detect content type from URL patterns
     */
    private detectContentType(url: string, title: string): ContentType {
        const urlLower = url.toLowerCase();
        const titleLower = title.toLowerCase();

        // YouTube
        if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
            return 'youtube';
        }

        // GitHub
        if (urlLower.includes('github.com')) {
            return 'github';
        }

        // Twitter/X
        if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
            return 'tweet';
        }

        // Academic papers
        if (urlLower.includes('arxiv.org') ||
            urlLower.includes('doi.org') ||
            urlLower.includes('scholar.google') ||
            urlLower.endsWith('.pdf') ||
            titleLower.includes('paper') ||
            titleLower.includes('research')) {
            return 'paper';
        }

        // Podcasts
        if (urlLower.includes('podcast') ||
            urlLower.includes('spotify.com/episode') ||
            urlLower.includes('anchor.fm') ||
            urlLower.includes('podcasts.apple.com')) {
            return 'podcast';
        }

        // Images
        if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
            return 'image';
        }

        // Tools/Apps
        if (titleLower.includes('tool') ||
            titleLower.includes('app') ||
            urlLower.includes('app.')) {
            return 'tool';
        }

        // Default to article for most web content
        if (url) {
            return 'article';
        }

        return 'other';
    }

    /**
     * Use AI to categorize the content
     */
    private async aiCategorize(
        title: string,
        url: string,
        content: string,
        contentType: ContentType,
        taxonomy: TaxonomySpace[]
    ): Promise<AutoCategorizationResult> {
        const aiService = await aiServiceManager.getService();

        // Build taxonomy context for AI
        const taxonomyJson = JSON.stringify(taxonomy, null, 2);

        // Truncate content if too long
        const maxContentLength = 4000;
        const truncatedContent = content.length > maxContentLength
            ? content.substring(0, maxContentLength) + '...[truncated]'
            : content;

        const systemPrompt = `You are a knowledge organization assistant for Decant, a Toby-like knowledge curation system.

Your task is to analyze content and determine optimal placement in a hierarchical taxonomy:
- Spaces (top-level categories like "Development", "Research", "Learning", "Entertainment")
- Collections (groups within spaces like "JavaScript", "Python" in "Development")
- Items (individual bookmarks/articles)

You should:
1. Match content to the most appropriate existing Space and Collection
2. Suggest creating a new Collection if none fit well (within an existing Space)
3. Generate relevant tags for discovery
4. Create a concise 2-sentence summary
5. Extract 3-5 key points
6. Provide a confidence score (0-1) for your placement decision

If no Spaces exist yet, suggest appropriate Space and Collection names to create.`;

        const userPrompt = `Analyze this content and categorize it:

**Title:** ${title}
**URL:** ${url || 'N/A'}
**Detected Type:** ${contentType}

**Content:**
${truncatedContent}

**Current Taxonomy:**
${taxonomy.length > 0 ? taxonomyJson : 'No Spaces or Collections exist yet. Suggest appropriate names to create.'}

Respond with a JSON object containing:
{
  "suggestedSpaceId": "noteId or null if creating new",
  "suggestedSpaceName": "Name of the Space",
  "suggestedCollectionId": "noteId or null if creating new",
  "suggestedCollectionName": "Name of the Collection",
  "createNewCollection": true/false,
  "newCollectionName": "Name if creating new (optional)",
  "contentType": "${contentType}",
  "suggestedTags": ["tag1", "tag2", ...],
  "summary": "2-sentence summary",
  "keyPoints": ["point1", "point2", ...],
  "confidence": 0.0-1.0
}`;

        const messages = [
            { role: 'system' as const, content: systemPrompt },
            { role: 'user' as const, content: userPrompt }
        ];

        const completion = await aiService.generateChatCompletion(messages, {
            temperature: SEARCH_CONSTANTS.TEMPERATURE.QUERY_PROCESSOR,
            maxTokens: SEARCH_CONSTANTS.LIMITS.DEFAULT_MAX_TOKENS
        });

        // Parse the AI response
        const responseText = completion.text || '';

        try {
            // Extract JSON from response (handle markdown code blocks)
            let jsonStr = responseText;
            const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                jsonStr = jsonMatch[1].trim();
            } else {
                // Try to find JSON object directly
                const objectMatch = responseText.match(/\{[\s\S]*\}/);
                if (objectMatch) {
                    jsonStr = objectMatch[0];
                }
            }

            const result = JSON.parse(jsonStr) as AutoCategorizationResult;

            // Validate and sanitize the result
            return {
                suggestedSpaceId: result.suggestedSpaceId || null,
                suggestedSpaceName: result.suggestedSpaceName || 'Uncategorized',
                suggestedCollectionId: result.suggestedCollectionId || null,
                suggestedCollectionName: result.suggestedCollectionName || 'General',
                createNewCollection: Boolean(result.createNewCollection),
                newCollectionName: result.newCollectionName,
                contentType: result.contentType || contentType,
                suggestedTags: Array.isArray(result.suggestedTags) ? result.suggestedTags : [],
                summary: result.summary || '',
                keyPoints: Array.isArray(result.keyPoints) ? result.keyPoints : [],
                confidence: typeof result.confidence === 'number'
                    ? Math.max(0, Math.min(1, result.confidence))
                    : 0.5
            };

        } catch (parseError) {
            log.error(`Failed to parse AI categorization response: ${parseError}`);
            log.info(`Raw response: ${responseText.substring(0, 500)}`);

            // Return a fallback result
            return {
                suggestedSpaceId: null,
                suggestedSpaceName: 'Uncategorized',
                suggestedCollectionId: null,
                suggestedCollectionName: 'Inbox',
                createNewCollection: true,
                contentType,
                suggestedTags: [],
                summary: `Content about: ${title}`,
                keyPoints: [],
                confidence: 0.3
            };
        }
    }
}
