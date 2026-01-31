// ============================================================
// Phase 1 Classification Service
// Quick classification for immediate content organization
// ============================================================

import type { LLMProvider, LLMMessage } from './llm/provider.js';
import {
  createProvider,
  OpenAIProvider,
  type CreateProviderOptions,
} from './llm/provider.js';
import {
  Phase1ClassificationSchema,
  PHASE1_SYSTEM_PROMPT,
  buildPhase1UserPrompt,
  DEFAULT_CLASSIFICATION,
  createFallbackClassification,
  type Phase1Classification,
  type Phase1PromptInput,
  SEGMENTS,
  CONTENT_TYPES,
  CATEGORIES,
} from './llm/prompts/phase1_classification.js';

// ============================================================
// Types
// ============================================================

/**
 * Input for Phase 1 classification
 */
export interface ClassifyInput {
  url: string;
  title: string;
  domain?: string;
  description?: string;
  author?: string;
  siteName?: string;
  content?: string;
}

/**
 * Result of Phase 1 classification
 */
export interface ClassifyResult {
  classification: Phase1Classification;
  fromCache: boolean;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

/**
 * Options for the Phase 1 Classifier
 */
export interface Phase1ClassifierOptions {
  /** Model to use for classification */
  model?: string;
  /** Temperature for LLM (lower = more deterministic) */
  temperature?: number;
  /** Enable result caching */
  enableCache?: boolean;
  /** Cache TTL in milliseconds */
  cacheTtlMs?: number;
}

// ============================================================
// Simple In-Memory Cache
// ============================================================

interface CacheEntry {
  classification: Phase1Classification;
  expiresAt: number;
}

class ClassificationCache {
  private cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  constructor(ttlMs: number = 3600000) { // 1 hour default
    this.ttlMs = ttlMs;
  }

  /**
   * Generate cache key from URL
   */
  private getKey(url: string): string {
    return url.toLowerCase().trim();
  }

  /**
   * Get cached classification if valid
   */
  get(url: string): Phase1Classification | null {
    const key = this.getKey(url);
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.classification;
  }

  /**
   * Store classification in cache
   */
  set(url: string, classification: Phase1Classification): void {
    const key = this.getKey(url);
    this.cache.set(key, {
      classification,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * Clear expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }
}

// ============================================================
// Phase 1 Classifier Service
// ============================================================

export class Phase1Classifier {
  private provider: LLMProvider;
  private model: string;
  private temperature: number;
  private cache: ClassificationCache | null;

  constructor(
    apiKey: string,
    options: Phase1ClassifierOptions = {}
  ) {
    // Create OpenAI provider
    this.provider = new OpenAIProvider({
      apiKey,
      defaultModel: options.model || 'gpt-4o-mini',
    });

    this.model = options.model || 'gpt-4o-mini';
    this.temperature = options.temperature ?? 0.2; // Low temperature for consistency

    // Initialize cache if enabled
    this.cache = options.enableCache !== false
      ? new ClassificationCache(options.cacheTtlMs)
      : null;
  }

  /**
   * Classify content using Phase 1 classification
   */
  async classify(input: ClassifyInput): Promise<ClassifyResult> {
    // Check cache first
    if (this.cache) {
      const cached = this.cache.get(input.url);
      if (cached) {
        return {
          classification: cached,
          fromCache: true,
        };
      }
    }

    try {
      // Build prompt
      const promptInput: Phase1PromptInput = {
        url: input.url,
        title: input.title,
        domain: input.domain,
        description: input.description,
        author: input.author,
        siteName: input.siteName,
        contentExcerpt: input.content,
      };

      const userPrompt = buildPhase1UserPrompt(promptInput);

      // Build messages
      const messages: LLMMessage[] = [
        { role: 'system', content: PHASE1_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ];

      // Call LLM with schema validation
      const result = await this.provider.completeWithSchema(
        messages,
        Phase1ClassificationSchema,
        {
          model: this.model,
          temperature: this.temperature,
          maxTokens: 500, // Phase 1 responses are small
        }
      );

      // Validate the category matches the segment
      const validatedClassification = this.validateAndFixClassification(result.data);

      // Cache successful result
      if (this.cache) {
        this.cache.set(input.url, validatedClassification);
      }

      return {
        classification: validatedClassification,
        fromCache: false,
        tokenUsage: {
          prompt: result.usage.promptTokens,
          completion: result.usage.completionTokens,
          total: result.usage.totalTokens,
        },
      };
    } catch (error) {
      console.error('Phase 1 classification failed:', error);

      // Attempt to extract useful information from the error
      const fallback = this.createIntelligentFallback(input, error);

      return {
        classification: fallback,
        fromCache: false,
      };
    }
  }

  /**
   * Validate and fix classification to ensure consistency
   */
  private validateAndFixClassification(
    classification: Phase1Classification
  ): Phase1Classification {
    const { segment, category, contentType, organization, confidence, reasoning } = classification;

    // Validate segment
    const validSegment = segment in SEGMENTS ? segment : 'T';

    // Validate content type
    const validContentType = contentType in CONTENT_TYPES ? contentType : 'A';

    // Validate category belongs to segment
    const segmentCategories = CATEGORIES[validSegment as keyof typeof CATEGORIES];
    const validCategory = segmentCategories && category in segmentCategories
      ? category
      : 'OTH';

    // Validate organization format (4 uppercase letters or underscores)
    const orgRegex = /^[A-Z_]{4}$/;
    const validOrganization = orgRegex.test(organization) ? organization : 'UNKN';

    // Validate confidence
    const validConfidence = typeof confidence === 'number'
      ? Math.max(0, Math.min(1, confidence))
      : 0.5;

    return {
      segment: validSegment,
      category: validCategory,
      contentType: validContentType,
      organization: validOrganization,
      confidence: validConfidence,
      reasoning: reasoning?.slice(0, 200),
    };
  }

  /**
   * Create an intelligent fallback based on URL/domain hints
   */
  private createIntelligentFallback(
    input: ClassifyInput,
    _error: unknown
  ): Phase1Classification {
    const domain = input.domain?.toLowerCase() || '';
    const title = input.title?.toLowerCase() || '';
    const url = input.url?.toLowerCase() || '';

    // Try to detect segment from common domain patterns
    let segment = 'T'; // Default to Technology
    let category = 'OTH';
    let contentType = 'A'; // Default to Article
    let organization = 'UNKN';

    // AI-related detection
    if (
      domain.includes('openai') ||
      domain.includes('anthropic') ||
      domain.includes('huggingface') ||
      title.includes('ai ') ||
      title.includes('llm') ||
      title.includes('gpt') ||
      title.includes('claude')
    ) {
      segment = 'A';
      category = 'LLM';
      if (domain.includes('openai')) organization = 'OAIA';
      if (domain.includes('anthropic')) organization = 'ANTH';
    }

    // GitHub detection
    if (domain.includes('github')) {
      segment = 'T';
      contentType = 'R';
      category = 'DEV';
      organization = 'GHUB';
    }

    // YouTube detection
    if (domain.includes('youtube') || domain.includes('youtu.be')) {
      contentType = 'V';
      organization = 'GOOG';
    }

    // Twitter/X detection
    if (domain.includes('twitter') || domain.includes('x.com')) {
      contentType = 'S';
      organization = 'TWTR';
    }

    // LinkedIn detection
    if (domain.includes('linkedin')) {
      segment = 'B';
      category = 'OTH';
      organization = 'LINK';
    }

    // ArXiv / research paper detection
    if (domain.includes('arxiv') || url.includes('.pdf')) {
      contentType = 'P';
      segment = 'X';
      category = 'OTH';
    }

    return createFallbackClassification({
      segment,
      category,
      contentType,
      organization,
      confidence: 0.3, // Low confidence for fallback
      reasoning: 'Fallback classification based on URL patterns',
    });
  }

  /**
   * Clear the classification cache
   */
  clearCache(): void {
    this.cache?.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { enabled: boolean; size: number } {
    return {
      enabled: this.cache !== null,
      size: this.cache?.size ?? 0,
    };
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * Create a Phase 1 Classifier instance
 */
export function createPhase1Classifier(
  apiKey: string,
  options?: Phase1ClassifierOptions
): Phase1Classifier {
  return new Phase1Classifier(apiKey, options);
}

// ============================================================
// Singleton Instance Management
// ============================================================

let defaultClassifier: Phase1Classifier | null = null;

/**
 * Initialize the default Phase 1 classifier
 */
export function initializePhase1Classifier(
  apiKey: string,
  options?: Phase1ClassifierOptions
): Phase1Classifier {
  defaultClassifier = new Phase1Classifier(apiKey, options);
  return defaultClassifier;
}

/**
 * Get the default Phase 1 classifier (throws if not initialized)
 */
export function getPhase1Classifier(): Phase1Classifier {
  if (!defaultClassifier) {
    throw new Error(
      'Phase 1 Classifier not initialized. Call initializePhase1Classifier() first.'
    );
  }
  return defaultClassifier;
}

/**
 * Check if the Phase 1 classifier is initialized
 */
export function hasPhase1Classifier(): boolean {
  return defaultClassifier !== null;
}

/**
 * Clear the default classifier (useful for testing)
 */
export function clearPhase1Classifier(): void {
  defaultClassifier = null;
}

// ============================================================
// Convenience Export for Direct Classification
// ============================================================

/**
 * Classify content directly (requires default classifier to be initialized)
 */
export async function classifyPhase1(input: ClassifyInput): Promise<ClassifyResult> {
  return getPhase1Classifier().classify(input);
}

// Re-export types and constants for convenience
export type { Phase1Classification } from './llm/prompts/phase1_classification.js';
export {
  SEGMENTS,
  CONTENT_TYPES,
  CATEGORIES,
  COMMON_ORGANIZATIONS,
} from './llm/prompts/phase1_classification.js';
