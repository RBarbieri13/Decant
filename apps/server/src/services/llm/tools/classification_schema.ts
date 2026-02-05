/**
 * Classification Schema for Decant Content
 *
 * This module defines comprehensive field schemas for each content type,
 * specifying what attributes should be extracted, validated, and stored.
 * Used by extractors and the auto-categorization tool to ensure consistent
 * data structure across the Decant platform.
 */

import type { ContentType } from './auto_categorization_tool.js';

/**
 * Field types supported in the schema
 */
export type FieldType = 'string' | 'number' | 'date' | 'array' | 'url' | 'boolean';

/**
 * Extraction methods for field values
 */
export type ExtractionMethod =
    | 'url_parse'       // Extract from URL structure
    | 'ai_extract'      // Use AI to extract from content
    | 'metadata'        // Extract from HTML meta tags or API response
    | 'user_input'      // Provided by user
    | 'computed'        // Calculated from other fields
    | 'api'             // Fetch from external API
    | 'transcript';     // Extract from video/audio transcript

/**
 * Validation rules for fields
 */
export interface ValidationRule {
    min?: number;           // Minimum value/length
    max?: number;           // Maximum value/length
    pattern?: RegExp;       // Regex pattern
    enum?: string[];        // Allowed values
    custom?: (value: any) => boolean | string;  // Custom validation function
}

/**
 * Field schema definition
 */
export interface FieldSchema {
    name: string;
    type: FieldType;
    required: boolean;
    extractionMethod: ExtractionMethod | ExtractionMethod[];  // Can support multiple methods
    description?: string;
    validation?: ValidationRule;
    defaultValue?: any;
    example?: any;
}

/**
 * Content type schema mapping fields to their definitions
 */
export interface ContentTypeSchema {
    contentType: ContentType;
    description: string;
    fields: FieldSchema[];
    exampleUrl?: string;
}

/**
 * Common fields shared across all content types
 */
export const COMMON_FIELDS: FieldSchema[] = [
    {
        name: 'title',
        type: 'string',
        required: true,
        extractionMethod: ['metadata', 'ai_extract'],
        description: 'Title of the content',
        validation: { min: 1, max: 500 },
        example: 'How to Build a Knowledge Graph'
    },
    {
        name: 'sourceUrl',
        type: 'url',
        required: true,
        extractionMethod: 'user_input',
        description: 'Original URL of the content',
        validation: {
            pattern: /^https?:\/\/.+/
        },
        example: 'https://example.com/article'
    },
    {
        name: 'favicon',
        type: 'url',
        required: false,
        extractionMethod: 'metadata',
        description: 'Site favicon URL',
        example: 'https://example.com/favicon.ico'
    },
    {
        name: 'thumbnail',
        type: 'url',
        required: false,
        extractionMethod: 'metadata',
        description: 'Preview image/thumbnail URL',
        example: 'https://example.com/preview.jpg'
    },
    {
        name: 'aiSummary',
        type: 'string',
        required: false,
        extractionMethod: 'ai_extract',
        description: 'AI-generated summary (2-3 sentences)',
        validation: { min: 10, max: 1000 },
        example: 'This article explores techniques for building knowledge graphs...'
    },
    {
        name: 'aiTags',
        type: 'array',
        required: false,
        extractionMethod: 'ai_extract',
        description: 'AI-suggested tags for categorization',
        validation: { min: 0, max: 20 },
        example: ['knowledge-graph', 'data-science', 'ai']
    },
    {
        name: 'aiKeyPoints',
        type: 'array',
        required: false,
        extractionMethod: 'ai_extract',
        description: 'Key points extracted by AI',
        validation: { min: 0, max: 10 },
        example: ['Point 1', 'Point 2', 'Point 3']
    },
    {
        name: 'dateAdded',
        type: 'date',
        required: true,
        extractionMethod: 'computed',
        description: 'When the item was added to Decant',
        example: '2024-01-27T12:00:00Z'
    }
];

/**
 * Decant-specific attributes (stored as note attributes)
 */
export const DECANT_ATTRIBUTES = {
    // Core taxonomy attributes
    decantType: {
        name: 'decantType',
        description: 'Type in Decant hierarchy',
        values: ['space', 'collection', 'item'],
        required: true
    },
    contentType: {
        name: 'contentType',
        description: 'Type of content',
        values: ['youtube', 'article', 'podcast', 'paper', 'github', 'tweet', 'image', 'tool', 'website', 'other'],
        required: true
    },

    // AI-related attributes
    aiConfidence: {
        name: 'aiConfidence',
        description: 'Confidence score from AI categorization (0-1)',
        type: 'number',
        required: false
    },
    aiProcessed: {
        name: 'aiProcessed',
        description: 'Whether AI processing has been completed',
        type: 'boolean',
        required: false
    },

    // User interaction
    starred: {
        name: 'starred',
        description: 'User has starred this item',
        type: 'boolean',
        required: false
    },
    archived: {
        name: 'archived',
        description: 'Item is archived',
        type: 'boolean',
        required: false
    },
    readStatus: {
        name: 'readStatus',
        description: 'Reading status',
        values: ['unread', 'reading', 'read'],
        required: false
    }
} as const;

/**
 * Schema definitions for each content type
 */
export const CONTENT_TYPE_SCHEMAS: Record<ContentType, ContentTypeSchema> = {
    youtube: {
        contentType: 'youtube',
        description: 'YouTube videos and content',
        exampleUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        fields: [
            {
                name: 'videoId',
                type: 'string',
                required: true,
                extractionMethod: 'url_parse',
                description: 'YouTube video ID',
                validation: { pattern: /^[a-zA-Z0-9_-]{11}$/ },
                example: 'dQw4w9WgXcQ'
            },
            {
                name: 'channelName',
                type: 'string',
                required: false,
                extractionMethod: ['metadata', 'api'],
                description: 'YouTube channel name',
                example: 'TechChannel'
            },
            {
                name: 'channelId',
                type: 'string',
                required: false,
                extractionMethod: ['metadata', 'api'],
                description: 'YouTube channel ID',
                example: 'UCxxxxxxxxxxxxxx'
            },
            {
                name: 'duration',
                type: 'number',
                required: false,
                extractionMethod: ['metadata', 'api'],
                description: 'Video duration in seconds',
                validation: { min: 0 },
                example: 300
            },
            {
                name: 'views',
                type: 'number',
                required: false,
                extractionMethod: ['metadata', 'api'],
                description: 'View count',
                validation: { min: 0 },
                example: 1000000
            },
            {
                name: 'publishedAt',
                type: 'date',
                required: false,
                extractionMethod: ['metadata', 'api'],
                description: 'When the video was published',
                example: '2024-01-15T12:00:00Z'
            },
            {
                name: 'transcript',
                type: 'string',
                required: false,
                extractionMethod: 'transcript',
                description: 'Video transcript/captions',
                example: 'Welcome to this video...'
            },
            {
                name: 'category',
                type: 'string',
                required: false,
                extractionMethod: ['metadata', 'api'],
                description: 'YouTube category',
                example: 'Education'
            }
        ]
    },

    article: {
        contentType: 'article',
        description: 'Web articles and blog posts',
        exampleUrl: 'https://example.com/article/how-to-learn',
        fields: [
            {
                name: 'author',
                type: 'string',
                required: false,
                extractionMethod: ['metadata', 'ai_extract'],
                description: 'Article author name',
                example: 'John Doe'
            },
            {
                name: 'publishedAt',
                type: 'date',
                required: false,
                extractionMethod: ['metadata', 'ai_extract'],
                description: 'Publication date',
                example: '2024-01-15T12:00:00Z'
            },
            {
                name: 'readingTime',
                type: 'number',
                required: false,
                extractionMethod: 'computed',
                description: 'Estimated reading time in minutes',
                validation: { min: 0, max: 300 },
                example: 5
            },
            {
                name: 'wordCount',
                type: 'number',
                required: false,
                extractionMethod: 'computed',
                description: 'Article word count',
                validation: { min: 0 },
                example: 1500
            },
            {
                name: 'siteName',
                type: 'string',
                required: false,
                extractionMethod: 'metadata',
                description: 'Publication or website name',
                example: 'Medium'
            },
            {
                name: 'excerpt',
                type: 'string',
                required: false,
                extractionMethod: 'metadata',
                description: 'Article excerpt or description',
                validation: { max: 500 },
                example: 'Learn how to effectively...'
            },
            {
                name: 'language',
                type: 'string',
                required: false,
                extractionMethod: 'metadata',
                description: 'Article language (ISO 639-1 code)',
                validation: { pattern: /^[a-z]{2}$/ },
                example: 'en'
            }
        ]
    },

    github: {
        contentType: 'github',
        description: 'GitHub repositories and resources',
        exampleUrl: 'https://github.com/owner/repo',
        fields: [
            {
                name: 'repoOwner',
                type: 'string',
                required: true,
                extractionMethod: 'url_parse',
                description: 'Repository owner username',
                example: 'octocat'
            },
            {
                name: 'repoName',
                type: 'string',
                required: true,
                extractionMethod: 'url_parse',
                description: 'Repository name',
                example: 'Hello-World'
            },
            {
                name: 'stars',
                type: 'number',
                required: false,
                extractionMethod: 'api',
                description: 'Star count',
                validation: { min: 0 },
                example: 5000
            },
            {
                name: 'forks',
                type: 'number',
                required: false,
                extractionMethod: 'api',
                description: 'Fork count',
                validation: { min: 0 },
                example: 1500
            },
            {
                name: 'language',
                type: 'string',
                required: false,
                extractionMethod: 'api',
                description: 'Primary programming language',
                example: 'TypeScript'
            },
            {
                name: 'license',
                type: 'string',
                required: false,
                extractionMethod: 'api',
                description: 'Repository license',
                example: 'MIT'
            },
            {
                name: 'lastCommit',
                type: 'date',
                required: false,
                extractionMethod: 'api',
                description: 'Date of last commit',
                example: '2024-01-20T15:30:00Z'
            },
            {
                name: 'topics',
                type: 'array',
                required: false,
                extractionMethod: 'api',
                description: 'Repository topics/tags',
                example: ['javascript', 'nodejs', 'api']
            },
            {
                name: 'description',
                type: 'string',
                required: false,
                extractionMethod: 'api',
                description: 'Repository description',
                validation: { max: 500 },
                example: 'A tool for building APIs'
            }
        ]
    },

    podcast: {
        contentType: 'podcast',
        description: 'Podcast episodes',
        exampleUrl: 'https://podcasts.apple.com/podcast/id123456',
        fields: [
            {
                name: 'podcastName',
                type: 'string',
                required: true,
                extractionMethod: ['metadata', 'api'],
                description: 'Podcast show name',
                example: 'The Tech Podcast'
            },
            {
                name: 'episodeNumber',
                type: 'number',
                required: false,
                extractionMethod: ['metadata', 'ai_extract'],
                description: 'Episode number',
                validation: { min: 0 },
                example: 42
            },
            {
                name: 'season',
                type: 'number',
                required: false,
                extractionMethod: ['metadata', 'ai_extract'],
                description: 'Season number',
                validation: { min: 0 },
                example: 2
            },
            {
                name: 'duration',
                type: 'number',
                required: false,
                extractionMethod: ['metadata', 'api'],
                description: 'Episode duration in seconds',
                validation: { min: 0 },
                example: 3600
            },
            {
                name: 'hosts',
                type: 'array',
                required: false,
                extractionMethod: ['metadata', 'ai_extract'],
                description: 'Podcast hosts',
                example: ['Jane Smith', 'John Doe']
            },
            {
                name: 'guests',
                type: 'array',
                required: false,
                extractionMethod: ['metadata', 'ai_extract'],
                description: 'Episode guests',
                example: ['Guest Name']
            },
            {
                name: 'publishedAt',
                type: 'date',
                required: false,
                extractionMethod: ['metadata', 'api'],
                description: 'Episode publication date',
                example: '2024-01-15T12:00:00Z'
            },
            {
                name: 'transcript',
                type: 'string',
                required: false,
                extractionMethod: 'transcript',
                description: 'Episode transcript',
                example: 'Welcome to episode 42...'
            }
        ]
    },

    paper: {
        contentType: 'paper',
        description: 'Academic papers and research',
        exampleUrl: 'https://arxiv.org/abs/2101.12345',
        fields: [
            {
                name: 'authors',
                type: 'array',
                required: false,
                extractionMethod: ['metadata', 'ai_extract'],
                description: 'Paper authors',
                example: ['Smith, J.', 'Doe, J.']
            },
            {
                name: 'journal',
                type: 'string',
                required: false,
                extractionMethod: ['metadata', 'ai_extract'],
                description: 'Journal or conference name',
                example: 'Nature'
            },
            {
                name: 'doi',
                type: 'string',
                required: false,
                extractionMethod: ['url_parse', 'metadata'],
                description: 'Digital Object Identifier',
                validation: { pattern: /^10\.\d{4,}\/\S+$/ },
                example: '10.1234/example.doi'
            },
            {
                name: 'arxivId',
                type: 'string',
                required: false,
                extractionMethod: 'url_parse',
                description: 'arXiv identifier',
                validation: { pattern: /^\d{4}\.\d{4,5}(v\d+)?$/ },
                example: '2101.12345'
            },
            {
                name: 'citations',
                type: 'number',
                required: false,
                extractionMethod: 'api',
                description: 'Citation count',
                validation: { min: 0 },
                example: 150
            },
            {
                name: 'abstract',
                type: 'string',
                required: false,
                extractionMethod: ['metadata', 'ai_extract'],
                description: 'Paper abstract',
                validation: { max: 5000 },
                example: 'This paper presents...'
            },
            {
                name: 'publishedAt',
                type: 'date',
                required: false,
                extractionMethod: ['metadata', 'ai_extract'],
                description: 'Publication date',
                example: '2024-01-15T12:00:00Z'
            },
            {
                name: 'venue',
                type: 'string',
                required: false,
                extractionMethod: ['metadata', 'ai_extract'],
                description: 'Publication venue',
                example: 'NeurIPS 2024'
            },
            {
                name: 'pdfUrl',
                type: 'url',
                required: false,
                extractionMethod: ['metadata', 'url_parse'],
                description: 'PDF download URL',
                example: 'https://arxiv.org/pdf/2101.12345.pdf'
            }
        ]
    },

    tweet: {
        contentType: 'tweet',
        description: 'Twitter/X posts',
        exampleUrl: 'https://twitter.com/user/status/1234567890',
        fields: [
            {
                name: 'tweetId',
                type: 'string',
                required: true,
                extractionMethod: 'url_parse',
                description: 'Tweet ID',
                validation: { pattern: /^\d+$/ },
                example: '1234567890123456789'
            },
            {
                name: 'authorHandle',
                type: 'string',
                required: false,
                extractionMethod: ['url_parse', 'metadata'],
                description: 'Author username/handle',
                validation: { pattern: /^@?[A-Za-z0-9_]{1,15}$/ },
                example: '@username'
            },
            {
                name: 'authorName',
                type: 'string',
                required: false,
                extractionMethod: ['metadata', 'api'],
                description: 'Author display name',
                example: 'John Doe'
            },
            {
                name: 'likes',
                type: 'number',
                required: false,
                extractionMethod: ['metadata', 'api'],
                description: 'Like count',
                validation: { min: 0 },
                example: 500
            },
            {
                name: 'retweets',
                type: 'number',
                required: false,
                extractionMethod: ['metadata', 'api'],
                description: 'Retweet count',
                validation: { min: 0 },
                example: 100
            },
            {
                name: 'replies',
                type: 'number',
                required: false,
                extractionMethod: ['metadata', 'api'],
                description: 'Reply count',
                validation: { min: 0 },
                example: 50
            },
            {
                name: 'threadLength',
                type: 'number',
                required: false,
                extractionMethod: 'computed',
                description: 'Number of tweets in thread',
                validation: { min: 1 },
                example: 5
            },
            {
                name: 'publishedAt',
                type: 'date',
                required: false,
                extractionMethod: ['metadata', 'api'],
                description: 'Tweet timestamp',
                example: '2024-01-15T12:00:00Z'
            },
            {
                name: 'mediaUrls',
                type: 'array',
                required: false,
                extractionMethod: ['metadata', 'api'],
                description: 'Attached media URLs',
                example: ['https://pbs.twimg.com/media/xxx.jpg']
            }
        ]
    },

    product: {
        contentType: 'other',
        description: 'Product pages and e-commerce',
        exampleUrl: 'https://example.com/product/widget',
        fields: [
            {
                name: 'price',
                type: 'number',
                required: false,
                extractionMethod: ['metadata', 'ai_extract'],
                description: 'Product price',
                validation: { min: 0 },
                example: 29.99
            },
            {
                name: 'currency',
                type: 'string',
                required: false,
                extractionMethod: ['metadata', 'ai_extract'],
                description: 'Price currency code',
                validation: { pattern: /^[A-Z]{3}$/ },
                example: 'USD'
            },
            {
                name: 'rating',
                type: 'number',
                required: false,
                extractionMethod: ['metadata', 'ai_extract'],
                description: 'Product rating',
                validation: { min: 0, max: 5 },
                example: 4.5
            },
            {
                name: 'reviewCount',
                type: 'number',
                required: false,
                extractionMethod: ['metadata', 'ai_extract'],
                description: 'Number of reviews',
                validation: { min: 0 },
                example: 1234
            },
            {
                name: 'brand',
                type: 'string',
                required: false,
                extractionMethod: ['metadata', 'ai_extract'],
                description: 'Product brand',
                example: 'BrandName'
            },
            {
                name: 'availability',
                type: 'string',
                required: false,
                extractionMethod: ['metadata', 'ai_extract'],
                description: 'Stock availability',
                validation: { enum: ['in_stock', 'out_of_stock', 'preorder', 'discontinued'] },
                example: 'in_stock'
            }
        ]
    },

    image: {
        contentType: 'image',
        description: 'Images and visual content',
        exampleUrl: 'https://example.com/image.jpg',
        fields: [
            {
                name: 'width',
                type: 'number',
                required: false,
                extractionMethod: 'metadata',
                description: 'Image width in pixels',
                validation: { min: 0 },
                example: 1920
            },
            {
                name: 'height',
                type: 'number',
                required: false,
                extractionMethod: 'metadata',
                description: 'Image height in pixels',
                validation: { min: 0 },
                example: 1080
            },
            {
                name: 'altText',
                type: 'string',
                required: false,
                extractionMethod: ['metadata', 'ai_extract'],
                description: 'Image alt text or AI-generated description',
                example: 'A sunset over the ocean'
            },
            {
                name: 'photographer',
                type: 'string',
                required: false,
                extractionMethod: ['metadata', 'ai_extract'],
                description: 'Photographer or creator name',
                example: 'Jane Doe'
            },
            {
                name: 'license',
                type: 'string',
                required: false,
                extractionMethod: 'metadata',
                description: 'Image license',
                example: 'CC BY 4.0'
            }
        ]
    },

    tool: {
        contentType: 'tool',
        description: 'Software tools and applications',
        exampleUrl: 'https://example.com/tool',
        fields: [
            {
                name: 'category',
                type: 'string',
                required: false,
                extractionMethod: ['metadata', 'ai_extract'],
                description: 'Tool category',
                example: 'Productivity'
            },
            {
                name: 'pricing',
                type: 'string',
                required: false,
                extractionMethod: ['metadata', 'ai_extract'],
                description: 'Pricing model',
                validation: { enum: ['free', 'freemium', 'paid', 'subscription', 'one-time'] },
                example: 'freemium'
            },
            {
                name: 'platforms',
                type: 'array',
                required: false,
                extractionMethod: ['metadata', 'ai_extract'],
                description: 'Supported platforms',
                example: ['web', 'ios', 'android']
            },
            {
                name: 'features',
                type: 'array',
                required: false,
                extractionMethod: 'ai_extract',
                description: 'Key features',
                example: ['Feature 1', 'Feature 2']
            }
        ]
    },

    website: {
        contentType: 'website',
        description: 'General websites and web pages',
        exampleUrl: 'https://example.com',
        fields: [
            {
                name: 'siteName',
                type: 'string',
                required: false,
                extractionMethod: 'metadata',
                description: 'Website name',
                example: 'Example Site'
            },
            {
                name: 'description',
                type: 'string',
                required: false,
                extractionMethod: 'metadata',
                description: 'Website description',
                validation: { max: 1000 },
                example: 'A website about...'
            },
            {
                name: 'keywords',
                type: 'array',
                required: false,
                extractionMethod: 'metadata',
                description: 'Meta keywords',
                example: ['keyword1', 'keyword2']
            }
        ]
    },

    other: {
        contentType: 'other',
        description: 'Other content not fitting specific categories',
        exampleUrl: 'https://example.com/content',
        fields: [
            {
                name: 'description',
                type: 'string',
                required: false,
                extractionMethod: ['metadata', 'ai_extract'],
                description: 'Content description',
                validation: { max: 1000 },
                example: 'Description of the content...'
            }
        ]
    }
};

/**
 * Validation error
 */
export interface ValidationError {
    field: string;
    error: string;
    severity: 'error' | 'warning';
}

/**
 * Validation result
 */
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
}

/**
 * Get schema for a specific content type
 */
export function getSchemaForContentType(contentType: ContentType): ContentTypeSchema {
    const schema = CONTENT_TYPE_SCHEMAS[contentType];
    if (!schema) {
        return CONTENT_TYPE_SCHEMAS.other;
    }
    return schema;
}

/**
 * Get all fields for a content type (common + type-specific)
 */
export function getAllFieldsForContentType(contentType: ContentType): FieldSchema[] {
    const schema = getSchemaForContentType(contentType);
    return [...COMMON_FIELDS, ...schema.fields];
}

/**
 * Validate extracted fields against schema
 */
export function validateExtractedFields(
    data: Record<string, any>,
    contentType: ContentType
): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const allFields = getAllFieldsForContentType(contentType);

    // Check required fields
    for (const field of allFields) {
        const value = data[field.name];

        // Required field missing
        if (field.required && (value === undefined || value === null || value === '')) {
            errors.push({
                field: field.name,
                error: `Required field '${field.name}' is missing`,
                severity: 'error'
            });
            continue;
        }

        // Skip validation if field is not present and not required
        if (value === undefined || value === null) {
            continue;
        }

        // Type validation
        const typeValid = validateFieldType(value, field.type);
        if (!typeValid) {
            errors.push({
                field: field.name,
                error: `Field '${field.name}' has invalid type. Expected ${field.type}, got ${typeof value}`,
                severity: 'error'
            });
            continue;
        }

        // Validation rules
        if (field.validation) {
            const validationErrors = validateFieldRules(value, field);
            errors.push(...validationErrors.filter(e => e.severity === 'error'));
            warnings.push(...validationErrors.filter(e => e.severity === 'warning'));
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Validate field type
 */
function validateFieldType(value: any, expectedType: FieldType): boolean {
    switch (expectedType) {
        case 'string':
            return typeof value === 'string';
        case 'number':
            return typeof value === 'number' && !isNaN(value);
        case 'boolean':
            return typeof value === 'boolean';
        case 'date':
            return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
        case 'array':
            return Array.isArray(value);
        case 'url':
            return typeof value === 'string' && isValidUrl(value);
        default:
            return true;
    }
}

/**
 * Validate field against rules
 */
function validateFieldRules(value: any, field: FieldSchema): ValidationError[] {
    const errors: ValidationError[] = [];
    const rules = field.validation;

    if (!rules) {
        return errors;
    }

    // Min/Max validation
    if (rules.min !== undefined) {
        if (typeof value === 'number' && value < rules.min) {
            errors.push({
                field: field.name,
                error: `Value ${value} is less than minimum ${rules.min}`,
                severity: 'error'
            });
        } else if (typeof value === 'string' && value.length < rules.min) {
            errors.push({
                field: field.name,
                error: `Length ${value.length} is less than minimum ${rules.min}`,
                severity: 'error'
            });
        } else if (Array.isArray(value) && value.length < rules.min) {
            errors.push({
                field: field.name,
                error: `Array length ${value.length} is less than minimum ${rules.min}`,
                severity: 'warning'
            });
        }
    }

    if (rules.max !== undefined) {
        if (typeof value === 'number' && value > rules.max) {
            errors.push({
                field: field.name,
                error: `Value ${value} exceeds maximum ${rules.max}`,
                severity: 'error'
            });
        } else if (typeof value === 'string' && value.length > rules.max) {
            errors.push({
                field: field.name,
                error: `Length ${value.length} exceeds maximum ${rules.max}`,
                severity: 'warning'
            });
        } else if (Array.isArray(value) && value.length > rules.max) {
            errors.push({
                field: field.name,
                error: `Array length ${value.length} exceeds maximum ${rules.max}`,
                severity: 'warning'
            });
        }
    }

    // Pattern validation
    if (rules.pattern && typeof value === 'string') {
        if (!rules.pattern.test(value)) {
            errors.push({
                field: field.name,
                error: `Value does not match required pattern`,
                severity: 'error'
            });
        }
    }

    // Enum validation
    if (rules.enum && !rules.enum.includes(String(value))) {
        errors.push({
            field: field.name,
            error: `Value '${value}' is not in allowed values: ${rules.enum.join(', ')}`,
            severity: 'error'
        });
    }

    // Custom validation
    if (rules.custom) {
        const customResult = rules.custom(value);
        if (typeof customResult === 'string') {
            errors.push({
                field: field.name,
                error: customResult,
                severity: 'error'
            });
        } else if (customResult === false) {
            errors.push({
                field: field.name,
                error: 'Custom validation failed',
                severity: 'error'
            });
        }
    }

    return errors;
}

/**
 * Check if a string is a valid URL
 */
function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get required fields for a content type
 */
export function getRequiredFields(contentType: ContentType): string[] {
    const allFields = getAllFieldsForContentType(contentType);
    return allFields.filter(f => f.required).map(f => f.name);
}

/**
 * Get fields by extraction method
 */
export function getFieldsByExtractionMethod(
    contentType: ContentType,
    method: ExtractionMethod
): FieldSchema[] {
    const allFields = getAllFieldsForContentType(contentType);
    return allFields.filter(field => {
        if (Array.isArray(field.extractionMethod)) {
            return field.extractionMethod.includes(method);
        }
        return field.extractionMethod === method;
    });
}

/**
 * Create a default data object for a content type
 */
export function createDefaultData(contentType: ContentType): Record<string, any> {
    const allFields = getAllFieldsForContentType(contentType);
    const data: Record<string, any> = {};

    for (const field of allFields) {
        if (field.defaultValue !== undefined) {
            data[field.name] = field.defaultValue;
        } else if (field.required) {
            // Set required fields to empty values based on type
            switch (field.type) {
                case 'string':
                case 'url':
                    data[field.name] = '';
                    break;
                case 'number':
                    data[field.name] = 0;
                    break;
                case 'boolean':
                    data[field.name] = false;
                    break;
                case 'array':
                    data[field.name] = [];
                    break;
                case 'date':
                    data[field.name] = new Date().toISOString();
                    break;
            }
        }
    }

    return data;
}

/**
 * Export all schemas for documentation purposes
 */
export function getAllSchemas(): ContentTypeSchema[] {
    return Object.values(CONTENT_TYPE_SCHEMAS);
}
