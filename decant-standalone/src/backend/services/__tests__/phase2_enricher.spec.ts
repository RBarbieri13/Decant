// ============================================================
// Phase 2 Enricher Service Unit Tests
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Setup mocks before any imports
const mockCreate = vi.fn();

// Use hoisted mocks to ensure they're applied before module loading
vi.mock('openai', () => ({
  default: vi.fn(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

// Mock database
vi.mock('../../database/connection.js', () => ({
  getDatabase: vi.fn(() => ({
    prepare: vi.fn().mockReturnValue({
      get: vi.fn(),
      run: vi.fn(),
    }),
  })),
}));

vi.mock('../../database/transaction.js', () => ({
  withTransaction: (fn: () => unknown) => fn(),
}));

// Mock database nodes
const mockReadNode = vi.fn();
const mockUpdateNode = vi.fn();
vi.mock('../../database/nodes.js', () => ({
  readNode: (...args: unknown[]) => mockReadNode(...args),
  updateNode: (...args: unknown[]) => mockUpdateNode(...args),
}));

// Mock metadata registry
const mockGetOrCreateCode = vi.fn();
const mockSetMetadataForNode = vi.fn();
vi.mock('../metadata_registry.js', () => ({
  getOrCreateCode: (...args: unknown[]) => mockGetOrCreateCode(...args),
  setMetadataForNode: (...args: unknown[]) => mockSetMetadataForNode(...args),
}));

// Mock logger
const mockLogWarn = vi.fn();
const mockLogInfo = vi.fn();
const mockLogError = vi.fn();
const mockLogDebug = vi.fn();
vi.mock('../../logger/index.js', () => ({
  log: {
    info: (...args: unknown[]) => mockLogInfo(...args),
    warn: (...args: unknown[]) => mockLogWarn(...args),
    error: (...args: unknown[]) => mockLogError(...args),
    debug: (...args: unknown[]) => mockLogDebug(...args),
  },
}));

describe('Phase 2 Enricher Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Phase2Enricher class', () => {
    describe('constructor', () => {
      it('should create enricher with required config', async () => {
        const { Phase2Enricher } = await import('../phase2_enricher.js');

        const enricher = new Phase2Enricher({
          apiKey: 'test-api-key',
        });

        expect(enricher).toBeDefined();
      });

      it('should create enricher with custom model', async () => {
        const { Phase2Enricher } = await import('../phase2_enricher.js');

        const enricher = new Phase2Enricher({
          apiKey: 'test-api-key',
          model: 'gpt-4',
        });

        expect(enricher).toBeDefined();
      });

      it('should create enricher with custom settings', async () => {
        const { Phase2Enricher } = await import('../phase2_enricher.js');

        const enricher = new Phase2Enricher({
          apiKey: 'test-api-key',
          model: 'gpt-4o',
          temperature: 0.5,
          maxTokens: 3000,
          timeout: 90000,
        });

        expect(enricher).toBeDefined();
      });
    });

    describe('enrich', () => {
      it('should populate all 9 enrichment fields', async () => {
        const { Phase2Enricher } = await import('../phase2_enricher.js');

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: 'Enriched Title',
                  company: 'Test Company',
                  phraseDescription: 'A short tagline',
                  shortDescription: 'A longer description of the content.',
                  aiSummary: 'Comprehensive summary with multiple paragraphs.',
                  keyConcepts: ['ai', 'machine learning', 'nlp'],
                  metadataTags: ['tech', 'tutorial'],
                  logoUrl: 'https://example.com/logo.png',
                  metadataCodes: {
                    ORG: ['ANTHROPIC'],
                    DOM: ['AI_ML'],
                    FNC: ['CODEGEN'],
                    TEC: ['PYTHON', 'API'],
                    CON: ['LLM', 'PROMPT_ENGINEERING'],
                    IND: ['TECHNOLOGY'],
                    AUD: ['DEVELOPER'],
                    PRC: ['FREEMIUM'],
                    PLT: ['WEB', 'API'],
                  },
                  codeConfidence: 0.92,
                }),
              },
            },
          ],
        };

        mockCreate.mockResolvedValue(mockResponse);

        const enricher = new Phase2Enricher({ apiKey: 'test-key' });
        const result = await enricher.enrich({
          nodeId: 'test-node',
          url: 'https://example.com/article',
          domain: 'example.com',
          title: 'Original Title',
        });

        expect(result.success).toBe(true);
        expect(result.enrichment).toBeDefined();

        const e = result.enrichment!;
        // Verify all 9 fields
        expect(e.title).toBe('Enriched Title');
        expect(e.company).toBe('Test Company');
        expect(e.phraseDescription).toBe('A short tagline');
        expect(e.shortDescription).toBe('A longer description of the content.');
        expect(e.aiSummary).toBeDefined();
        expect(e.keyConcepts).toContain('ai');
        expect(e.metadataTags).toContain('tech');
        expect(e.logoUrl).toBe('https://example.com/logo.png');
        expect(e.metadataCodes).toBeDefined();
        expect(e.descriptorString).toBeDefined();
      });

      it('should handle missing optional fields gracefully', async () => {
        const { Phase2Enricher } = await import('../phase2_enricher.js');

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: 'Minimal Enrichment',
                  company: 'Test Co',
                  phraseDescription: 'Brief',
                  shortDescription: 'Short desc',
                  keyConcepts: ['basic'],
                  metadataCodes: {
                    ORG: [],
                    DOM: [],
                    FNC: [],
                    TEC: [],
                    CON: [],
                    IND: [],
                    AUD: [],
                    PRC: [],
                    PLT: [],
                  },
                }),
              },
            },
          ],
        };

        mockCreate.mockResolvedValue(mockResponse);

        const enricher = new Phase2Enricher({ apiKey: 'test-key' });
        const result = await enricher.enrich({
          nodeId: 'test-node',
          url: 'https://example.com/minimal',
          domain: 'example.com',
          title: 'Minimal',
        });

        expect(result.success).toBe(true);
        expect(result.enrichment?.title).toBe('Minimal Enrichment');
      });

      it('should extract metadata codes correctly', async () => {
        const { Phase2Enricher } = await import('../phase2_enricher.js');

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: 'Code Test',
                  company: 'Anthropic',
                  phraseDescription: 'Test',
                  shortDescription: 'Testing metadata codes',
                  keyConcepts: ['test'],
                  metadataCodes: {
                    ORG: ['ANTHROPIC', 'OPENAI'],
                    DOM: ['AI_SAFETY', 'ML_OPS'],
                    FNC: ['REASONING', 'CODEGEN'],
                    TEC: ['PYTHON', 'TYPESCRIPT'],
                    CON: ['LLM', 'RAG'],
                    IND: ['TECHNOLOGY'],
                    AUD: ['DEVELOPER', 'RESEARCHER'],
                    PRC: ['API_CREDITS'],
                    PLT: ['API', 'WEB'],
                  },
                }),
              },
            },
          ],
        };

        mockCreate.mockResolvedValue(mockResponse);

        const enricher = new Phase2Enricher({ apiKey: 'test-key' });
        const result = await enricher.enrich({
          nodeId: 'test-node',
          url: 'https://anthropic.com/claude',
          domain: 'anthropic.com',
          title: 'Claude',
        });

        expect(result.success).toBe(true);
        const codes = result.enrichment?.metadataCodes;
        expect(codes?.ORG).toContain('ANTHROPIC');
        expect(codes?.DOM).toContain('AI_SAFETY');
        expect(codes?.TEC).toContain('PYTHON');
      });
    });

    describe('descriptor string generation', () => {
      it('should generate descriptor string with all fields', async () => {
        const { Phase2Enricher } = await import('../phase2_enricher.js');

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: 'Full Title',
                  company: 'Full Company',
                  phraseDescription: 'Full phrase',
                  shortDescription: 'Full description',
                  keyConcepts: ['concept1', 'concept2'],
                  metadataCodes: {
                    ORG: ['TESTORG'],
                    DOM: [],
                    FNC: [],
                    TEC: [],
                    CON: [],
                    IND: [],
                    AUD: [],
                    PRC: [],
                    PLT: [],
                  },
                }),
              },
            },
          ],
        };

        mockCreate.mockResolvedValue(mockResponse);

        const enricher = new Phase2Enricher({ apiKey: 'test-key' });
        const result = await enricher.enrich({
          nodeId: 'test-node',
          url: 'https://example.com/full',
          domain: 'example.com',
          title: 'Full',
        });

        expect(result.success).toBe(true);
        const descriptor = result.enrichment?.descriptorString;
        expect(descriptor).toBeDefined();
        expect(descriptor).toContain('full title');
        expect(descriptor).toContain('example.com');
        expect(descriptor).toContain('full company');
      });

      it('should generate lowercase descriptor string for search', async () => {
        const { Phase2Enricher } = await import('../phase2_enricher.js');

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: 'UPPERCASE Title',
                  company: 'COMPANY',
                  phraseDescription: 'PHRASE',
                  shortDescription: 'DESCRIPTION',
                  keyConcepts: ['CONCEPT'],
                  metadataCodes: {
                    ORG: [],
                    DOM: [],
                    FNC: [],
                    TEC: [],
                    CON: [],
                    IND: [],
                    AUD: [],
                    PRC: [],
                    PLT: [],
                  },
                }),
              },
            },
          ],
        };

        mockCreate.mockResolvedValue(mockResponse);

        const enricher = new Phase2Enricher({ apiKey: 'test-key' });
        const result = await enricher.enrich({
          nodeId: 'test-node',
          url: 'https://example.com/case',
          domain: 'example.com',
          title: 'Case',
        });

        expect(result.success).toBe(true);
        const descriptor = result.enrichment?.descriptorString;
        expect(descriptor).toBe(descriptor?.toLowerCase());
      });
    });

    describe('enrichAndUpdateNode', () => {
      it('should enrich and update existing node', async () => {
        const { Phase2Enricher } = await import('../phase2_enricher.js');

        const mockNode = {
          id: 'node-123',
          url: 'https://example.com/test',
          source_domain: 'example.com',
          title: 'Test Node',
          short_description: 'Original desc',
          key_concepts: ['original'],
        };

        mockReadNode.mockReturnValue(mockNode);
        mockUpdateNode.mockReturnValue({ ...mockNode, title: 'Updated Title' });
        mockGetOrCreateCode.mockReturnValue({ id: 'code-1', code: 'TEST' });

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: 'Updated Title',
                  company: 'Updated Co',
                  phraseDescription: 'Updated phrase',
                  shortDescription: 'Updated description',
                  keyConcepts: ['updated'],
                  metadataCodes: {
                    ORG: ['TESTORG'],
                    DOM: [],
                    FNC: [],
                    TEC: [],
                    CON: [],
                    IND: [],
                    AUD: [],
                    PRC: [],
                    PLT: [],
                  },
                }),
              },
            },
          ],
        };

        mockCreate.mockResolvedValue(mockResponse);

        const enricher = new Phase2Enricher({ apiKey: 'test-key' });
        const result = await enricher.enrichAndUpdateNode('node-123');

        expect(result.success).toBe(true);
        expect(mockReadNode).toHaveBeenCalledWith('node-123');
        expect(mockUpdateNode).toHaveBeenCalled();
      });

      it('should return error for non-existent node', async () => {
        const { Phase2Enricher } = await import('../phase2_enricher.js');

        mockReadNode.mockReturnValue(null);

        const enricher = new Phase2Enricher({ apiKey: 'test-key' });
        const result = await enricher.enrichAndUpdateNode('non-existent');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Node not found');
      });

      it('should register metadata codes with registry', async () => {
        const { Phase2Enricher } = await import('../phase2_enricher.js');

        const mockNode = {
          id: 'node-456',
          url: 'https://example.com/registry',
          source_domain: 'example.com',
          title: 'Registry Test',
        };

        mockReadNode.mockReturnValue(mockNode);
        mockUpdateNode.mockReturnValue(mockNode);
        mockGetOrCreateCode.mockReturnValue({ id: 'reg-1', code: 'ANTHROPIC' });

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: 'Registry Test',
                  company: 'Anthropic',
                  phraseDescription: 'Test',
                  shortDescription: 'Testing registry',
                  keyConcepts: ['ai'],
                  metadataCodes: {
                    ORG: ['ANTHROPIC'],
                    DOM: ['AI_ML'],
                    FNC: [],
                    TEC: [],
                    CON: [],
                    IND: [],
                    AUD: [],
                    PRC: [],
                    PLT: [],
                  },
                  codeConfidence: 0.9,
                }),
              },
            },
          ],
        };

        mockCreate.mockResolvedValue(mockResponse);

        const enricher = new Phase2Enricher({ apiKey: 'test-key' });
        const result = await enricher.enrichAndUpdateNode('node-456');

        expect(result.success).toBe(true);
        expect(mockGetOrCreateCode).toHaveBeenCalled();
        expect(result.metadataCodesRegistered).toBeGreaterThan(0);
      });
    });

    describe('error handling', () => {
      it('should return error when API fails', async () => {
        const { Phase2Enricher } = await import('../phase2_enricher.js');

        mockCreate.mockRejectedValue(new Error('API Error'));

        const enricher = new Phase2Enricher({ apiKey: 'test-key' });
        const result = await enricher.enrich({
          nodeId: 'test-node',
          url: 'https://example.com/error',
          domain: 'example.com',
          title: 'Error Test',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('API Error');
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
      });

      it('should return error for empty response', async () => {
        const { Phase2Enricher } = await import('../phase2_enricher.js');

        mockCreate.mockResolvedValue({
          choices: [{ message: { content: null } }],
        });

        const enricher = new Phase2Enricher({ apiKey: 'test-key' });
        const result = await enricher.enrich({
          nodeId: 'test-node',
          url: 'https://example.com/empty',
          domain: 'example.com',
          title: 'Empty Test',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('No response content');
      });

      it('should return error for invalid JSON response', async () => {
        const { Phase2Enricher } = await import('../phase2_enricher.js');

        mockCreate.mockResolvedValue({
          choices: [{ message: { content: 'not valid json' } }],
        });

        const enricher = new Phase2Enricher({ apiKey: 'test-key' });
        const result = await enricher.enrich({
          nodeId: 'test-node',
          url: 'https://example.com/invalid-json',
          domain: 'example.com',
          title: 'Invalid JSON Test',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to parse');
      });

      it('should handle update failure after successful enrichment', async () => {
        const { Phase2Enricher } = await import('../phase2_enricher.js');

        const mockNode = {
          id: 'node-fail',
          url: 'https://example.com/update-fail',
          source_domain: 'example.com',
          title: 'Update Fail Test',
        };

        mockReadNode.mockReturnValue(mockNode);
        mockUpdateNode.mockImplementation(() => {
          throw new Error('Database update failed');
        });

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: 'Valid Enrichment',
                  company: 'Test',
                  phraseDescription: 'Test',
                  shortDescription: 'Test',
                  keyConcepts: ['test'],
                  metadataCodes: {
                    ORG: [],
                    DOM: [],
                    FNC: [],
                    TEC: [],
                    CON: [],
                    IND: [],
                    AUD: [],
                    PRC: [],
                    PLT: [],
                  },
                }),
              },
            },
          ],
        };

        mockCreate.mockResolvedValue(mockResponse);

        const enricher = new Phase2Enricher({ apiKey: 'test-key' });
        const result = await enricher.enrichAndUpdateNode('node-fail');

        expect(result.success).toBe(false);
        expect(result.error).toContain('update failed');
      });
    });

    describe('fromEnv static method', () => {
      it('should return null when OPENAI_API_KEY is not set', async () => {
        const { Phase2Enricher } = await import('../phase2_enricher.js');

        delete process.env.OPENAI_API_KEY;

        const enricher = Phase2Enricher.fromEnv();

        expect(enricher).toBeNull();
      });

      it('should create enricher from environment', async () => {
        const { Phase2Enricher } = await import('../phase2_enricher.js');

        process.env.OPENAI_API_KEY = 'test-env-key';
        process.env.OPENAI_MODEL = 'gpt-4';
        process.env.OPENAI_TEMPERATURE = '0.5';
        process.env.OPENAI_MAX_TOKENS = '2500';

        const enricher = Phase2Enricher.fromEnv();

        expect(enricher).toBeDefined();
        expect(enricher).toBeInstanceOf(Phase2Enricher);

        // Clean up
        delete process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_MODEL;
        delete process.env.OPENAI_TEMPERATURE;
        delete process.env.OPENAI_MAX_TOKENS;
      });
    });
  });

  describe('Field Validation', () => {
    it('should warn about missing required fields', async () => {
      const { Phase2Enricher } = await import('../phase2_enricher.js');

      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: '', // Empty title
                company: '', // Empty company
                phraseDescription: '', // Empty
                shortDescription: '', // Empty
                keyConcepts: [], // Empty
                metadataCodes: {
                  ORG: [],
                  DOM: [],
                  FNC: [],
                  TEC: [],
                  CON: [],
                  IND: [],
                  AUD: [],
                  PRC: [],
                  PLT: [],
                },
              }),
            },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);

      const enricher = new Phase2Enricher({ apiKey: 'test-key' });
      await enricher.enrich({
        nodeId: 'test-node',
        url: 'https://example.com/empty-fields',
        domain: 'example.com',
        title: 'Empty Fields Test',
      });

      expect(mockLogWarn).toHaveBeenCalledWith(
        'Enrichment result has missing fields',
        expect.objectContaining({
          warnings: expect.any(Array),
        })
      );
    });

    it('should truncate overly long fields in update', async () => {
      const { Phase2Enricher } = await import('../phase2_enricher.js');

      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'A'.repeat(600), // Over 500 limit
                company: 'Test',
                phraseDescription: 'B'.repeat(150), // Over 100 limit
                shortDescription: 'C'.repeat(600), // Over 500 limit
                keyConcepts: Array(25).fill('concept'), // Over 20 limit
                metadataCodes: {
                  ORG: [],
                  DOM: [],
                  FNC: [],
                  TEC: [],
                  CON: [],
                  IND: [],
                  AUD: [],
                  PRC: [],
                  PLT: [],
                },
              }),
            },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);

      mockReadNode.mockReturnValue({
        id: 'node-truncate',
        url: 'https://example.com/truncate',
        source_domain: 'example.com',
        title: 'Truncate Test',
      });
      mockUpdateNode.mockImplementation((_id, data) => data);

      const enricher = new Phase2Enricher({ apiKey: 'test-key' });
      const result = await enricher.enrichAndUpdateNode('node-truncate');

      expect(result.success).toBe(true);

      // Verify updateNode was called with truncated data
      const updateCall = mockUpdateNode.mock.calls[0][1];
      expect(updateCall.title.length).toBeLessThanOrEqual(500);
      expect(updateCall.phrase_description.length).toBeLessThanOrEqual(100);
      expect(updateCall.short_description.length).toBeLessThanOrEqual(500);
      expect(updateCall.key_concepts.length).toBeLessThanOrEqual(20);
    });
  });

  describe('Favicon Generation', () => {
    it('should generate favicon URL from domain when not provided', async () => {
      const { Phase2Enricher } = await import('../phase2_enricher.js');

      mockReadNode.mockReturnValue({
        id: 'node-favicon',
        url: 'https://example.com/favicon',
        source_domain: 'example.com',
        title: 'Favicon Test',
      });
      mockUpdateNode.mockImplementation((_id, data) => data);
      mockGetOrCreateCode.mockReturnValue({ id: 'code-1', code: 'TEST' });

      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Favicon Test',
                company: 'Test',
                phraseDescription: 'Test',
                shortDescription: 'Test',
                keyConcepts: ['test'],
                logoUrl: null, // No logo URL provided
                metadataCodes: {
                  ORG: [],
                  DOM: [],
                  FNC: [],
                  TEC: [],
                  CON: [],
                  IND: [],
                  AUD: [],
                  PRC: [],
                  PLT: [],
                },
              }),
            },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);

      const enricher = new Phase2Enricher({ apiKey: 'test-key' });
      await enricher.enrichAndUpdateNode('node-favicon');

      const updateCall = mockUpdateNode.mock.calls[0][1];
      expect(updateCall.logo_url).toContain('example.com');
      expect(updateCall.logo_url).toContain('google.com/s2/favicons');
    });
  });

  describe('Integration with Metadata Registry', () => {
    it('should register valid codes with the registry', async () => {
      const { Phase2Enricher } = await import('../phase2_enricher.js');

      const mockNode = {
        id: 'node-reg',
        url: 'https://example.com/registry',
        source_domain: 'example.com',
        title: 'Registry Test',
      };

      mockReadNode.mockReturnValue(mockNode);
      mockUpdateNode.mockReturnValue(mockNode);
      mockGetOrCreateCode.mockReturnValue({ id: 'code-1', code: 'TEST' });

      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Registry Test',
                company: 'Test',
                phraseDescription: 'Test',
                shortDescription: 'Testing registry integration',
                keyConcepts: ['registry'],
                metadataCodes: {
                  ORG: ['ANTHROPIC', 'OPENAI'],
                  DOM: ['AI_ML'],
                  FNC: ['CODEGEN'],
                  TEC: ['PYTHON'],
                  CON: ['LLM'],
                  IND: ['TECHNOLOGY'],
                  AUD: ['DEVELOPER'],
                  PRC: ['API_CREDITS'],
                  PLT: ['WEB'],
                },
                codeConfidence: 0.95,
              }),
            },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);

      const enricher = new Phase2Enricher({ apiKey: 'test-key' });
      const result = await enricher.enrichAndUpdateNode('node-reg');

      expect(result.success).toBe(true);
      // Should call getOrCreateCode for each valid code
      expect(mockGetOrCreateCode).toHaveBeenCalled();
      // Should call setMetadataForNode to create associations
      expect(mockSetMetadataForNode).toHaveBeenCalled();
    });

    it('should skip invalid code formats', async () => {
      const { Phase2Enricher } = await import('../phase2_enricher.js');

      const mockNode = {
        id: 'node-invalid',
        url: 'https://example.com/invalid',
        source_domain: 'example.com',
        title: 'Invalid Code Test',
      };

      mockReadNode.mockReturnValue(mockNode);
      mockUpdateNode.mockReturnValue(mockNode);
      mockGetOrCreateCode.mockReturnValue({ id: 'code-1', code: 'VALID' });

      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Invalid Code Test',
                company: 'Test',
                phraseDescription: 'Test',
                shortDescription: 'Testing invalid codes',
                keyConcepts: ['test'],
                metadataCodes: {
                  ORG: ['x', 'VALID'],
                  DOM: [],
                  FNC: [],
                  TEC: [],
                  CON: [],
                  IND: [],
                  AUD: [],
                  PRC: [],
                  PLT: [],
                },
              }),
            },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);

      const enricher = new Phase2Enricher({ apiKey: 'test-key' });
      const result = await enricher.enrichAndUpdateNode('node-invalid');

      expect(result.success).toBe(true);
      // Should have warned about invalid codes
      expect(mockLogWarn).toHaveBeenCalled();
    });
  });

  // These tests use vi.resetModules() which clears all mocks
  // They MUST be at the end of the file to avoid breaking other tests
  describe('Helper Functions (must run last - uses resetModules)', () => {
    describe('enrichNode', () => {
      it('should return error when enricher not configured', async () => {
        vi.resetModules();

        vi.doMock('openai', () => ({
          default: vi.fn().mockImplementation(() => ({
            chat: { completions: { create: vi.fn() } },
          })),
        }));

        vi.doMock('../../logger/index.js', () => ({
          log: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
          },
        }));

        delete process.env.OPENAI_API_KEY;

        const { enrichNode } = await import('../phase2_enricher.js');

        const result = await enrichNode('test-node');

        expect(result.success).toBe(false);
        expect(result.error).toContain('not configured');
      });
    });

    describe('enrichNodes batch function', () => {
      it('should return errors when enricher not configured', async () => {
        vi.resetModules();

        vi.doMock('openai', () => ({
          default: vi.fn().mockImplementation(() => ({
            chat: { completions: { create: vi.fn() } },
          })),
        }));

        vi.doMock('../../logger/index.js', () => ({
          log: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
          },
        }));

        delete process.env.OPENAI_API_KEY;

        const { enrichNodes } = await import('../phase2_enricher.js');

        const results = await enrichNodes(['node-1', 'node-2']);

        expect(results).toHaveLength(2);
        expect(results[0].success).toBe(false);
        expect(results[1].success).toBe(false);
      });
    });
  });
});
