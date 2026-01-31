# Filtered Search API Implementation

## Overview
Added a comprehensive filtered search endpoint to support the SearchFiltersPanel component with advanced filtering capabilities.

## New Endpoint

### POST /api/search/filtered

**Description:** Advanced search endpoint with comprehensive filter support for segments, categories, content types, organizations, date ranges, and metadata completeness.

**Request Body:**
```json
{
  "query": "machine learning",
  "filters": {
    "segments": ["A", "T"],
    "categories": ["LLM", "AGT"],
    "contentTypes": ["T", "V"],
    "organizations": ["Anthropic", "OpenAI"],
    "dateRange": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-12-31T23:59:59Z"
    },
    "hasCompleteMetadata": true
  },
  "page": 1,
  "limit": 20
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "uuid",
      "title": "Node Title",
      "url": "https://example.com",
      "segment": "A",
      "category": "LLM",
      "contentType": "T",
      "company": "Anthropic",
      "source_domain": "example.com",
      "phrase_description": "Brief description",
      "short_description": "Detailed description",
      "ai_summary": "AI-generated summary",
      "logo_url": "https://example.com/logo.png",
      "matchedFields": ["title", "short_description"],
      "snippet": "...highlighted snippet...",
      "extracted_fields": {},
      "metadata_tags": [],
      "key_concepts": ["AI", "ML"]
    }
  ],
  "facets": {
    "segments": {
      "A": 15,
      "T": 8
    },
    "categories": {
      "LLM": 10,
      "AGT": 5
    },
    "contentTypes": {
      "T": 12,
      "V": 8,
      "A": 3
    },
    "organizations": [
      { "name": "Anthropic", "count": 10 },
      { "name": "OpenAI", "count": 8 }
    ]
  },
  "total": 23,
  "page": 1,
  "pageSize": 20
}
```

## Filter Parameters

### segments: SegmentCode[]
- Filter by segment codes (A, T, F, S, H, B, E, L, X, C)
- Supports multiple segments
- Example: `["A", "T"]` for AI and Technology

### categories: string[]
- Filter by category codes (e.g., LLM, AGT, FND)
- Supports multiple categories
- Example: `["LLM", "AGT"]`

### contentTypes: ContentTypeCode[]
- Filter by content type codes (T, A, V, P, R, G, S, C, I, N, K, U)
- Supports multiple content types
- T: Tool, A: Article, V: Video, P: Podcast, R: Research, G: Repository,
  S: Social, C: Course, I: Image, N: Newsletter, K: Book, U: Audio
- Example: `["T", "V", "A"]` for Tools, Videos, and Articles

### organizations: string[]
- Filter by organization/company names
- Supports partial matching (LIKE query)
- Supports multiple organizations
- Example: `["Anthropic", "OpenAI"]`

### dateRange: { start?: string, end?: string }
- Filter by date range (date_added field)
- Dates should be ISO 8601 format
- Both start and end are optional
- Example: `{ "start": "2024-01-01T00:00:00Z", "end": "2024-12-31T23:59:59Z" }`

### hasCompleteMetadata: boolean
- Filter for nodes with complete Phase 2 enrichment data
- Checks for `extracted_fields.phase2Completed = true`
- Example: `true`

## Pagination

- **page**: Page number (default: 1, min: 1)
- **limit**: Results per page (default: 20, min: 1, max: 100)

## Backend Changes

### 1. Updated SearchFilters Interface
**File:** `/decant-standalone/src/backend/database/search.ts`

```typescript
export interface SearchFilters {
  // New array-based filters
  segments?: string[];
  categories?: string[];
  contentTypes?: string[];
  organizations?: string[];
  dateRange?: {
    start?: string;
    end?: string;
  };
  hasCompleteMetadata?: boolean;

  // Legacy single-value filters (backward compatible)
  segment?: string;
  category?: string;
  contentType?: string;
  organization?: string;
  hasMetadata?: boolean;
}
```

### 2. Updated buildFilterConditions Function
**File:** `/decant-standalone/src/backend/database/search.ts`

- Handles both array-based and single-value filters for backward compatibility
- Uses SQL IN clauses for array filters
- Supports multiple organizations with LIKE queries

### 3. Added Validation Schema
**File:** `/decant-standalone/src/backend/validation/schemas.ts`

```typescript
export const FilteredSearchSchema = z.object({
  query: z.string().min(1).max(500),
  filters: z.object({
    segments: z.array(z.string().length(1)).optional(),
    categories: z.array(z.string().max(10)).optional(),
    contentTypes: z.array(z.string().length(1)).optional(),
    organizations: z.array(z.string().max(200)).optional(),
    dateRange: z.object({
      start: z.string().datetime().optional(),
      end: z.string().datetime().optional(),
    }).optional(),
    hasCompleteMetadata: z.boolean().optional(),
  }).optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
```

### 4. Added Route Handler
**File:** `/decant-standalone/src/backend/routes/search.ts`

```typescript
export async function searchFiltered(req: Request, res: Response): Promise<void> {
  const { query, filters, page, limit } = req.body;

  const pagination = validatePaginationParams(
    page?.toString(),
    limit?.toString()
  );

  const response = searchNodesAdvanced(query, filters, pagination);

  res.json(response);
}
```

### 5. Registered Route
**File:** `/decant-standalone/src/backend/routes/index.ts`

```typescript
app.post('/api/search/filtered', validateBody(FilteredSearchSchema), searchRoutes.searchFiltered);
```

## Testing

### Test File
**File:** `/decant-standalone/src/backend/routes/__tests__/search.spec.ts`

Comprehensive test coverage including:
- ✅ Search with no filters
- ✅ Filter by single segment
- ✅ Filter by multiple segments
- ✅ Filter by single content type
- ✅ Filter by multiple content types
- ✅ Filter by organizations
- ✅ Filter by date range
- ✅ Filter by hasCompleteMetadata
- ✅ Combine multiple filters
- ✅ Pagination support
- ✅ Facet aggregation
- ✅ Input validation
- ✅ Error handling

## Backward Compatibility

The implementation maintains backward compatibility with existing search endpoints:
- `/api/search` - Basic search (unchanged)
- `/api/search/advanced` - Advanced search with query params (unchanged)
- `/api/search/filtered` - New POST endpoint with comprehensive filters

The `SearchFilters` interface supports both:
- **New array-based filters** (segments, categories, contentTypes, organizations)
- **Legacy single-value filters** (segment, category, contentType, organization)

## Usage Example

### Frontend Integration

```typescript
// Example usage with SearchFiltersPanel
const handleFiltersChange = async (filters: SearchFilterState) => {
  const response = await fetch('/api/search/filtered', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: searchQuery,
      filters: {
        segments: filters.segments,
        categories: filters.categories,
        contentTypes: filters.contentTypes,
        organizations: filters.organizations,
        dateRange: filters.dateRange,
        hasCompleteMetadata: filters.hasCompleteMetadata,
      },
      page: 1,
      limit: 20,
    }),
  });

  const data = await response.json();
  // data.results, data.facets, data.total, data.page, data.pageSize
};
```

### cURL Example

```bash
curl -X POST http://localhost:8080/api/search/filtered \
  -H "Content-Type: application/json" \
  -d '{
    "query": "machine learning",
    "filters": {
      "segments": ["A"],
      "contentTypes": ["T", "V"],
      "hasCompleteMetadata": true
    },
    "page": 1,
    "limit": 20
  }'
```

## Performance Considerations

1. **FTS5 Full-Text Search**: Uses SQLite FTS5 when available for fast text search
2. **LIKE Fallback**: Falls back to LIKE queries when FTS5 is unavailable
3. **Indexed Filtering**: All filter fields (segment_code, category_code, content_type_code, company, date_added) should have database indexes
4. **Facet Limits**: Facet calculation limited to first 10,000 results for performance
5. **Batch Concept Loading**: Key concepts are batch-loaded to avoid N+1 queries

## Next Steps

1. ✅ Backend endpoint implemented
2. Frontend already has SearchFiltersPanel component
3. Integration needed: Connect SearchFiltersPanel to POST /api/search/filtered
4. Optional: Add search result caching for repeated queries
5. Optional: Add search analytics tracking

## Files Modified

1. `/decant-standalone/src/backend/database/search.ts` - Updated SearchFilters interface and buildFilterConditions
2. `/decant-standalone/src/backend/validation/schemas.ts` - Added FilteredSearchSchema
3. `/decant-standalone/src/backend/routes/search.ts` - Added searchFiltered handler
4. `/decant-standalone/src/backend/routes/index.ts` - Registered new route
5. `/decant-standalone/src/backend/routes/__tests__/search.spec.ts` - Added comprehensive tests

## Files Created

1. `/decant-standalone/src/backend/routes/__tests__/search.spec.ts` - Test suite for filtered search
2. `/decant-standalone/FILTERED_SEARCH_IMPLEMENTATION.md` - This documentation
