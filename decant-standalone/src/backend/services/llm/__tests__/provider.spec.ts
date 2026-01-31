// ============================================================
// LLM Provider Unit Tests
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

// Create mock for OpenAI chat completions
const mockCreate = vi.fn();

// Create a mock APIError class for testing
class MockAPIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'APIError';
    this.status = status;
  }
}

// Mock OpenAI module - need to use a function that returns the mock object
vi.mock('openai', () => {
  // Create a function constructor that returns the mock client
  function MockOpenAI() {
    return {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    };
  }

  // Attach APIError as a static property (like the real OpenAI SDK)
  MockOpenAI.APIError = MockAPIError;

  return {
    default: MockOpenAI,
    // Also export it directly for named imports
    APIError: MockAPIError,
  };
});

describe('LLM Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('OpenAIProvider', () => {
    describe('initialization', () => {
      it('should create provider with API key', async () => {
        const { OpenAIProvider } = await import('../provider.js');

        const provider = new OpenAIProvider({
          apiKey: 'test-api-key',
        });

        expect(provider).toBeDefined();
        expect(provider.name).toBe('openai');
      });

      it('should create provider with default model', async () => {
        const { OpenAIProvider } = await import('../provider.js');

        const provider = new OpenAIProvider({
          apiKey: 'test-api-key',
          defaultModel: 'gpt-4',
        });

        expect(provider).toBeDefined();
      });

      it('should create provider with organization', async () => {
        const { OpenAIProvider } = await import('../provider.js');

        const provider = new OpenAIProvider({
          apiKey: 'test-api-key',
          organization: 'org-123',
        });

        expect(provider).toBeDefined();
      });

      it('should create provider with custom base URL', async () => {
        const { OpenAIProvider } = await import('../provider.js');

        const provider = new OpenAIProvider({
          apiKey: 'test-api-key',
          baseURL: 'https://custom-api.example.com',
        });

        expect(provider).toBeDefined();
      });

      it('should create provider with custom retry config', async () => {
        const { OpenAIProvider } = await import('../provider.js');

        const provider = new OpenAIProvider({
          apiKey: 'test-api-key',
          retryConfig: {
            maxAttempts: 5,
            baseDelayMs: 500,
            maxDelayMs: 5000,
          },
        });

        expect(provider).toBeDefined();
      });
    });

    describe('complete', () => {
      it('should complete a conversation', async () => {
        const { OpenAIProvider } = await import('../provider.js');

        mockCreate.mockResolvedValue({
          choices: [{ message: { content: 'Hello, world!' } }],
          model: 'gpt-4o-mini',
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        });

        const provider = new OpenAIProvider({ apiKey: 'test-key' });
        const result = await provider.complete([
          { role: 'user', content: 'Say hello' },
        ]);

        expect(result.content).toBe('Hello, world!');
        expect(result.model).toBe('gpt-4o-mini');
        expect(result.usage.totalTokens).toBe(15);
      });

      it('should use custom model', async () => {
        const { OpenAIProvider } = await import('../provider.js');

        mockCreate.mockResolvedValue({
          choices: [{ message: { content: 'Response' } }],
          model: 'gpt-4',
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        });

        const provider = new OpenAIProvider({ apiKey: 'test-key' });
        await provider.complete(
          [{ role: 'user', content: 'Test' }],
          { model: 'gpt-4' }
        );

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ model: 'gpt-4' })
        );
      });

      it('should use custom temperature', async () => {
        const { OpenAIProvider } = await import('../provider.js');

        mockCreate.mockResolvedValue({
          choices: [{ message: { content: 'Response' } }],
          model: 'gpt-4o-mini',
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        });

        const provider = new OpenAIProvider({ apiKey: 'test-key' });
        await provider.complete(
          [{ role: 'user', content: 'Test' }],
          { temperature: 0.7 }
        );

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ temperature: 0.7 })
        );
      });

      it('should use custom max tokens', async () => {
        const { OpenAIProvider } = await import('../provider.js');

        mockCreate.mockResolvedValue({
          choices: [{ message: { content: 'Response' } }],
          model: 'gpt-4o-mini',
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        });

        const provider = new OpenAIProvider({ apiKey: 'test-key' });
        await provider.complete(
          [{ role: 'user', content: 'Test' }],
          { maxTokens: 1000 }
        );

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ max_tokens: 1000 })
        );
      });

      it('should throw on empty response', async () => {
        const { OpenAIProvider } = await import('../provider.js');

        mockCreate.mockResolvedValue({
          choices: [{ message: { content: null } }],
          model: 'gpt-4o-mini',
          usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
        });

        const provider = new OpenAIProvider({ apiKey: 'test-key' });

        await expect(
          provider.complete([{ role: 'user', content: 'Test' }])
        ).rejects.toThrow('Empty response from OpenAI');
      });
    });

    describe('completeWithSchema', () => {
      it('should complete with schema validation', async () => {
        const { OpenAIProvider } = await import('../provider.js');

        const schema = z.object({
          name: z.string(),
          age: z.number(),
        });

        mockCreate.mockResolvedValue({
          choices: [
            { message: { content: JSON.stringify({ name: 'John', age: 30 }) } },
          ],
          model: 'gpt-4o-mini',
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        });

        const provider = new OpenAIProvider({ apiKey: 'test-key' });
        const result = await provider.completeWithSchema(
          [{ role: 'user', content: 'Extract person info' }],
          schema
        );

        expect(result.data).toEqual({ name: 'John', age: 30 });
        expect(result.raw).toBe(JSON.stringify({ name: 'John', age: 30 }));
      });

      it('should request JSON format', async () => {
        const { OpenAIProvider } = await import('../provider.js');

        const schema = z.object({ value: z.string() });

        mockCreate.mockResolvedValue({
          choices: [{ message: { content: JSON.stringify({ value: 'test' }) } }],
          model: 'gpt-4o-mini',
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        });

        const provider = new OpenAIProvider({ apiKey: 'test-key' });
        await provider.completeWithSchema(
          [{ role: 'user', content: 'Test' }],
          schema
        );

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            response_format: { type: 'json_object' },
          })
        );
      });

      it('should throw on invalid JSON response', async () => {
        const { OpenAIProvider } = await import('../provider.js');

        const schema = z.object({ value: z.string() });

        mockCreate.mockResolvedValue({
          choices: [{ message: { content: 'not valid json' } }],
          model: 'gpt-4o-mini',
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        });

        const provider = new OpenAIProvider({ apiKey: 'test-key' });

        await expect(
          provider.completeWithSchema(
            [{ role: 'user', content: 'Test' }],
            schema
          )
        ).rejects.toThrow('Failed to parse JSON');
      });

      it('should throw on schema validation failure', async () => {
        const { OpenAIProvider } = await import('../provider.js');

        const schema = z.object({
          name: z.string(),
          age: z.number(),
        });

        mockCreate.mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({ name: 'John', age: 'invalid' }),
              },
            },
          ],
          model: 'gpt-4o-mini',
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        });

        const provider = new OpenAIProvider({ apiKey: 'test-key' });

        await expect(
          provider.completeWithSchema(
            [{ role: 'user', content: 'Test' }],
            schema
          )
        ).rejects.toThrow('Schema validation failed');
      });
    });

    describe('retry logic', () => {
      it('should retry on rate limit errors (429)', async () => {
        const { OpenAIProvider } = await import('../provider.js');

        // First call fails with rate limit, second succeeds
        mockCreate
          .mockRejectedValueOnce(new MockAPIError('Rate limit exceeded', 429))
          .mockResolvedValueOnce({
            choices: [{ message: { content: 'Success after retry' } }],
            model: 'gpt-4o-mini',
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          });

        const provider = new OpenAIProvider({
          apiKey: 'test-key',
          retryConfig: {
            maxAttempts: 3,
            baseDelayMs: 10,
            maxDelayMs: 100,
          },
        });

        const result = await provider.complete([{ role: 'user', content: 'Test' }]);

        expect(result.content).toBe('Success after retry');
        expect(mockCreate).toHaveBeenCalledTimes(2);
      });

      it('should retry on server errors (500)', async () => {
        const { OpenAIProvider } = await import('../provider.js');

        mockCreate
          .mockRejectedValueOnce(new MockAPIError('Server error', 500))
          .mockResolvedValueOnce({
            choices: [{ message: { content: 'Success' } }],
            model: 'gpt-4o-mini',
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          });

        const provider = new OpenAIProvider({
          apiKey: 'test-key',
          retryConfig: {
            maxAttempts: 3,
            baseDelayMs: 10,
            maxDelayMs: 100,
          },
        });

        const result = await provider.complete([{ role: 'user', content: 'Test' }]);

        expect(result.content).toBe('Success');
        expect(mockCreate).toHaveBeenCalledTimes(2);
      });

      it('should not retry on non-retryable errors (401)', async () => {
        const { OpenAIProvider } = await import('../provider.js');

        mockCreate.mockRejectedValue(new MockAPIError('Invalid API key', 401));

        const provider = new OpenAIProvider({
          apiKey: 'test-key',
          retryConfig: {
            maxAttempts: 3,
            baseDelayMs: 10,
            maxDelayMs: 100,
          },
        });

        await expect(
          provider.complete([{ role: 'user', content: 'Test' }])
        ).rejects.toThrow('Invalid API key');

        expect(mockCreate).toHaveBeenCalledTimes(1);
      });

      it('should retry on network errors', async () => {
        const { OpenAIProvider } = await import('../provider.js');

        mockCreate
          .mockRejectedValueOnce(new Error('ECONNRESET'))
          .mockResolvedValueOnce({
            choices: [{ message: { content: 'Success' } }],
            model: 'gpt-4o-mini',
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          });

        const provider = new OpenAIProvider({
          apiKey: 'test-key',
          retryConfig: {
            maxAttempts: 3,
            baseDelayMs: 10,
            maxDelayMs: 100,
          },
        });

        const result = await provider.complete([{ role: 'user', content: 'Test' }]);

        expect(result.content).toBe('Success');
        expect(mockCreate).toHaveBeenCalledTimes(2);
      });

      it('should fail after max attempts', async () => {
        const { OpenAIProvider } = await import('../provider.js');

        mockCreate.mockRejectedValue(new MockAPIError('Rate limit exceeded', 429));

        const provider = new OpenAIProvider({
          apiKey: 'test-key',
          retryConfig: {
            maxAttempts: 2,
            baseDelayMs: 10,
            maxDelayMs: 100,
          },
        });

        await expect(
          provider.complete([{ role: 'user', content: 'Test' }])
        ).rejects.toThrow('Rate limit exceeded');

        expect(mockCreate).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Provider Factory', () => {
    describe('createProvider', () => {
      it('should create OpenAI provider', async () => {
        const { createProvider } = await import('../provider.js');

        const provider = createProvider({
          type: 'openai',
          apiKey: 'test-key',
        });

        expect(provider.name).toBe('openai');
      });

      it('should create OpenAI provider with custom model', async () => {
        const { createProvider } = await import('../provider.js');

        const provider = createProvider({
          type: 'openai',
          apiKey: 'test-key',
          model: 'gpt-4',
        });

        expect(provider.name).toBe('openai');
      });

      it('should throw on unsupported provider type', async () => {
        const { createProvider } = await import('../provider.js');

        expect(() =>
          createProvider({
            type: 'unsupported' as 'openai',
            apiKey: 'test-key',
          })
        ).toThrow('Unsupported provider type');
      });
    });
  });

  describe('Singleton Provider Manager', () => {
    it('should initialize default provider', async () => {
      const {
        initializeProvider,
        getProvider,
        hasProvider,
        clearProvider,
      } = await import('../provider.js');

      clearProvider();
      expect(hasProvider()).toBe(false);

      initializeProvider({
        type: 'openai',
        apiKey: 'test-key',
      });

      expect(hasProvider()).toBe(true);

      const provider = getProvider();
      expect(provider.name).toBe('openai');

      clearProvider();
    });

    it('should throw when getting uninitialized provider', async () => {
      const { getProvider, clearProvider } = await import('../provider.js');

      clearProvider();

      expect(() => getProvider()).toThrow('LLM provider not initialized');
    });

    it('should return same instance for singleton', async () => {
      const { initializeProvider, getProvider, clearProvider } = await import(
        '../provider.js'
      );

      clearProvider();

      const initialized = initializeProvider({
        type: 'openai',
        apiKey: 'test-key',
      });

      const retrieved = getProvider();

      expect(initialized).toBe(retrieved);

      clearProvider();
    });
  });

  describe('Response Parsing', () => {
    it('should handle missing usage data', async () => {
      const { OpenAIProvider } = await import('../provider.js');

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Response' } }],
        model: 'gpt-4o-mini',
        usage: undefined, // No usage data
      });

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const result = await provider.complete([
        { role: 'user', content: 'Test' },
      ]);

      expect(result.usage.promptTokens).toBe(0);
      expect(result.usage.completionTokens).toBe(0);
      expect(result.usage.totalTokens).toBe(0);
    });

    it('should handle partial usage data', async () => {
      const { OpenAIProvider } = await import('../provider.js');

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Response' } }],
        model: 'gpt-4o-mini',
        usage: {
          prompt_tokens: 10,
          // Missing completion_tokens and total_tokens
        },
      });

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const result = await provider.complete([
        { role: 'user', content: 'Test' },
      ]);

      expect(result.usage.promptTokens).toBe(10);
      expect(result.usage.completionTokens).toBe(0);
      expect(result.usage.totalTokens).toBe(0);
    });
  });

  describe('Rate Limit Handling', () => {
    it('should use exponential backoff on retries', async () => {
      const { OpenAIProvider } = await import('../provider.js');

      // Track timing between calls
      const callTimes: number[] = [];
      mockCreate.mockImplementation(() => {
        callTimes.push(Date.now());
        if (callTimes.length < 3) {
          return Promise.reject(new MockAPIError('Rate limit', 429));
        }
        return Promise.resolve({
          choices: [{ message: { content: 'Success' } }],
          model: 'gpt-4o-mini',
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        });
      });

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        retryConfig: {
          maxAttempts: 5,
          baseDelayMs: 50,
          maxDelayMs: 500,
        },
      });

      await provider.complete([{ role: 'user', content: 'Test' }]);

      // Verify delays increased (with some tolerance for jitter)
      const delay1 = callTimes[1] - callTimes[0];
      const delay2 = callTimes[2] - callTimes[1];

      expect(delay1).toBeGreaterThanOrEqual(40); // ~50ms base
      expect(delay2).toBeGreaterThanOrEqual(80); // ~100ms (2x base)
    });
  });
});
