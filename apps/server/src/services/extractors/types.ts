/**
 * Phase 2 Content Extractor Types
 *
 * Defines interfaces for the quality-optimized content extraction pipeline.
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

export type ExtractionMethod =
    | 'api_premium'    // Gemini Pro, Firecrawl with deep crawling
    | 'api_standard'   // Gemini Flash, basic Firecrawl scrape
    | 'scraping'       // Cheerio-based fallback
    | 'fallback';      // Minimal URL parsing only

export type GeminiTier = 'pro' | 'flash' | 'auto';

export interface ContentMetadata {
    url: string;
    domain: string;
    contentType: ContentType;
    wordCount?: number;
    hasMultipleSpeakers?: boolean;
    hasSlides?: boolean;
    hasCodeBlocks?: boolean;
    isTechnical?: boolean;
    language?: string;
}

export interface ExtractorOptions {
    apiKeys: {
        firecrawl?: string;
        gemini?: string;
        youtube?: string;
        github?: string;
    };
    timeout?: number;
    useFallback?: boolean;
    geminiTier?: GeminiTier;
}

export interface ExtractorResult {
    success: boolean;
    data?: Record<string, any>;  // Content-type-specific fields
    metadata: {
        extractionMethod: ExtractionMethod;
        apiUsed?: string;
        confidence: number;
        timestamp: string;
        cost?: number;  // API cost in USD
        processingTimeMs?: number;
    };
    error?: {
        code: string;
        message: string;
        recoverable: boolean;
        originalError?: Error;
    };
}

export interface ContentExtractor {
    readonly contentType: ContentType;
    readonly requiresApiKey: boolean;

    /**
     * Check if this extractor can handle the given URL
     */
    canHandle(url: string): boolean;

    /**
     * Extract content from the URL
     */
    extract(url: string, options?: ExtractorOptions): Promise<ExtractorResult>;

    /**
     * Validate API key (if required)
     */
    validateApiKey?(apiKey: string): Promise<boolean>;

    /**
     * Get estimated cost for processing this content
     */
    estimateCost?(metadata: ContentMetadata): number;
}

/**
 * Firecrawl-specific types
 */
export interface FirecrawlScrapeResult {
    markdown: string;
    metadata?: {
        title?: string;
        description?: string;
        author?: string;
        publishedDate?: string;
        language?: string;
        siteName?: string;
        favicon?: string;
    };
    html?: string;
    screenshot?: string;  // Base64 or URL
}

export interface FirecrawlCrawlResult {
    pages: FirecrawlScrapeResult[];
    totalPages: number;
    completedPages: number;
}

/**
 * Gemini-specific types
 */
export interface GeminiProcessingResult {
    summary: string;
    taxonomy: string[];  // 5-level hierarchical tags
    keyConcepts: string[];
    transcript?: string;
    visualElements?: {
        slideText?: string[];
        diagrams?: string[];
        codeSnippets?: string[];
    };
    mermaidDiagram?: string;
}

/**
 * YouTube-specific types
 */
export interface YouTubeMetadata {
    videoId: string;
    title: string;
    description: string;
    channelName: string;
    channelId: string;
    duration: number;  // seconds
    views: number;
    likes?: number;
    publishedAt: string;
    category: string;
    tags: string[];
    thumbnails: {
        default: string;
        medium: string;
        high: string;
        maxres?: string;
    };
}

/**
 * GitHub-specific types
 */
export interface GitHubRepositoryMetadata {
    repoOwner: string;
    repoName: string;
    description: string;
    stars: number;
    forks: number;
    language: string;
    languages: Record<string, number>;  // language -> bytes
    license?: string;
    topics: string[];
    lastCommit: string;
    readme: string;  // Markdown content
    homepageUrl?: string;
    isArchived: boolean;
    isFork: boolean;
}

/**
 * Error codes for extraction failures
 */
export enum ExtractionErrorCode {
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    INVALID_API_KEY = 'INVALID_API_KEY',
    NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
    CONTENT_NOT_FOUND = 'CONTENT_NOT_FOUND',
    PARSING_ERROR = 'PARSING_ERROR',
    SSRF_BLOCKED = 'SSRF_BLOCKED',
    COST_BUDGET_EXCEEDED = 'COST_BUDGET_EXCEEDED',
    UNSUPPORTED_CONTENT_TYPE = 'UNSUPPORTED_CONTENT_TYPE',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}
