# AI Import Service

The AI Import Service provides intelligent URL import functionality for Decant, automatically categorizing and organizing web content into the appropriate Spaces and Collections.

## Overview

This service orchestrates the complete import pipeline:

1. **Content Detection** - Identifies content type (YouTube, GitHub, Article, etc.)
2. **Content Extraction** - Extracts relevant metadata and content
3. **AI Categorization** - Uses LLM to determine optimal placement
4. **Hierarchy Management** - Creates or finds appropriate Space/Collection
5. **Note Creation** - Creates the item note with all attributes

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client Request                        │
│              POST /api/ai-import                         │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│          API Route (ai_import.ts)                        │
│  - Validates request                                     │
│  - Calls AI Import Service                              │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│       AI Import Service (ai_import_service.ts)           │
│                                                          │
│  1. Extract Content                                      │
│     └─> extractContent() → {title, content, metadata}   │
│                                                          │
│  2. AI Categorization                                    │
│     └─> AutoCategorizationTool.execute()                │
│         └─> Returns: Space, Collection, tags, summary   │
│                                                          │
│  3. Find or Create Space                                 │
│     └─> findOrCreateSpace()                             │
│         └─> Returns: Space Note                         │
│                                                          │
│  4. Find or Create Collection                            │
│     └─> findOrCreateCollection()                        │
│         └─> Returns: Collection Note                    │
│                                                          │
│  5. Create Item Note                                     │
│     └─> createItemNote()                                │
│         └─> Adds all Decant attributes                  │
│                                                          │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                   Response                               │
│  {                                                       │
│    success: true,                                        │
│    noteId: "abc123",                                     │
│    spaceId: "space_dev",                                 │
│    spaceName: "Development",                             │
│    collectionId: "coll_tools",                           │
│    collectionName: "Tools & Libraries",                  │
│    categorization: { ... },                              │
│    processingTimeMs: 2500                                │
│  }                                                       │
└─────────────────────────────────────────────────────────┘
```

## Files Created

### Service Layer

**`apps/server/src/services/ai_import_service.ts`**
- Main orchestration service
- Handles content extraction
- Invokes AI categorization
- Creates Space/Collection hierarchy
- Creates item notes with attributes

### API Layer

**`apps/server/src/routes/api/ai_import.ts`**
- REST endpoint for imports
- Request validation
- Error handling
- Response formatting

**`apps/server/src/routes/routes.ts`** (modified)
- Registered AI import routes:
  - `POST /api/ai-import` - Import URL
  - `GET /api/ai-import/status` - Service status

### Documentation & Tests

**`apps/server/src/routes/api/ai_import.spec.ts`**
- Test cases and examples
- API usage documentation

**`docs/AI_IMPORT_SERVICE.md`** (this file)
- Architecture documentation
- Integration guide

## API Reference

### Import URL

**Endpoint:** `POST /api/ai-import`

**Request Body:**
```typescript
{
  url: string,                    // Required: URL to import
  options?: {
    spaceId?: string,             // Optional: Force specific Space
    collectionId?: string,        // Optional: Force specific Collection
    skipCategorization?: boolean, // Optional: Skip AI categorization
    title?: string                // Optional: Override extracted title
  }
}
```

**Response:**
```typescript
{
  success: boolean,
  noteId: string,              // Created note ID
  spaceId: string,             // Space where note was placed
  spaceName: string,
  collectionId: string,        // Collection where note was placed
  collectionName: string,
  categorization: {
    suggestedSpaceId: string | null,
    suggestedSpaceName: string,
    suggestedCollectionId: string | null,
    suggestedCollectionName: string,
    createNewCollection: boolean,
    newCollectionName?: string,
    contentType: string,       // 'youtube' | 'article' | 'github' | etc.
    suggestedTags: string[],   // AI-suggested tags
    summary: string,           // AI-generated summary
    keyPoints: string[],       // Key points extracted
    confidence: number         // 0-1, AI confidence score
  },
  processingTimeMs: number,
  error?: string               // Only present if success = false
}
```

### Check Status

**Endpoint:** `GET /api/ai-import/status`

**Response:**
```typescript
{
  available: boolean,
  message: string
}
```

## Usage Examples

### Basic Import (AI Categorization)

```typescript
const response = await fetch('/api/ai-import', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://github.com/trilium-next/notes'
  })
});

const result = await response.json();
console.log(`Created note: ${result.noteId}`);
console.log(`Space: ${result.spaceName}`);
console.log(`Collection: ${result.collectionName}`);
console.log(`Confidence: ${result.categorization.confidence}`);
```

### Import to Specific Location

```typescript
const response = await fetch('/api/ai-import', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://example.com/article',
    options: {
      spaceId: 'mySpaceId',
      collectionId: 'myCollectionId',
      skipCategorization: true
    }
  })
});
```

### Import with Custom Title

```typescript
const response = await fetch('/api/ai-import', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://example.com/page',
    options: {
      title: 'My Custom Title for This Page'
    }
  })
});
```

## Data Model

### Decant Attributes

Each imported item note gets these attributes:

| Attribute | Type | Description | Example |
|-----------|------|-------------|---------|
| `#decantType` | label | Always "item" | `item` |
| `#sourceUrl` | label | Original URL | `https://...` |
| `#contentType` | label | Detected type | `youtube`, `article`, `github` |
| `#favicon` | label | Favicon URL | `https://...` |
| `#thumbnail` | label | Thumbnail URL | `https://...` |
| `#aiSummary` | label | AI summary | `This article discusses...` |
| `#aiConfidence` | label | Confidence score | `0.85` |
| `#aiTags` | label | Comma-separated tags | `javascript, tutorial, beginner` |
| Individual tags | label | Each tag separately | `#javascript`, `#tutorial` |
| `#iconClass` | label | Icon class | `bx bx-bookmark` |

### Hierarchy Structure

```
Root
├── Space (Development)          #decantType=space
│   ├── Collection (JavaScript)  #decantType=collection
│   │   ├── Item (Tutorial)      #decantType=item
│   │   └── Item (GitHub Repo)   #decantType=item
│   └── Collection (Python)      #decantType=collection
│       └── Item (Article)       #decantType=item
└── Space (Research)             #decantType=space
    └── Collection (Papers)      #decantType=collection
        └── Item (ArXiv Paper)   #decantType=item
```

## Integration with Existing Tools

### Auto-Categorization Tool

The service uses the existing `AutoCategorizationTool` from:
```
apps/server/src/services/llm/tools/auto_categorization_tool.ts
```

This tool:
- Analyzes content semantically
- Determines optimal Space/Collection placement
- Generates tags and summaries
- Provides confidence scores

### Note Creation

Uses the standard `notes.createNewNote()` function:
```typescript
const { note } = notes.createNewNote({
  parentNoteId: collection.noteId,
  title: title,
  content: content,
  type: 'text'
});
```

### Attribute Management

Uses the `attributes` service:
```typescript
attributes.createLabel(noteId, 'decantType', 'item');
attributes.createLabel(noteId, 'sourceUrl', url);
```

## Future Enhancements (Phase 2+)

### Content Extractors

Planned specialized extractors:
- **YouTube**: Extract transcript, video metadata
- **GitHub**: Extract README, repo info, stars
- **Articles**: Full text extraction with readability
- **Papers**: PDF parsing, abstract extraction
- **Podcasts**: Episode info, show notes
- **Twitter/X**: Tweet content, thread extraction

Location: `apps/server/src/services/content_extractors/`

### Enhanced Features

- **Batch Import**: Import multiple URLs at once
- **Smart Deduplication**: Detect already-imported URLs
- **Content Updates**: Re-extract and update content
- **Custom Extractors**: Plugin system for custom extractors
- **Import History**: Track import statistics and sources

## Error Handling

The service handles errors gracefully:

```typescript
{
  success: false,
  error: "Invalid URL provided",
  noteId: "",
  spaceId: "",
  spaceName: "",
  collectionId: "",
  collectionName: "",
  categorization: { /* fallback values */ },
  processingTimeMs: 150
}
```

Common error scenarios:
- Invalid URL format
- Network failures during extraction
- AI service unavailable
- Database errors during note creation
- Permission issues

## Performance Considerations

**Typical Processing Time:**
- Content extraction: 100-500ms
- AI categorization: 1-3 seconds
- Note creation: 50-200ms
- **Total: 1.5-4 seconds per URL**

**Optimization Strategies:**
- Content extraction happens asynchronously
- AI batching for multiple imports (future)
- Caching of common categorizations (future)
- Progressive enhancement (basic import first, details later)

## Testing

Run tests:
```bash
pnpm test apps/server/src/routes/api/ai_import.spec.ts
```

Manual testing:
```bash
# Start dev server
pnpm run server:start

# Test import
curl -X POST http://localhost:8080/api/ai-import \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/trilium-next/notes"}'

# Check status
curl http://localhost:8080/api/ai-import/status
```

## Security Considerations

- **URL Validation**: All URLs are sanitized before processing
- **Content Sanitization**: HTML content is sanitized to prevent XSS
- **Rate Limiting**: Consider adding rate limits for production
- **Authentication**: Requires authenticated session
- **CSRF Protection**: Inherits from Trilium's CSRF middleware

## Logging

The service logs key events:
- Import start/completion with URLs
- AI categorization results
- Space/Collection creation
- Errors with stack traces

Log level: `INFO` for normal operations, `ERROR` for failures

Location: Check server logs via `GET /api/backend-log`

## Contributing

When extending the AI Import Service:

1. **Add Content Extractors**: Create new files in `services/content_extractors/`
2. **Enhance Categorization**: Modify `auto_categorization_tool.ts`
3. **Add Attributes**: Update `createItemNote()` in `ai_import_service.ts`
4. **Write Tests**: Add test cases to `ai_import.spec.ts`
5. **Update Docs**: Document new features here

## Related Documentation

- [DECANT_INTEGRATION.md](./DECANT_INTEGRATION.md) - Overall Decant architecture
- [Auto-Categorization Tool](../apps/server/src/services/llm/tools/auto_categorization_tool.ts)
- [LLM Tools](../apps/server/src/services/llm/tools/) - Available AI tools
