/**
 * Decant - AI Provider Service
 *
 * Unified interface for AI providers (OpenAI, Anthropic, Ollama)
 * Used for metadata extraction and content analysis
 */

import options from "../options.js";
import log from "../log.js";
import type { AIProviderConfig } from "./types.js";

interface AIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface AICompletionOptions {
    messages: AIMessage[];
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
}

interface AICompletionResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

/**
 * AI Provider abstraction for multi-provider support
 */
class AIProvider {
    private config: AIProviderConfig | null = null;

    /**
     * Initialize the AI provider with configuration from options
     */
    async initialize(): Promise<void> {
        const provider = await options.getOption('aiSelectedProvider') || 'openai';

        this.config = {
            provider: provider as AIProviderConfig['provider'],
            apiKey: await this.getApiKey(provider),
            baseUrl: await this.getBaseUrl(provider),
            model: await this.getModel(provider),
        };

        log.info(`Decant AI Provider initialized: ${provider}`);
    }

    /**
     * Get API key for the specified provider
     */
    private async getApiKey(provider: string): Promise<string | undefined> {
        switch (provider) {
            case 'openai':
                return await options.getOption('openaiApiKey') || undefined;
            case 'anthropic':
                return await options.getOption('anthropicApiKey') || undefined;
            case 'ollama':
                return undefined; // Ollama doesn't require API key
            default:
                return undefined;
        }
    }

    /**
     * Get base URL for the specified provider
     */
    private async getBaseUrl(provider: string): Promise<string | undefined> {
        switch (provider) {
            case 'openai':
                return await options.getOption('openaiBaseUrl') || 'https://api.openai.com/v1';
            case 'anthropic':
                return await options.getOption('anthropicBaseUrl') || 'https://api.anthropic.com';
            case 'ollama':
                return await options.getOption('ollamaBaseUrl') || 'http://localhost:11434';
            default:
                return undefined;
        }
    }

    /**
     * Get model for the specified provider
     */
    private async getModel(provider: string): Promise<string | undefined> {
        switch (provider) {
            case 'openai':
                return await options.getOption('openaiDefaultModel') || 'gpt-4o-mini';
            case 'anthropic':
                return await options.getOption('anthropicDefaultModel') || 'claude-sonnet-4-20250514';
            case 'ollama':
                return await options.getOption('ollamaDefaultModel') || 'llama3.2';
            default:
                return undefined;
        }
    }

    /**
     * Ensure provider is initialized
     */
    private ensureInitialized(): void {
        if (!this.config) {
            throw new Error('AI Provider not initialized. Call initialize() first.');
        }
    }

    /**
     * Get current provider configuration
     */
    getConfig(): AIProviderConfig | null {
        return this.config;
    }

    /**
     * Create a chat completion using the configured provider
     */
    async createCompletion(opts: AICompletionOptions): Promise<AICompletionResponse> {
        this.ensureInitialized();

        switch (this.config!.provider) {
            case 'openai':
                return this.createOpenAICompletion(opts);
            case 'anthropic':
                return this.createAnthropicCompletion(opts);
            case 'ollama':
                return this.createOllamaCompletion(opts);
            default:
                throw new Error(`Unsupported provider: ${this.config!.provider}`);
        }
    }

    /**
     * OpenAI completion
     */
    private async createOpenAICompletion(opts: AICompletionOptions): Promise<AICompletionResponse> {
        const { messages, temperature = 0.3, maxTokens = 2000, jsonMode = false } = opts;

        const response = await fetch(`${this.config!.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config!.apiKey}`,
            },
            body: JSON.stringify({
                model: this.config!.model,
                messages,
                temperature,
                max_tokens: maxTokens,
                ...(jsonMode && { response_format: { type: 'json_object' } }),
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            log.error(`OpenAI API error: ${error}`);
            throw new Error(`OpenAI API error: ${response.status} - ${error}`);
        }

        const data = await response.json() as any;

        return {
            content: data.choices[0]?.message?.content || '',
            usage: data.usage ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
            } : undefined,
        };
    }

    /**
     * Anthropic completion
     */
    private async createAnthropicCompletion(opts: AICompletionOptions): Promise<AICompletionResponse> {
        const { messages, temperature = 0.3, maxTokens = 2000 } = opts;

        // Extract system message if present
        const systemMessage = messages.find(m => m.role === 'system');
        const conversationMessages = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
            }));

        const response = await fetch(`${this.config!.baseUrl}/v1/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.config!.apiKey!,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: this.config!.model,
                max_tokens: maxTokens,
                temperature,
                ...(systemMessage && { system: systemMessage.content }),
                messages: conversationMessages,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            log.error(`Anthropic API error: ${error}`);
            throw new Error(`Anthropic API error: ${response.status} - ${error}`);
        }

        const data = await response.json() as any;

        return {
            content: data.content[0]?.text || '',
            usage: data.usage ? {
                promptTokens: data.usage.input_tokens,
                completionTokens: data.usage.output_tokens,
                totalTokens: data.usage.input_tokens + data.usage.output_tokens,
            } : undefined,
        };
    }

    /**
     * Ollama completion
     */
    private async createOllamaCompletion(opts: AICompletionOptions): Promise<AICompletionResponse> {
        const { messages, temperature = 0.3 } = opts;

        const response = await fetch(`${this.config!.baseUrl}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.config!.model,
                messages: messages.map(m => ({
                    role: m.role,
                    content: m.content,
                })),
                stream: false,
                options: {
                    temperature,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            log.error(`Ollama API error: ${error}`);
            throw new Error(`Ollama API error: ${response.status} - ${error}`);
        }

        const data = await response.json() as any;

        return {
            content: data.message?.content || '',
            usage: data.eval_count ? {
                promptTokens: data.prompt_eval_count || 0,
                completionTokens: data.eval_count || 0,
                totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
            } : undefined,
        };
    }

    /**
     * Test the provider connection
     */
    async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            await this.initialize();

            const response = await this.createCompletion({
                messages: [
                    { role: 'user', content: 'Say "OK" if you can hear me.' }
                ],
                maxTokens: 10,
            });

            return {
                success: true,
                message: `Provider ${this.config!.provider} connected successfully. Response: ${response.content.substring(0, 50)}`,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return {
                success: false,
                message: `Failed to connect to AI provider: ${message}`,
            };
        }
    }
}

// Singleton instance
const aiProvider = new AIProvider();

export default aiProvider;
export { AIProvider, AIMessage, AICompletionOptions, AICompletionResponse };
