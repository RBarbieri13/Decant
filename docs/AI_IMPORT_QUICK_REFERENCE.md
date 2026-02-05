# AI Import Service - Quick Reference

## Quick Start

### Import a URL (AI decides where to place it)
```bash
curl -X POST http://localhost:8080/api/ai-import \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/trilium-next/notes"}'
```

### Import with custom title
```bash
curl -X POST http://localhost:8080/api/ai-import \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "options": {"title": "My Title"}}'
```

### Import to specific Space/Collection
```bash
curl -X POST http://localhost:8080/api/ai-import \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "options": {
      "spaceId": "YOUR_SPACE_ID",
      "collectionId": "YOUR_COLLECTION_ID",
      "skipCategorization": true
    }
  }'
```

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/ai-import` | Import a URL with AI categorization |
| GET | `/api/ai-import/status` | Check if service is available |

## Request Format

```typescript
{
  url: string,              // Required: URL to import
  options?: {
    spaceId?: string,       // Force specific Space
    collectionId?: string,  // Force specific Collection
    skipCategorization?: boolean, // Skip AI (requires spaceId & collectionId)
    title?: string          // Override extracted title
  }
}
```

## Response Format

```typescript
{
  success: boolean,
  noteId: string,
  spaceId: string,
  spaceName: string,
  collectionId: string,
  collectionName: string,
  categorization: {
    suggestedSpaceId: string | null,
    suggestedSpaceName: string,
    suggestedCollectionId: string | null,
    suggestedCollectionName: string,
    createNewCollection: boolean,
    contentType: 'youtube' | 'article' | 'github' | 'podcast' | 'paper' | 'tweet' | 'image' | 'tool' | 'website' | 'other',
    suggestedTags: string[],
    summary: string,
    keyPoints: string[],
    confidence: number  // 0-1
  },
  processingTimeMs: number,
  error?: string  // Only if success = false
}
```

## TypeScript/JavaScript

```typescript
// Basic import
const response = await fetch('/api/ai-import', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://example.com' })
});
const result = await response.json();

if (result.success) {
  console.log('Created note:', result.noteId);
  console.log('Space:', result.spaceName);
  console.log('Collection:', result.collectionName);
  console.log('Tags:', result.categorization.suggestedTags);
}
```

## Python

```python
import requests

response = requests.post(
    'http://localhost:8080/api/ai-import',
    json={'url': 'https://example.com'}
)
result = response.json()

if result['success']:
    print(f"Created note: {result['noteId']}")
    print(f"Space: {result['spaceName']}")
    print(f"Collection: {result['collectionName']}")
```

## Attributes Added to Items

Every imported item gets these attributes:

| Attribute | Value | Example |
|-----------|-------|---------|
| `#decantType` | `item` | Always `item` |
| `#sourceUrl` | Original URL | `https://example.com/article` |
| `#contentType` | Detected type | `article`, `youtube`, `github` |
| `#favicon` | Favicon URL | `https://www.google.com/s2/favicons?...` |
| `#thumbnail` | Thumbnail URL | Optional |
| `#aiSummary` | AI summary | 2-sentence summary of content |
| `#aiConfidence` | Confidence score | `0.85` |
| `#aiTags` | Comma-separated tags | `javascript, tutorial, beginner` |
| Individual tags | Each tag | `#javascript`, `#tutorial`, `#beginner` |
| `#iconClass` | Icon | `bx bx-bookmark` |

## Content Types

The service automatically detects:

- `youtube` - YouTube videos
- `github` - GitHub repositories
- `article` - Blog posts, news articles
- `paper` - Academic papers (ArXiv, DOI)
- `podcast` - Podcast episodes
- `tweet` - Twitter/X posts
- `image` - Direct image links
- `tool` - Web apps/tools
- `website` - Generic websites
- `other` - Fallback

## Common Use Cases

### 1. Bookmark with AI organization
```typescript
fetch('/api/ai-import', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({url: currentUrl})
});
```

### 2. Save to reading list
```typescript
fetch('/api/ai-import', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    url: articleUrl,
    options: {
      spaceId: 'reading_space_id',
      collectionId: 'to_read_collection_id',
      skipCategorization: true
    }
  })
});
```

### 3. Batch import
```typescript
const urls = ['https://url1.com', 'https://url2.com', 'https://url3.com'];

const results = await Promise.all(
  urls.map(url =>
    fetch('/api/ai-import', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({url})
    }).then(r => r.json())
  )
);

console.log(`Imported ${results.filter(r => r.success).length} of ${urls.length}`);
```

## Error Handling

Always check `success` field:

```typescript
const result = await fetch('/api/ai-import', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({url: myUrl})
}).then(r => r.json());

if (!result.success) {
  console.error('Import failed:', result.error);
  // Handle error
} else {
  console.log('Success! Note:', result.noteId);
  // Handle success
}
```

## Testing

### Check if service is available
```bash
curl http://localhost:8080/api/ai-import/status
```

Expected: `{"available":true,"message":"AI Import service is available"}`

### Test with various URLs
```bash
# GitHub repo
curl -X POST http://localhost:8080/api/ai-import \
  -H "Content-Type: application/json" \
  -d '{"url":"https://github.com/trilium-next/notes"}'

# YouTube video
curl -X POST http://localhost:8080/api/ai-import \
  -H "Content-Type: application/json" \
  -d '{"url":"https://youtube.com/watch?v=..."}'

# Article
curl -X POST http://localhost:8080/api/ai-import \
  -H "Content-Type: application/json" \
  -d '{"url":"https://dev.to/example-article"}'
```

## Performance

Typical timing:
- **Fast:** 1.5-2 seconds (simple content)
- **Normal:** 2-3 seconds (average content)
- **Slow:** 3-4 seconds (complex content or slow AI)

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Invalid URL" | Check URL format (must start with http/https) |
| "Service not available" | Check AI provider configuration |
| Low confidence score | Content unclear, try custom title |
| Slow response | AI provider latency, check network |
| Note not found | Check `result.noteId`, verify in database |

## Query Notes by Decant Attributes

```typescript
// Find all items in a Space
const items = searchService.searchNotes(
  '#decantType=item AND #decantSpace="Development"'
);

// Find all GitHub imports
const githubItems = searchService.searchNotes(
  '#decantType=item AND #contentType=github'
);

// Find high-confidence imports
const highConfidence = searchService.searchNotes(
  '#decantType=item AND #aiConfidence>0.8'
);
```

## File Locations

| File | Location |
|------|----------|
| Service | `apps/server/src/services/ai_import_service.ts` |
| API | `apps/server/src/routes/api/ai_import.ts` |
| Routes | `apps/server/src/routes/routes.ts` |
| Tests | `apps/server/src/routes/api/ai_import.spec.ts` |
| Docs | `docs/AI_IMPORT_SERVICE.md` |
| Examples | `docs/examples/ai_import_*.{sh,ts}` |

## Related

- [Full Documentation](./AI_IMPORT_SERVICE.md)
- [Implementation Summary](./AI_IMPORT_IMPLEMENTATION_SUMMARY.md)
- [Decant Integration Plan](./DECANT_INTEGRATION.md)
- [Auto-Categorization Tool](../apps/server/src/services/llm/tools/auto_categorization_tool.ts)

## Development Server

```bash
# Start server
pnpm run server:start

# Server runs at
http://localhost:8080

# Test endpoint
http://localhost:8080/api/ai-import/status
```

## Next Steps

1. Test the implementation
2. Review API responses
3. Adjust AI prompts if needed
4. Build Workspace Widget (Phase 4)
5. Add content extractors (Phase 2+)
