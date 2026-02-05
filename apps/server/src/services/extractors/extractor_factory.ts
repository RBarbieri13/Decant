/**
 * Extractor Factory
 *
 * Smart routing system that selects the appropriate extractor for each URL.
 * Coordinates content extraction across multiple specialized extractors.
 */

import {
    type ContentExtractor,
    type ExtractorOptions,
    type ExtractorResult,
    type ContentType,
    ExtractionErrorCode
} from './types.js';
import {
    createErrorResult,
    parseDomain
} from './base_extractor.js';
import { FirecrawlExtractor } from './firecrawl_extractor.js';
import { YouTubeExtractor } from './youtube_extractor.js';
import { GitHubExtractor } from './github_extractor.js';
import { MediaProcessor } from './media_processor.js';
import { GeminiProcessor } from './gemini_processor.js';
import log from '../log.js';

export class ExtractorFactory {
    private extractors: Map<ContentType, ContentExtractor>;
    private mediaProcessor: MediaProcessor;
    private geminiProcessor: GeminiProcessor;

    constructor() {
        this.extractors = new Map();
        this.mediaProcessor = new MediaProcessor();
        this.geminiProcessor = new GeminiProcessor();

        // Register specialized extractors
        this.registerExtractor(new FirecrawlExtractor());
        this.registerExtractor(new YouTubeExtractor());
        this.registerExtractor(new GitHubExtractor());
    }

    /**
     * Register an extractor
     */
    private registerExtractor(extractor: ContentExtractor): void {
        this.extractors.set(extractor.contentType, extractor);
        log.info(`Registered extractor for content type: ${extractor.contentType}`);
    }

    /**
     * Detect content type from URL
     */
    detectContentType(url: string): ContentType {
        const domain = parseDomain(url);

        // YouTube
        if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
            return 'youtube';
        }

        // GitHub
        if (domain === 'github.com') {
            return 'github';
        }

        // Twitter/X
        if (domain.includes('twitter.com') || domain === 'x.com') {
            return 'tweet';
        }

        // Default to article for most web content
        return 'article';
    }

    /**
     * Get appropriate extractor for URL
     */
    getExtractor(url: string): ContentExtractor | null {
        const contentType = this.detectContentType(url);

        // Check if we have a registered extractor for this content type
        const extractor = this.extractors.get(contentType);
        if (extractor && extractor.canHandle(url)) {
            return extractor;
        }

        // Fallback to article extractor for unknown types
        return this.extractors.get('article') || null;
    }

    /**
     * Extract content from URL using appropriate extractor
     */
    async extract(url: string, options?: ExtractorOptions): Promise<ExtractorResult> {
        const contentType = this.detectContentType(url);
        log.info(`Extracting content (type: ${contentType}): ${url}`);

        try {
            // Special handling for YouTube videos (coordinate metadata + media processing)
            if (contentType === 'youtube') {
                return await this.mediaProcessor.processYouTubeVideo(url, options);
            }

            // Get appropriate extractor
            const extractor = this.getExtractor(url);
            if (!extractor) {
                return createErrorResult(
                    ExtractionErrorCode.UNSUPPORTED_CONTENT_TYPE,
                    `No extractor available for content type: ${contentType}`,
                    false
                );
            }

            // Extract base content
            const extractionResult = await extractor.extract(url, options);

            if (!extractionResult.success) {
                return extractionResult;
            }

            // Enhance with Gemini analysis if API key is available
            if (options?.apiKeys?.gemini && extractionResult.data) {
                try {
                    const enhanced = await this.enhanceWithGemini(
                        extractionResult,
                        contentType,
                        options
                    );

                    if (enhanced) {
                        return enhanced;
                    }
                } catch (error) {
                    log.warn('Gemini enhancement failed, returning base extraction:', error);
                    // Return base extraction result
                }
            }

            return extractionResult;
        } catch (error: any) {
            log.error('Extraction error:', error);

            return createErrorResult(
                ExtractionErrorCode.UNKNOWN_ERROR,
                `Extraction failed: ${error.message}`,
                true,
                error
            );
        }
    }

    /**
     * Enhance extraction result with Gemini analysis
     */
    private async enhanceWithGemini(
        extractionResult: ExtractorResult,
        contentType: ContentType,
        options: ExtractorOptions
    ): Promise<ExtractorResult | null> {
        if (!extractionResult.data || !options.apiKeys?.gemini) {
            return null;
        }

        try {
            this.geminiProcessor.initialize(options.apiKeys.gemini);

            const content = extractionResult.data.content ||
                           extractionResult.data.readme ||
                           extractionResult.data.description ||
                           '';

            if (!content || content.length < 100) {
                // Not enough content to analyze
                return null;
            }

            // Build content metadata
            const metadata = {
                url: extractionResult.data.url || '',
                domain: parseDomain(extractionResult.data.url || ''),
                contentType,
                wordCount: extractionResult.data.wordCount,
                isTechnical: this.detectTechnicalContent(content),
                language: extractionResult.data.language
            };

            // Process with Gemini
            const geminiResult = await this.geminiProcessor.processText(
                content,
                metadata,
                options.geminiTier || 'auto'
            );

            // Merge Gemini results with base extraction
            return {
                ...extractionResult,
                data: {
                    ...extractionResult.data,
                    summary: geminiResult.summary,
                    taxonomy: geminiResult.taxonomy,
                    keyConcepts: geminiResult.keyConcepts,
                    mermaidDiagram: geminiResult.mermaidDiagram
                },
                metadata: {
                    ...extractionResult.metadata,
                    extractionMethod: 'api_premium',
                    apiUsed: `${extractionResult.metadata.apiUsed || 'Base'} + Gemini`,
                    cost: (extractionResult.metadata.cost || 0) + geminiResult.cost
                }
            };
        } catch (error) {
            log.error('Gemini enhancement error:', error);
            return null;  // Return null to use base extraction
        }
    }

    /**
     * Detect if content is technical
     */
    private detectTechnicalContent(content: string): boolean {
        const technicalIndicators = [
            /```[\s\S]*?```/g,  // Code blocks
            /`[^`]+`/g,          // Inline code
            /function\s+\w+/g,   // Function declarations
            /class\s+\w+/g,      // Class declarations
            /import\s+/g,        // Import statements
            /<[^>]+>/g           // HTML/XML tags
        ];

        const text = content.substring(0, 5000);  // Sample first 5000 chars
        return technicalIndicators.some(pattern => pattern.test(text));
    }

    /**
     * Batch extraction for multiple URLs
     */
    async extractBatch(
        urls: string[],
        options?: ExtractorOptions
    ): Promise<Map<string, ExtractorResult>> {
        const results = new Map<string, ExtractorResult>();

        // Process URLs in parallel (with concurrency limit)
        const concurrency = 5;
        const chunks: string[][] = [];

        for (let i = 0; i < urls.length; i += concurrency) {
            chunks.push(urls.slice(i, i + concurrency));
        }

        for (const chunk of chunks) {
            const promises = chunk.map(async (url) => {
                try {
                    const result = await this.extract(url, options);
                    results.set(url, result);
                } catch (error: any) {
                    results.set(url, createErrorResult(
                        ExtractionErrorCode.UNKNOWN_ERROR,
                        `Extraction failed: ${error.message}`,
                        true,
                        error
                    ));
                }
            });

            await Promise.all(promises);
        }

        return results;
    }

    /**
     * Validate all configured API keys
     */
    async validateApiKeys(options: ExtractorOptions): Promise<Record<string, boolean>> {
        const validation: Record<string, boolean> = {};

        // Validate Firecrawl
        if (options.apiKeys.firecrawl) {
            const firecrawl = this.extractors.get('article') as FirecrawlExtractor;
            if (firecrawl && firecrawl.validateApiKey) {
                validation.firecrawl = await firecrawl.validateApiKey(options.apiKeys.firecrawl);
            }
        }

        // Validate YouTube
        if (options.apiKeys.youtube) {
            const youtube = this.extractors.get('youtube') as YouTubeExtractor;
            if (youtube && youtube.validateApiKey) {
                validation.youtube = await youtube.validateApiKey(options.apiKeys.youtube);
            }
        }

        // Validate GitHub
        if (options.apiKeys.github) {
            const github = this.extractors.get('github') as GitHubExtractor;
            if (github && github.validateApiKey) {
                validation.github = await github.validateApiKey(options.apiKeys.github);
            }
        }

        // Validate Gemini
        if (options.apiKeys.gemini) {
            validation.gemini = await this.geminiProcessor.validateApiKey(options.apiKeys.gemini);
        }

        return validation;
    }

    /**
     * Get extraction statistics
     */
    getStats(): {
        registeredExtractors: string[];
        supportedContentTypes: ContentType[];
    } {
        return {
            registeredExtractors: Array.from(this.extractors.keys()),
            supportedContentTypes: Array.from(this.extractors.keys())
        };
    }
}

// Export singleton instance
export const extractorFactory = new ExtractorFactory();
