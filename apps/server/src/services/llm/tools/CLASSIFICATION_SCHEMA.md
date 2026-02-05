# Classification Schema Documentation

## Overview

The Classification Schema defines a comprehensive, type-safe system for extracting, validating, and storing metadata for different content types in Decant. This ensures consistent data structure across the platform and enables powerful search, filtering, and AI-powered features.

## Architecture

### Core Concepts

1. **Content Types**: Categories of content (YouTube, Article, GitHub, etc.)
2. **Field Schemas**: Definition of what data to extract for each type
3. **Validation Rules**: Constraints to ensure data quality
4. **Extraction Methods**: How to obtain field values

### File Structure

- `classification_schema.ts` - Main schema definitions and utilities
- `classification_schema.spec.ts` - Comprehensive test suite
- `CLASSIFICATION_SCHEMA.md` - This documentation file

## Content Types

Currently supported content types:

| Type | Description | Example URL |
|------|-------------|-------------|
| `youtube` | YouTube videos | `https://youtube.com/watch?v=abc123` |
| `article` | Web articles & blogs | `https://blog.example.com/post` |
| `github` | GitHub repositories | `https://github.com/owner/repo` |
| `podcast` | Podcast episodes | `https://podcasts.apple.com/podcast/id123` |
| `paper` | Academic papers | `https://arxiv.org/abs/2101.12345` |
| `tweet` | Twitter/X posts | `https://twitter.com/user/status/123` |
| `image` | Images & visual content | `https://example.com/image.jpg` |
| `tool` | Software tools & apps | `https://example.com/tool` |
| `website` | General websites | `https://example.com` |
| `other` | Uncategorized content | Any URL |

## Field Types

### Common Fields

All content types inherit these fields:

```typescript
{
  title: string;           // Required
  sourceUrl: string;       // Required (URL)
  favicon: string;         // Optional (URL)
  thumbnail: string;       // Optional (URL)
  aiSummary: string;       // Optional (AI-generated)
  aiTags: string[];        // Optional (AI-generated)
  aiKeyPoints: string[];   // Optional (AI-generated)
  dateAdded: Date;         // Required (auto-set)
}
```

### Type-Specific Fields

#### YouTube
```typescript
{
  videoId: string;         // Required (11 chars)
  channelName: string;
  channelId: string;
  duration: number;        // Seconds
  views: number;
  publishedAt: Date;
  transcript: string;
  category: string;
}
```

#### Article
```typescript
{
  author: string;
  publishedAt: Date;
  readingTime: number;     // Minutes
  wordCount: number;
  siteName: string;
  excerpt: string;
  language: string;        // ISO 639-1 (e.g., "en")
}
```

#### GitHub
```typescript
{
  repoOwner: string;       // Required
  repoName: string;        // Required
  stars: number;
  forks: number;
  language: string;        // Programming language
  license: string;
  lastCommit: Date;
  topics: string[];
  description: string;
}
```

#### Podcast
```typescript
{
  podcastName: string;     // Required
  episodeNumber: number;
  season: number;
  duration: number;        // Seconds
  hosts: string[];
  guests: string[];
  publishedAt: Date;
  transcript: string;
}
```

#### Paper
```typescript
{
  authors: string[];
  journal: string;
  doi: string;             // Pattern: 10.xxxx/xxx
  arxivId: string;         // Pattern: xxxx.xxxxx
  citations: number;
  abstract: string;
  publishedAt: Date;
  venue: string;
  pdfUrl: string;
}
```

#### Tweet
```typescript
{
  tweetId: string;         // Required (numeric)
  authorHandle: string;    // @username
  authorName: string;
  likes: number;
  retweets: number;
  replies: number;
  threadLength: number;
  publishedAt: Date;
  mediaUrls: string[];
}
```

## Extraction Methods

Each field specifies how its value should be obtained:

| Method | Description | Example |
|--------|-------------|---------|
| `url_parse` | Extract from URL structure | YouTube video ID from URL |
| `ai_extract` | Use AI to extract from content | Author name, summary |
| `metadata` | Extract from HTML meta tags | Open Graph tags, title |
| `user_input` | Provided by user | Source URL |
| `computed` | Calculate from other data | Reading time from word count |
| `api` | Fetch from external API | GitHub stars, tweet likes |
| `transcript` | Extract from video/audio | YouTube captions |

## Usage Examples

### 1. Get Schema for Content Type

```typescript
import { getSchemaForContentType } from './classification_schema.js';

const schema = getSchemaForContentType('youtube');
console.log(schema.description); // "YouTube videos and content"
console.log(schema.fields);      // Array of field schemas
```

### 2. Validate Extracted Data

```typescript
import { validateExtractedFields } from './classification_schema.js';

const data = {
  title: 'How to Build APIs',
  sourceUrl: 'https://youtube.com/watch?v=abc123',
  videoId: 'abc123',
  views: 50000,
  dateAdded: new Date().toISOString()
};

const result = validateExtractedFields(data, 'youtube');

if (result.valid) {
  console.log('Data is valid!');
} else {
  console.error('Validation errors:', result.errors);
  console.warn('Warnings:', result.warnings);
}
```

### 3. Get All Fields (Common + Type-Specific)

```typescript
import { getAllFieldsForContentType } from './classification_schema.js';

const fields = getAllFieldsForContentType('article');
// Returns: [...COMMON_FIELDS, ...article-specific fields]

fields.forEach(field => {
  console.log(`${field.name}: ${field.type} (required: ${field.required})`);
});
```

### 4. Get Required Fields Only

```typescript
import { getRequiredFields } from './classification_schema.js';

const required = getRequiredFields('github');
// Returns: ['title', 'sourceUrl', 'dateAdded', 'repoOwner', 'repoName']
```

### 5. Filter Fields by Extraction Method

```typescript
import { getFieldsByExtractionMethod } from './classification_schema.js';

// Get all fields that can be extracted from URL
const urlFields = getFieldsByExtractionMethod('youtube', 'url_parse');

// Get all fields requiring AI processing
const aiFields = getFieldsByExtractionMethod('article', 'ai_extract');
```

### 6. Create Default Data Object

```typescript
import { createDefaultData } from './classification_schema.js';

const data = createDefaultData('article');
// Returns object with all required fields initialized to default values
```

## Validation

### Validation Rules

Fields can have the following validation rules:

```typescript
{
  min: number;              // Minimum value/length
  max: number;              // Maximum value/length
  pattern: RegExp;          // Regex pattern
  enum: string[];           // Allowed values
  custom: (value) => boolean | string;  // Custom validator
}
```

### Validation Example

```typescript
const schema: FieldSchema = {
  name: 'videoId',
  type: 'string',
  required: true,
  extractionMethod: 'url_parse',
  validation: {
    pattern: /^[a-zA-Z0-9_-]{11}$/,
    min: 11,
    max: 11
  }
};
```

### Error Severities

- **Error**: Critical issue preventing data storage
- **Warning**: Non-critical issue (e.g., recommended limits)

## Decant Attributes

Special attributes stored on notes for Decant functionality:

```typescript
// Core taxonomy
#decantType = 'space' | 'collection' | 'item'
#contentType = 'youtube' | 'article' | ...

// AI metadata
#aiConfidence = 0.0-1.0
#aiProcessed = true | false

// User interaction
#starred = true | false
#archived = true | false
#readStatus = 'unread' | 'reading' | 'read'
```

## Integration with Other Tools

### Auto-Categorization Tool

The auto-categorization tool uses this schema to:
1. Determine which fields to extract
2. Validate extracted data
3. Store metadata as note attributes

```typescript
import { getSchemaForContentType, validateExtractedFields } from './classification_schema.js';
import type { ContentType } from './auto_categorization_tool.js';

async function categorizeContent(url: string, contentType: ContentType) {
  const schema = getSchemaForContentType(contentType);
  const data = await extractData(url, schema);
  const validation = validateExtractedFields(data, contentType);

  if (!validation.valid) {
    console.error('Extraction errors:', validation.errors);
  }

  return data;
}
```

### Content Extractors

Future extractors should use the schema to determine what to extract:

```typescript
import { getFieldsByExtractionMethod } from './classification_schema.js';

class YouTubeExtractor {
  async extract(url: string) {
    const schema = getSchemaForContentType('youtube');

    // Get URL-parseable fields
    const urlFields = getFieldsByExtractionMethod('youtube', 'url_parse');
    const urlData = this.parseUrl(url, urlFields);

    // Get API fields
    const apiFields = getFieldsByExtractionMethod('youtube', 'api');
    const apiData = await this.fetchFromAPI(urlData.videoId, apiFields);

    // Combine and validate
    const data = { ...urlData, ...apiData };
    return validateExtractedFields(data, 'youtube');
  }
}
```

## Adding New Content Types

To add a new content type:

1. **Define the type** in `auto_categorization_tool.ts`:
```typescript
export type ContentType =
  | 'youtube'
  | 'article'
  | 'mynewtype';  // Add here
```

2. **Create schema** in `classification_schema.ts`:
```typescript
mynewtype: {
  contentType: 'mynewtype',
  description: 'Description of the content type',
  exampleUrl: 'https://example.com',
  fields: [
    {
      name: 'specificField',
      type: 'string',
      required: true,
      extractionMethod: 'metadata',
      description: 'Field description',
      example: 'Example value'
    }
    // ... more fields
  ]
}
```

3. **Add detection logic** in `auto_categorization_tool.ts`:
```typescript
private detectContentType(url: string, title: string): ContentType {
  if (url.includes('mynewtype.com')) {
    return 'mynewtype';
  }
  // ... existing detection logic
}
```

4. **Write tests** in `classification_schema.spec.ts`

## Best Practices

1. **Always validate** extracted data before storing
2. **Use type guards** for runtime type safety
3. **Handle missing optional fields** gracefully
4. **Log validation warnings** for debugging
5. **Keep extraction methods accurate** - don't mark fields as `api` if they're actually `metadata`
6. **Provide examples** for all new fields
7. **Document patterns** for validation regex

## Performance Considerations

- Schema lookups are O(1) using record access
- Validation is O(n) where n = number of fields
- Consider caching schemas for frequently accessed content types
- Async extraction methods (API, transcript) should be batched when possible

## Future Enhancements

Planned improvements:

1. **Dynamic field registration** for plugins
2. **Schema versioning** for backward compatibility
3. **Field dependencies** (e.g., require X if Y is present)
4. **Conditional validation** based on content type variants
5. **Auto-migration** when schemas change
6. **GraphQL schema generation** from field definitions
7. **OpenAPI spec generation** for ETAPI endpoints

## Contributing

When modifying the schema:

1. Update the TypeScript definitions
2. Add/update validation rules
3. Update tests to maintain 100% coverage
4. Update this documentation
5. Add examples for new fields
6. Consider backward compatibility

## Related Files

- `/apps/server/src/services/llm/tools/auto_categorization_tool.ts` - Uses schema for categorization
- `/apps/server/src/services/llm/tools/attribute_manager_tool.ts` - Manages note attributes
- `/apps/server/src/becca/entities/BAttribute.ts` - Attribute storage
- `/apps/server/src/services/attributes.ts` - Attribute helpers

## Questions?

For questions or suggestions about the schema:
- Open an issue on GitHub
- Check the test suite for usage examples
- Review inline code documentation
