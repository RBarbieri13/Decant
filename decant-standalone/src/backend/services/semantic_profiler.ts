// ============================================================
// Semantic Profile Service
// ============================================================
// Single unified LLM call that replaces Phase 1 classifier and
// Phase 2 enricher. Produces a complete semantic identity for
// each imported node in one synchronous step.

import { OpenAIProvider, type LLMStructuredResult } from './llm/provider.js';
import {
  SemanticProfileSchema,
  buildSemanticProfilePrompt,
  buildDescriptorString,
  createFallbackProfile,
  type SemanticProfile,
  type SemanticProfileInput,
} from './llm/prompts/semantic_profile.js';
import { log } from '../logger/index.js';

// ============================================================
// Types
// ============================================================

export interface ProfileResult {
  profile: SemanticProfile;
  descriptorString: string;
  fromFallback: boolean;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  durationMs: number;
}

export interface SemanticProfilerOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

// Re-export for consumers
export type { SemanticProfile, SemanticProfileInput };

// ============================================================
// Constants
// ============================================================

const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_TOKENS = 4000;
const DEFAULT_TIMEOUT = 30000;

// ============================================================
// SemanticProfiler
// ============================================================

export class SemanticProfiler {
  private provider: OpenAIProvider;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(apiKey: string, options: SemanticProfilerOptions = {}) {
    this.model = options.model ?? DEFAULT_MODEL;
    this.temperature = options.temperature ?? DEFAULT_TEMPERATURE;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

    this.provider = new OpenAIProvider({
      apiKey,
      defaultModel: this.model,
      enableCircuitBreaker: false,
    });
  }

  /**
   * Generate a semantic profile for a piece of content.
   * This is the single LLM call that replaces Phase 1 + Phase 2.
   */
  async profile(input: SemanticProfileInput): Promise<ProfileResult> {
    const startTime = Date.now();

    try {
      const prompt = buildSemanticProfilePrompt(input);

      const result: LLMStructuredResult<SemanticProfile> = await this.provider.completeWithSchema(
        [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        SemanticProfileSchema,
        {
          temperature: this.temperature,
          maxTokens: this.maxTokens,
        },
      );

      const profile = this.postProcess(result.data, input);
      const descriptorString = buildDescriptorString(profile, input.domain);

      log.info('Semantic profile generated', {
        module: 'semantic-profiler',
        url: input.url,
        title: profile.title.slice(0, 80),
        function: profile.primaryFunction,
        domain: profile.primaryDomain,
        type: profile.resourceType,
        confidence: profile.confidence,
        tokens: result.usage.totalTokens,
        durationMs: Date.now() - startTime,
      });

      return {
        profile,
        descriptorString,
        fromFallback: false,
        tokenUsage: result.usage,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      log.warn('Semantic profiling failed, using fallback', {
        module: 'semantic-profiler',
        url: input.url,
        error: error instanceof Error ? error.message : String(error),
      });

      const fallback = createFallbackProfile(input);
      const descriptorString = buildDescriptorString(fallback, input.domain);

      return {
        profile: fallback,
        descriptorString,
        fromFallback: true,
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Post-process the LLM output to normalize values.
   */
  private postProcess(profile: SemanticProfile, input: SemanticProfileInput): SemanticProfile {
    return {
      ...profile,
      // Normalize arrays to lowercase
      keyConcepts: profile.keyConcepts.map(c => c.toLowerCase().trim()).filter(Boolean),
      metadataTags: profile.metadataTags.map(t => t.toLowerCase().trim()).filter(Boolean),
      technologies: profile.technologies.map(t => t.trim()).filter(Boolean),
      concepts: profile.concepts.map(c => c.trim()).filter(Boolean),
      audience: profile.audience.map(a => a.trim()).filter(Boolean),
      platform: profile.platform.map(p => p.trim()).filter(Boolean),
      industry: profile.industry.map(i => i.trim()).filter(Boolean),
      pricing: profile.pricing.map(p => p.toLowerCase().trim()).filter(Boolean),
      // Clamp confidence
      confidence: Math.max(0, Math.min(1, profile.confidence)),
      // Use favicon from input if LLM didn't find a logo
      logoUrl: profile.logoUrl || input.favicon || null,
      // Ensure title isn't empty
      title: profile.title?.trim() || input.title || 'Untitled',
    };
  }
}

// ============================================================
// Singleton
// ============================================================

let instance: SemanticProfiler | null = null;

export function initializeSemanticProfiler(apiKey: string, options?: SemanticProfilerOptions): SemanticProfiler {
  instance = new SemanticProfiler(apiKey, options);
  return instance;
}

export function getSemanticProfiler(): SemanticProfiler {
  if (!instance) {
    throw new Error('SemanticProfiler not initialized. Call initializeSemanticProfiler() first.');
  }
  return instance;
}

export function hasSemanticProfiler(): boolean {
  return instance !== null;
}

export function clearSemanticProfiler(): void {
  instance = null;
}
