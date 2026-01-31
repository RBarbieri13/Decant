# Search API Examples

Quick reference for using the advanced search API with real-world examples.

## Table of Contents

- [Basic Search](#basic-search)
- [Filtering by Classification](#filtering-by-classification)
- [Filtering by Organization](#filtering-by-organization)
- [Date Range Filtering](#date-range-filtering)
- [Quality Filtering](#quality-filtering)
- [Combining Filters](#combining-filters)
- [Pagination](#pagination)
- [Using Facets](#using-facets)

## Basic Search

### Search for AI Content

```bash
curl "http://localhost:8080/api/search/advanced?q=artificial+intelligence"
```

### Phrase Search (Exact Match)

```bash
curl "http://localhost:8080/api/search/advanced?q=\"large+language+model\""
```

### Search Across All Fields

The search queries title, description, summary, company, and domain fields:

```bash
curl "http://localhost:8080/api/search/advanced?q=transformer"
```

## Filtering by Classification

### Find All LLM Content

```bash
curl "http://localhost:8080/api/search/advanced?q=&category=LLM"
```

### Find Text Articles in AI Segment

```bash
curl "http://localhost:8080/api/search/advanced?q=&segment=A&contentType=T"
```

### Find Videos About Neural Networks

```bash
curl "http://localhost:8080/api/search/advanced?q=neural+networks&contentType=V"
```

### Search Within Engineering Segment

```bash
curl "http://localhost:8080/api/search/advanced?q=web+development&segment=E"
```

## Filtering by Organization

### All Anthropic Content

```bash
curl "http://localhost:8080/api/search/advanced?q=&organization=Anthropic"
```

### OpenAI LLM Articles

```bash
curl "http://localhost:8080/api/search/advanced?q=&organization=OpenAI&category=LLM&contentType=T"
```

### Search Within Specific Company

```bash
curl "http://localhost:8080/api/search/advanced?q=machine+learning&organization=Google"
```

## Date Range Filtering

### Content from 2024

```bash
curl "http://localhost:8080/api/search/advanced?q=AI&dateStart=2024-01-01&dateEnd=2024-12-31"
```

### Recent Content (Last 30 Days)

```bash
# In your application, calculate the date
curl "http://localhost:8080/api/search/advanced?q=deep+learning&dateStart=2024-11-01"
```

### Content Before Specific Date

```bash
curl "http://localhost:8080/api/search/advanced?q=neural+networks&dateEnd=2023-12-31"
```

## Quality Filtering

### Only Fully Enriched Content

```bash
curl "http://localhost:8080/api/search/advanced?q=machine+learning&hasMetadata=true"
```

### High-Quality LLM Articles

```bash
curl "http://localhost:8080/api/search/advanced?q=&category=LLM&contentType=T&hasMetadata=true"
```

## Combining Filters

### Complex Research Query

Find fully enriched text articles about transformers in the AI segment from 2024:

```bash
curl "http://localhost:8080/api/search/advanced?q=transformer&segment=A&contentType=T&hasMetadata=true&dateStart=2024-01-01"
```

### Specific Organization and Topic

Find OpenAI content about GPT models:

```bash
curl "http://localhost:8080/api/search/advanced?q=GPT&organization=OpenAI&category=LLM"
```

### Multi-Dimensional Filter

```bash
curl "http://localhost:8080/api/search/advanced?q=reinforcement+learning&segment=A&category=AGT&contentType=T&organization=DeepMind&hasMetadata=true"
```

## Pagination

### First Page (20 Results)

```bash
curl "http://localhost:8080/api/search/advanced?q=machine+learning&page=1&limit=20"
```

### Second Page

```bash
curl "http://localhost:8080/api/search/advanced?q=machine+learning&page=2&limit=20"
```

### Large Page Size (Max 100)

```bash
curl "http://localhost:8080/api/search/advanced?q=AI&page=1&limit=100"
```

### Small Page Size for Preview

```bash
curl "http://localhost:8080/api/search/advanced?q=neural+networks&page=1&limit=5"
```

## Using Facets

### Example: Building Filter UI

```javascript
// Fetch search results with facets
const response = await fetch('/api/search/advanced?q=machine+learning');
const data = await response.json();

// Display segment filter options
console.log('Available Segments:');
Object.entries(data.facets.segments).forEach(([code, count]) => {
  console.log(`  ${code}: ${count} results`);
});

// Display category filter options
console.log('Available Categories:');
Object.entries(data.facets.categories).forEach(([code, count]) => {
  console.log(`  ${code}: ${count} results`);
});

// Display top organizations
console.log('Top Organizations:');
data.facets.organizations.forEach(org => {
  console.log(`  ${org.name}: ${org.count} results`);
});
```

### Example Response with Facets

```json
{
  "results": [...],
  "facets": {
    "segments": {
      "A": 45,
      "E": 12,
      "R": 8
    },
    "categories": {
      "LLM": 30,
      "AGT": 15,
      "FND": 10
    },
    "contentTypes": {
      "T": 50,
      "V": 10,
      "D": 5
    },
    "organizations": [
      { "name": "OpenAI", "count": 20 },
      { "name": "Anthropic", "count": 15 },
      { "name": "Google", "count": 10 }
    ]
  },
  "total": 65,
  "page": 1,
  "pageSize": 20
}
```

## Frontend Integration Examples

### React Component

```typescript
import { useState, useEffect } from 'react';

interface SearchFilters {
  segment?: string;
  category?: string;
  contentType?: string;
  organization?: string;
  hasMetadata?: boolean;
}

function SearchComponent() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [results, setResults] = useState(null);

  const search = async () => {
    const params = new URLSearchParams({ q: query });

    if (filters.segment) params.append('segment', filters.segment);
    if (filters.category) params.append('category', filters.category);
    if (filters.contentType) params.append('contentType', filters.contentType);
    if (filters.organization) params.append('organization', filters.organization);
    if (filters.hasMetadata) params.append('hasMetadata', 'true');

    const response = await fetch(`/api/search/advanced?${params}`);
    const data = await response.json();
    setResults(data);
  };

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
      />
      <button onClick={search}>Search</button>

      {/* Filter UI */}
      <select onChange={(e) => setFilters({...filters, segment: e.target.value})}>
        <option value="">All Segments</option>
        <option value="A">AI/ML</option>
        <option value="E">Engineering</option>
      </select>

      {/* Results */}
      {results && (
        <div>
          <p>Found {results.total} results</p>
          {results.results.map(item => (
            <div key={item.id}>
              <h3>{item.title}</h3>
              <p>{item.snippet}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Vue Component

```vue
<template>
  <div>
    <input v-model="query" @keyup.enter="search" placeholder="Search..." />
    <button @click="search">Search</button>

    <div v-if="results">
      <p>Found {{ results.total }} results</p>

      <!-- Facets -->
      <div class="facets">
        <h4>Segments</h4>
        <button
          v-for="(count, code) in results.facets.segments"
          :key="code"
          @click="applyFilter('segment', code)"
        >
          {{ code }} ({{ count }})
        </button>
      </div>

      <!-- Results -->
      <div v-for="item in results.results" :key="item.id">
        <h3>{{ item.title }}</h3>
        <p v-html="item.snippet"></p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const query = ref('');
const filters = ref({});
const results = ref(null);

const search = async () => {
  const params = new URLSearchParams({ q: query.value, ...filters.value });
  const response = await fetch(`/api/search/advanced?${params}`);
  results.value = await response.json();
};

const applyFilter = (key, value) => {
  filters.value = { ...filters.value, [key]: value };
  search();
};
</script>
```

## CLI Examples

### Using jq for Pretty Output

```bash
curl -s "http://localhost:8080/api/search/advanced?q=machine+learning" | jq '.'
```

### Extract Just Titles

```bash
curl -s "http://localhost:8080/api/search/advanced?q=AI" | jq '.results[].title'
```

### Count Results by Segment

```bash
curl -s "http://localhost:8080/api/search/advanced?q=neural+networks" | jq '.facets.segments'
```

### Get URLs of All Results

```bash
curl -s "http://localhost:8080/api/search/advanced?q=deep+learning&limit=100" | jq -r '.results[].url'
```

## Python Script Example

```python
import requests
import json

class DecantSearchClient:
    def __init__(self, base_url='http://localhost:8080'):
        self.base_url = base_url

    def search_advanced(self, query, **filters):
        """
        Advanced search with filters.

        Args:
            query: Search query string
            segment: Segment code filter
            category: Category code filter
            contentType: Content type code filter
            organization: Organization filter
            hasMetadata: Filter for enriched content
            page: Page number
            limit: Results per page
        """
        params = {'q': query, **filters}
        response = requests.get(
            f'{self.base_url}/api/search/advanced',
            params=params
        )
        response.raise_for_status()
        return response.json()

    def print_results(self, data):
        """Pretty print search results."""
        print(f"\nFound {data['total']} results\n")

        print("=== Results ===")
        for item in data['results']:
            print(f"\n{item['title']}")
            print(f"  URL: {item['url']}")
            print(f"  Company: {item.get('company', 'N/A')}")
            if item.get('snippet'):
                print(f"  Snippet: {item['snippet']}")

        print("\n=== Facets ===")
        print(f"Segments: {data['facets']['segments']}")
        print(f"Categories: {data['facets']['categories']}")
        print(f"Content Types: {data['facets']['contentTypes']}")

# Usage
client = DecantSearchClient()

# Basic search
results = client.search_advanced('machine learning')
client.print_results(results)

# Filtered search
results = client.search_advanced(
    'neural networks',
    segment='A',
    category='LLM',
    hasMetadata=True
)
client.print_results(results)
```

## Performance Tips

1. **Use Specific Filters**: Reduce result set size with filters before searching
2. **Pagination**: Always paginate large result sets
3. **Facets for UI**: Use facet counts to show users available filters
4. **Phrase Search**: Use quotes for exact phrases to improve relevance
5. **Phase 2 Filter**: Use `hasMetadata=true` for highest quality results
6. **Caching**: Cache facet results on the client for filter UI
7. **Debounce**: Debounce search input to reduce API calls

## Common Patterns

### Search and Refine

1. Start with broad search: `q=machine+learning`
2. Review facets to see available segments/categories
3. Add filters based on facets: `q=machine+learning&segment=A&category=LLM`
4. Further refine: Add `contentType=T&hasMetadata=true`

### Browse by Category

1. Empty query with category filter: `q=&category=LLM`
2. Returns all LLM content with facets
3. User can refine by segment, organization, etc.

### Organization Explorer

1. Start with organization: `q=&organization=Anthropic`
2. See facets showing their content types
3. Refine to specific category: `q=&organization=Anthropic&category=LLM`

### Quality Content Discovery

1. Start with quality filter: `q=&hasMetadata=true`
2. Browse facets to see what's available
3. Add topic filter: `q=transformer&hasMetadata=true`
