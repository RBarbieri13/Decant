/**
 * Classification Schema Usage Examples
 *
 * This file demonstrates practical usage patterns for the classification schema.
 * These examples can be used as templates for implementing extractors and validators.
 */

import {
    getSchemaForContentType,
    getAllFieldsForContentType,
    validateExtractedFields,
    getRequiredFields,
    getFieldsByExtractionMethod,
    createDefaultData,
    type ContentType,
    type FieldSchema,
    type ValidationResult
} from './classification_schema.js';
import log from '../../log.js';

/**
 * Example 1: Basic Data Extraction and Validation
 */
export async function extractAndValidateYouTubeVideo(url: string): Promise<{
    valid: boolean;
    data?: Record<string, any>;
    errors?: string[];
}> {
    try {
        // Parse video ID from URL
        const videoIdMatch = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (!videoIdMatch) {
            return {
                valid: false,
                errors: ['Invalid YouTube URL format']
            };
        }

        // Build data object
        const data = {
            title: 'Example Video Title',  // Would be extracted from API/metadata
            sourceUrl: url,
            videoId: videoIdMatch[1],
            channelName: 'Example Channel',
            duration: 600,
            views: 50000,
            publishedAt: new Date().toISOString(),
            dateAdded: new Date().toISOString()
        };

        // Validate against schema
        const validation = validateExtractedFields(data, 'youtube');

        if (!validation.valid) {
            log.error('YouTube data validation failed', validation.errors);
            return {
                valid: false,
                errors: validation.errors.map(e => `${e.field}: ${e.error}`)
            };
        }

        if (validation.warnings.length > 0) {
            log.warn('YouTube data validation warnings', validation.warnings);
        }

        return {
            valid: true,
            data
        };

    } catch (error) {
        log.error('Error extracting YouTube data', error);
        return {
            valid: false,
            errors: [String(error)]
        };
    }
}

/**
 * Example 2: Multi-Stage Extraction with Different Methods
 */
export class ContentExtractor {
    /**
     * Extract data using multiple extraction methods
     */
    async extract(url: string, contentType: ContentType): Promise<Record<string, any>> {
        const data = createDefaultData(contentType);

        // Stage 1: URL parsing
        const urlFields = getFieldsByExtractionMethod(contentType, 'url_parse');
        const urlData = this.extractFromUrl(url, urlFields);
        Object.assign(data, urlData);

        // Stage 2: Metadata extraction (HTML meta tags)
        const metadataFields = getFieldsByExtractionMethod(contentType, 'metadata');
        const metadata = await this.extractMetadata(url, metadataFields);
        Object.assign(data, metadata);

        // Stage 3: API extraction
        const apiFields = getFieldsByExtractionMethod(contentType, 'api');
        if (apiFields.length > 0) {
            const apiData = await this.extractFromAPI(url, contentType, apiFields);
            Object.assign(data, apiData);
        }

        // Stage 4: AI extraction
        const aiFields = getFieldsByExtractionMethod(contentType, 'ai_extract');
        if (aiFields.length > 0) {
            const aiData = await this.extractWithAI(url, aiFields);
            Object.assign(data, aiData);
        }

        return data;
    }

    private extractFromUrl(url: string, fields: FieldSchema[]): Record<string, any> {
        const data: Record<string, any> = {};

        try {
            const urlObj = new URL(url);

            for (const field of fields) {
                // Example: Extract GitHub repo info from URL
                if (field.name === 'repoOwner' || field.name === 'repoName') {
                    const pathParts = urlObj.pathname.split('/').filter(p => p);
                    if (pathParts.length >= 2) {
                        data.repoOwner = pathParts[0];
                        data.repoName = pathParts[1];
                    }
                }

                // Example: Extract YouTube video ID
                if (field.name === 'videoId') {
                    const videoId = urlObj.searchParams.get('v') ||
                                   urlObj.pathname.split('/').pop();
                    if (videoId) {
                        data.videoId = videoId;
                    }
                }

                // Example: Extract tweet ID
                if (field.name === 'tweetId') {
                    const pathParts = urlObj.pathname.split('/');
                    const statusIndex = pathParts.indexOf('status');
                    if (statusIndex >= 0 && pathParts[statusIndex + 1]) {
                        data.tweetId = pathParts[statusIndex + 1];
                    }
                }
            }
        } catch (error) {
            log.error('Error extracting from URL', error);
        }

        return data;
    }

    private async extractMetadata(url: string, fields: FieldSchema[]): Promise<Record<string, any>> {
        // This would fetch the page and extract meta tags
        // Placeholder implementation
        return {
            title: 'Extracted Title',
            favicon: 'https://example.com/favicon.ico',
            thumbnail: 'https://example.com/preview.jpg'
        };
    }

    private async extractFromAPI(
        url: string,
        contentType: ContentType,
        fields: FieldSchema[]
    ): Promise<Record<string, any>> {
        // This would call appropriate APIs (YouTube Data API, GitHub API, etc.)
        // Placeholder implementation
        return {};
    }

    private async extractWithAI(url: string, fields: FieldSchema[]): Promise<Record<string, any>> {
        // This would use AI service to extract data
        // Placeholder implementation
        return {
            aiSummary: 'AI-generated summary',
            aiTags: ['tag1', 'tag2'],
            aiKeyPoints: ['Point 1', 'Point 2']
        };
    }
}

/**
 * Example 3: Validation with Error Handling
 */
export function validateAndLog(
    data: Record<string, any>,
    contentType: ContentType,
    logPrefix: string = 'Validation'
): ValidationResult {
    const result = validateExtractedFields(data, contentType);

    if (!result.valid) {
        log.error(`${logPrefix}: Validation failed for ${contentType}`, {
            errors: result.errors,
            data
        });
    } else if (result.warnings.length > 0) {
        log.warn(`${logPrefix}: Validation warnings for ${contentType}`, {
            warnings: result.warnings,
            data
        });
    } else {
        log.info(`${logPrefix}: Validation successful for ${contentType}`);
    }

    return result;
}

/**
 * Example 4: Incremental Data Building
 */
export class DataBuilder {
    private data: Record<string, any>;
    private contentType: ContentType;

    constructor(contentType: ContentType) {
        this.contentType = contentType;
        this.data = createDefaultData(contentType);
    }

    /**
     * Set a field value
     */
    set(field: string, value: any): this {
        this.data[field] = value;
        return this;
    }

    /**
     * Set multiple fields
     */
    setMany(fields: Record<string, any>): this {
        Object.assign(this.data, fields);
        return this;
    }

    /**
     * Validate current data
     */
    validate(): ValidationResult {
        return validateExtractedFields(this.data, this.contentType);
    }

    /**
     * Build and validate
     */
    build(): { data: Record<string, any>; validation: ValidationResult } {
        const validation = this.validate();
        return {
            data: this.data,
            validation
        };
    }

    /**
     * Get data only if valid
     */
    buildIfValid(): Record<string, any> | null {
        const validation = this.validate();
        return validation.valid ? this.data : null;
    }
}

/**
 * Example 5: Schema-Driven Form Generation
 */
export function generateFormFields(contentType: ContentType): Array<{
    name: string;
    label: string;
    type: string;
    required: boolean;
    placeholder?: string;
}> {
    const fields = getAllFieldsForContentType(contentType);

    return fields.map(field => ({
        name: field.name,
        label: field.description || field.name,
        type: mapFieldTypeToInputType(field.type),
        required: field.required,
        placeholder: field.example ? String(field.example) : undefined
    }));
}

function mapFieldTypeToInputType(fieldType: string): string {
    const mapping: Record<string, string> = {
        'string': 'text',
        'number': 'number',
        'date': 'date',
        'url': 'url',
        'boolean': 'checkbox',
        'array': 'tags'
    };
    return mapping[fieldType] || 'text';
}

/**
 * Example 6: Compare Data Against Schema
 */
export function analyzeDataCompleteness(
    data: Record<string, any>,
    contentType: ContentType
): {
    requiredFieldsFilled: number;
    requiredFieldsTotal: number;
    optionalFieldsFilled: number;
    optionalFieldsTotal: number;
    completenessPercent: number;
} {
    const allFields = getAllFieldsForContentType(contentType);
    const requiredFields = allFields.filter(f => f.required);
    const optionalFields = allFields.filter(f => !f.required);

    const requiredFieldsFilled = requiredFields.filter(
        f => data[f.name] !== undefined && data[f.name] !== null && data[f.name] !== ''
    ).length;

    const optionalFieldsFilled = optionalFields.filter(
        f => data[f.name] !== undefined && data[f.name] !== null && data[f.name] !== ''
    ).length;

    const totalFieldsFilled = requiredFieldsFilled + optionalFieldsFilled;
    const totalFields = allFields.length;
    const completenessPercent = Math.round((totalFieldsFilled / totalFields) * 100);

    return {
        requiredFieldsFilled,
        requiredFieldsTotal: requiredFields.length,
        optionalFieldsFilled,
        optionalFieldsTotal: optionalFields.length,
        completenessPercent
    };
}

/**
 * Example 7: Field Priority Extraction
 */
export function getExtractionPriority(contentType: ContentType): {
    critical: FieldSchema[];
    important: FieldSchema[];
    optional: FieldSchema[];
} {
    const allFields = getAllFieldsForContentType(contentType);

    const critical = allFields.filter(f => f.required);

    const important = allFields.filter(f =>
        !f.required &&
        (f.extractionMethod === 'metadata' || f.extractionMethod === 'url_parse')
    );

    const optional = allFields.filter(f =>
        !f.required &&
        f.extractionMethod !== 'metadata' &&
        f.extractionMethod !== 'url_parse'
    );

    return { critical, important, optional };
}

/**
 * Example 8: Batch Validation
 */
export function validateBatch(
    items: Array<{ data: Record<string, any>; contentType: ContentType }>
): {
    totalItems: number;
    validItems: number;
    invalidItems: number;
    results: ValidationResult[];
} {
    const results = items.map(item =>
        validateExtractedFields(item.data, item.contentType)
    );

    return {
        totalItems: items.length,
        validItems: results.filter(r => r.valid).length,
        invalidItems: results.filter(r => !r.valid).length,
        results
    };
}

/**
 * Example 9: Schema Documentation Generator
 */
export function generateSchemaDocumentation(contentType: ContentType): string {
    const schema = getSchemaForContentType(contentType);
    const allFields = getAllFieldsForContentType(contentType);

    let doc = `# ${contentType.toUpperCase()} Schema\n\n`;
    doc += `${schema.description}\n\n`;

    if (schema.exampleUrl) {
        doc += `**Example URL**: ${schema.exampleUrl}\n\n`;
    }

    doc += `## Fields\n\n`;
    doc += `| Field | Type | Required | Extraction | Description |\n`;
    doc += `|-------|------|----------|------------|-------------|\n`;

    for (const field of allFields) {
        const extraction = Array.isArray(field.extractionMethod)
            ? field.extractionMethod.join(', ')
            : field.extractionMethod;

        doc += `| ${field.name} | ${field.type} | ${field.required ? 'Yes' : 'No'} | ${extraction} | ${field.description || '-'} |\n`;
    }

    return doc;
}

/**
 * Example 10: Convert to Trilium Attributes
 */
export function dataToTriliumAttributes(
    data: Record<string, any>,
    contentType: ContentType
): Array<{ name: string; value: string }> {
    const attributes: Array<{ name: string; value: string }> = [];

    // Add content type
    attributes.push({
        name: 'contentType',
        value: contentType
    });

    // Add decant type (assuming all items are 'item')
    attributes.push({
        name: 'decantType',
        value: 'item'
    });

    // Convert data fields to attributes
    const schema = getSchemaForContentType(contentType);
    for (const field of schema.fields) {
        const value = data[field.name];

        if (value !== undefined && value !== null) {
            // Convert to string for attribute storage
            const stringValue = Array.isArray(value)
                ? JSON.stringify(value)
                : String(value);

            attributes.push({
                name: field.name,
                value: stringValue
            });
        }
    }

    return attributes;
}
