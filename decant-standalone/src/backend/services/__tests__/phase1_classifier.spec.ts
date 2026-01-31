// ============================================================
// Phase 1 Classifier Service Unit Tests
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock for the LLMProvider completeWithSchema
const mockCompleteWithSchema = vi.fn();
const mockComplete = vi.fn();

// Mock the provider module - use function constructor pattern like provider tests
vi.mock('../llm/provider.js', () => {
  // Create a proper class-like function constructor
  function MockOpenAIProvider() {
    return {
      name: 'openai',
      complete: mockComplete,
      completeWithSchema: mockCompleteWithSchema,
    };
  }

  return {
    OpenAIProvider: MockOpenAIProvider,
    createProvider: vi.fn(() => ({
      name: 'openai',
      complete: mockComplete,
      completeWithSchema: mockCompleteWithSchema,
    })),
  };
});

describe('Phase 1 Classifier Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Phase1Classifier class', () => {
    describe('constructor', () => {
      it('should create classifier with default options', async () => {
        const { Phase1Classifier } = await import('../phase1_classifier.js');
        const classifier = new Phase1Classifier('test-api-key');

        expect(classifier).toBeDefined();
      });

      it('should create classifier with custom model', async () => {
        const { Phase1Classifier } = await import('../phase1_classifier.js');
        const classifier = new Phase1Classifier('test-api-key', {
          model: 'gpt-4',
        });

        expect(classifier).toBeDefined();
      });

      it('should create classifier with custom temperature', async () => {
        const { Phase1Classifier } = await import('../phase1_classifier.js');
        const classifier = new Phase1Classifier('test-api-key', {
          temperature: 0.5,
        });

        expect(classifier).toBeDefined();
      });

      it('should create classifier with cache disabled', async () => {
        const { Phase1Classifier } = await import('../phase1_classifier.js');
        const classifier = new Phase1Classifier('test-api-key', {
          enableCache: false,
        });

        const stats = classifier.getCacheStats();
        expect(stats.enabled).toBe(false);
      });

      it('should create classifier with custom cache TTL', async () => {
        const { Phase1Classifier } = await import('../phase1_classifier.js');
        const classifier = new Phase1Classifier('test-api-key', {
          cacheTtlMs: 7200000, // 2 hours
        });

        const stats = classifier.getCacheStats();
        expect(stats.enabled).toBe(true);
      });
    });

    describe('classify', () => {
      it('should classify a YouTube URL', async () => {
        const { Phase1Classifier } = await import('../phase1_classifier.js');

        const mockResponse = {
          data: {
            segment: 'E',
            category: 'STR',
            contentType: 'V',
            organization: 'GOOG',
            confidence: 0.95,
            reasoning: 'YouTube video content',
          },
          raw: '{}',
          model: 'gpt-4o-mini',
          usage: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
          },
        };

        mockCompleteWithSchema.mockResolvedValue(mockResponse);

        const classifier = new Phase1Classifier('test-api-key');
        const result = await classifier.classify({
          url: 'https://www.youtube.com/watch?v=abc123',
          title: 'How to Code in Python',
          domain: 'youtube.com',
        });

        expect(result.classification.segment).toBe('E');
        expect(result.classification.contentType).toBe('V');
        expect(result.classification.organization).toBe('GOOG');
        expect(result.fromCache).toBe(false);
        expect(result.tokenUsage).toBeDefined();
        expect(result.tokenUsage?.total).toBe(150);
      });

      it('should classify a GitHub repository', async () => {
        const { Phase1Classifier } = await import('../phase1_classifier.js');

        const mockResponse = {
          data: {
            segment: 'T',
            category: 'DEV',
            contentType: 'R',
            organization: 'GHUB',
            confidence: 0.9,
            reasoning: 'GitHub repository',
          },
          raw: '{}',
          model: 'gpt-4o-mini',
          usage: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
          },
        };

        mockCompleteWithSchema.mockResolvedValue(mockResponse);

        const classifier = new Phase1Classifier('test-api-key');
        const result = await classifier.classify({
          url: 'https://github.com/anthropics/claude-code',
          title: 'Claude Code - AI Coding Assistant',
          domain: 'github.com',
        });

        expect(result.classification.segment).toBe('T');
        expect(result.classification.contentType).toBe('R');
        expect(result.classification.organization).toBe('GHUB');
      });

      it('should classify an article', async () => {
        const { Phase1Classifier } = await import('../phase1_classifier.js');

        const mockResponse = {
          data: {
            segment: 'A',
            category: 'LLM',
            contentType: 'A',
            organization: 'ANTH',
            confidence: 0.88,
            reasoning: 'Blog article about AI',
          },
          raw: '{}',
          model: 'gpt-4o-mini',
          usage: {
            promptTokens: 150,
            completionTokens: 60,
            totalTokens: 210,
          },
        };

        mockCompleteWithSchema.mockResolvedValue(mockResponse);

        const classifier = new Phase1Classifier('test-api-key');
        const result = await classifier.classify({
          url: 'https://www.anthropic.com/news/claude-3-5-sonnet',
          title: 'Introducing Claude 3.5 Sonnet',
          domain: 'anthropic.com',
          description: 'The latest Claude model with improved capabilities',
        });

        expect(result.classification.segment).toBe('A');
        expect(result.classification.contentType).toBe('A');
        expect(result.classification.organization).toBe('ANTH');
        expect(result.fromCache).toBe(false);
      });
    });

    describe('caching behavior', () => {
      it('should return cached result for same URL', async () => {
        const { Phase1Classifier } = await import('../phase1_classifier.js');

        const mockResponse = {
          data: {
            segment: 'T',
            category: 'DEV',
            contentType: 'A',
            organization: 'UNKN',
            confidence: 0.8,
            reasoning: 'Tech article',
          },
          raw: '{}',
          model: 'gpt-4o-mini',
          usage: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
          },
        };

        mockCompleteWithSchema.mockResolvedValue(mockResponse);

        const classifier = new Phase1Classifier('test-api-key');

        // First call - should hit LLM
        const result1 = await classifier.classify({
          url: 'https://example.com/article',
          title: 'Test Article',
        });
        expect(result1.fromCache).toBe(false);
        expect(mockCompleteWithSchema).toHaveBeenCalledTimes(1);

        // Second call - should hit cache
        const result2 = await classifier.classify({
          url: 'https://example.com/article',
          title: 'Test Article',
        });
        expect(result2.fromCache).toBe(true);
        expect(mockCompleteWithSchema).toHaveBeenCalledTimes(1); // Not called again

        // Same classification
        expect(result1.classification).toEqual(result2.classification);
      });

      it('should not cache when cache is disabled', async () => {
        const { Phase1Classifier } = await import('../phase1_classifier.js');

        const mockResponse = {
          data: {
            segment: 'T',
            category: 'DEV',
            contentType: 'A',
            organization: 'UNKN',
            confidence: 0.8,
            reasoning: 'Tech article',
          },
          raw: '{}',
          model: 'gpt-4o-mini',
          usage: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
          },
        };

        mockCompleteWithSchema.mockResolvedValue(mockResponse);

        const classifier = new Phase1Classifier('test-api-key', {
          enableCache: false,
        });

        await classifier.classify({
          url: 'https://example.com/no-cache',
          title: 'No Cache Article',
        });

        const result2 = await classifier.classify({
          url: 'https://example.com/no-cache',
          title: 'No Cache Article',
        });

        expect(result2.fromCache).toBe(false);
        expect(mockCompleteWithSchema).toHaveBeenCalledTimes(2);
      });

      it('should clear cache', async () => {
        const { Phase1Classifier } = await import('../phase1_classifier.js');

        const mockResponse = {
          data: {
            segment: 'T',
            category: 'OTH',
            contentType: 'A',
            organization: 'UNKN',
            confidence: 0.8,
          },
          raw: '{}',
          model: 'gpt-4o-mini',
          usage: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
          },
        };

        mockCompleteWithSchema.mockResolvedValue(mockResponse);

        const classifier = new Phase1Classifier('test-api-key');

        await classifier.classify({
          url: 'https://example.com/to-clear',
          title: 'Clear Test',
        });

        let stats = classifier.getCacheStats();
        expect(stats.size).toBe(1);

        classifier.clearCache();

        stats = classifier.getCacheStats();
        expect(stats.size).toBe(0);
      });
    });

    describe('confidence thresholds', () => {
      it('should return high confidence for clear cases', async () => {
        const { Phase1Classifier } = await import('../phase1_classifier.js');

        const mockResponse = {
          data: {
            segment: 'A',
            category: 'LLM',
            contentType: 'T',
            organization: 'OAIA',
            confidence: 0.95,
            reasoning: 'OpenAI ChatGPT tool',
          },
          raw: '{}',
          model: 'gpt-4o-mini',
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        };

        mockCompleteWithSchema.mockResolvedValue(mockResponse);

        const classifier = new Phase1Classifier('test-api-key');
        const result = await classifier.classify({
          url: 'https://chat.openai.com/',
          title: 'ChatGPT',
          domain: 'openai.com',
        });

        expect(result.classification.confidence).toBeGreaterThanOrEqual(0.9);
      });

      it('should clamp confidence to valid range', async () => {
        const { Phase1Classifier } = await import('../phase1_classifier.js');

        const mockResponse = {
          data: {
            segment: 'T',
            category: 'OTH',
            contentType: 'A',
            organization: 'UNKN',
            confidence: 1.5, // Invalid - over 1
            reasoning: 'Test',
          },
          raw: '{}',
          model: 'gpt-4o-mini',
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        };

        mockCompleteWithSchema.mockResolvedValue(mockResponse);

        const classifier = new Phase1Classifier('test-api-key');
        const result = await classifier.classify({
          url: 'https://example.com/overflow',
          title: 'Overflow Test',
        });

        expect(result.classification.confidence).toBeLessThanOrEqual(1);
        expect(result.classification.confidence).toBeGreaterThanOrEqual(0);
      });
    });

    describe('error handling', () => {
      it('should return fallback classification when LLM fails', async () => {
        const { Phase1Classifier } = await import('../phase1_classifier.js');

        mockCompleteWithSchema.mockRejectedValue(new Error('API Error'));

        const classifier = new Phase1Classifier('test-api-key');
        const result = await classifier.classify({
          url: 'https://example.com/error',
          title: 'Error Test',
        });

        expect(result.classification).toBeDefined();
        expect(result.classification.confidence).toBeLessThan(0.5);
        expect(result.fromCache).toBe(false);
      });

      it('should use intelligent fallback based on URL patterns', async () => {
        const { Phase1Classifier } = await import('../phase1_classifier.js');

        mockCompleteWithSchema.mockRejectedValue(new Error('API Error'));

        const classifier = new Phase1Classifier('test-api-key');

        // Test GitHub fallback
        const githubResult = await classifier.classify({
          url: 'https://github.com/user/repo',
          title: 'Some Repo',
          domain: 'github.com',
        });

        expect(githubResult.classification.contentType).toBe('R'); // Repository
        expect(githubResult.classification.organization).toBe('GHUB');

        // Test YouTube fallback
        const youtubeResult = await classifier.classify({
          url: 'https://youtube.com/watch?v=xyz',
          title: 'Some Video',
          domain: 'youtube.com',
        });

        expect(youtubeResult.classification.contentType).toBe('V'); // Video
        expect(youtubeResult.classification.organization).toBe('GOOG');
      });

      it('should handle rate limit errors gracefully', async () => {
        const { Phase1Classifier } = await import('../phase1_classifier.js');

        mockCompleteWithSchema.mockRejectedValue(
          Object.assign(new Error('Rate limit exceeded'), { status: 429 })
        );

        const classifier = new Phase1Classifier('test-api-key');
        const result = await classifier.classify({
          url: 'https://example.com/rate-limited',
          title: 'Rate Limited Test',
        });

        // Should still return a fallback
        expect(result.classification).toBeDefined();
        expect(result.fromCache).toBe(false);
      });

      it('should handle network errors', async () => {
        const { Phase1Classifier } = await import('../phase1_classifier.js');

        mockCompleteWithSchema.mockRejectedValue(new Error('ENOTFOUND'));

        const classifier = new Phase1Classifier('test-api-key');
        const result = await classifier.classify({
          url: 'https://example.com/network-error',
          title: 'Network Error Test',
        });

        expect(result.classification).toBeDefined();
      });
    });

    describe('validation and fixing', () => {
      it('should fix invalid segment code', async () => {
        const { Phase1Classifier } = await import('../phase1_classifier.js');

        const mockResponse = {
          data: {
            segment: 'Z', // Invalid
            category: 'OTH',
            contentType: 'A',
            organization: 'UNKN',
            confidence: 0.8,
          },
          raw: '{}',
          model: 'gpt-4o-mini',
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        };

        mockCompleteWithSchema.mockResolvedValue(mockResponse);

        const classifier = new Phase1Classifier('test-api-key');
        const result = await classifier.classify({
          url: 'https://example.com/invalid-segment',
          title: 'Invalid Segment Test',
        });

        expect(result.classification.segment).toBe('T'); // Default
      });

      it('should fix invalid organization format', async () => {
        const { Phase1Classifier } = await import('../phase1_classifier.js');

        const mockResponse = {
          data: {
            segment: 'T',
            category: 'OTH',
            contentType: 'A',
            organization: 'invalid', // Should be 4 uppercase letters
            confidence: 0.8,
          },
          raw: '{}',
          model: 'gpt-4o-mini',
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        };

        mockCompleteWithSchema.mockResolvedValue(mockResponse);

        const classifier = new Phase1Classifier('test-api-key');
        const result = await classifier.classify({
          url: 'https://example.com/invalid-org',
          title: 'Invalid Org Test',
        });

        expect(result.classification.organization).toBe('UNKN');
      });

      it('should truncate long reasoning', async () => {
        const { Phase1Classifier } = await import('../phase1_classifier.js');

        const mockResponse = {
          data: {
            segment: 'T',
            category: 'OTH',
            contentType: 'A',
            organization: 'UNKN',
            confidence: 0.8,
            reasoning: 'A'.repeat(300), // Over 200 chars
          },
          raw: '{}',
          model: 'gpt-4o-mini',
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        };

        mockCompleteWithSchema.mockResolvedValue(mockResponse);

        const classifier = new Phase1Classifier('test-api-key');
        const result = await classifier.classify({
          url: 'https://example.com/long-reasoning',
          title: 'Long Reasoning Test',
        });

        expect(result.classification.reasoning?.length).toBeLessThanOrEqual(200);
      });
    });
  });

  describe('Factory and Singleton Functions', () => {
    it('should create classifier with factory function', async () => {
      const { createPhase1Classifier } = await import('../phase1_classifier.js');

      const classifier = createPhase1Classifier('test-api-key', {
        model: 'gpt-4',
      });

      expect(classifier).toBeDefined();
    });

    it('should initialize default classifier', async () => {
      const {
        initializePhase1Classifier,
        getPhase1Classifier,
        hasPhase1Classifier,
        clearPhase1Classifier,
      } = await import('../phase1_classifier.js');

      // Clear any existing classifier
      clearPhase1Classifier();
      expect(hasPhase1Classifier()).toBe(false);

      // Initialize
      initializePhase1Classifier('test-api-key');
      expect(hasPhase1Classifier()).toBe(true);

      // Get should not throw
      const classifier = getPhase1Classifier();
      expect(classifier).toBeDefined();

      // Clean up
      clearPhase1Classifier();
    });

    it('should throw when getting uninitialized classifier', async () => {
      const {
        getPhase1Classifier,
        clearPhase1Classifier,
      } = await import('../phase1_classifier.js');

      clearPhase1Classifier();

      expect(() => getPhase1Classifier()).toThrow(
        'Phase 1 Classifier not initialized'
      );
    });

    it('should classify directly with default classifier', async () => {
      const {
        initializePhase1Classifier,
        classifyPhase1,
        clearPhase1Classifier,
      } = await import('../phase1_classifier.js');

      const mockResponse = {
        data: {
          segment: 'T',
          category: 'OTH',
          contentType: 'A',
          organization: 'UNKN',
          confidence: 0.8,
        },
        raw: '{}',
        model: 'gpt-4o-mini',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      };

      mockCompleteWithSchema.mockResolvedValue(mockResponse);

      initializePhase1Classifier('test-api-key');

      const result = await classifyPhase1({
        url: 'https://example.com/direct',
        title: 'Direct Classification',
      });

      expect(result.classification).toBeDefined();

      clearPhase1Classifier();
    });
  });

  describe('Re-exported Constants', () => {
    it('should export SEGMENTS constant', async () => {
      const { SEGMENTS } = await import('../phase1_classifier.js');

      expect(SEGMENTS).toBeDefined();
      expect(SEGMENTS.A).toContain('AI');
      expect(SEGMENTS.T).toContain('Technology');
    });

    it('should export CONTENT_TYPES constant', async () => {
      const { CONTENT_TYPES } = await import('../phase1_classifier.js');

      expect(CONTENT_TYPES).toBeDefined();
      expect(CONTENT_TYPES.V).toContain('Video');
      expect(CONTENT_TYPES.R).toContain('Repository');
    });

    it('should export CATEGORIES constant', async () => {
      const { CATEGORIES } = await import('../phase1_classifier.js');

      expect(CATEGORIES).toBeDefined();
      expect(CATEGORIES.A).toBeDefined(); // AI categories
      expect(CATEGORIES.T).toBeDefined(); // Tech categories
    });

    it('should export COMMON_ORGANIZATIONS constant', async () => {
      const { COMMON_ORGANIZATIONS } = await import('../phase1_classifier.js');

      expect(COMMON_ORGANIZATIONS).toBeDefined();
      expect(COMMON_ORGANIZATIONS.ANTH).toBe('Anthropic');
      expect(COMMON_ORGANIZATIONS.OAIA).toBe('OpenAI');
    });
  });

  describe('Different URL Type Classifications', () => {
    it('should classify ArXiv papers correctly', async () => {
      const { Phase1Classifier } = await import('../phase1_classifier.js');

      const mockResponse = {
        data: {
          segment: 'X',
          category: 'OTH',
          contentType: 'P',
          organization: 'ARXV',
          confidence: 0.92,
          reasoning: 'Academic paper on ArXiv',
        },
        raw: '{}',
        model: 'gpt-4o-mini',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      };

      mockCompleteWithSchema.mockResolvedValue(mockResponse);

      const classifier = new Phase1Classifier('test-api-key');
      const result = await classifier.classify({
        url: 'https://arxiv.org/abs/2301.00001',
        title: 'A Novel Approach to Machine Learning',
        domain: 'arxiv.org',
      });

      expect(result.classification.contentType).toBe('P');
      expect(result.classification.segment).toBe('X');
    });

    it('should classify Twitter/X posts correctly', async () => {
      const { Phase1Classifier } = await import('../phase1_classifier.js');

      const mockResponse = {
        data: {
          segment: 'T',
          category: 'OTH',
          contentType: 'S',
          organization: 'TWTR',
          confidence: 0.85,
          reasoning: 'Social media post',
        },
        raw: '{}',
        model: 'gpt-4o-mini',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      };

      mockCompleteWithSchema.mockResolvedValue(mockResponse);

      const classifier = new Phase1Classifier('test-api-key');
      const result = await classifier.classify({
        url: 'https://x.com/user/status/123456789',
        title: 'A tweet about AI',
        domain: 'x.com',
      });

      expect(result.classification.contentType).toBe('S');
      expect(result.classification.organization).toBe('TWTR');
    });

    it('should classify LinkedIn content correctly', async () => {
      const { Phase1Classifier } = await import('../phase1_classifier.js');

      const mockResponse = {
        data: {
          segment: 'B',
          category: 'OTH',
          contentType: 'A',
          organization: 'LINK',
          confidence: 0.82,
          reasoning: 'LinkedIn professional content',
        },
        raw: '{}',
        model: 'gpt-4o-mini',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      };

      mockCompleteWithSchema.mockResolvedValue(mockResponse);

      const classifier = new Phase1Classifier('test-api-key');
      const result = await classifier.classify({
        url: 'https://www.linkedin.com/pulse/article-about-tech',
        title: 'Tech Leadership Article',
        domain: 'linkedin.com',
      });

      expect(result.classification.segment).toBe('B');
      expect(result.classification.organization).toBe('LINK');
    });
  });
});
