/**
 * Base Extractor Utilities
 *
 * Common utilities and helper functions for content extractors.
 */

import { ExtractionErrorCode, type ExtractorResult, type ContentMetadata, type GeminiTier } from './types.js';

/**
 * Create a success result
 */
export function createSuccessResult(
    data: Record<string, any>,
    metadata: {
        extractionMethod: ExtractorResult['metadata']['extractionMethod'];
        apiUsed?: string;
        confidence?: number;
        cost?: number;
        processingTimeMs?: number;
    }
): ExtractorResult {
    return {
        success: true,
        data,
        metadata: {
            extractionMethod: metadata.extractionMethod,
            apiUsed: metadata.apiUsed,
            confidence: metadata.confidence ?? 0.8,
            timestamp: new Date().toISOString(),
            cost: metadata.cost,
            processingTimeMs: metadata.processingTimeMs
        }
    };
}

/**
 * Create an error result
 */
export function createErrorResult(
    code: ExtractionErrorCode,
    message: string,
    recoverable: boolean = true,
    originalError?: Error
): ExtractorResult {
    return {
        success: false,
        metadata: {
            extractionMethod: 'fallback',
            confidence: 0,
            timestamp: new Date().toISOString()
        },
        error: {
            code,
            message,
            recoverable,
            originalError
        }
    };
}

/**
 * Parse domain from URL
 */
export function parseDomain(url: string): string {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch {
        return '';
    }
}

/**
 * Detect if content is complex enough to warrant premium processing
 */
export function isComplexContent(metadata: ContentMetadata): boolean {
    return (
        (metadata.wordCount && metadata.wordCount > 3000) ||
        metadata.hasCodeBlocks === true ||
        metadata.isTechnical === true ||
        metadata.hasSlides === true
    );
}

/**
 * Select appropriate Gemini tier based on content and user preference
 */
export function selectGeminiTier(
    userPreference: GeminiTier,
    metadata: ContentMetadata
): 'pro' | 'flash' {
    if (userPreference === 'pro') return 'pro';
    if (userPreference === 'flash') return 'flash';

    // Auto mode: detect complexity
    return isComplexContent(metadata) ? 'pro' : 'flash';
}

/**
 * Exponential backoff for retries
 */
export async function exponentialBackoff(
    attempt: number,
    maxAttempts: number = 3,
    baseDelay: number = 1000
): Promise<boolean> {
    if (attempt >= maxAttempts) {
        return false;
    }

    const delay = baseDelay * Math.pow(2, attempt);
    await new Promise(resolve => setTimeout(resolve, delay));
    return true;
}

/**
 * Retry wrapper with exponential backoff
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    shouldRetry: (error: any) => boolean = () => true
): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (!shouldRetry(error)) {
                throw error;
            }

            if (attempt < maxAttempts - 1) {
                await exponentialBackoff(attempt, maxAttempts);
            }
        }
    }

    throw lastError;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
    if (!error) return false;

    const retryableCodes = [
        ExtractionErrorCode.RATE_LIMIT_EXCEEDED,
        ExtractionErrorCode.NETWORK_TIMEOUT
    ];

    if (error.code && retryableCodes.includes(error.code)) {
        return true;
    }

    // Check HTTP status codes
    if (error.status) {
        const retryableStatuses = [408, 429, 500, 502, 503, 504];
        return retryableStatuses.includes(error.status);
    }

    // Check for network errors
    if (error.message) {
        const networkErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];
        return networkErrors.some(code => error.message.includes(code));
    }

    return false;
}

/**
 * Validate URL to prevent SSRF attacks
 * Reuses logic from existing scraper service
 */
export function validateUrlSafety(url: string): { safe: boolean; reason?: string } {
    try {
        const urlObj = new URL(url);

        // Block private IP ranges
        const hostname = urlObj.hostname.toLowerCase();

        // Localhost
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
            return { safe: false, reason: 'Localhost access blocked' };
        }

        // Private IP ranges
        const privateRanges = [
            /^10\./,                    // 10.0.0.0/8
            /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
            /^192\.168\./,              // 192.168.0.0/16
            /^169\.254\./,              // Link-local
            /^fc00:/,                   // IPv6 private
            /^fe80:/                    // IPv6 link-local
        ];

        for (const range of privateRanges) {
            if (range.test(hostname)) {
                return { safe: false, reason: 'Private IP range blocked' };
            }
        }

        // Block metadata services
        const blockedHosts = [
            '169.254.169.254',  // AWS metadata
            'metadata.google.internal',
            'metadata.azure.com'
        ];

        if (blockedHosts.includes(hostname)) {
            return { safe: false, reason: 'Metadata service blocked' };
        }

        return { safe: true };
    } catch {
        return { safe: false, reason: 'Invalid URL format' };
    }
}

/**
 * Estimate Gemini API cost based on token count
 */
export function estimateGeminiCost(tokens: number, tier: 'pro' | 'flash'): number {
    const pricePerMillionTokens = tier === 'pro' ? 3.50 : 0.075;
    return (tokens / 1_000_000) * pricePerMillionTokens;
}

/**
 * Convert duration string (e.g., "PT1H30M") to seconds
 */
export function parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Calculate reading time estimate (words per minute)
 */
export function estimateReadingTime(wordCount: number, wpm: number = 200): number {
    return Math.ceil(wordCount / wpm);
}

/**
 * Truncate text to max length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Clean markdown content (remove excessive newlines, etc.)
 */
export function cleanMarkdown(markdown: string): string {
    return markdown
        .replace(/\n{3,}/g, '\n\n')  // Max 2 consecutive newlines
        .trim();
}
