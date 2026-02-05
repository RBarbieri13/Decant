/**
 * Firecrawl Content Extractor
 *
 * Extracts articles, PDFs, and documentation sites using Firecrawl API.
 * Falls back to existing scraper service when API is unavailable.
 */

import FirecrawlApp from '@mendable/firecrawl-js';
import {
    type ContentExtractor,
    type ExtractorOptions,
    type ExtractorResult,
    type FirecrawlScrapeResult,
    ExtractionErrorCode
} from './types.js';
import {
    createSuccessResult,
    createErrorResult,
    parseDomain,
    validateUrlSafety,
    retryWithBackoff,
    isRetryableError,
    cleanMarkdown,
    estimateReadingTime
} from './base_extractor.js';
import log from '../log.js';

export class FirecrawlExtractor implements ContentExtractor {
    readonly contentType = 'article';
    readonly requiresApiKey = false;  // Can fallback to scraping

    private firecrawlClient: FirecrawlApp | null = null;

    /**
     * Check if this extractor can handle the URL
     */
    canHandle(url: string): boolean {
        // Firecrawl handles most web content except specialized platforms
        const domain = parseDomain(url);

        // Exclude content types handled by other extractors
        const excludedDomains = [
            'youtube.com',
            'youtu.be',
            'github.com',
            'twitter.com',
            'x.com'
        ];

        return !excludedDomains.some(excluded => domain.includes(excluded));
    }

    /**
     * Initialize Firecrawl client if API key is available
     */
    private initializeClient(apiKey?: string): void {
        if (!apiKey) {
            this.firecrawlClient = null;
            return;
        }

        try {
            this.firecrawlClient = new FirecrawlApp({ apiKey });
            log.info('Firecrawl client initialized successfully');
        } catch (error) {
            log.error('Failed to initialize Firecrawl client:', error);
            this.firecrawlClient = null;
        }
    }

    /**
     * Extract content from URL using Firecrawl
     */
    async extract(url: string, options?: ExtractorOptions): Promise<ExtractorResult> {
        const startTime = Date.now();

        // Validate URL safety
        const safetyCheck = validateUrlSafety(url);
        if (!safetyCheck.safe) {
            return createErrorResult(
                ExtractionErrorCode.SSRF_BLOCKED,
                safetyCheck.reason || 'URL blocked by safety check',
                false
            );
        }

        // Initialize client if API key provided
        this.initializeClient(options?.apiKeys?.firecrawl);

        // Try Firecrawl API first
        if (this.firecrawlClient) {
            try {
                const result = await this.extractWithFirecrawl(url, options);
                if (result.success) {
                    return result;
                }

                // If API failed but error is not recoverable, return error
                if (result.error && !result.error.recoverable) {
                    return result;
                }

                log.info(`Firecrawl extraction failed (${result.error?.code}), falling back to scraper`);
            } catch (error) {
                log.error('Firecrawl extraction error:', error);
                // Continue to fallback
            }
        }

        // Fallback to existing scraper (to be implemented)
        return this.extractWithFallback(url, startTime);
    }

    /**
     * Extract using Firecrawl API
     */
    private async extractWithFirecrawl(
        url: string,
        options?: ExtractorOptions
    ): Promise<ExtractorResult> {
        const startTime = Date.now();

        if (!this.firecrawlClient) {
            return createErrorResult(
                ExtractionErrorCode.INVALID_API_KEY,
                'Firecrawl client not initialized',
                true
            );
        }

        try {
            // Use retry wrapper for network resilience
            const response = await retryWithBackoff(
                async () => {
                    return await this.firecrawlClient!.scrapeUrl(url, {
                        formats: ['markdown', 'html'],
                        onlyMainContent: true,
                        timeout: options?.timeout || 30000,
                        waitFor: 2000  // Wait for JS to render
                    });
                },
                3,
                isRetryableError
            );

            if (!response.success || !response.markdown) {
                return createErrorResult(
                    ExtractionErrorCode.PARSING_ERROR,
                    'Firecrawl returned no content',
                    true
                );
            }

            // Extract and clean content
            const markdown = cleanMarkdown(response.markdown);
            const wordCount = markdown.split(/\s+/).length;
            const readingTime = estimateReadingTime(wordCount);

            const processingTimeMs = Date.now() - startTime;

            return createSuccessResult(
                {
                    content: markdown,
                    html: response.html,
                    title: response.metadata?.title || '',
                    description: response.metadata?.description || '',
                    author: response.metadata?.author || '',
                    publishedAt: response.metadata?.publishedTime || '',
                    siteName: response.metadata?.siteName || '',
                    favicon: response.metadata?.favicon || '',
                    language: response.metadata?.language || '',
                    wordCount,
                    readingTime,
                    excerpt: response.metadata?.description || markdown.substring(0, 200)
                },
                {
                    extractionMethod: 'api_premium',
                    apiUsed: 'Firecrawl',
                    confidence: 0.9,
                    cost: 0.001,  // Approximate cost per scrape (varies by plan)
                    processingTimeMs
                }
            );
        } catch (error: any) {
            // Map error types to extraction error codes
            if (error.message?.includes('Rate limit')) {
                return createErrorResult(
                    ExtractionErrorCode.RATE_LIMIT_EXCEEDED,
                    'Firecrawl rate limit exceeded',
                    true,
                    error
                );
            }

            if (error.message?.includes('Invalid API key') || error.message?.includes('Unauthorized')) {
                return createErrorResult(
                    ExtractionErrorCode.INVALID_API_KEY,
                    'Invalid Firecrawl API key',
                    false,
                    error
                );
            }

            if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
                return createErrorResult(
                    ExtractionErrorCode.NETWORK_TIMEOUT,
                    'Request timed out',
                    true,
                    error
                );
            }

            if (error.status === 404 || error.message?.includes('not found')) {
                return createErrorResult(
                    ExtractionErrorCode.CONTENT_NOT_FOUND,
                    'Content not found',
                    false,
                    error
                );
            }

            return createErrorResult(
                ExtractionErrorCode.UNKNOWN_ERROR,
                `Firecrawl extraction failed: ${error.message}`,
                true,
                error
            );
        }
    }

    /**
     * Fallback to existing scraper service
     */
    private async extractWithFallback(url: string, startTime: number): Promise<ExtractorResult> {
        try {
            // TODO: Import and use existing scraper from decant-standalone/src/backend/services/scraper.ts
            // For now, return minimal metadata
            log.info('Fallback scraper not yet implemented, returning minimal metadata');

            const domain = parseDomain(url);

            return createSuccessResult(
                {
                    content: '',
                    title: domain,
                    description: '',
                    wordCount: 0,
                    excerpt: ''
                },
                {
                    extractionMethod: 'fallback',
                    apiUsed: 'None',
                    confidence: 0.3,
                    processingTimeMs: Date.now() - startTime
                }
            );
        } catch (error: any) {
            return createErrorResult(
                ExtractionErrorCode.UNKNOWN_ERROR,
                `Fallback scraper failed: ${error.message}`,
                false,
                error
            );
        }
    }

    /**
     * Crawl entire site (for documentation, etc.)
     */
    async crawlSite(
        url: string,
        options?: ExtractorOptions & { maxPages?: number; depth?: number }
    ): Promise<ExtractorResult> {
        if (!this.firecrawlClient) {
            this.initializeClient(options?.apiKeys?.firecrawl);
        }

        if (!this.firecrawlClient) {
            return createErrorResult(
                ExtractionErrorCode.INVALID_API_KEY,
                'Firecrawl API key required for site crawling',
                false
            );
        }

        const startTime = Date.now();

        try {
            const response = await this.firecrawlClient.crawlUrl(url, {
                limit: options?.maxPages || 10,
                scrapeOptions: {
                    formats: ['markdown'],
                    onlyMainContent: true
                }
            });

            if (!response.success || !response.data) {
                return createErrorResult(
                    ExtractionErrorCode.PARSING_ERROR,
                    'Crawl returned no data',
                    true
                );
            }

            // Aggregate content from all pages
            const pages = response.data.map((page: any) => ({
                url: page.metadata?.sourceURL || '',
                title: page.metadata?.title || '',
                content: cleanMarkdown(page.markdown || '')
            }));

            const totalWordCount = pages.reduce(
                (sum: number, page: any) => sum + (page.content?.split(/\s+/).length || 0),
                0
            );

            const processingTimeMs = Date.now() - startTime;

            return createSuccessResult(
                {
                    pages,
                    totalPages: pages.length,
                    totalWordCount,
                    siteName: parseDomain(url)
                },
                {
                    extractionMethod: 'api_premium',
                    apiUsed: 'Firecrawl (crawl)',
                    confidence: 0.9,
                    cost: pages.length * 0.001,  // Cost per page
                    processingTimeMs
                }
            );
        } catch (error: any) {
            return createErrorResult(
                ExtractionErrorCode.UNKNOWN_ERROR,
                `Site crawl failed: ${error.message}`,
                true,
                error
            );
        }
    }

    /**
     * Validate Firecrawl API key
     */
    async validateApiKey(apiKey: string): Promise<boolean> {
        try {
            const testClient = new FirecrawlApp({ apiKey });

            // Try a simple scrape to test the key
            const response = await testClient.scrapeUrl('https://example.com', {
                formats: ['markdown']
            });

            return response.success;
        } catch (error) {
            log.error('Firecrawl API key validation failed:', error);
            return false;
        }
    }
}
