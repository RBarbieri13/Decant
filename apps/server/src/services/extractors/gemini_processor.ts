/**
 * Gemini Content Processor
 *
 * Unified cognitive layer for all content types using Google Gemini 1.5 Pro/Flash.
 * Handles summarization, taxonomy generation, and diagram creation.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
    type GeminiProcessingResult,
    type ContentMetadata,
    type GeminiTier,
    ExtractionErrorCode
} from './types.js';
import {
    selectGeminiTier,
    estimateGeminiCost,
    retryWithBackoff,
    isRetryableError
} from './base_extractor.js';
import log from '../log.js';

export class GeminiProcessor {
    private client: GoogleGenerativeAI | null = null;
    private proModel: any = null;
    private flashModel: any = null;

    /**
     * Initialize Gemini client
     */
    initialize(apiKey: string): void {
        if (!apiKey) {
            throw new Error('Gemini API key is required');
        }

        try {
            this.client = new GoogleGenerativeAI(apiKey);
            this.proModel = this.client.getGenerativeModel({ model: 'gemini-1.5-pro' });
            this.flashModel = this.client.getGenerativeModel({ model: 'gemini-1.5-flash' });
            log.info('Gemini client initialized successfully');
        } catch (error) {
            log.error('Failed to initialize Gemini client:', error);
            throw error;
        }
    }

    /**
     * Process text content (articles, transcripts, etc.)
     */
    async processText(
        content: string,
        metadata: ContentMetadata,
        userTier: GeminiTier = 'auto'
    ): Promise<GeminiProcessingResult & { cost: number }> {
        const tier = selectGeminiTier(userTier, metadata);
        const model = tier === 'pro' ? this.proModel : this.flashModel;

        if (!model) {
            throw new Error('Gemini model not initialized');
        }

        const prompt = this.buildTextAnalysisPrompt(content, metadata);

        try {
            const result = await retryWithBackoff(
                async () => {
                    const response = await model.generateContent(prompt);
                    return response.response;
                },
                3,
                isRetryableError
            );

            const responseText = result.text();
            const parsed = this.parseStructuredResponse(responseText);

            // Estimate cost based on tokens
            const estimatedTokens = this.estimateTokens(content + prompt);
            const cost = estimateGeminiCost(estimatedTokens, tier);

            return {
                ...parsed,
                cost
            };
        } catch (error: any) {
            log.error('Gemini text processing error:', error);
            throw this.mapGeminiError(error);
        }
    }

    /**
     * Process video/audio content (multimodal)
     */
    async processMedia(
        fileData: Buffer | string,
        metadata: ContentMetadata,
        userTier: GeminiTier = 'auto',
        options?: { extractVisuals?: boolean }
    ): Promise<GeminiProcessingResult & { cost: number }> {
        const tier = selectGeminiTier(userTier, metadata);
        const model = tier === 'pro' ? this.proModel : this.flashModel;

        if (!model) {
            throw new Error('Gemini model not initialized');
        }

        const prompt = this.buildMediaAnalysisPrompt(metadata, options);

        try {
            // For video/audio, we need to upload to Gemini File API first
            let filePart: any;

            if (typeof fileData === 'string') {
                // URL provided
                filePart = {
                    fileData: {
                        fileUri: fileData,
                        mimeType: 'video/*'
                    }
                };
            } else {
                // Buffer provided - would need to upload via File API
                // For now, we'll assume URL is provided
                throw new Error('Buffer upload not yet implemented - please provide URL or use File API');
            }

            const result = await retryWithBackoff(
                async () => {
                    const response = await model.generateContent([prompt, filePart]);
                    return response.response;
                },
                3,
                isRetryableError
            );

            const responseText = result.text();
            const parsed = this.parseStructuredResponse(responseText);

            // Estimate cost for video processing
            const durationSeconds = metadata.wordCount || 600;  // Default 10 min
            const videoTokens = durationSeconds * 263;  // 263 tokens/sec for video
            const cost = estimateGeminiCost(videoTokens, tier);

            return {
                ...parsed,
                cost
            };
        } catch (error: any) {
            log.error('Gemini media processing error:', error);
            throw this.mapGeminiError(error);
        }
    }

    /**
     * Generate Mermaid diagram from content
     */
    async generateDiagram(
        content: string,
        diagramType: 'mindmap' | 'flowchart' | 'sequence' | 'architecture' = 'mindmap',
        tier: 'pro' | 'flash' = 'flash'
    ): Promise<{ mermaid: string; cost: number }> {
        const model = tier === 'pro' ? this.proModel : this.flashModel;

        if (!model) {
            throw new Error('Gemini model not initialized');
        }

        const prompt = this.buildDiagramPrompt(content, diagramType);

        try {
            const result = await retryWithBackoff(
                async () => {
                    const response = await model.generateContent(prompt);
                    return response.response;
                },
                3,
                isRetryableError
            );

            const responseText = result.text();
            const mermaid = this.extractMermaidSyntax(responseText);

            const estimatedTokens = this.estimateTokens(content + prompt + mermaid);
            const cost = estimateGeminiCost(estimatedTokens, tier);

            return { mermaid, cost };
        } catch (error: any) {
            log.error('Gemini diagram generation error:', error);
            throw this.mapGeminiError(error);
        }
    }

    /**
     * Build prompt for text analysis
     */
    private buildTextAnalysisPrompt(content: string, metadata: ContentMetadata): string {
        return `Analyze the following ${metadata.contentType} content and provide a structured analysis.

Content:
${content}

Please provide your analysis in the following JSON format:
{
    "summary": "2-3 sentence summary capturing the main ideas and key takeaways",
    "taxonomy": ["Level1 > Level2 > Level3 > Level4 > Level5"],
    "keyConcepts": ["concept1", "concept2", "concept3"],
    "mermaidDiagram": "optional mermaid syntax for visualization"
}

Taxonomy rules:
- Use hierarchical tags from broad to specific (5 levels)
- Examples: "Technology > AI > Machine Learning > NLP > Transformers"
- Examples: "Business > Marketing > Digital > SEO > Technical"

Key concepts:
- 3-7 human-readable tags for search
- Focus on actionable insights, tools, frameworks mentioned

Respond ONLY with valid JSON.`;
    }

    /**
     * Build prompt for media analysis
     */
    private buildMediaAnalysisPrompt(
        metadata: ContentMetadata,
        options?: { extractVisuals?: boolean }
    ): string {
        const visualInstructions = options?.extractVisuals
            ? `
- Extract text from slides, diagrams, code shown on screen
- Note key visual transitions and their timestamps
- Capture on-screen code snippets if present`
            : '';

        return `Analyze this ${metadata.contentType} and provide a structured analysis.

Instructions:
- Generate complete transcript with timestamps
- Provide 2-3 sentence summary${visualInstructions}

Respond in JSON format:
{
    "summary": "Brief summary of main points",
    "transcript": "Full transcript with [00:00] timestamps",
    "taxonomy": ["Level1 > Level2 > Level3 > Level4 > Level5"],
    "keyConcepts": ["concept1", "concept2"],
    "visualElements": {
        "slideText": ["Text from slide 1", "Text from slide 2"],
        "diagrams": ["Description of diagram 1"],
        "codeSnippets": ["Code shown on screen"]
    }
}

Respond ONLY with valid JSON.`;
    }

    /**
     * Build prompt for diagram generation
     */
    private buildDiagramPrompt(content: string, diagramType: string): string {
        const examples = {
            mindmap: `mindmap
  root((Main Topic))
    Subtopic 1
      Detail A
      Detail B
    Subtopic 2`,
            flowchart: `flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]`,
            sequence: `sequenceDiagram
    participant A
    participant B
    A->>B: Request
    B->>A: Response`,
            architecture: `graph TD
    Client --> API
    API --> Database`
        };

        return `Generate a Mermaid.js ${diagramType} diagram for the following content.

Content:
${content.substring(0, 2000)}  // Truncate for token efficiency

Example ${diagramType} syntax:
\`\`\`mermaid
${examples[diagramType] || examples.mindmap}
\`\`\`

Rules:
- Use valid Mermaid.js syntax
- Keep it concise (max 15 nodes)
- Focus on main concepts and relationships
- Do NOT include markdown code fence markers

Respond with ONLY the Mermaid syntax (no additional text).`;
    }

    /**
     * Parse structured JSON response from Gemini
     */
    private parseStructuredResponse(responseText: string): GeminiProcessingResult {
        try {
            // Extract JSON from potential markdown code blocks
            const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) ||
                             responseText.match(/({[\s\S]*})/);

            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const json = JSON.parse(jsonMatch[1] || jsonMatch[0]);

            return {
                summary: json.summary || '',
                taxonomy: json.taxonomy || [],
                keyConcepts: json.keyConcepts || [],
                transcript: json.transcript,
                visualElements: json.visualElements,
                mermaidDiagram: json.mermaidDiagram
            };
        } catch (error) {
            log.error('Failed to parse Gemini response:', error);
            log.error('Raw response:', responseText);

            // Return basic fallback
            return {
                summary: 'Analysis failed',
                taxonomy: [],
                keyConcepts: [],
                transcript: responseText.substring(0, 500)
            };
        }
    }

    /**
     * Extract Mermaid syntax from response
     */
    private extractMermaidSyntax(responseText: string): string {
        // Remove markdown code fences if present
        const cleaned = responseText
            .replace(/```mermaid\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

        return cleaned;
    }

    /**
     * Estimate token count (rough approximation)
     */
    private estimateTokens(text: string): number {
        // Rough estimate: ~4 characters per token
        return Math.ceil(text.length / 4);
    }

    /**
     * Map Gemini errors to extraction error codes
     */
    private mapGeminiError(error: any): Error {
        const mapped: any = new Error(error.message || 'Gemini processing failed');

        if (error.message?.includes('quota')) {
            mapped.code = ExtractionErrorCode.RATE_LIMIT_EXCEEDED;
        } else if (error.message?.includes('API key')) {
            mapped.code = ExtractionErrorCode.INVALID_API_KEY;
        } else {
            mapped.code = ExtractionErrorCode.UNKNOWN_ERROR;
        }

        mapped.originalError = error;
        return mapped;
    }

    /**
     * Validate Gemini API key
     */
    async validateApiKey(apiKey: string): Promise<boolean> {
        try {
            const testClient = new GoogleGenerativeAI(apiKey);
            const testModel = testClient.getGenerativeModel({ model: 'gemini-1.5-flash' });

            const result = await testModel.generateContent('Say "OK" if you can read this.');
            const text = result.response.text();

            return text.includes('OK');
        } catch (error) {
            log.error('Gemini API key validation failed:', error);
            return false;
        }
    }
}
