# Filtered Search API - Quick Reference

## Endpoint
```
POST /api/search/filtered
```

## Request Format
```typescript
{
  query: string;              // Required: Search query (1-500 chars)
  filters?: {
    segments?: string[];      // Filter by segment codes: A, T, F, S, H, B, E, L, X, C
    categories?: string[];    // Filter by category codes: LLM, AGT, FND, etc.
    contentTypes?: string[];  // Filter by content types: T, A, V, P, R, G, S, C, I, N, K, U
    organizations?: string[]; // Filter by organization names (partial match)
    dateRange?: {
      start?: string;         // ISO 8601 date string
      end?: string;           // ISO 8601 date string
    };
    hasCompleteMetadata?: boolean; // Filter for complete Phase 2 data
  };
  page?: number;              // Page number (default: 1, min: 1)
  limit?: number;             // Results per page (default: 20, min: 1, max: 100)
}
```

## Response Format
```typescript
{
  results: SearchResultItem[];  // Array of search results
  facets: {
    segments: Record<string, number>;           // Segment counts
    categories: Record<string, number>;         // Category counts
    contentTypes: Record<string, number>;       // Content type counts
    organizations: Array<{name: string; count: number}>; // Top 20 organizations
  };
  total: number;     // Total matching results
  page: number;      // Current page
  pageSize: number;  // Results per page
}
```

## Segment Codes
- **A**: AI & ML
- **T**: Technology
- **F**: Finance
- **S**: Sports
- **H**: Health
- **B**: Business
- **E**: Entertainment
- **L**: Lifestyle
- **X**: Science
- **C**: Creative

## Content Type Codes
- **T**: Tool
- **A**: Article
- **V**: Video
- **P**: Podcast
- **R**: Research Paper
- **G**: Repository
- **S**: Social Post
- **C**: Course
- **I**: Image
- **N**: Newsletter
- **K**: Book
- **U**: Audio

## Example Requests

### Basic Search (No Filters)
```json
{
  "query": "machine learning"
}
```

### Filter by Segment
```json
{
  "query": "artificial intelligence",
  "filters": {
    "segments": ["A"]
  }
}
```

### Multiple Filters
```json
{
  "query": "tutorial",
  "filters": {
    "segments": ["A", "T"],
    "contentTypes": ["V", "C"],
    "organizations": ["Anthropic", "OpenAI"],
    "hasCompleteMetadata": true
  },
  "page": 1,
  "limit": 20
}
```

### Date Range Filter
```json
{
  "query": "latest research",
  "filters": {
    "segments": ["A"],
    "dateRange": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-12-31T23:59:59Z"
    }
  }
}
```

### Pagination
```json
{
  "query": "tools",
  "filters": {
    "contentTypes": ["T"]
  },
  "page": 2,
  "limit": 50
}
```

## cURL Examples

### Basic Search
```bash
curl -X POST http://localhost:8080/api/search/filtered \
  -H "Content-Type: application/json" \
  -d '{"query": "machine learning"}'
```

### Filtered Search
```bash
curl -X POST http://localhost:8080/api/search/filtered \
  -H "Content-Type: application/json" \
  -d '{
    "query": "AI tools",
    "filters": {
      "segments": ["A"],
      "contentTypes": ["T", "V"],
      "hasCompleteMetadata": true
    },
    "page": 1,
    "limit": 20
  }'
```

## JavaScript/TypeScript Example

```typescript
async function searchFiltered(
  query: string,
  filters?: SearchFilters,
  page = 1,
  limit = 20
) {
  const response = await fetch('/api/search/filtered', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      filters,
      page,
      limit,
    }),
  });

  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`);
  }

  return await response.json();
}

// Usage
const results = await searchFiltered(
  'machine learning',
  {
    segments: ['A'],
    contentTypes: ['T', 'V'],
    hasCompleteMetadata: true,
  },
  1,
  20
);

console.log(`Found ${results.total} results`);
console.log(`Showing page ${results.page} of ${Math.ceil(results.total / results.pageSize)}`);
console.log('Facets:', results.facets);
results.results.forEach(item => {
  console.log(`- ${item.title} (${item.contentType})`);
});
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Validation error message",
  "issues": [
    {
      "path": ["query"],
      "message": "Query is required"
    }
  ]
}
```

### 500 Internal Server Error
```json
{
  "error": "Error message",
  "details": "Stack trace (development only)"
}
```

## Common Use Cases

### 1. Search AI Tools
```json
{
  "query": "AI",
  "filters": {
    "segments": ["A"],
    "contentTypes": ["T"]
  }
}
```

### 2. Search Recent Videos
```json
{
  "query": "tutorial",
  "filters": {
    "contentTypes": ["V"],
    "dateRange": {
      "start": "2024-01-01T00:00:00Z"
    }
  }
}
```

### 3. Search by Organization
```json
{
  "query": "research",
  "filters": {
    "organizations": ["Anthropic", "OpenAI", "Google"]
  }
}
```

### 4. Search Complete Items Only
```json
{
  "query": "programming",
  "filters": {
    "hasCompleteMetadata": true
  }
}
```

## Performance Tips

1. **Use specific filters**: More filters = faster queries due to reduced result set
2. **Limit page size**: Use smaller page sizes (20-50) for better performance
3. **Use hasCompleteMetadata**: Filters for higher quality, curated content
4. **Date range filtering**: Reduces index scans significantly

## Integration with SearchFiltersPanel

The frontend `SearchFiltersPanel` component is already built to support this API:

```typescript
import { SearchFiltersPanel } from './components/search/SearchFiltersPanel';

function SearchPage() {
  const [results, setResults] = useState([]);
  const [query, setQuery] = useState('');

  const handleFiltersChange = async (filters) => {
    const data = await searchFiltered(query, filters);
    setResults(data.results);
  };

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
      />
      <SearchFiltersPanel
        onFiltersChange={handleFiltersChange}
        resultCount={results.length}
      />
      {/* Render results */}
    </div>
  );
}
```

## Testing

Run the test suite:
```bash
npm test -- search.spec.ts
```

Or with Vitest:
```bash
npx vitest run search.spec.ts
```
