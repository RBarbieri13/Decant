# Advanced Search API

This document describes the advanced search functionality available in the Decant application.

## Overview

The advanced search endpoint provides powerful filtering and faceted search capabilities for finding and analyzing content nodes. It supports:

- Full-text search using SQLite FTS5 (with LIKE fallback)
- Multi-dimensional filtering (segment, category, content type, organization, date range)
- Faceted aggregation results
- Match highlighting and snippets
- Pagination
- Phase 2 enrichment filtering

## Endpoints

### GET /api/search/advanced

Advanced search with filters and faceted results.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query string. Supports phrase matching with quotes. |
| `segment` | string | No | Filter by segment code (e.g., A, E, R, S, M) |
| `category` | string | No | Filter by category code (e.g., LLM, AGT, FND) |
| `contentType` | string | No | Filter by content type code (e.g., T, V, D, G, C) |
| `organization` | string | No | Filter by organization/company name (partial match) |
| `dateStart` | string | No | Filter by start date (ISO date string, e.g., 2024-01-01) |
| `dateEnd` | string | No | Filter by end date (ISO date string) |
| `hasMetadata` | boolean | No | Only show nodes with Phase 2 enrichment (true/false) |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Results per page (default: 20, max: 100) |

#### Response Format

```typescript
{
  results: Array<{
    id: string;
    title: string;
    url: string;
    segment: string | null;
    category: string | null;
    contentType: string | null;
    company: string | null;
    source_domain: string;
    phrase_description: string | null;
    short_description: string | null;
    ai_summary: string | null;
    logo_url: string | null;
    matchedFields: string[];      // Fields that matched the query
    snippet?: string;              // Context around match
    extracted_fields?: object;
    metadata_tags?: string[];
    key_concepts?: string[];
  }>;
  facets: {
    segments: Record<string, number>;        // Count by segment code
    categories: Record<string, number>;      // Count by category code
    contentTypes: Record<string, number>;    // Count by content type code
    organizations: Array<{                   // Top 20 organizations
      name: string;
      count: number;
    }>;
  };
  total: number;      // Total results matching query
  page: number;       // Current page number
  pageSize: number;   // Results per page
}
```

## Examples

### Basic Search

Search for "machine learning":

```bash
GET /api/search/advanced?q=machine+learning
```

### Search with Single Filter

Search for AI content in segment A:

```bash
GET /api/search/advanced?q=artificial+intelligence&segment=A
```

### Search with Multiple Filters

Search for text-based LLM content:

```bash
GET /api/search/advanced?q=language+models&segment=A&category=LLM&contentType=T
```

### Search by Organization

Find all Anthropic content:

```bash
GET /api/search/advanced?q=&organization=Anthropic
```

### Date Range Search

Find recent AI articles:

```bash
GET /api/search/advanced?q=AI&dateStart=2024-01-01&dateEnd=2024-12-31
```

### Search with Phase 2 Filter

Find only fully enriched content:

```bash
GET /api/search/advanced?q=neural+networks&hasMetadata=true
```

### Paginated Search

Get second page of results:

```bash
GET /api/search/advanced?q=deep+learning&page=2&limit=20
```

### Phrase Search

Search for exact phrase:

```bash
GET /api/search/advanced?q="large+language+model"
```

### Complex Multi-Filter Search

Combine multiple filters for precise results:

```bash
GET /api/search/advanced?q=transformer&segment=A&category=LLM&contentType=T&organization=OpenAI&hasMetadata=true&page=1&limit=50
```

## Response Examples

### Basic Search Response

```json
{
  "results": [
    {
      "id": "abc123",
      "title": "Introduction to Machine Learning",
      "url": "https://example.com/ml-intro",
      "segment": "A",
      "category": "LLM",
      "contentType": "T",
      "company": "Anthropic",
      "source_domain": "example.com",
      "phrase_description": "ML fundamentals guide",
      "short_description": "A comprehensive guide to machine learning",
      "ai_summary": "This article covers ML algorithms...",
      "logo_url": "https://example.com/logo.png",
      "matchedFields": ["title", "short_description"],
      "snippet": "...comprehensive guide to <mark>machine learning</mark> fundamentals...",
      "extracted_fields": {
        "phase2Completed": true
      },
      "metadata_tags": ["ai", "ml"],
      "key_concepts": ["machine learning", "algorithms"]
    }
  ],
  "facets": {
    "segments": {
      "A": 15,
      "E": 8,
      "R": 3
    },
    "categories": {
      "LLM": 12,
      "AGT": 5,
      "FND": 3
    },
    "contentTypes": {
      "T": 18,
      "V": 4,
      "D": 2
    },
    "organizations": [
      { "name": "Anthropic", "count": 8 },
      { "name": "OpenAI", "count": 6 },
      { "name": "Google", "count": 4 }
    ]
  },
  "total": 26,
  "page": 1,
  "pageSize": 20
}
```

## Implementation Details

### Full-Text Search

The search implementation uses SQLite FTS5 when available for high-performance full-text search. If FTS5 is not available, it falls back to LIKE-based pattern matching.

**FTS5 Features:**
- Fast full-text indexing
- Phrase matching with quotes
- BM25 relevance ranking
- Snippet extraction with highlighting
- OR query expansion for multi-word queries

**Fallback Features:**
- LIKE-based pattern matching across key fields
- Simple snippet generation
- Match field detection

### Filter Behavior

- **Segment, Category, Content Type**: Exact match on classification codes
- **Organization**: Partial match (LIKE) on company field
- **Date Range**: Range query on date_added field
- **Has Metadata**: Checks for phase2Completed flag in extracted_fields JSON

### Facet Calculation

Facets are calculated from the first 10,000 matching results for performance. This provides:
- Fast aggregation even on large result sets
- Representative distribution of results
- Reduced database load

### Matched Fields

The `matchedFields` array indicates which fields contained the search query:
- `title`
- `source_domain`
- `company`
- `phrase_description`
- `short_description`
- `ai_summary`

### Snippets

Snippets show context around the matched text:
- FTS5: Uses SQLite's `snippet()` function with `<mark>` tags
- Fallback: Extracts first 150 characters from best matching field
- Prioritizes: short_description > phrase_description > ai_summary

### Performance Considerations

- **Indexes**: Covering indexes on segment_code, category_code, content_type_code
- **Batch Loading**: Key concepts loaded in single batch query
- **Pagination**: LIMIT/OFFSET for efficient result windowing
- **Facet Limit**: First 10,000 results for aggregation
- **Organization Limit**: Top 20 organizations in facets

## Classification Codes

### Segment Codes
- `A` - AI/ML
- `E` - Engineering
- `R` - Research
- `S` - Security
- `M` - Management
- etc.

### Category Codes (3 letters)
- `LLM` - Large Language Models
- `AGT` - Agents
- `FND` - Foundations
- `WEB` - Web Development
- etc.

### Content Type Codes
- `T` - Text/Article
- `V` - Video
- `D` - Documentation
- `G` - GitHub Repository
- `C` - Course
- etc.

## Error Handling

### Missing Query Parameter

```bash
GET /api/search/advanced
```

Response (400):
```json
{
  "error": "Query parameter \"q\" is required"
}
```

### Invalid Filter Values

Invalid filter values are silently ignored. For example, an invalid segment code will return no results.

### Server Errors

Response (500):
```json
{
  "error": "Error message here",
  "details": "Stack trace (only in development mode)"
}
```

## Integration Examples

### JavaScript/TypeScript

```typescript
async function searchAdvanced(query: string, filters?: SearchFilters) {
  const params = new URLSearchParams({ q: query });

  if (filters?.segment) params.append('segment', filters.segment);
  if (filters?.category) params.append('category', filters.category);
  if (filters?.contentType) params.append('contentType', filters.contentType);

  const response = await fetch(`/api/search/advanced?${params}`);
  return await response.json();
}

// Usage
const results = await searchAdvanced('machine learning', {
  segment: 'A',
  category: 'LLM',
  contentType: 'T'
});
```

### Python

```python
import requests

def search_advanced(query, filters=None):
    params = {'q': query}
    if filters:
        params.update(filters)

    response = requests.get('http://localhost:8080/api/search/advanced', params=params)
    return response.json()

# Usage
results = search_advanced('machine learning', {
    'segment': 'A',
    'category': 'LLM',
    'contentType': 'T',
    'page': 1,
    'limit': 20
})
```

### cURL

```bash
curl -X GET "http://localhost:8080/api/search/advanced?q=machine+learning&segment=A&category=LLM&contentType=T&page=1&limit=20" \
  -H "Accept: application/json"
```

## Best Practices

1. **Use Specific Filters**: Combine multiple filters for more precise results
2. **Leverage Facets**: Use facet counts to show users available refinements
3. **Pagination**: Always paginate for large result sets
4. **Phrase Search**: Use quotes for exact phrase matching
5. **Phase 2 Filter**: Use `hasMetadata=true` for highest quality content
6. **Organization Search**: Use partial organization names for broader matching
7. **Date Ranges**: Combine with other filters to find recent relevant content
8. **Error Handling**: Always check for error responses and handle appropriately

## Future Enhancements

Potential improvements to consider:

- [ ] Elasticsearch/OpenSearch integration for larger datasets
- [ ] Fuzzy matching and typo tolerance
- [ ] Synonym expansion
- [ ] Autocomplete suggestions
- [ ] Search history and saved searches
- [ ] Advanced query syntax (AND, OR, NOT operators)
- [ ] Weighted field boosting
- [ ] Related searches and "did you mean" suggestions
- [ ] Export search results
- [ ] Search analytics
