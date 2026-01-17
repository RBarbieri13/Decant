/**
 * Decant - Metadata Extraction Service
 *
 * Fetches URL content and uses AI to extract structured metadata
 */

import log from "../log.js";
import aiProvider from "./ai_provider.js";
import type {
    ResourceMetadata,
    MetadataExtractionRequest,
    MetadataExtractionResponse,
    DEFAULT_METADATA,
    FUNCTION_HIERARCHIES,
    ORGANIZATION_HIERARCHIES,
} from "./types.js";

// Import the constants properly
import { DEFAULT_METADATA as defaultMeta, FUNCTION_HIERARCHIES as funcHierarchies, ORGANIZATION_HIERARCHIES as orgHierarchies } from "./types.js";

/**
 * Simple in-memory cache for extracted metadata
 * In production, this should be persisted to the database
 */
const metadataCache = new Map<string, { metadata: ResourceMetadata; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch content from a URL with proper error handling
 */
async function fetchUrlContent(url: string): Promise<{ html: string; finalUrl: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
            redirect: 'follow',
        });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();
        const finalUrl = response.url || url;

        return { html, finalUrl };
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Extract basic metadata from HTML (title, description, og tags, etc.)
 */
function extractBasicMetadata(html: string, url: string): Partial<ResourceMetadata> {
    const metadata: Partial<ResourceMetadata> = { url };

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
        metadata.title = titleMatch[1].trim();
    }

    // Extract meta description
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    if (descMatch) {
        metadata.description = descMatch[1].trim();
    }

    // Extract Open Graph data
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    if (ogTitleMatch && !metadata.title) {
        metadata.title = ogTitleMatch[1].trim();
    }

    const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    if (ogDescMatch && !metadata.description) {
        metadata.description = ogDescMatch[1].trim();
    }

    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (ogImageMatch) {
        metadata.logo = ogImageMatch[1].trim();
    }

    // Extract favicon
    if (!metadata.logo) {
        const faviconMatch = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/i) ||
                            html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["']/i);
        if (faviconMatch) {
            let favicon = faviconMatch[1].trim();
            // Convert relative URLs to absolute
            if (favicon.startsWith('/')) {
                const urlObj = new URL(url);
                favicon = `${urlObj.protocol}//${urlObj.host}${favicon}`;
            } else if (!favicon.startsWith('http')) {
                const urlObj = new URL(url);
                favicon = `${urlObj.protocol}//${urlObj.host}/${favicon}`;
            }
            metadata.logo = favicon;
        }
    }

    // Extract keywords as potential tags
    const keywordsMatch = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i);
    if (keywordsMatch) {
        metadata.tags = keywordsMatch[1].split(',').map(k => k.trim()).filter(k => k.length > 0);
    }

    return metadata;
}

/**
 * Truncate HTML content to reduce token usage
 */
function truncateHtml(html: string, maxLength: number = 15000): string {
    // Remove scripts, styles, and comments
    let cleaned = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (cleaned.length > maxLength) {
        cleaned = cleaned.substring(0, maxLength) + '...';
    }

    return cleaned;
}

/**
 * Build the AI prompt for metadata extraction
 */
function buildExtractionPrompt(basicMetadata: Partial<ResourceMetadata>, htmlContent: string, context?: string): string {
    const functionCodes = funcHierarchies.map(h => `${h.code}: ${h.name} - ${h.description}`).join('\n');
    const orgCodes = orgHierarchies.map(h => `${h.code}: ${h.name} - ${h.description}`).join('\n');

    return `You are a metadata extraction expert. Analyze the following webpage and extract structured metadata.

## Basic Information Already Extracted:
- URL: ${basicMetadata.url}
- Title: ${basicMetadata.title || 'Not found'}
- Description: ${basicMetadata.description || 'Not found'}
${context ? `- Additional Context: ${context}` : ''}

## Page Content (truncated):
${htmlContent}

## Available Function Hierarchy Codes:
${functionCodes}

## Available Organization Hierarchy Codes:
${orgCodes}

## Your Task:
Extract the following metadata and respond ONLY with a valid JSON object (no markdown, no explanation):

{
  "title": "The resource's name/title",
  "function": "Primary function/purpose (e.g., 'Design Tool', 'Analytics Platform', 'Code Editor')",
  "category": "Main category (Software, Service, Framework, Library, Platform, Tool, Resource)",
  "subCategory": "More specific sub-category",
  "parentOrganization": "Company/organization that owns/operates this",
  "logo": "${basicMetadata.logo || 'null'}" (keep existing or null),
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"] (5-10 relevant tags),
  "differentiation": "What makes this unique compared to similar resources (1-2 sentences)",
  "functionHierarchyCode": "Best matching code from the function hierarchy list above",
  "organizationHierarchyCode": "Best matching code from the organization hierarchy list above",
  "description": "A concise description of what this resource is/does (2-3 sentences)"
}

Important:
- Use the MOST SPECIFIC hierarchy code that applies
- Tags should be lowercase, single words or hyphenated phrases
- Be concise but informative
- If unsure about something, make your best guess based on available information
- ONLY output valid JSON, nothing else`;
}

/**
 * Parse AI response and extract JSON
 */
function parseAIResponse(response: string): Partial<ResourceMetadata> {
    // Try to extract JSON from the response
    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    try {
        const parsed = JSON.parse(jsonStr);
        return {
            title: parsed.title || '',
            function: parsed.function || '',
            category: parsed.category || 'Other',
            subCategory: parsed.subCategory || '',
            parentOrganization: parsed.parentOrganization || '',
            logo: parsed.logo === 'null' ? null : parsed.logo,
            tags: Array.isArray(parsed.tags) ? parsed.tags : [],
            differentiation: parsed.differentiation || '',
            functionHierarchyCode: parsed.functionHierarchyCode || 'OTHER',
            organizationHierarchyCode: parsed.organizationHierarchyCode || 'OTHER',
            description: parsed.description || '',
        };
    } catch (error) {
        log.error(`Failed to parse AI response: ${error}`);
        log.error(`Response was: ${response.substring(0, 500)}`);
        throw new Error('Failed to parse AI response as JSON');
    }
}

/**
 * Extract metadata from a URL
 */
async function extractMetadata(request: MetadataExtractionRequest): Promise<MetadataExtractionResponse> {
    const { url, forceRefresh = false, context } = request;

    log.info(`Extracting metadata for URL: ${url}`);

    // Check cache first
    if (!forceRefresh) {
        const cached = metadataCache.get(url);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            log.info(`Returning cached metadata for: ${url}`);
            return {
                success: true,
                metadata: cached.metadata,
                cached: true,
            };
        }
    }

    try {
        // Initialize AI provider
        await aiProvider.initialize();

        // Fetch URL content
        log.info(`Fetching URL content: ${url}`);
        const { html, finalUrl } = await fetchUrlContent(url);

        // Extract basic metadata from HTML
        const basicMetadata = extractBasicMetadata(html, finalUrl);
        log.info(`Basic metadata extracted: ${basicMetadata.title}`);

        // Truncate HTML for AI processing
        const truncatedContent = truncateHtml(html);

        // Build and send AI prompt
        const prompt = buildExtractionPrompt(basicMetadata, truncatedContent, context);

        log.info(`Sending to AI for analysis...`);
        const aiResponse = await aiProvider.createCompletion({
            messages: [
                {
                    role: 'system',
                    content: 'You are a metadata extraction expert. Always respond with valid JSON only, no markdown formatting or explanations.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.2,
            maxTokens: 1500,
        });

        // Parse AI response
        const aiMetadata = parseAIResponse(aiResponse.content);

        // Merge basic and AI-extracted metadata
        const metadata: ResourceMetadata = {
            ...defaultMeta,
            ...basicMetadata,
            ...aiMetadata,
            url: finalUrl,
            dateAdded: new Date().toISOString(),
        };

        // Cache the result
        metadataCache.set(url, { metadata, timestamp: Date.now() });

        log.info(`Metadata extraction complete for: ${metadata.title}`);

        return {
            success: true,
            metadata,
            cached: false,
        };

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        log.error(`Metadata extraction failed for ${url}: ${message}`);

        return {
            success: false,
            error: message,
        };
    }
}

/**
 * Clear metadata cache
 */
function clearCache(url?: string): void {
    if (url) {
        metadataCache.delete(url);
    } else {
        metadataCache.clear();
    }
}

/**
 * Get cache statistics
 */
function getCacheStats(): { size: number; urls: string[] } {
    return {
        size: metadataCache.size,
        urls: Array.from(metadataCache.keys()),
    };
}

export default {
    extractMetadata,
    clearCache,
    getCacheStats,
    fetchUrlContent,
    extractBasicMetadata,
};

export {
    extractMetadata,
    clearCache,
    getCacheStats,
    fetchUrlContent,
    extractBasicMetadata,
};
