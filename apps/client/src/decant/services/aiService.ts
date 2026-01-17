/**
 * AIService - Service for AI-powered content analysis
 *
 * Handles content summarization, tagging, categorization, and knowledge extraction.
 */

import type {
    AIServiceConfig,
    AIProcessingRequest,
    AIProcessingResult,
    AIProcessingOptions,
    AITag,
    AICategorySuggestion,
    AIQueueItem,
    AIQueueStats,
    PromptTemplate,
    AI_PROMPTS,
} from '../types/ai';
import { DEFAULT_AI_OPTIONS } from '../types/ai';

/**
 * AIService class for content analysis and processing
 */
class AIService {
    private baseUrl = '/api/decant/ai';
    private config: AIServiceConfig | null = null;
    private queue: AIQueueItem[] = [];

    /**
     * Initialize AI service with configuration
     */
    async initialize(config: AIServiceConfig): Promise<void> {
        this.config = config;

        // Verify configuration with backend
        try {
            const response = await fetch(`${this.baseUrl}/configure`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });

            if (!response.ok && response.status !== 404) {
                throw new Error('Failed to configure AI service');
            }
        } catch (error) {
            console.warn('AI service configuration deferred:', error);
        }
    }

    /**
     * Check if AI service is configured
     */
    isConfigured(): boolean {
        return this.config !== null;
    }

    /**
     * Process content with AI
     */
    async processContent(
        request: AIProcessingRequest,
        options: AIProcessingOptions = DEFAULT_AI_OPTIONS
    ): Promise<AIProcessingResult> {
        try {
            const response = await fetch(`${this.baseUrl}/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ request, options }),
            });

            if (!response.ok) {
                if (response.status === 404) {
                    // API not implemented yet, return mock result
                    return this.getMockProcessingResult(request, options);
                }
                throw new Error(`AI processing failed: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.warn('Using mock AI result:', error);
            return this.getMockProcessingResult(request, options);
        }
    }

    /**
     * Generate summary for content
     */
    async summarize(content: string, maxLength: number = 200): Promise<string> {
        try {
            const response = await fetch(`${this.baseUrl}/summarize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, maxLength }),
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return this.getMockSummary(content);
                }
                throw new Error('Summarization failed');
            }

            const result = await response.json();
            return result.summary;
        } catch (error) {
            console.warn('Using mock summary:', error);
            return this.getMockSummary(content);
        }
    }

    /**
     * Generate tags for content
     */
    async generateTags(content: string, maxTags: number = 5): Promise<AITag[]> {
        try {
            const response = await fetch(`${this.baseUrl}/tags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, maxTags }),
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return this.getMockTags(content);
                }
                throw new Error('Tag generation failed');
            }

            const result = await response.json();
            return result.tags;
        } catch (error) {
            console.warn('Using mock tags:', error);
            return this.getMockTags(content);
        }
    }

    /**
     * Suggest category for content
     */
    async suggestCategory(
        content: string,
        availableCategories: string[]
    ): Promise<AICategorySuggestion> {
        try {
            const response = await fetch(`${this.baseUrl}/categorize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, categories: availableCategories }),
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return this.getMockCategorySuggestion(availableCategories);
                }
                throw new Error('Categorization failed');
            }

            return await response.json();
        } catch (error) {
            console.warn('Using mock category suggestion:', error);
            return this.getMockCategorySuggestion(availableCategories);
        }
    }

    /**
     * Extract key points from content
     */
    async extractKeyPoints(content: string, maxPoints: number = 5): Promise<string[]> {
        try {
            const response = await fetch(`${this.baseUrl}/keypoints`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, maxPoints }),
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return this.getMockKeyPoints();
                }
                throw new Error('Key point extraction failed');
            }

            const result = await response.json();
            return result.keyPoints;
        } catch (error) {
            console.warn('Using mock key points:', error);
            return this.getMockKeyPoints();
        }
    }

    /**
     * Add content to processing queue
     */
    async queueForProcessing(contentId: string, priority: number = 0): Promise<string> {
        const queueItem: AIQueueItem = {
            id: `queue-${Date.now()}`,
            contentId,
            priority,
            status: 'pending',
            createdAt: new Date().toISOString(),
            retryCount: 0,
        };

        this.queue.push(queueItem);
        this.queue.sort((a, b) => b.priority - a.priority);

        // Trigger backend queue processing
        try {
            await fetch(`${this.baseUrl}/queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(queueItem),
            });
        } catch (error) {
            console.warn('Queue operation deferred:', error);
        }

        return queueItem.id;
    }

    /**
     * Get queue statistics
     */
    async getQueueStats(): Promise<AIQueueStats> {
        try {
            const response = await fetch(`${this.baseUrl}/queue/stats`);

            if (!response.ok) {
                return this.getLocalQueueStats();
            }

            return await response.json();
        } catch (error) {
            return this.getLocalQueueStats();
        }
    }

    // ============================================================
    // Mock/Fallback Methods (used before AI backend is implemented)
    // ============================================================

    private getMockProcessingResult(
        request: AIProcessingRequest,
        options: AIProcessingOptions
    ): AIProcessingResult {
        const result: AIProcessingResult = {
            confidence: 0.75,
            processingTime: 100,
        };

        if (options.generateSummary) {
            result.summary = this.getMockSummary(request.rawContent);
        }

        if (options.generateTags) {
            result.tags = this.getMockTags(request.rawContent);
        }

        if (options.suggestCategory) {
            result.suggestedCategory = {
                spaceName: 'Inbox',
                confidence: 0.6,
                reasoning: 'Default categorization pending AI processing',
            };
        }

        if (options.extractKeyPoints) {
            result.keyPoints = this.getMockKeyPoints();
        }

        if (options.detectLanguage) {
            result.language = 'en';
        }

        return result;
    }

    private getMockSummary(content: string): string {
        // Extract first 200 characters as a basic "summary"
        const cleaned = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleaned.length <= 200) {
            return cleaned;
        }
        return cleaned.substring(0, 197) + '...';
    }

    private getMockTags(content: string): AITag[] {
        // Extract some common words as mock tags
        const words = content
            .toLowerCase()
            .replace(/<[^>]*>/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 4);

        const wordCounts = new Map<string, number>();
        for (const word of words) {
            wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        }

        const sorted = [...wordCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        return sorted.map(([name], index) => ({
            name,
            confidence: 0.8 - index * 0.1,
        }));
    }

    private getMockCategorySuggestion(categories: string[]): AICategorySuggestion {
        return {
            spaceName: categories[0] || 'Inbox',
            confidence: 0.5,
            reasoning: 'Default suggestion - AI processing pending',
            alternatives: categories.slice(1, 3).map((name, i) => ({
                spaceName: name,
                confidence: 0.3 - i * 0.1,
            })),
        };
    }

    private getMockKeyPoints(): string[] {
        return [
            'Key point extraction pending AI processing',
            'Content will be analyzed for main topics',
            'Insights will be generated automatically',
        ];
    }

    private getLocalQueueStats(): AIQueueStats {
        const pending = this.queue.filter(q => q.status === 'pending').length;
        const processing = this.queue.filter(q => q.status === 'processing').length;
        const completed = this.queue.filter(q => q.status === 'completed').length;
        const failed = this.queue.filter(q => q.status === 'failed').length;

        return {
            pending,
            processing,
            completed,
            failed,
            averageProcessingTime: 0,
        };
    }
}

// Export singleton instance
export const aiService = new AIService();
export default aiService;
