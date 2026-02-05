/**
 * Media Content Processor
 *
 * Coordinates YouTube metadata extraction with Gemini video/audio processing.
 * Handles video and audio content using Gemini's multimodal capabilities.
 */

import ytdl from 'ytdl-core';
import {
    type ExtractorOptions,
    type ExtractorResult,
    type ContentMetadata,
    ExtractionErrorCode
} from './types.js';
import {
    createSuccessResult,
    createErrorResult
} from './base_extractor.js';
import { YouTubeExtractor } from './youtube_extractor.js';
import { GeminiProcessor } from './gemini_processor.js';
import log from '../log.js';

export class MediaProcessor {
    private youtubeExtractor: YouTubeExtractor;
    private geminiProcessor: GeminiProcessor;

    constructor() {
        this.youtubeExtractor = new YouTubeExtractor();
        this.geminiProcessor = new GeminiProcessor();
    }

    /**
     * Process YouTube video
     */
    async processYouTubeVideo(
        url: string,
        options?: ExtractorOptions
    ): Promise<ExtractorResult> {
        const startTime = Date.now();

        try {
            // Step 1: Extract YouTube metadata
            const metadataResult = await this.youtubeExtractor.extract(url, options);

            if (!metadataResult.success) {
                return metadataResult;  // Return error if metadata extraction failed
            }

            const metadata = metadataResult.data!;

            // Step 2: Build content metadata for Gemini tier selection
            const contentMetadata: ContentMetadata = {
                url,
                domain: 'youtube.com',
                contentType: 'youtube',
                wordCount: metadata.duration || 600,  // Use duration as proxy
                hasSlides: false,  // TODO: Could detect from title/description
                isTechnical: this.detectTechnicalContent(metadata),
                language: metadata.language || 'en'
            };

            // Step 3: Process video content with Gemini (if API key available)
            let geminiResult: any = null;
            let totalCost = 0;

            if (options?.apiKeys?.gemini) {
                try {
                    this.geminiProcessor.initialize(options.apiKeys.gemini);

                    // For YouTube, we pass the URL directly to Gemini
                    // Gemini can process YouTube URLs natively
                    const processingResult = await this.geminiProcessor.processMedia(
                        url,
                        contentMetadata,
                        options.geminiTier || 'auto',
                        {
                            extractVisuals: true  // Extract slide text, diagrams
                        }
                    );

                    geminiResult = processingResult;
                    totalCost += processingResult.cost;

                    log.info(`Gemini video processing completed (cost: $${processingResult.cost.toFixed(4)})`);
                } catch (error) {
                    log.error('Gemini video processing failed:', error);
                    // Continue with metadata only
                }
            }

            const processingTimeMs = Date.now() - startTime;

            // Combine metadata and Gemini results
            return createSuccessResult(
                {
                    ...metadata,
                    // Add Gemini analysis if available
                    ...(geminiResult && {
                        summary: geminiResult.summary,
                        taxonomy: geminiResult.taxonomy,
                        keyConcepts: geminiResult.keyConcepts,
                        transcript: geminiResult.transcript,
                        visualElements: geminiResult.visualElements,
                        mermaidDiagram: geminiResult.mermaidDiagram
                    })
                },
                {
                    extractionMethod: geminiResult ? 'api_premium' : 'api_standard',
                    apiUsed: geminiResult ? 'YouTube Data API + Gemini' : 'YouTube Data API',
                    confidence: geminiResult ? 0.9 : metadataResult.metadata.confidence,
                    cost: totalCost,
                    processingTimeMs
                }
            );
        } catch (error: any) {
            log.error('Media processing error:', error);

            return createErrorResult(
                ExtractionErrorCode.UNKNOWN_ERROR,
                `Media processing failed: ${error.message}`,
                true,
                error
            );
        }
    }

    /**
     * Process audio-only content (podcasts, etc.)
     */
    async processAudioContent(
        url: string,
        options?: ExtractorOptions
    ): Promise<ExtractorResult> {
        const startTime = Date.now();

        if (!options?.apiKeys?.gemini) {
            return createErrorResult(
                ExtractionErrorCode.INVALID_API_KEY,
                'Gemini API key required for audio processing',
                false
            );
        }

        try {
            this.geminiProcessor.initialize(options.apiKeys.gemini);

            const contentMetadata: ContentMetadata = {
                url,
                domain: new URL(url).hostname,
                contentType: 'podcast',
                isTechnical: false
            };

            // Process audio with Gemini
            const result = await this.geminiProcessor.processMedia(
                url,
                contentMetadata,
                options.geminiTier || 'flash',  // Default to Flash for audio
                {
                    extractVisuals: false  // Audio only
                }
            );

            const processingTimeMs = Date.now() - startTime;

            return createSuccessResult(
                {
                    transcript: result.transcript,
                    summary: result.summary,
                    taxonomy: result.taxonomy,
                    keyConcepts: result.keyConcepts
                },
                {
                    extractionMethod: 'api_premium',
                    apiUsed: 'Gemini Audio',
                    confidence: 0.9,
                    cost: result.cost,
                    processingTimeMs
                }
            );
        } catch (error: any) {
            log.error('Audio processing error:', error);

            return createErrorResult(
                ExtractionErrorCode.UNKNOWN_ERROR,
                `Audio processing failed: ${error.message}`,
                true,
                error
            );
        }
    }

    /**
     * Download YouTube video/audio
     * (Used if we need to process locally instead of passing URL to Gemini)
     */
    async downloadYouTubeMedia(
        url: string,
        audioOnly: boolean = false
    ): Promise<{ buffer: Buffer; mimeType: string }> {
        try {
            const chunks: Buffer[] = [];

            return new Promise((resolve, reject) => {
                const stream = ytdl(url, {
                    quality: audioOnly ? 'highestaudio' : 'highest',
                    filter: audioOnly ? 'audioonly' : 'audioandvideo'
                });

                stream.on('data', (chunk) => {
                    chunks.push(chunk);
                });

                stream.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    const mimeType = audioOnly ? 'audio/mp4' : 'video/mp4';
                    resolve({ buffer, mimeType });
                });

                stream.on('error', (error) => {
                    reject(error);
                });
            });
        } catch (error: any) {
            log.error('YouTube download error:', error);
            throw error;
        }
    }

    /**
     * Detect if content is technical based on metadata
     */
    private detectTechnicalContent(metadata: any): boolean {
        const technicalKeywords = [
            'programming', 'coding', 'tutorial', 'development', 'software',
            'algorithm', 'api', 'database', 'framework', 'code',
            'tech', 'engineering', 'computer science', 'data',
            'machine learning', 'ai', 'architecture'
        ];

        const text = `${metadata.title} ${metadata.description} ${metadata.tags?.join(' ')}`.toLowerCase();

        return technicalKeywords.some(keyword => text.includes(keyword));
    }

    /**
     * Estimate cost for media processing
     */
    estimateCost(
        durationSeconds: number,
        tier: 'pro' | 'flash' = 'flash'
    ): number {
        // Video: 263 tokens/second
        // Audio: 32 tokens/second
        // For simplicity, use video rate (worst case)
        const tokensPerSecond = 263;
        const totalTokens = durationSeconds * tokensPerSecond;

        const pricePerMillionTokens = tier === 'pro' ? 3.50 : 0.075;
        return (totalTokens / 1_000_000) * pricePerMillionTokens;
    }
}
