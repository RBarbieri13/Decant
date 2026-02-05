/**
 * AI Import Service
 *
 * Orchestrates the import of URLs with AI-powered auto-categorization.
 * This service handles the complete pipeline:
 * 1. Content type detection
 * 2. Content extraction (using appropriate extractor)
 * 3. AI categorization (via auto_categorize tool)
 * 4. Note creation with proper attributes
 * 5. Space/Collection creation if needed
 */

import type { AutoCategorizationResult, ContentType } from './llm/tools/auto_categorization_tool.js';
import { AutoCategorizationTool } from './llm/tools/auto_categorization_tool.js';
import log from './log.js';
import becca from '../becca/becca.js';
import notes from './notes.js';
import attributes from './attributes.js';
import htmlSanitizer from './html_sanitizer.js';
import type BNote from '../becca/entities/bnote.js';

/**
 * Options for AI import
 */
export interface AIImportOptions {
    /** Force a specific Space (if null, AI will decide) */
    spaceId?: string | null;
    /** Force a specific Collection (if null, AI will decide) */
    collectionId?: string | null;
    /** Skip AI categorization and use default/provided location */
    skipCategorization?: boolean;
    /** Custom title (if not provided, extracted from content) */
    title?: string;
}

/**
 * Result of AI import operation
 */
export interface AIImportResult {
    success: boolean;
    noteId: string;
    spaceId: string;
    spaceName: string;
    collectionId: string;
    collectionName: string;
    categorization: AutoCategorizationResult;
    processingTimeMs: number;
    error?: string;
}

/**
 * Extract basic metadata from a URL
 */
function extractMetadataFromUrl(url: string): { title: string; domain: string } {
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace('www.', '');

        // Try to extract a reasonable title from the URL
        let title = urlObj.pathname
            .split('/')
            .filter(segment => segment.length > 0)
            .pop() || domain;

        // Clean up the title
        title = title
            .replace(/[-_]/g, ' ')
            .replace(/\.(html|htm|php|asp|jsp)$/i, '')
            .trim();

        // Capitalize first letter
        title = title.charAt(0).toUpperCase() + title.slice(1);

        return { title, domain };
    } catch (error) {
        return { title: url, domain: '' };
    }
}

/**
 * Extract content from URL
 * Currently returns basic metadata - will be enhanced with content extractors in Phase 2
 */
async function extractContent(url: string, contentType: ContentType): Promise<{
    title: string;
    content: string;
    thumbnail?: string;
    favicon?: string;
}> {
    log.info(`Extracting content from ${url} (type: ${contentType})`);

    const { title, domain } = extractMetadataFromUrl(url);

    // Phase 2: Use specialized extractors for content extraction
    try {
        const { extractorFactory } = await import('./extractors/extractor_factory.js');

        // Get API keys from options
        const extractorOptions = {
            apiKeys: {
                firecrawl: await becca.getOption('firecrawlApiKey'),
                gemini: await becca.getOption('geminiApiKey'),
                youtube: await becca.getOption('youtubeApiKey'),
                github: await becca.getOption('githubAccessToken')
            },
            geminiTier: (await becca.getOption('geminiTier') || 'auto') as 'pro' | 'flash' | 'auto',
            timeout: 30000,
            useFallback: true
        };

        // Extract content using appropriate extractor
        const extractionResult = await extractorFactory.extract(url, extractorOptions);

        if (extractionResult.success && extractionResult.data) {
            const data = extractionResult.data;

            // Build content from extracted data
            let content = '';

            // Add summary if available
            if (data.summary) {
                content += `## Summary\n\n${data.summary}\n\n`;
            }

            // Add transcript if available (YouTube, podcasts)
            if (data.transcript) {
                content += `## Transcript\n\n${data.transcript}\n\n`;
            }

            // Add main content if available (articles, GitHub README)
            if (data.content) {
                content += `${data.content}\n\n`;
            } else if (data.readme) {
                content += `## README\n\n${data.readme}\n\n`;
            } else if (data.description) {
                content += `${data.description}\n\n`;
            }

            // Add visual elements if extracted from video
            if (data.visualElements) {
                if (data.visualElements.slideText && data.visualElements.slideText.length > 0) {
                    content += `## Slide Content\n\n${data.visualElements.slideText.join('\n\n')}\n\n`;
                }
                if (data.visualElements.codeSnippets && data.visualElements.codeSnippets.length > 0) {
                    content += `## Code Snippets\n\n${data.visualElements.codeSnippets.join('\n\n')}\n\n`;
                }
            }

            // Fallback to URL if no content extracted
            if (!content || content.trim().length === 0) {
                content = `Bookmarked from ${domain}\n\nURL: ${url}`;
            }

            return {
                title: data.title || title,
                content: content.trim(),
                favicon: data.favicon || `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
                thumbnail: data.thumbnails?.high || data.thumbnails?.medium || data.thumbnail
            };
        } else {
            // Extraction failed, log error and use fallback
            log.warn(`Content extraction failed: ${extractionResult.error?.message}`);
        }
    } catch (error) {
        log.error('Extractor initialization failed, using basic metadata:', error);
    }

    // Fallback: Return basic metadata if extraction failed
    return {
        title,
        content: `Bookmarked from ${domain}\n\nURL: ${url}\n\nContent extraction is in progress...`,
        favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
        thumbnail: undefined
    };
}

/**
 * Find or create a Space note
 */
function findOrCreateSpace(spaceName: string, spaceId: string | null): BNote {
    // If spaceId provided and exists, use it
    if (spaceId) {
        const existingSpace = becca.getNote(spaceId);
        if (existingSpace && existingSpace.getLabelValue('decantType') === 'space') {
            return existingSpace;
        }
    }

    // Look for existing Space with this name
    const spaces = attributes.getNotesWithLabel('decantType', 'space');
    const existingSpace = spaces.find(space =>
        space.title.toLowerCase() === spaceName.toLowerCase()
    );

    if (existingSpace) {
        log.info(`Found existing Space: ${existingSpace.title} (${existingSpace.noteId})`);
        return existingSpace;
    }

    // Create new Space under root
    log.info(`Creating new Space: ${spaceName}`);
    const rootNote = becca.getNote('root');
    if (!rootNote) {
        throw new Error('Root note not found');
    }

    const { note: spaceNote } = notes.createNewNote({
        parentNoteId: 'root',
        title: spaceName,
        content: `<p>Space for organizing ${spaceName} items</p>`,
        type: 'text'
    });

    // Mark as Space
    attributes.createLabel(spaceNote.noteId, 'decantType', 'space');
    attributes.createLabel(spaceNote.noteId, 'iconClass', 'bx bx-folder');

    log.info(`Created Space: ${spaceNote.title} (${spaceNote.noteId})`);
    return spaceNote;
}

/**
 * Find or create a Collection note within a Space
 */
function findOrCreateCollection(
    collectionName: string,
    collectionId: string | null,
    spaceNote: BNote
): BNote {
    // If collectionId provided and exists, use it
    if (collectionId) {
        const existingCollection = becca.getNote(collectionId);
        if (existingCollection &&
            existingCollection.getLabelValue('decantType') === 'collection' &&
            existingCollection.getParentNotes().some(p => p.noteId === spaceNote.noteId)) {
            return existingCollection;
        }
    }

    // Look for existing Collection with this name in this Space
    const childNotes = spaceNote.getChildNotes();
    const existingCollection = childNotes.find(child =>
        child.getLabelValue('decantType') === 'collection' &&
        child.title.toLowerCase() === collectionName.toLowerCase()
    );

    if (existingCollection) {
        log.info(`Found existing Collection: ${existingCollection.title} (${existingCollection.noteId})`);
        return existingCollection;
    }

    // Create new Collection
    log.info(`Creating new Collection: ${collectionName} in Space ${spaceNote.title}`);
    const { note: collectionNote } = notes.createNewNote({
        parentNoteId: spaceNote.noteId,
        title: collectionName,
        content: `<p>Collection for ${collectionName} items</p>`,
        type: 'text'
    });

    // Mark as Collection
    attributes.createLabel(collectionNote.noteId, 'decantType', 'collection');
    attributes.createLabel(collectionNote.noteId, 'iconClass', 'bx bx-collection');

    log.info(`Created Collection: ${collectionNote.title} (${collectionNote.noteId})`);
    return collectionNote;
}

/**
 * Create the item note with all attributes
 */
function createItemNote(
    collectionNote: BNote,
    title: string,
    url: string,
    content: string,
    categorization: AutoCategorizationResult,
    metadata: {
        thumbnail?: string;
        favicon?: string;
    }
): BNote {
    log.info(`Creating item note: ${title}`);

    // Sanitize HTML content
    const sanitizedContent = htmlSanitizer.sanitize(content);

    // Create the note
    const { note: itemNote } = notes.createNewNote({
        parentNoteId: collectionNote.noteId,
        title: htmlSanitizer.sanitize(title),
        content: sanitizedContent,
        type: 'text'
    });

    // Add Decant attributes
    attributes.createLabel(itemNote.noteId, 'decantType', 'item');
    attributes.createLabel(itemNote.noteId, 'sourceUrl', url);
    attributes.createLabel(itemNote.noteId, 'contentType', categorization.contentType);

    // Add metadata attributes
    if (metadata.favicon) {
        attributes.createLabel(itemNote.noteId, 'favicon', metadata.favicon);
    }

    if (metadata.thumbnail) {
        attributes.createLabel(itemNote.noteId, 'thumbnail', metadata.thumbnail);
    }

    // Add AI-generated attributes
    if (categorization.summary) {
        attributes.createLabel(itemNote.noteId, 'aiSummary', categorization.summary);
    }

    attributes.createLabel(itemNote.noteId, 'aiConfidence', categorization.confidence.toString());

    if (categorization.suggestedTags && categorization.suggestedTags.length > 0) {
        attributes.createLabel(itemNote.noteId, 'aiTags', categorization.suggestedTags.join(', '));

        // Also add individual tags for searchability
        for (const tag of categorization.suggestedTags) {
            attributes.createLabel(itemNote.noteId, tag.toLowerCase().replace(/\s+/g, '-'), '');
        }
    }

    // Add icon
    attributes.createLabel(itemNote.noteId, 'iconClass', 'bx bx-bookmark');

    log.info(`Created item note: ${itemNote.title} (${itemNote.noteId})`);
    return itemNote;
}

/**
 * Main AI import function
 */
export async function importUrl(
    url: string,
    options: AIImportOptions = {}
): Promise<AIImportResult> {
    const startTime = Date.now();

    try {
        log.info(`Starting AI import for URL: ${url}`);

        // Sanitize and validate URL
        const sanitizedUrl = htmlSanitizer.sanitizeUrl(url);
        if (!sanitizedUrl) {
            throw new Error('Invalid URL provided');
        }

        // Extract content (Phase 2 will use specialized extractors)
        const extracted = await extractContent(sanitizedUrl, 'article');
        const title = options.title || extracted.title;
        const content = extracted.content;

        let categorization: AutoCategorizationResult;

        if (options.skipCategorization && options.spaceId && options.collectionId) {
            // Skip AI categorization, use provided location
            log.info('Skipping AI categorization, using provided location');

            const space = becca.getNote(options.spaceId);
            const collection = becca.getNote(options.collectionId);

            if (!space || !collection) {
                throw new Error('Provided spaceId or collectionId not found');
            }

            categorization = {
                suggestedSpaceId: options.spaceId,
                suggestedSpaceName: space.title,
                suggestedCollectionId: options.collectionId,
                suggestedCollectionName: collection.title,
                createNewCollection: false,
                contentType: 'article',
                suggestedTags: [],
                summary: '',
                keyPoints: [],
                confidence: 1.0
            };
        } else {
            // Use AI to categorize
            log.info('Invoking AI categorization...');
            const autoCatTool = new AutoCategorizationTool();
            const catResult = await autoCatTool.execute({
                title,
                url: sanitizedUrl,
                content
            });

            if (typeof catResult === 'string') {
                throw new Error(`AI categorization failed: ${catResult}`);
            }

            categorization = catResult as unknown as AutoCategorizationResult;
        }

        // Find or create Space
        const spaceNote = findOrCreateSpace(
            categorization.suggestedSpaceName,
            options.spaceId || categorization.suggestedSpaceId
        );

        // Find or create Collection
        const collectionName = categorization.createNewCollection && categorization.newCollectionName
            ? categorization.newCollectionName
            : categorization.suggestedCollectionName;

        const collectionNote = findOrCreateCollection(
            collectionName,
            options.collectionId || categorization.suggestedCollectionId,
            spaceNote
        );

        // Create the item note
        const itemNote = createItemNote(
            collectionNote,
            title,
            sanitizedUrl,
            content,
            categorization,
            {
                thumbnail: extracted.thumbnail,
                favicon: extracted.favicon
            }
        );

        const processingTime = Date.now() - startTime;

        log.info(`AI import completed successfully in ${processingTime}ms - Note: ${itemNote.noteId}`);

        return {
            success: true,
            noteId: itemNote.noteId,
            spaceId: spaceNote.noteId,
            spaceName: spaceNote.title,
            collectionId: collectionNote.noteId,
            collectionName: collectionNote.title,
            categorization,
            processingTimeMs: processingTime
        };

    } catch (error: any) {
        const processingTime = Date.now() - startTime;
        log.error(`AI import failed: ${error.message || String(error)}`);

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
            processingTimeMs: processingTime,
            error: error.message || String(error)
        };
    }
}

export default {
    importUrl
};
