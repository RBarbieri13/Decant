// ============================================================
// LLM Provider Abstraction Layer
// Provides a unified interface for LLM interactions with
// support for multiple providers and structured output
// ============================================================

import OpenAI from 'openai';
import { z, ZodSchema } from 'zod';
import { withRetry, RetryOptions, RetryPresets } from '../retry/index.js';
import { getCircuitBreakerRegistry } from '../retry/circuit-breaker.js';

// ============================================================
// Types and Interfaces
// ============================================================

/**
 * Message format for LLM conversations
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Options for LLM completion requests
 */
export interface LLMCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

/**
 * Result of an LLM completion
 */
export interface LLMCompletionResult {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Result of a structured LLM completion
 */
export interface LLMStructuredResult<T> {
  data: T;
  raw: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Abstract LLM Provider interface
 */
export interface LLMProvider {
  /**
   * Provider name identifier
   */
  readonly name: string;

  /**
   * Complete a conversation and return raw text
   */
  complete(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult>;

  /**
   * Complete a conversation with structured JSON output validated by Zod schema
   */
  completeWithSchema<T>(
    messages: LLMMessage[],
    schema: ZodSchema<T>,
    options?: LLMCompletionOptions
  ): Promise<LLMStructuredResult<T>>;
}

// ============================================================
// OpenAI Provider Implementation
// ============================================================

/**
 * OpenAI-specific configuration
 */
export interface OpenAIProviderConfig {
  apiKey: string;
  defaultModel?: string;
  organization?: string;
  baseURL?: string;
  retryOptions?: Partial<RetryOptions>;
  enableCircuitBreaker?: boolean;
}

/**
 * OpenAI LLM Provider implementation
 */
export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  private client: OpenAI;
  private defaultModel: string;
  private retryOptions: Partial<RetryOptions>;
  private enableCircuitBreaker: boolean;

  constructor(config: OpenAIProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organization,
      baseURL: config.baseURL,
    });
    this.defaultModel = config.defaultModel || 'gpt-4o-mini';

    // Use LLM-specific retry configuration (rate limits are common)
    this.retryOptions = {
      ...RetryPresets.RATE_LIMIT,
      context: 'openai-llm',
      ...config.retryOptions,
    };

    this.enableCircuitBreaker = config.enableCircuitBreaker ?? true;
  }

  /**
   * Complete a conversation and return raw text
   */
  async complete(
    messages: LLMMessage[],
    options: LLMCompletionOptions = {}
  ): Promise<LLMCompletionResult> {
    const model = options.model || this.defaultModel;

    // Wrap the API call with retry and optional circuit breaker
    const apiCall = async () => {
      const response = await this.client.chat.completions.create({
        model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 2000,
        top_p: options.topP ?? 1,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      return {
        content,
        model: response.model,
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
      };
    };

    // Apply circuit breaker if enabled
    if (this.enableCircuitBreaker) {
      const circuitBreaker = getCircuitBreakerRegistry().getOrCreate('openai-llm');
      return withRetry(
        () => circuitBreaker.call(apiCall),
        this.retryOptions
      );
    }

    return withRetry(apiCall, this.retryOptions);
  }

  /**
   * Complete a conversation with structured JSON output validated by Zod schema
   */
  async completeWithSchema<T>(
    messages: LLMMessage[],
    schema: ZodSchema<T>,
    options: LLMCompletionOptions = {}
  ): Promise<LLMStructuredResult<T>> {
    const model = options.model || this.defaultModel;

    // Wrap the API call with retry and optional circuit breaker
    const apiCall = async () => {
      const response = await this.client.chat.completions.create({
        model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        response_format: { type: 'json_object' },
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 2000,
        top_p: options.topP ?? 1,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        throw new Error(
          `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        );
      }

      // Validate with Zod schema
      const validationResult = schema.safeParse(parsed);
      if (!validationResult.success) {
        // Zod v4 uses 'issues' instead of 'errors'
        const issues = validationResult.error.issues;
        const errorMessages = issues
          .map((issue: z.core.$ZodIssue) => `${issue.path.join('.')}: ${issue.message}`)
          .join(', ');
        throw new Error(`Schema validation failed: ${errorMessages}`);
      }

      return {
        data: validationResult.data,
        raw: content,
        model: response.model,
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
      };
    };

    // Apply circuit breaker if enabled
    if (this.enableCircuitBreaker) {
      const circuitBreaker = getCircuitBreakerRegistry().getOrCreate('openai-llm');
      return withRetry(
        () => circuitBreaker.call(apiCall),
        this.retryOptions
      );
    }

    return withRetry(apiCall, this.retryOptions);
  }
}

// ============================================================
// Provider Factory
// ============================================================

export type ProviderType = 'openai';

export interface CreateProviderOptions {
  type: ProviderType;
  apiKey: string;
  model?: string;
  retryOptions?: Partial<RetryOptions>;
  enableCircuitBreaker?: boolean;
}

/**
 * Create an LLM provider instance
 */
export function createProvider(options: CreateProviderOptions): LLMProvider {
  switch (options.type) {
    case 'openai':
      return new OpenAIProvider({
        apiKey: options.apiKey,
        defaultModel: options.model,
        retryOptions: options.retryOptions,
        enableCircuitBreaker: options.enableCircuitBreaker,
      });
    default:
      throw new Error(`Unsupported provider type: ${options.type}`);
  }
}

// ============================================================
// Singleton Provider Manager
// ============================================================

let defaultProvider: LLMProvider | null = null;

/**
 * Initialize the default LLM provider
 */
export function initializeProvider(options: CreateProviderOptions): LLMProvider {
  defaultProvider = createProvider(options);
  return defaultProvider;
}

/**
 * Get the default LLM provider (throws if not initialized)
 */
export function getProvider(): LLMProvider {
  if (!defaultProvider) {
    throw new Error(
      'LLM provider not initialized. Call initializeProvider() first.'
    );
  }
  return defaultProvider;
}

/**
 * Check if a provider is initialized
 */
export function hasProvider(): boolean {
  return defaultProvider !== null;
}

/**
 * Clear the default provider (useful for testing)
 */
export function clearProvider(): void {
  defaultProvider = null;
}
