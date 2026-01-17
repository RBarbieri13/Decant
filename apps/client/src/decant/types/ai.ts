/**
 * AI Service Types - Defines AI integration interfaces
 */

export type AIProvider = 'openai' | 'anthropic' | 'local' | 'custom';

export interface AIServiceConfig {
    provider: AIProvider;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
}

export interface AIProcessingRequest {
    contentId: string;
    url: string;
    rawContent: string;
    metadata: {
        title?: string;
        description?: string;
        contentType: string;
    };
    options?: AIProcessingOptions;
}

export interface AIProcessingOptions {
    generateSummary: boolean;
    generateTags: boolean;
    suggestCategory: boolean;
    extractKeyPoints: boolean;
    detectLanguage: boolean;
    analyzeSentiment: boolean;
}

export const DEFAULT_AI_OPTIONS: AIProcessingOptions = {
    generateSummary: true,
    generateTags: true,
    suggestCategory: true,
    extractKeyPoints: true,
    detectLanguage: true,
    analyzeSentiment: false,
};

export interface AIProcessingResult {
    summary?: string;
    tags?: AITag[];
    suggestedCategory?: AICategorySuggestion;
    keyPoints?: string[];
    language?: string;
    sentiment?: SentimentAnalysis;
    confidence: number;
    processingTime: number;
    tokensUsed?: number;
}

export interface AITag {
    name: string;
    confidence: number;
    category?: string;
}

export interface AICategorySuggestion {
    spaceId?: string;
    spaceName: string;
    confidence: number;
    reasoning?: string;
    alternatives?: Array<{
        spaceName: string;
        confidence: number;
    }>;
}

export interface SentimentAnalysis {
    overall: 'positive' | 'neutral' | 'negative';
    score: number; // -1 to 1
    aspects?: Array<{
        aspect: string;
        sentiment: 'positive' | 'neutral' | 'negative';
        score: number;
    }>;
}

export interface AIQueueItem {
    id: string;
    contentId: string;
    priority: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    error?: string;
    retryCount: number;
}

export interface AIQueueStats {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    averageProcessingTime: number;
}

/**
 * Prompt templates for AI processing
 */
export const AI_PROMPTS = {
    summarize: `Summarize the following content in 2-3 concise sentences. Focus on the main idea and key takeaways.

Content:
{{content}}

Summary:`,

    extractTags: `Extract 3-7 relevant tags from the following content. Tags should be single words or short phrases that capture the main topics, themes, and concepts.

Content:
{{content}}

Return tags as a JSON array of strings.`,

    categorize: `Given the following content and available categories, suggest the most appropriate category.

Content:
{{content}}

Available categories:
{{categories}}

Return your suggestion as JSON with fields: category, confidence (0-1), reasoning.`,

    keyPoints: `Extract the 3-5 most important key points from the following content. Each point should be a single sentence.

Content:
{{content}}

Return key points as a JSON array of strings.`,
};

export type PromptTemplate = keyof typeof AI_PROMPTS;
