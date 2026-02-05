/**
 * Tests for Classification Schema
 */

import { describe, it, expect } from 'vitest';
import {
    COMMON_FIELDS,
    DECANT_ATTRIBUTES,
    CONTENT_TYPE_SCHEMAS,
    getSchemaForContentType,
    getAllFieldsForContentType,
    validateExtractedFields,
    getRequiredFields,
    getFieldsByExtractionMethod,
    createDefaultData,
    getAllSchemas,
    type ContentType,
    type FieldSchema,
    type ValidationResult
} from './classification_schema.js';

describe('Classification Schema', () => {
    describe('COMMON_FIELDS', () => {
        it('should define all common fields', () => {
            expect(COMMON_FIELDS).toBeDefined();
            expect(COMMON_FIELDS.length).toBeGreaterThan(0);

            const fieldNames = COMMON_FIELDS.map(f => f.name);
            expect(fieldNames).toContain('title');
            expect(fieldNames).toContain('sourceUrl');
            expect(fieldNames).toContain('favicon');
            expect(fieldNames).toContain('thumbnail');
            expect(fieldNames).toContain('aiSummary');
            expect(fieldNames).toContain('aiTags');
        });

        it('should have title and sourceUrl as required fields', () => {
            const titleField = COMMON_FIELDS.find(f => f.name === 'title');
            const urlField = COMMON_FIELDS.find(f => f.name === 'sourceUrl');

            expect(titleField?.required).toBe(true);
            expect(urlField?.required).toBe(true);
        });
    });

    describe('DECANT_ATTRIBUTES', () => {
        it('should define core Decant attributes', () => {
            expect(DECANT_ATTRIBUTES.decantType).toBeDefined();
            expect(DECANT_ATTRIBUTES.contentType).toBeDefined();
            expect(DECANT_ATTRIBUTES.aiConfidence).toBeDefined();
        });

        it('should have correct values for decantType', () => {
            expect(DECANT_ATTRIBUTES.decantType.values).toEqual(['space', 'collection', 'item']);
        });

        it('should have correct content type values', () => {
            expect(DECANT_ATTRIBUTES.contentType.values).toContain('youtube');
            expect(DECANT_ATTRIBUTES.contentType.values).toContain('article');
            expect(DECANT_ATTRIBUTES.contentType.values).toContain('github');
        });
    });

    describe('CONTENT_TYPE_SCHEMAS', () => {
        it('should define schemas for all content types', () => {
            const contentTypes: ContentType[] = [
                'youtube', 'article', 'podcast', 'paper', 'github',
                'tweet', 'image', 'tool', 'website', 'other'
            ];

            for (const type of contentTypes) {
                expect(CONTENT_TYPE_SCHEMAS[type]).toBeDefined();
                expect(CONTENT_TYPE_SCHEMAS[type].contentType).toBe(type);
            }
        });

        describe('YouTube schema', () => {
            it('should have correct fields', () => {
                const schema = CONTENT_TYPE_SCHEMAS.youtube;
                const fieldNames = schema.fields.map(f => f.name);

                expect(fieldNames).toContain('videoId');
                expect(fieldNames).toContain('channelName');
                expect(fieldNames).toContain('duration');
                expect(fieldNames).toContain('views');
                expect(fieldNames).toContain('transcript');
            });

            it('should require videoId', () => {
                const schema = CONTENT_TYPE_SCHEMAS.youtube;
                const videoIdField = schema.fields.find(f => f.name === 'videoId');

                expect(videoIdField?.required).toBe(true);
                expect(videoIdField?.extractionMethod).toBe('url_parse');
            });
        });

        describe('Article schema', () => {
            it('should have correct fields', () => {
                const schema = CONTENT_TYPE_SCHEMAS.article;
                const fieldNames = schema.fields.map(f => f.name);

                expect(fieldNames).toContain('author');
                expect(fieldNames).toContain('publishedAt');
                expect(fieldNames).toContain('readingTime');
                expect(fieldNames).toContain('wordCount');
            });
        });

        describe('GitHub schema', () => {
            it('should have correct fields', () => {
                const schema = CONTENT_TYPE_SCHEMAS.github;
                const fieldNames = schema.fields.map(f => f.name);

                expect(fieldNames).toContain('repoOwner');
                expect(fieldNames).toContain('repoName');
                expect(fieldNames).toContain('stars');
                expect(fieldNames).toContain('forks');
                expect(fieldNames).toContain('language');
            });

            it('should require repoOwner and repoName', () => {
                const schema = CONTENT_TYPE_SCHEMAS.github;
                const ownerField = schema.fields.find(f => f.name === 'repoOwner');
                const nameField = schema.fields.find(f => f.name === 'repoName');

                expect(ownerField?.required).toBe(true);
                expect(nameField?.required).toBe(true);
            });
        });

        describe('Paper schema', () => {
            it('should have correct fields', () => {
                const schema = CONTENT_TYPE_SCHEMAS.paper;
                const fieldNames = schema.fields.map(f => f.name);

                expect(fieldNames).toContain('authors');
                expect(fieldNames).toContain('doi');
                expect(fieldNames).toContain('citations');
                expect(fieldNames).toContain('abstract');
            });
        });

        describe('Tweet schema', () => {
            it('should have correct fields', () => {
                const schema = CONTENT_TYPE_SCHEMAS.tweet;
                const fieldNames = schema.fields.map(f => f.name);

                expect(fieldNames).toContain('tweetId');
                expect(fieldNames).toContain('authorHandle');
                expect(fieldNames).toContain('likes');
                expect(fieldNames).toContain('retweets');
            });
        });
    });

    describe('getSchemaForContentType', () => {
        it('should return correct schema for valid content type', () => {
            const schema = getSchemaForContentType('youtube');
            expect(schema.contentType).toBe('youtube');
        });

        it('should return "other" schema for unknown content type', () => {
            const schema = getSchemaForContentType('unknown' as ContentType);
            expect(schema.contentType).toBe('other');
        });
    });

    describe('getAllFieldsForContentType', () => {
        it('should return common + type-specific fields', () => {
            const fields = getAllFieldsForContentType('youtube');
            const fieldNames = fields.map(f => f.name);

            // Should have common fields
            expect(fieldNames).toContain('title');
            expect(fieldNames).toContain('sourceUrl');

            // Should have YouTube-specific fields
            expect(fieldNames).toContain('videoId');
            expect(fieldNames).toContain('channelName');
        });

        it('should not have duplicate fields', () => {
            const fields = getAllFieldsForContentType('article');
            const fieldNames = fields.map(f => f.name);
            const uniqueNames = new Set(fieldNames);

            expect(fieldNames.length).toBe(uniqueNames.size);
        });
    });

    describe('validateExtractedFields', () => {
        it('should validate valid data successfully', () => {
            const data = {
                title: 'Test Video',
                sourceUrl: 'https://youtube.com/watch?v=test123',
                videoId: 'test1234567',
                dateAdded: new Date().toISOString()
            };

            const result = validateExtractedFields(data, 'youtube');
            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
        });

        it('should detect missing required fields', () => {
            const data = {
                // Missing title and sourceUrl
                videoId: 'test1234567'
            };

            const result = validateExtractedFields(data, 'youtube');
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);

            const errorFields = result.errors.map(e => e.field);
            expect(errorFields).toContain('title');
            expect(errorFields).toContain('sourceUrl');
        });

        it('should detect type mismatches', () => {
            const data = {
                title: 'Test',
                sourceUrl: 'https://example.com',
                dateAdded: new Date().toISOString(),
                videoId: 'test1234567',
                views: 'not a number' // Should be number
            };

            const result = validateExtractedFields(data, 'youtube');
            expect(result.valid).toBe(false);

            const viewsError = result.errors.find(e => e.field === 'views');
            expect(viewsError).toBeDefined();
        });

        it('should validate URL format', () => {
            const data = {
                title: 'Test',
                sourceUrl: 'not-a-valid-url',
                dateAdded: new Date().toISOString()
            };

            const result = validateExtractedFields(data, 'article');
            expect(result.valid).toBe(false);

            const urlError = result.errors.find(e => e.field === 'sourceUrl');
            expect(urlError).toBeDefined();
        });

        it('should validate string length constraints', () => {
            const data = {
                title: '', // Too short (min: 1)
                sourceUrl: 'https://example.com',
                dateAdded: new Date().toISOString()
            };

            const result = validateExtractedFields(data, 'article');
            expect(result.valid).toBe(false);

            const titleError = result.errors.find(e => e.field === 'title');
            expect(titleError).toBeDefined();
        });

        it('should validate number ranges', () => {
            const data = {
                title: 'Test Article',
                sourceUrl: 'https://example.com',
                dateAdded: new Date().toISOString(),
                readingTime: -5 // Should be >= 0
            };

            const result = validateExtractedFields(data, 'article');
            expect(result.valid).toBe(false);

            const timeError = result.errors.find(e => e.field === 'readingTime');
            expect(timeError).toBeDefined();
        });

        it('should validate regex patterns', () => {
            const data = {
                title: 'Test Tweet',
                sourceUrl: 'https://twitter.com/user/status/123',
                dateAdded: new Date().toISOString(),
                tweetId: '12345',
                authorHandle: 'invalid_handle_thats_way_too_long_for_twitter' // Max 15 chars
            };

            const result = validateExtractedFields(data, 'tweet');

            const handleError = result.errors.find(e => e.field === 'authorHandle');
            expect(handleError).toBeDefined();
        });

        it('should generate warnings for non-critical issues', () => {
            const data = {
                title: 'Test',
                sourceUrl: 'https://example.com',
                dateAdded: new Date().toISOString(),
                aiTags: new Array(25).fill('tag') // Max recommended is 20
            };

            const result = validateExtractedFields(data, 'article');
            // May still be valid but should have warnings
            expect(result.warnings.length).toBeGreaterThan(0);
        });
    });

    describe('getRequiredFields', () => {
        it('should return all required field names', () => {
            const required = getRequiredFields('youtube');

            expect(required).toContain('title');
            expect(required).toContain('sourceUrl');
            expect(required).toContain('videoId');
            expect(required).toContain('dateAdded');
        });

        it('should not include optional fields', () => {
            const required = getRequiredFields('youtube');

            expect(required).not.toContain('channelName');
            expect(required).not.toContain('views');
        });
    });

    describe('getFieldsByExtractionMethod', () => {
        it('should return fields with specific extraction method', () => {
            const urlParseFields = getFieldsByExtractionMethod('youtube', 'url_parse');
            const fieldNames = urlParseFields.map(f => f.name);

            expect(fieldNames).toContain('videoId');
        });

        it('should handle fields with multiple extraction methods', () => {
            const aiFields = getFieldsByExtractionMethod('article', 'ai_extract');
            expect(aiFields.length).toBeGreaterThan(0);
        });

        it('should return empty array if no fields match', () => {
            const fields = getFieldsByExtractionMethod('image', 'transcript');
            expect(fields.length).toBe(0);
        });
    });

    describe('createDefaultData', () => {
        it('should create object with required fields', () => {
            const data = createDefaultData('youtube');

            expect(data.title).toBeDefined();
            expect(data.sourceUrl).toBeDefined();
            expect(data.videoId).toBeDefined();
        });

        it('should use default values when specified', () => {
            const data = createDefaultData('article');

            // Check that basic types are initialized
            expect(typeof data.title).toBe('string');
            expect(typeof data.sourceUrl).toBe('string');
        });

        it('should initialize arrays as empty', () => {
            const data = createDefaultData('article');

            if (data.aiTags !== undefined) {
                expect(Array.isArray(data.aiTags)).toBe(true);
            }
        });
    });

    describe('getAllSchemas', () => {
        it('should return all content type schemas', () => {
            const schemas = getAllSchemas();

            expect(schemas.length).toBeGreaterThan(0);
            expect(schemas.every(s => s.contentType)).toBe(true);
            expect(schemas.every(s => Array.isArray(s.fields))).toBe(true);
        });

        it('should include all content types', () => {
            const schemas = getAllSchemas();
            const contentTypes = schemas.map(s => s.contentType);

            expect(contentTypes).toContain('youtube');
            expect(contentTypes).toContain('article');
            expect(contentTypes).toContain('github');
            expect(contentTypes).toContain('podcast');
            expect(contentTypes).toContain('paper');
            expect(contentTypes).toContain('tweet');
        });
    });

    describe('Field schema structure', () => {
        it('should have consistent field structure', () => {
            const schemas = getAllSchemas();

            for (const schema of schemas) {
                for (const field of schema.fields) {
                    expect(field.name).toBeDefined();
                    expect(field.type).toBeDefined();
                    expect(typeof field.required).toBe('boolean');
                    expect(field.extractionMethod).toBeDefined();
                }
            }
        });

        it('should have examples for all fields', () => {
            const schemas = getAllSchemas();
            const fieldsWithoutExamples: string[] = [];

            for (const schema of schemas) {
                for (const field of schema.fields) {
                    if (!field.example) {
                        fieldsWithoutExamples.push(`${schema.contentType}.${field.name}`);
                    }
                }
            }

            // Most fields should have examples
            expect(fieldsWithoutExamples.length).toBeLessThan(5);
        });
    });

    describe('Integration scenarios', () => {
        it('should handle YouTube video data extraction', () => {
            const data = {
                title: 'How to Build APIs',
                sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                videoId: 'dQw4w9WgXcQ',
                channelName: 'Tech Channel',
                duration: 600,
                views: 50000,
                publishedAt: '2024-01-15T12:00:00Z',
                dateAdded: new Date().toISOString()
            };

            const result = validateExtractedFields(data, 'youtube');
            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
        });

        it('should handle article data extraction', () => {
            const data = {
                title: 'The Future of AI',
                sourceUrl: 'https://blog.example.com/ai-future',
                author: 'Jane Doe',
                publishedAt: '2024-01-15T12:00:00Z',
                readingTime: 8,
                wordCount: 2000,
                siteName: 'Tech Blog',
                dateAdded: new Date().toISOString()
            };

            const result = validateExtractedFields(data, 'article');
            expect(result.valid).toBe(true);
        });

        it('should handle GitHub repository data', () => {
            const data = {
                title: 'awesome-project',
                sourceUrl: 'https://github.com/octocat/awesome-project',
                repoOwner: 'octocat',
                repoName: 'awesome-project',
                stars: 5000,
                forks: 1200,
                language: 'TypeScript',
                license: 'MIT',
                dateAdded: new Date().toISOString()
            };

            const result = validateExtractedFields(data, 'github');
            expect(result.valid).toBe(true);
        });

        it('should handle partial data gracefully', () => {
            const data = {
                title: 'Incomplete Article',
                sourceUrl: 'https://example.com/article',
                dateAdded: new Date().toISOString()
                // Missing optional fields
            };

            const result = validateExtractedFields(data, 'article');
            expect(result.valid).toBe(true); // Should be valid with just required fields
        });
    });
});
