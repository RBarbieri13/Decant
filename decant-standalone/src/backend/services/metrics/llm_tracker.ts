// ============================================================
// LLM Metrics Tracking Wrapper
// Wraps LLM provider calls with metrics collection
// ============================================================

import type { LLMProvider, LLMMessage, LLMCompletionOptions, LLMCompletionResult, LLMStructuredResult } from '../llm/provider.js';
import type { ZodSchema } from 'zod';
import { trackLLMRequest, type TokenUsage } from './index.js';

/**
 * Estimate cost for OpenAI models
 * Prices as of 2025 (per 1M tokens)
 */
function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  // Pricing per 1M tokens
  const pricing: Record<string, { prompt: number; completion: number }> = {
    'gpt-4o': { prompt: 2.50, completion: 10.00 },
    'gpt-4o-mini': { prompt: 0.15, completion: 0.60 },
    'gpt-4-turbo': { prompt: 10.00, completion: 30.00 },
    'gpt-4': { prompt: 30.00, completion: 60.00 },
    'gpt-3.5-turbo': { prompt: 0.50, completion: 1.50 },
  };

  // Find matching model pricing (handle versioned models)
  let modelPricing = pricing[model];
  if (!modelPricing) {
    // Try to find base model (e.g., "gpt-4o-2024-08-06" -> "gpt-4o")
    const baseModel = Object.keys(pricing).find(key => model.startsWith(key));
    modelPricing = baseModel ? pricing[baseModel] : { prompt: 0, completion: 0 };
  }

  const promptCost = (promptTokens / 1_000_000) * modelPricing.prompt;
  const completionCost = (completionTokens / 1_000_000) * modelPricing.completion;

  return promptCost + completionCost;
}

/**
 * Convert LLM usage to TokenUsage format
 */
function createTokenUsage(model: string, usage: LLMCompletionResult['usage']): TokenUsage {
  return {
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    estimatedCost: estimateCost(model, usage.promptTokens, usage.completionTokens),
  };
}

/**
 * Wrapper around LLM provider that tracks metrics
 */
export class MetricsTrackedLLMProvider implements LLMProvider {
  constructor(private provider: LLMProvider) {}

  get name(): string {
    return this.provider.name;
  }

  async complete(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    const startTime = Date.now();
    let status: 'success' | 'failed' = 'failed';

    try {
      const result = await this.provider.complete(messages, options);
      status = 'success';

      // Track successful request with token usage
      const durationSeconds = (Date.now() - startTime) / 1000;
      const tokenUsage = createTokenUsage(result.model, result.usage);

      trackLLMRequest(this.provider.name, status, durationSeconds, tokenUsage);

      return result;
    } catch (error) {
      // Track failed request without token usage
      const durationSeconds = (Date.now() - startTime) / 1000;
      trackLLMRequest(this.provider.name, status, durationSeconds);

      throw error;
    }
  }

  async completeWithSchema<T>(
    messages: LLMMessage[],
    schema: ZodSchema<T>,
    options?: LLMCompletionOptions
  ): Promise<LLMStructuredResult<T>> {
    const startTime = Date.now();
    let status: 'success' | 'failed' = 'failed';

    try {
      const result = await this.provider.completeWithSchema(messages, schema, options);
      status = 'success';

      // Track successful request with token usage
      const durationSeconds = (Date.now() - startTime) / 1000;
      const tokenUsage = createTokenUsage(result.model, result.usage);

      trackLLMRequest(this.provider.name, status, durationSeconds, tokenUsage);

      return result;
    } catch (error) {
      // Track failed request without token usage
      const durationSeconds = (Date.now() - startTime) / 1000;
      trackLLMRequest(this.provider.name, status, durationSeconds);

      throw error;
    }
  }
}

/**
 * Wrap an LLM provider with metrics tracking
 */
export function withMetrics(provider: LLMProvider): LLMProvider {
  return new MetricsTrackedLLMProvider(provider);
}
