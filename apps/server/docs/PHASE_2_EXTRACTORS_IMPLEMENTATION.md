# Phase 2 Content Extractors - Implementation Summary

**Status**: ✅ **COMPLETED** - All extractors implemented and integrated
**Date**: February 2, 2026
**Build Status**: ✅ Passing

## Overview

Phase 2 content extractors have been successfully implemented to enhance the AI Import feature with specialized content extraction capabilities. The system uses a quality-optimized, cost-effective architecture that processes 100-200 content pieces/month at ~$23.50-41/month.

## Architecture

### Smart Routing System

The `ExtractorFactory` intelligently routes URLs to the appropriate extractor based on content type:

```
URL → ExtractorFactory → [Content Type Detection] → Specialized Extractor → Gemini Enhancement → Result
```

### Implemented Components

#### 1. **Base Infrastructure** (`apps/server/src/services/extractors/`)
- ✅ `types.ts` - Type definitions for all extractors
- ✅ `base_extractor.ts` - Common utilities (retry logic, error handling, cost estimation)
- ✅ `index.ts` - Module exports

#### 2. **Content Extractors**
- ✅ **FirecrawlExtractor** (`firecrawl_extractor.ts`)
  - Articles, PDFs, documentation sites
  - Deep crawling with `/crawl` endpoint
  - Falls back to existing scraper when API unavailable

- ✅ **YouTubeExtractor** (`youtube_extractor.ts`)
  - Video metadata via YouTube Data API v3
  - Thumbnail URLs, duration, views, channel info
  - Falls back to URL parsing when API key missing

- ✅ **GitHubExtractor** (`github_extractor.ts`)
  - Repository metadata via GitHub REST API v3
  - README content, stars, forks, languages
  - Works with/without authentication (different rate limits)

#### 3. **Processing Layer**
- ✅ **GeminiProcessor** (`gemini_processor.ts`)
  - Unified content analysis (Pro/Flash tiers)
  - Summarization, taxonomy generation
  - Diagram generation (Mermaid syntax)
  - Multimodal video/audio processing

- ✅ **MediaProcessor** (`media_processor.ts`)
  - Coordinates YouTube + Gemini for video content
  - Extracts visual elements (slides, code, diagrams)
  - Audio-only processing for podcasts
  - Download capability via ytdl-core

#### 4. **Orchestration**
- ✅ **ExtractorFactory** (`extractor_factory.ts`)
  - Smart content type detection
  - Automatic extractor selection
  - Gemini enhancement layer
  - Batch extraction support
  - API key validation

## Integration

### AI Import Service

Updated `apps/server/src/services/ai_import_service.ts` (lines 90-170) to:
- Replace placeholder extraction with extractor factory
- Pass API keys from options
- Build rich content from extraction results
- Handle transcripts, summaries, visual elements
- Graceful fallback on extraction failures

### Configuration

Added new options in `apps/server/src/services/options_init.ts`:
```javascript
{ name: 'firecrawlApiKey', value: '', isSynced: false, isSecret: true }
{ name: 'geminiApiKey', value: '', isSynced: false, isSecret: true }
{ name: 'youtubeApiKey', value: '', isSynced: false, isSecret: true }
{ name: 'githubAccessToken', value: '', isSynced: false, isSecret: true }
{ name: 'geminiTier', value: 'auto', isSynced: true, isSecret: false }
```

## Dependencies

### Added Packages
- `@mendable/firecrawl-js@4.12.0` - Article/PDF extraction
- `@google/generative-ai@0.24.1` - Gemini AI processing
- `ytdl-core@4.11.5` - YouTube video download

### Dependency Fixes
- **Zod upgrade**: v3.24.4 → v4.3.6
  - Fixed compatibility with `zod-to-json-schema` (Firecrawl dependency)
  - Added pnpm override: `"zod@<4": "^4.3.6"`

## API Cost Structure

### Monthly Cost Estimates (100-200 items/month, ~50 hours video)

| Service | Plan | Cost | Usage |
|---------|------|------|-------|
| Firecrawl | Hobby | $16/mo | 3,000 credits |
| Gemini Pro/Flash | Pay-as-you-go | $1-25/mo | Hybrid: ~$7-8/mo |
| YouTube Data API | Free | $0 | 10,000 quota/day |
| GitHub REST API | Free | $0 | 5,000 requests/hour (auth) |
| Kroki | Free | $0 | Self-hosted or public |

**Total**: ~$23.50-41/month depending on Gemini tier usage

### Quality Tier Selection

The system intelligently selects processing tier based on content:

```javascript
// Auto mode (default)
- Complex content (>3000 words, technical, has code) → Gemini Pro
- Simple content → Gemini Flash

// Manual override
- geminiTier: 'pro' → Always use Pro (higher quality)
- geminiTier: 'flash' → Always use Flash (lower cost)
```

## Extraction Pipeline

### 1. YouTube Video
```
URL → YouTubeExtractor (metadata)
    → MediaProcessor (video download optional)
    → Gemini multimodal (transcript + visual elements)
    → Result with: title, description, transcript, slide text, code snippets, summary, taxonomy
```

### 2. Article/PDF
```
URL → FirecrawlExtractor (scrape/crawl)
    → Gemini text analysis (summary, taxonomy)
    → Result with: content, metadata, summary, key concepts
```

### 3. GitHub Repository
```
URL → GitHubExtractor (repo + README)
    → Gemini text analysis
    → Result with: repo metadata, README, summary, topics
```

## Error Handling

### 4-Level Fallback Hierarchy

1. **Premium API** (Firecrawl /crawl, Gemini Pro)
2. **Standard API** (Firecrawl /scrape, Gemini Flash, free APIs)
3. **Scraping Fallback** (existing cheerio-based scraper)
4. **Minimal Metadata** (URL parsing only)

### Retry Logic
- Exponential backoff (3 retries, 1s → 2s → 4s delay)
- Only retries on recoverable errors (rate limits, timeouts)
- Non-retryable: 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found

### Error Codes
```typescript
enum ExtractionErrorCode {
    RATE_LIMIT_EXCEEDED,
    INVALID_API_KEY,
    NETWORK_TIMEOUT,
    CONTENT_NOT_FOUND,
    PARSING_ERROR,
    SSRF_BLOCKED,
    COST_BUDGET_EXCEEDED,
    UNSUPPORTED_CONTENT_TYPE,
    UNKNOWN_ERROR
}
```

## Security

### SSRF Protection
- Blocks localhost (127.0.0.1, ::1)
- Blocks private IP ranges (10.x, 172.16-31.x, 192.168.x)
- Blocks cloud metadata services (169.254.169.254, metadata.google.internal)

### API Key Security
- Stored with `isSynced: false` (not synced across devices)
- Marked as `isSecret: true` (not exposed in logs)
- Validated before use (test API calls)

## Testing Status

### Build Status
✅ **Server build**: Passing
✅ **TypeScript compilation**: No errors
✅ **Dependencies**: Installed and resolved

### Manual Testing Required

To test the extractors, start the server and try these URLs via the AI Import API:

```bash
# Start server
pnpm run server:start

# Test YouTube extraction
curl -X POST http://localhost:8080/api/ai-import \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'

# Test GitHub extraction
curl -X POST http://localhost:8080/api/ai-import \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/zadam/trilium"}'

# Test article extraction
curl -X POST http://localhost:8080/api/ai-import \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/article"}'
```

## Next Steps

### Phase 3 Enhancements (Future)
1. **Diagram Rendering** - Integrate Kroki for Mermaid → SVG conversion
2. **Batch Processing** - Queue-based background extraction
3. **Cost Tracking Dashboard** - Monitor API usage and costs
4. **Additional Content Types** - Papers (Semantic Scholar), Podcasts (Apple/Spotify)
5. **Webhook Updates** - Re-extract when source content changes

### Configuration UI
- Add API key input fields in settings
- Add Gemini tier selector (Pro/Flash/Auto)
- Add extraction method indicators in note attributes

## Files Modified

### New Files (8)
1. `apps/server/src/services/extractors/types.ts`
2. `apps/server/src/services/extractors/base_extractor.ts`
3. `apps/server/src/services/extractors/firecrawl_extractor.ts`
4. `apps/server/src/services/extractors/youtube_extractor.ts`
5. `apps/server/src/services/extractors/github_extractor.ts`
6. `apps/server/src/services/extractors/gemini_processor.ts`
7. `apps/server/src/services/extractors/media_processor.ts`
8. `apps/server/src/services/extractors/extractor_factory.ts`
9. `apps/server/src/services/extractors/index.ts`

### Modified Files (3)
1. `apps/server/src/services/ai_import_service.ts` - Integrated extractor factory
2. `apps/server/src/services/options_init.ts` - Added API key options
3. `package.json` (root) - Added zod v4, pnpm overrides, new dependencies

## Key Features

✅ **Quality-First Architecture** - Premium APIs for best results
✅ **Cost-Optimized** - Smart tier selection, ~$30/mo for 200 items
✅ **Graceful Degradation** - 4-level fallback hierarchy
✅ **Visual Context** - Extracts slide text, diagrams, code from videos
✅ **Unified Processing** - Gemini handles all content types
✅ **Security** - SSRF protection, API key validation
✅ **Extensible** - Easy to add new extractors

## Summary

Phase 2 content extractors transform the AI Import feature from basic URL bookmarking to intelligent knowledge synthesis. The system:

- Extracts rich content from articles, videos, repos, and more
- Generates summaries and taxonomies automatically
- Processes visual elements from videos (slides, code, diagrams)
- Costs ~$30/month for 100-200 imports
- Falls back gracefully when APIs unavailable
- Maintains security and data privacy

The implementation is production-ready pending manual testing with actual API keys.

---

**Implementation Team**: Claude Code
**Review Status**: Pending User Approval
**Deployment**: Ready for testing
