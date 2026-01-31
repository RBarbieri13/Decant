# Advanced Search Quick Start Guide

Get started with the Decant advanced search API in 5 minutes.

## Basic Usage

### 1. Simple Search

```bash
curl "http://localhost:8080/api/search/advanced?q=machine+learning"
```

### 2. Filter by Segment

```bash
curl "http://localhost:8080/api/search/advanced?q=AI&segment=A"
```

### 3. Multiple Filters

```bash
curl "http://localhost:8080/api/search/advanced?q=neural&segment=A&category=LLM&contentType=T"
```

## JavaScript/TypeScript Client

### Installation

Copy the type definitions:

```typescript
// src/types/search.ts
export interface SearchFilters {
  segment?: string;
  category?: string;
  contentType?: string;
  organization?: string;
  dateRange?: { start?: string; end?: string };
  hasMetadata?: boolean;
}

export interface SearchResponse {
  results: SearchResultItem[];
  facets: SearchFacets;
  total: number;
  page: number;
  pageSize: number;
}
```

### Basic Client

```typescript
// src/api/search.ts
async function searchAdvanced(
  query: string,
  filters?: SearchFilters,
  page = 1,
  limit = 20
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query, page: String(page), limit: String(limit) });

  if (filters?.segment) params.append('segment', filters.segment);
  if (filters?.category) params.append('category', filters.category);
  if (filters?.contentType) params.append('contentType', filters.contentType);
  if (filters?.organization) params.append('organization', filters.organization);
  if (filters?.hasMetadata) params.append('hasMetadata', 'true');

  const response = await fetch(`/api/search/advanced?${params}`);
  if (!response.ok) throw new Error('Search failed');

  return response.json();
}

// Usage
const results = await searchAdvanced('machine learning', {
  segment: 'A',
  category: 'LLM'
});

console.log(`Found ${results.total} results`);
results.results.forEach(item => {
  console.log(`- ${item.title}`);
});
```

## React Hook

```typescript
// src/hooks/useSearch.ts
import { useState, useEffect } from 'react';

export function useSearch(query: string, filters?: SearchFilters) {
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!query) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ q: query });
        if (filters?.segment) params.append('segment', filters.segment);
        if (filters?.category) params.append('category', filters.category);

        const response = await fetch(`/api/search/advanced?${params}`);
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [query, JSON.stringify(filters)]);

  return { data, loading, error };
}

// Usage in component
function SearchResults({ query }: { query: string }) {
  const { data, loading, error } = useSearch(query, { segment: 'A' });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return null;

  return (
    <div>
      <p>Found {data.total} results</p>
      {data.results.map(item => (
        <div key={item.id}>
          <h3>{item.title}</h3>
          <p>{item.snippet}</p>
        </div>
      ))}
    </div>
  );
}
```

## Common Use Cases

### 1. Search with Faceted Filters

```typescript
function SearchWithFacets() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const { data } = useSearch(query, filters);

  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search..."
      />

      {/* Facet Filters */}
      {data && (
        <div>
          <h4>Segments</h4>
          {Object.entries(data.facets.segments).map(([code, count]) => (
            <button
              key={code}
              onClick={() => setFilters({ ...filters, segment: code })}
            >
              {code} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {data?.results.map(item => (
        <div key={item.id}>{item.title}</div>
      ))}
    </div>
  );
}
```

### 2. Organization Filter

```typescript
async function findOrganizationContent(org: string) {
  const results = await searchAdvanced('', { organization: org });
  return results;
}

// Find all Anthropic content
const anthropicContent = await findOrganizationContent('Anthropic');
```

### 3. Quality Content Only

```typescript
async function findQualityContent(query: string) {
  return searchAdvanced(query, { hasMetadata: true });
}

// Find only fully enriched ML content
const qualityML = await findQualityContent('machine learning');
```

### 4. Recent Content

```typescript
function getRecentContent(query: string, days: number = 30) {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  return searchAdvanced(query, {
    dateRange: { start: startDate, end: endDate }
  });
}

// Find AI content from last 30 days
const recentAI = await getRecentContent('AI', 30);
```

## Filter Cheat Sheet

| Filter | Example | Description |
|--------|---------|-------------|
| `segment` | `A` | AI/ML content |
| `category` | `LLM` | Large Language Models |
| `contentType` | `T` | Text articles |
| `organization` | `Anthropic` | Partial match on company |
| `dateStart` | `2024-01-01` | From this date |
| `dateEnd` | `2024-12-31` | Until this date |
| `hasMetadata` | `true` | Only enriched content |

## Segment Codes

- `A` - AI/ML
- `E` - Engineering
- `R` - Research
- `S` - Security
- `M` - Management

## Content Type Codes

- `T` - Text/Article
- `V` - Video
- `D` - Documentation
- `G` - GitHub Repository
- `C` - Course

## Response Structure

```typescript
{
  results: [
    {
      id: "uuid",
      title: "Article Title",
      url: "https://...",
      segment: "A",
      category: "LLM",
      contentType: "T",
      company: "Anthropic",
      matchedFields: ["title", "short_description"],
      snippet: "...highlighted text...",
      key_concepts: ["ai", "ml"]
    }
  ],
  facets: {
    segments: { "A": 15, "E": 8 },
    categories: { "LLM": 12, "AGT": 5 },
    contentTypes: { "T": 18, "V": 4 },
    organizations: [
      { name: "Anthropic", count: 8 }
    ]
  },
  total: 26,
  page: 1,
  pageSize: 20
}
```

## Tips

1. **Empty Query**: Use `q=` with filters to browse by category/segment
2. **Phrase Search**: Use quotes: `q="large language model"`
3. **Facets**: Use facet counts to show available filter options
4. **Pagination**: Always paginate for large result sets
5. **Quality**: Use `hasMetadata=true` for best content

## Next Steps

- See [ADVANCED_SEARCH_API.md](./ADVANCED_SEARCH_API.md) for full API reference
- See [SEARCH_EXAMPLES.md](./SEARCH_EXAMPLES.md) for more examples
- See [SEARCH_IMPLEMENTATION_SUMMARY.md](./SEARCH_IMPLEMENTATION_SUMMARY.md) for technical details
