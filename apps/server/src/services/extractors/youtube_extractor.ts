/**
 * YouTube Content Extractor
 *
 * Extracts metadata from YouTube videos using YouTube Data API v3.
 * Falls back to basic metadata extraction from URL parsing if API unavailable.
 */

import {
    type ContentExtractor,
    type ExtractorOptions,
    type ExtractorResult,
    type YouTubeMetadata,
    ExtractionErrorCode
} from './types.js';
import {
    createSuccessResult,
    createErrorResult,
    parseDuration,
    retryWithBackoff,
    isRetryableError
} from './base_extractor.js';
import log from '../log.js';

export class YouTubeExtractor implements ContentExtractor {
    readonly contentType = 'youtube';
    readonly requiresApiKey = false;  // Can fallback to URL parsing

    /**
     * Check if this extractor can handle the URL
     */
    canHandle(url: string): boolean {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be');
        } catch {
            return false;
        }
    }

    /**
     * Extract video ID from YouTube URL
     */
    private extractVideoId(url: string): string | null {
        try {
            const urlObj = new URL(url);

            // Format: https://www.youtube.com/watch?v=VIDEO_ID
            if (urlObj.hostname.includes('youtube.com')) {
                return urlObj.searchParams.get('v');
            }

            // Format: https://youtu.be/VIDEO_ID
            if (urlObj.hostname.includes('youtu.be')) {
                return urlObj.pathname.slice(1);
            }

            return null;
        } catch {
            return null;
        }
    }

    /**
     * Extract content from YouTube URL
     */
    async extract(url: string, options?: ExtractorOptions): Promise<ExtractorResult> {
        const startTime = Date.now();
        const videoId = this.extractVideoId(url);

        if (!videoId) {
            return createErrorResult(
                ExtractionErrorCode.PARSING_ERROR,
                'Could not extract video ID from URL',
                false
            );
        }

        // Try YouTube Data API if key is available
        if (options?.apiKeys?.youtube) {
            try {
                const result = await this.extractWithApi(videoId, options.apiKeys.youtube, startTime);
                if (result.success) {
                    return result;
                }

                // If API failed but error is not recoverable, return error
                if (result.error && !result.error.recoverable) {
                    return result;
                }

                log.info(`YouTube API extraction failed (${result.error?.code}), falling back to basic metadata`);
            } catch (error) {
                log.error('YouTube API extraction error:', error);
                // Continue to fallback
            }
        }

        // Fallback to basic metadata
        return this.extractWithFallback(videoId, url, startTime);
    }

    /**
     * Extract using YouTube Data API v3
     */
    private async extractWithApi(
        videoId: string,
        apiKey: string,
        startTime: number
    ): Promise<ExtractorResult> {
        try {
            const response = await retryWithBackoff(
                async () => {
                    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
                    url.searchParams.set('part', 'snippet,contentDetails,statistics');
                    url.searchParams.set('id', videoId);
                    url.searchParams.set('key', apiKey);

                    const res = await fetch(url.toString());

                    if (!res.ok) {
                        const error: any = new Error(`YouTube API error: ${res.status}`);
                        error.status = res.status;
                        throw error;
                    }

                    return res.json();
                },
                3,
                isRetryableError
            );

            if (!response.items || response.items.length === 0) {
                return createErrorResult(
                    ExtractionErrorCode.CONTENT_NOT_FOUND,
                    'Video not found',
                    false
                );
            }

            const video = response.items[0];
            const snippet = video.snippet;
            const contentDetails = video.contentDetails;
            const statistics = video.statistics;

            // Parse duration from ISO 8601 format (e.g., "PT1H30M45S")
            const durationSeconds = parseDuration(contentDetails.duration);

            const processingTimeMs = Date.now() - startTime;

            return createSuccessResult(
                {
                    videoId,
                    title: snippet.title,
                    description: snippet.description,
                    channelName: snippet.channelTitle,
                    channelId: snippet.channelId,
                    duration: durationSeconds,
                    views: parseInt(statistics.viewCount || '0', 10),
                    likes: parseInt(statistics.likeCount || '0', 10),
                    publishedAt: snippet.publishedAt,
                    category: snippet.categoryId,
                    tags: snippet.tags || [],
                    thumbnails: {
                        default: snippet.thumbnails.default?.url || '',
                        medium: snippet.thumbnails.medium?.url || '',
                        high: snippet.thumbnails.high?.url || '',
                        maxres: snippet.thumbnails.maxres?.url
                    },
                    language: snippet.defaultLanguage || snippet.defaultAudioLanguage || 'en'
                },
                {
                    extractionMethod: 'api_standard',
                    apiUsed: 'YouTube Data API v3',
                    confidence: 1.0,
                    cost: 0,  // Free tier (within quota limits)
                    processingTimeMs
                }
            );
        } catch (error: any) {
            // Map error types
            if (error.status === 403) {
                return createErrorResult(
                    ExtractionErrorCode.RATE_LIMIT_EXCEEDED,
                    'YouTube API quota exceeded',
                    true,
                    error
                );
            }

            if (error.status === 400) {
                return createErrorResult(
                    ExtractionErrorCode.INVALID_API_KEY,
                    'Invalid YouTube API key',
                    false,
                    error
                );
            }

            if (error.status === 404) {
                return createErrorResult(
                    ExtractionErrorCode.CONTENT_NOT_FOUND,
                    'Video not found',
                    false,
                    error
                );
            }

            return createErrorResult(
                ExtractionErrorCode.UNKNOWN_ERROR,
                `YouTube API extraction failed: ${error.message}`,
                true,
                error
            );
        }
    }

    /**
     * Fallback to basic metadata from URL
     */
    private extractWithFallback(videoId: string, url: string, startTime: number): ExtractorResult {
        const processingTimeMs = Date.now() - startTime;

        // Return minimal metadata
        return createSuccessResult(
            {
                videoId,
                title: `YouTube Video ${videoId}`,
                description: '',
                url,
                thumbnails: {
                    default: `https://img.youtube.com/vi/${videoId}/default.jpg`,
                    medium: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                    high: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                    maxres: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
                }
            },
            {
                extractionMethod: 'fallback',
                apiUsed: 'None',
                confidence: 0.3,
                processingTimeMs
            }
        );
    }

    /**
     * Validate YouTube Data API key
     */
    async validateApiKey(apiKey: string): Promise<boolean> {
        try {
            const url = new URL('https://www.googleapis.com/youtube/v3/videos');
            url.searchParams.set('part', 'snippet');
            url.searchParams.set('id', 'dQw4w9WgXcQ');  // Test with a known video
            url.searchParams.set('key', apiKey);

            const response = await fetch(url.toString());
            return response.ok;
        } catch (error) {
            log.error('YouTube API key validation failed:', error);
            return false;
        }
    }
}
