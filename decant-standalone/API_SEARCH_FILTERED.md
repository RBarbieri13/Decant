# API Specification: POST /api/search/filtered

## Overview
Advanced search endpoint with comprehensive filtering capabilities for segments, categories, content types, organizations, date ranges, and metadata completeness.

---

## Endpoint Details

**Method:** `POST`
**Path:** `/api/search/filtered`
**Content-Type:** `application/json`
**Authentication:** None (currently)
**Rate Limiting:** Standard rate limits apply

---

## Request Schema

### Request Body (JSON)

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `query` | string | **Yes** | Search query string | 1-500 characters |
| `filters` | object | No | Filter criteria | See Filters Object |
| `page` | number | No | Page number | Integer ≥ 1, default: 1 |
| `limit` | number | No | Results per page | Integer 1-100, default: 20 |

### Filters Object

| Field | Type | Required | Description | Constraints |
|-------|------|----------|-------------|-------------|
| `segments` | string[] | No | Segment codes to filter by | Valid segment codes (A, T, F, S, H, B, E, L, X, C) |
| `categories` | string[] | No | Category codes to filter by | Max 10 chars per code |
| `contentTypes` | string[] | No | Content type codes to filter by | Valid content type codes (T, A, V, P, R, G, S, C, I, N, K, U) |
| `organizations` | string[] | No | Organization names to filter by | Max 200 chars per name, partial match supported |
| `dateRange` | object | No | Date range filter | See DateRange Object |
| `hasCompleteMetadata` | boolean | No | Filter for complete Phase 2 data | true or false |

### DateRange Object

| Field | Type | Required | Description | Format |
|-------|------|----------|-------------|--------|
| `start` | string | No | Range start date | ISO 8601 datetime |
| `end` | string | No | Range end date | ISO 8601 datetime |

---

## Response Schema

### Success Response (200 OK)

```typescript
{
  results: SearchResultItem[];
  facets: SearchFacets;
  total: number;
  page: number;
  pageSize: number;
}
```

### SearchResultItem Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique node identifier (UUID) |
| `title` | string | Node title |
| `url` | string | Source URL |
| `segment` | string \| null | Segment code |
| `category` | string \| null | Category code |
| `contentType` | string \| null | Content type code |
| `company` | string \| null | Organization/company name |
| `source_domain` | string | Source domain |
| `phrase_description` | string \| null | Brief description |
| `short_description` | string \| null | Detailed description |
| `ai_summary` | string \| null | AI-generated summary |
| `logo_url` | string \| null | Logo/favicon URL |
| `matchedFields` | string[] | Fields that matched the query |
| `snippet` | string | Optional highlighted snippet |
| `extracted_fields` | object | Additional extracted data |
| `metadata_tags` | string[] | Metadata tags |
| `key_concepts` | string[] | Key concepts |

### SearchFacets Object

| Field | Type | Description |
|-------|------|-------------|
| `segments` | Record<string, number> | Count of results by segment code |
| `categories` | Record<string, number> | Count of results by category code |
| `contentTypes` | Record<string, number> | Count of results by content type |
| `organizations` | Array<{name: string; count: number}> | Top 20 organizations with counts |

---

## Error Responses

### 400 Bad Request

Returned when request validation fails.

```json
{
  "error": "Validation error message",
  "issues": [
    {
      "path": ["field", "name"],
      "message": "Specific validation error"
    }
  ]
}
```

**Common validation errors:**
- Query is required
- Query must be 500 characters or less
- Page must be at least 1
- Limit must be between 1 and 100
- Segment code must be 1 character
- Invalid ISO date format

### 500 Internal Server Error

Returned when an unexpected server error occurs.

```json
{
  "error": "Error message",
  "details": "Stack trace (development mode only)"
}
```

---

## Examples

### Example 1: Basic Search

**Request:**
```http
POST /api/search/filtered HTTP/1.1
Content-Type: application/json

{
  "query": "machine learning"
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Introduction to Machine Learning",
      "url": "https://example.com/ml-intro",
      "segment": "A",
      "category": "LLM",
      "contentType": "A",
      "company": "Anthropic",
      "source_domain": "example.com",
      "phrase_description": "A comprehensive guide",
      "short_description": "Learn the fundamentals of machine learning",
      "ai_summary": "This article covers...",
      "logo_url": "https://example.com/logo.png",
      "matchedFields": ["title", "short_description"],
      "snippet": "Learn the fundamentals of <mark>machine learning</mark>...",
      "extracted_fields": {"phase2Completed": true},
      "metadata_tags": ["education", "AI"],
      "key_concepts": ["supervised learning", "neural networks"]
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
      "A": 12,
      "V": 8,
      "T": 3
    },
    "organizations": [
      {"name": "Anthropic", "count": 10},
      {"name": "OpenAI", "count": 8}
    ]
  },
  "total": 23,
  "page": 1,
  "pageSize": 20
}
```

### Example 2: Filtered Search with Multiple Criteria

**Request:**
```http
POST /api/search/filtered HTTP/1.1
Content-Type: application/json

{
  "query": "AI tutorial",
  "filters": {
    "segments": ["A"],
    "contentTypes": ["V", "C"],
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
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "title": "Advanced AI Techniques",
      "url": "https://example.com/ai-advanced",
      "segment": "A",
      "category": "LLM",
      "contentType": "V",
      "company": "Anthropic",
      "source_domain": "example.com",
      "matchedFields": ["title"],
      "extracted_fields": {"phase2Completed": true},
      "key_concepts": ["transformer models", "attention mechanisms"]
    }
  ],
  "facets": {
    "segments": {"A": 5},
    "categories": {"LLM": 3, "AGT": 2},
    "contentTypes": {"V": 3, "C": 2},
    "organizations": [
      {"name": "Anthropic", "count": 3},
      {"name": "OpenAI", "count": 2}
    ]
  },
  "total": 5,
  "page": 1,
  "pageSize": 20
}
```

### Example 3: Pagination

**Request:**
```http
POST /api/search/filtered HTTP/1.1
Content-Type: application/json

{
  "query": "programming",
  "filters": {
    "contentTypes": ["T"]
  },
  "page": 2,
  "limit": 10
}
```

**Response:**
```json
{
  "results": [...],
  "facets": {...},
  "total": 45,
  "page": 2,
  "pageSize": 10
}
```

### Example 4: Error Response

**Request:**
```http
POST /api/search/filtered HTTP/1.1
Content-Type: application/json

{
  "filters": {
    "segments": ["A"]
  }
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "issues": [
    {
      "path": ["query"],
      "message": "Query is required"
    }
  ]
}
```

---

## Field Reference

### Segment Codes
- `A` - AI & Machine Learning
- `T` - Technology
- `F` - Finance
- `S` - Sports
- `H` - Health
- `B` - Business
- `E` - Entertainment
- `L` - Lifestyle
- `X` - Science
- `C` - Creative

### Content Type Codes
- `T` - Tool
- `A` - Article
- `V` - Video
- `P` - Podcast
- `R` - Research Paper
- `G` - Repository (Git/GitHub)
- `S` - Social Post
- `C` - Course
- `I` - Image
- `N` - Newsletter
- `K` - Book
- `U` - Audio

---

## Pagination Behavior

- **Default Page:** 1
- **Default Limit:** 20
- **Maximum Limit:** 100
- **Total Pages:** `Math.ceil(total / pageSize)`
- **Has Next Page:** `page * pageSize < total`
- **Has Previous Page:** `page > 1`

---

## Search Behavior

### Text Matching
1. Uses FTS5 (Full-Text Search 5) when available for optimal performance
2. Falls back to LIKE queries if FTS5 is not available
3. Searches across: title, source_domain, company, short_description, ai_summary

### Filter Logic
- **Array filters** (segments, categories, contentTypes, organizations): Results match ANY value (OR logic)
- **Combined filters**: Results must match ALL filter groups (AND logic)
- **Date range**: Inclusive on both start and end dates
- **Organization filter**: Partial match using LIKE operator

### Facet Generation
- Facets calculated from all matching results (up to 10,000 for performance)
- Organizations limited to top 20 by count
- Facets respect the current query but not the current filter selections

---

## Performance Characteristics

- **Average Response Time:** < 100ms for typical queries
- **Maximum Results:** No hard limit, but pagination recommended
- **Facet Calculation:** Limited to first 10,000 results
- **Index Usage:** All filter fields are indexed for optimal performance
- **Batch Loading:** Key concepts loaded in batch to avoid N+1 queries

---

## Best Practices

1. **Use specific queries:** More specific queries return faster results
2. **Apply filters:** Filters reduce result set and improve performance
3. **Reasonable page sizes:** Use 20-50 items per page for best UX
4. **Date range filtering:** Significantly reduces query time
5. **Cache results:** Consider caching for repeated queries
6. **Leverage facets:** Use facets to guide users to relevant filters

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01-31 | Initial implementation |

---

## Related Endpoints

- `GET /api/search` - Basic search without filters
- `GET /api/search/advanced` - Advanced search with query parameters
- `GET /api/nodes/:id` - Get single node details
- `GET /api/hierarchy/tree/:view` - Get hierarchy tree
