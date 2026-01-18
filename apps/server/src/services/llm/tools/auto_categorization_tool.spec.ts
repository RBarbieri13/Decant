import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutoCategorizationTool, autoCategorizationToolDefinition } from './auto_categorization_tool.js';
import type { ContentType } from './auto_categorization_tool.js';

// Mock dependencies
vi.mock('../../log.js', () => ({
    default: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    }
}));

vi.mock('../../attributes.js', () => ({
    default: {
        getNotesWithLabel: vi.fn()
    }
}));

vi.mock('../ai_service_manager.js', () => ({
    default: {
        getService: vi.fn()
    }
}));

// Import mocked modules
import attributes from '../../attributes.js';
import aiServiceManager from '../ai_service_manager.js';

describe('AutoCategorizationTool', () => {
    let tool: AutoCategorizationTool;

    beforeEach(() => {
        tool = new AutoCategorizationTool();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('tool definition', () => {
        it('should have correct name', () => {
            expect(autoCategorizationToolDefinition.function.name).toBe('auto_categorize');
        });

        it('should have required parameters', () => {
            const params = autoCategorizationToolDefinition.function.parameters;
            expect(params.required).toContain('title');
            expect(params.required).toContain('content');
        });

        it('should have all expected properties', () => {
            const props = autoCategorizationToolDefinition.function.parameters.properties;
            expect(props.title).toBeDefined();
            expect(props.url).toBeDefined();
            expect(props.content).toBeDefined();
            expect(props.contentType).toBeDefined();
        });

        it('should define content type enum', () => {
            const contentTypeParam = autoCategorizationToolDefinition.function.parameters.properties.contentType;
            expect(contentTypeParam.enum).toContain('youtube');
            expect(contentTypeParam.enum).toContain('article');
            expect(contentTypeParam.enum).toContain('github');
            expect(contentTypeParam.enum).toContain('podcast');
        });
    });

    describe('content type detection', () => {
        it('should detect YouTube URLs', async () => {
            const mockAiService = {
                generateChatCompletion: vi.fn().mockResolvedValue({
                    text: JSON.stringify({
                        suggestedSpaceId: null,
                        suggestedSpaceName: 'Entertainment',
                        suggestedCollectionId: null,
                        suggestedCollectionName: 'Videos',
                        createNewCollection: true,
                        contentType: 'youtube',
                        suggestedTags: ['video', 'tutorial'],
                        summary: 'A YouTube video about testing.',
                        keyPoints: ['Point 1', 'Point 2'],
                        confidence: 0.9
                    })
                })
            };
            vi.mocked(aiServiceManager.getService).mockResolvedValue(mockAiService as any);
            vi.mocked(attributes.getNotesWithLabel).mockReturnValue([]);

            const result = await tool.execute({
                title: 'Test Video',
                url: 'https://www.youtube.com/watch?v=abc123',
                content: 'Video content about testing'
            });

            expect(result).toHaveProperty('success', true);
            expect(result).toHaveProperty('contentType', 'youtube');
        });

        it('should detect GitHub URLs', async () => {
            const mockAiService = {
                generateChatCompletion: vi.fn().mockResolvedValue({
                    text: JSON.stringify({
                        suggestedSpaceId: null,
                        suggestedSpaceName: 'Development',
                        suggestedCollectionId: null,
                        suggestedCollectionName: 'Repositories',
                        createNewCollection: true,
                        contentType: 'github',
                        suggestedTags: ['code', 'opensource'],
                        summary: 'A GitHub repository.',
                        keyPoints: ['Point 1'],
                        confidence: 0.85
                    })
                })
            };
            vi.mocked(aiServiceManager.getService).mockResolvedValue(mockAiService as any);
            vi.mocked(attributes.getNotesWithLabel).mockReturnValue([]);

            const result = await tool.execute({
                title: 'Test Repo',
                url: 'https://github.com/user/repo',
                content: 'Repository README content'
            });

            expect(result).toHaveProperty('success', true);
            expect(result).toHaveProperty('contentType', 'github');
        });

        it('should detect academic paper URLs', async () => {
            const mockAiService = {
                generateChatCompletion: vi.fn().mockResolvedValue({
                    text: JSON.stringify({
                        suggestedSpaceId: null,
                        suggestedSpaceName: 'Research',
                        suggestedCollectionId: null,
                        suggestedCollectionName: 'Papers',
                        createNewCollection: true,
                        contentType: 'paper',
                        suggestedTags: ['research', 'AI'],
                        summary: 'An academic paper about AI.',
                        keyPoints: ['Finding 1', 'Finding 2'],
                        confidence: 0.92
                    })
                })
            };
            vi.mocked(aiServiceManager.getService).mockResolvedValue(mockAiService as any);
            vi.mocked(attributes.getNotesWithLabel).mockReturnValue([]);

            const result = await tool.execute({
                title: 'Attention Is All You Need',
                url: 'https://arxiv.org/abs/1706.03762',
                content: 'Abstract about transformers...'
            });

            expect(result).toHaveProperty('success', true);
            expect(result).toHaveProperty('contentType', 'paper');
        });

        it('should default to article for generic URLs', async () => {
            const mockAiService = {
                generateChatCompletion: vi.fn().mockResolvedValue({
                    text: JSON.stringify({
                        suggestedSpaceId: null,
                        suggestedSpaceName: 'Reading',
                        suggestedCollectionId: null,
                        suggestedCollectionName: 'Articles',
                        createNewCollection: true,
                        contentType: 'article',
                        suggestedTags: ['news'],
                        summary: 'A news article.',
                        keyPoints: ['Point 1'],
                        confidence: 0.8
                    })
                })
            };
            vi.mocked(aiServiceManager.getService).mockResolvedValue(mockAiService as any);
            vi.mocked(attributes.getNotesWithLabel).mockReturnValue([]);

            const result = await tool.execute({
                title: 'Test Article',
                url: 'https://example.com/article',
                content: 'Article content'
            });

            expect(result).toHaveProperty('success', true);
            expect(result).toHaveProperty('contentType', 'article');
        });
    });

    describe('taxonomy integration', () => {
        it('should query existing Spaces', async () => {
            const mockSpaceNote = {
                noteId: 'space123',
                title: 'Development',
                isDeleted: false,
                getLabelValue: vi.fn().mockReturnValue(undefined),
                getChildNotes: vi.fn().mockReturnValue([])
            };

            vi.mocked(attributes.getNotesWithLabel).mockReturnValue([mockSpaceNote as any]);

            const mockAiService = {
                generateChatCompletion: vi.fn().mockResolvedValue({
                    text: JSON.stringify({
                        suggestedSpaceId: 'space123',
                        suggestedSpaceName: 'Development',
                        suggestedCollectionId: null,
                        suggestedCollectionName: 'JavaScript',
                        createNewCollection: true,
                        contentType: 'article',
                        suggestedTags: ['javascript'],
                        summary: 'A JavaScript article.',
                        keyPoints: ['Point 1'],
                        confidence: 0.88
                    })
                })
            };
            vi.mocked(aiServiceManager.getService).mockResolvedValue(mockAiService as any);

            const result = await tool.execute({
                title: 'JavaScript Guide',
                url: 'https://example.com/js',
                content: 'JavaScript tutorial content'
            });

            expect(attributes.getNotesWithLabel).toHaveBeenCalledWith('decantType', 'space');
            expect(result).toHaveProperty('suggestedSpaceId', 'space123');
        });

        it('should include Collections in taxonomy', async () => {
            const mockCollectionNote = {
                noteId: 'coll456',
                title: 'JavaScript',
                isDeleted: false,
                getLabelValue: vi.fn().mockReturnValue('collection'),
                getChildNotes: vi.fn().mockReturnValue([])
            };

            const mockSpaceNote = {
                noteId: 'space123',
                title: 'Development',
                isDeleted: false,
                getLabelValue: vi.fn().mockReturnValue(undefined),
                getChildNotes: vi.fn().mockReturnValue([mockCollectionNote])
            };

            vi.mocked(attributes.getNotesWithLabel).mockReturnValue([mockSpaceNote as any]);

            const mockAiService = {
                generateChatCompletion: vi.fn().mockResolvedValue({
                    text: JSON.stringify({
                        suggestedSpaceId: 'space123',
                        suggestedSpaceName: 'Development',
                        suggestedCollectionId: 'coll456',
                        suggestedCollectionName: 'JavaScript',
                        createNewCollection: false,
                        contentType: 'article',
                        suggestedTags: ['javascript', 'tutorial'],
                        summary: 'A JS tutorial.',
                        keyPoints: ['Point 1'],
                        confidence: 0.95
                    })
                })
            };
            vi.mocked(aiServiceManager.getService).mockResolvedValue(mockAiService as any);

            const result = await tool.execute({
                title: 'Advanced JavaScript',
                url: 'https://example.com/advanced-js',
                content: 'Advanced JS content'
            });

            expect(result).toHaveProperty('suggestedCollectionId', 'coll456');
            expect(result).toHaveProperty('createNewCollection', false);
        });
    });

    describe('AI response handling', () => {
        it('should handle JSON in markdown code block', async () => {
            vi.mocked(attributes.getNotesWithLabel).mockReturnValue([]);

            const mockAiService = {
                generateChatCompletion: vi.fn().mockResolvedValue({
                    text: '```json\n{"suggestedSpaceId": null, "suggestedSpaceName": "Test", "suggestedCollectionId": null, "suggestedCollectionName": "Test", "createNewCollection": true, "contentType": "article", "suggestedTags": [], "summary": "Test", "keyPoints": [], "confidence": 0.7}\n```'
                })
            };
            vi.mocked(aiServiceManager.getService).mockResolvedValue(mockAiService as any);

            const result = await tool.execute({
                title: 'Test',
                content: 'Test content'
            });

            expect(result).toHaveProperty('success', true);
            expect(result).toHaveProperty('suggestedSpaceName', 'Test');
        });

        it('should handle malformed AI response gracefully', async () => {
            vi.mocked(attributes.getNotesWithLabel).mockReturnValue([]);

            const mockAiService = {
                generateChatCompletion: vi.fn().mockResolvedValue({
                    text: 'This is not valid JSON at all'
                })
            };
            vi.mocked(aiServiceManager.getService).mockResolvedValue(mockAiService as any);

            const result = await tool.execute({
                title: 'Test',
                content: 'Test content'
            });

            // Should return fallback result
            expect(result).toHaveProperty('success', true);
            expect(result).toHaveProperty('suggestedSpaceName', 'Uncategorized');
            expect(result).toHaveProperty('suggestedCollectionName', 'Inbox');
            expect(result).toHaveProperty('confidence', 0.3);
        });

        it('should validate confidence score bounds', async () => {
            vi.mocked(attributes.getNotesWithLabel).mockReturnValue([]);

            const mockAiService = {
                generateChatCompletion: vi.fn().mockResolvedValue({
                    text: JSON.stringify({
                        suggestedSpaceId: null,
                        suggestedSpaceName: 'Test',
                        suggestedCollectionId: null,
                        suggestedCollectionName: 'Test',
                        createNewCollection: true,
                        contentType: 'article',
                        suggestedTags: [],
                        summary: 'Test',
                        keyPoints: [],
                        confidence: 1.5 // Out of bounds
                    })
                })
            };
            vi.mocked(aiServiceManager.getService).mockResolvedValue(mockAiService as any);

            const result = await tool.execute({
                title: 'Test',
                content: 'Test content'
            });

            // Confidence should be clamped to 1.0
            expect(result).toHaveProperty('confidence', 1.0);
        });
    });

    describe('error handling', () => {
        it('should handle AI service errors', async () => {
            vi.mocked(attributes.getNotesWithLabel).mockReturnValue([]);
            vi.mocked(aiServiceManager.getService).mockRejectedValue(new Error('AI service unavailable'));

            const result = await tool.execute({
                title: 'Test',
                content: 'Test content'
            });

            expect(result).toContain('Error:');
            expect(result).toContain('AI service unavailable');
        });

        it('should handle attribute query errors', async () => {
            vi.mocked(attributes.getNotesWithLabel).mockImplementation(() => {
                throw new Error('Database error');
            });

            const result = await tool.execute({
                title: 'Test',
                content: 'Test content'
            });

            expect(result).toContain('Error:');
        });
    });

    describe('performance', () => {
        it('should include processing time in result', async () => {
            vi.mocked(attributes.getNotesWithLabel).mockReturnValue([]);

            const mockAiService = {
                generateChatCompletion: vi.fn().mockResolvedValue({
                    text: JSON.stringify({
                        suggestedSpaceId: null,
                        suggestedSpaceName: 'Test',
                        suggestedCollectionId: null,
                        suggestedCollectionName: 'Test',
                        createNewCollection: true,
                        contentType: 'article',
                        suggestedTags: [],
                        summary: 'Test',
                        keyPoints: [],
                        confidence: 0.8
                    })
                })
            };
            vi.mocked(aiServiceManager.getService).mockResolvedValue(mockAiService as any);

            const result = await tool.execute({
                title: 'Test',
                content: 'Test content'
            });

            expect(result).toHaveProperty('processingTimeMs');
            expect((result as any).processingTimeMs).toBeGreaterThanOrEqual(0);
        });
    });
});
