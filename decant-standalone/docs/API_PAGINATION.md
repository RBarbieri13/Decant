# API Pagination Guide

This guide explains how to use pagination with the Decant Standalone API.

## Quick Start

### Basic Pagination Request

```bash
# Get first page with default limit (20 items)
curl "http://localhost:3000/api/nodes?page=1"

# Get second page with custom limit (50 items)
curl "http://localhost:3000/api/nodes?page=2&limit=50"

# Search with pagination
curl "http://localhost:3000/api/search?q=typescript&page=1&limit=10"
```

### Response Format

When pagination parameters are provided, the response includes a `pagination` metadata object:

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Example Node",
      "url": "https://example.com/article",
      "source_domain": "example.com",
      "company": "Example Corp",
      "short_description": "An example article",
      "created_at": "2024-01-15T10:30:00.000Z",
      ...
    }
  ],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasMore": true
  }
}
```

## Endpoints with Pagination Support

### 1. GET `/api/nodes`

List all nodes with optional pagination.

**Query Parameters**:
| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `page` | integer | 1 | 1+ | Page number (1-indexed) |
| `limit` | integer | 20 | 1-100 | Items per page |

**Example**:
```bash
GET /api/nodes?page=1&limit=25
```

**Response**:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 150,
    "totalPages": 6,
    "hasMore": true
  }
}
```

### 2. GET `/api/search`

Search nodes with optional pagination.

**Query Parameters**:
| Parameter | Type | Required | Default | Range | Description |
|-----------|------|----------|---------|-------|-------------|
| `q` | string | Yes | - | - | Search query |
| `page` | integer | No | 1 | 1+ | Page number (1-indexed) |
| `limit` | integer | No | 20 | 1-100 | Items per page |

**Example**:
```bash
GET /api/search?q=machine%20learning&page=2&limit=15
```

**Response**:
```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 15,
    "total": 45,
    "totalPages": 3,
    "hasMore": true
  }
}
```

## Pagination Metadata

The `pagination` object contains:

| Field | Type | Description |
|-------|------|-------------|
| `page` | integer | Current page number (1-indexed) |
| `limit` | integer | Items per page |
| `total` | integer | Total number of items across all pages |
| `totalPages` | integer | Total number of pages |
| `hasMore` | boolean | True if there are more pages after current page |

## Backward Compatibility

**Important**: If you don't provide any pagination parameters, the API returns a plain array (legacy format):

```bash
# No pagination params = returns array directly
GET /api/nodes

# Response is just an array:
[
  { "id": "...", "title": "..." },
  { "id": "...", "title": "..." }
]
```

This ensures existing API consumers continue to work without changes.

## Implementation Examples

### JavaScript/TypeScript

```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

async function fetchNodes(page: number = 1, limit: number = 20): Promise<PaginatedResponse<Node>> {
  const response = await fetch(`/api/nodes?page=${page}&limit=${limit}`);
  return response.json();
}

async function searchNodes(query: string, page: number = 1, limit: number = 20) {
  const params = new URLSearchParams({
    q: query,
    page: page.toString(),
    limit: limit.toString(),
  });

  const response = await fetch(`/api/search?${params}`);
  return response.json();
}

// Usage
const result = await fetchNodes(2, 50);
console.log(`Showing page ${result.pagination.page} of ${result.pagination.totalPages}`);
console.log(`Total items: ${result.pagination.total}`);
console.log(`Has more: ${result.pagination.hasMore}`);
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react';

function useNodesPagination(initialPage = 1, initialLimit = 20) {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPage = async (page: number, limit: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/nodes?page=${page}&limit=${limit}`);
      const result = await response.json();

      setData(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage(initialPage, initialLimit);
  }, []);

  const nextPage = () => {
    if (pagination?.hasMore) {
      fetchPage(pagination.page + 1, pagination.limit);
    }
  };

  const previousPage = () => {
    if (pagination?.page > 1) {
      fetchPage(pagination.page - 1, pagination.limit);
    }
  };

  const goToPage = (page: number) => {
    fetchPage(page, pagination?.limit || initialLimit);
  };

  return {
    data,
    pagination,
    loading,
    error,
    nextPage,
    previousPage,
    goToPage,
  };
}
```

### Python Example

```python
import requests
from typing import Dict, List, Any, Optional

def fetch_nodes(page: int = 1, limit: int = 20) -> Dict[str, Any]:
    """Fetch paginated nodes from the API."""
    response = requests.get(
        'http://localhost:3000/api/nodes',
        params={'page': page, 'limit': limit}
    )
    response.raise_for_status()
    return response.json()

def search_nodes(query: str, page: int = 1, limit: int = 20) -> Dict[str, Any]:
    """Search nodes with pagination."""
    response = requests.get(
        'http://localhost:3000/api/search',
        params={'q': query, 'page': page, 'limit': limit}
    )
    response.raise_for_status()
    return response.json()

# Usage
result = fetch_nodes(page=1, limit=50)
print(f"Total items: {result['pagination']['total']}")
print(f"Current page: {result['pagination']['page']}")
print(f"Has more: {result['pagination']['hasMore']}")

for node in result['data']:
    print(f"- {node['title']}")
```

### Fetch All Pages Example

```typescript
async function fetchAllNodes(): Promise<Node[]> {
  const allNodes: Node[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`/api/nodes?page=${page}&limit=100`);
    const result = await response.json();

    allNodes.push(...result.data);
    hasMore = result.pagination.hasMore;
    page++;
  }

  return allNodes;
}
```

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_PAGE` | 1 | Default page number when not specified |
| `DEFAULT_LIMIT` | 20 | Default items per page |
| `MAX_LIMIT` | 100 | Maximum allowed items per page |
| `MIN_LIMIT` | 1 | Minimum allowed items per page |

## Error Handling

### Invalid Parameters

The API gracefully handles invalid parameters:

- **Invalid page number** (e.g., `page=-1` or `page=abc`) → defaults to page 1
- **Invalid limit** (e.g., `limit=abc`) → defaults to 20
- **Limit too high** (e.g., `limit=500`) → clamped to 100
- **Limit too low** (e.g., `limit=0`) → clamped to 1
- **Missing search query** → 400 Bad Request with error message

```bash
# These will work with defaults applied:
GET /api/nodes?page=invalid  # Uses page=1
GET /api/nodes?limit=500     # Uses limit=100
GET /api/nodes?limit=-5      # Uses limit=1
```

### Error Response Format

```json
{
  "error": "Query parameter \"q\" is required"
}
```

## Best Practices

### 1. Choose Appropriate Page Sizes

- **Small lists** (mobile): 10-20 items
- **Desktop tables**: 20-50 items
- **Bulk operations**: 100 items (maximum)

### 2. Show Pagination Controls

Always display:
- Current page number
- Total pages or total items
- Previous/Next buttons (disable when not applicable)
- Optional: Page size selector

### 3. Handle Edge Cases

```typescript
// Check if there's data
if (result.data.length === 0) {
  console.log('No results found');
}

// Don't fetch beyond last page
if (result.pagination.hasMore) {
  // Can safely fetch next page
  fetchNodes(result.pagination.page + 1);
}

// Validate page number
const maxPage = result.pagination.totalPages;
if (requestedPage > maxPage) {
  // Redirect to last page or show error
}
```

### 4. Performance Tips

- Use maximum limit (100) for data exports
- Use smaller limits (10-20) for interactive UIs
- Cache pages in memory for quick back/forward navigation
- Show loading states during pagination requests

### 5. URL State Management

Keep pagination state in URL for bookmarkability:

```typescript
// Update URL when pagination changes
const updateURL = (page: number, limit: number) => {
  const url = new URL(window.location.href);
  url.searchParams.set('page', page.toString());
  url.searchParams.set('limit', limit.toString());
  window.history.pushState({}, '', url);
};

// Read from URL on page load
const urlParams = new URLSearchParams(window.location.search);
const page = parseInt(urlParams.get('page') || '1');
const limit = parseInt(urlParams.get('limit') || '20');
```

## Troubleshooting

### Problem: Getting plain array instead of paginated response

**Solution**: Make sure you include at least one pagination parameter (`page` or `limit`):

```bash
# Wrong - returns array
GET /api/nodes

# Correct - returns paginated response
GET /api/nodes?page=1
```

### Problem: Limit not working as expected

**Solution**: Check if you're exceeding MAX_LIMIT (100):

```bash
# Will be clamped to 100
GET /api/nodes?limit=200

# Actual response will have limit: 100
```

### Problem: Empty data array but total > 0

**Solution**: You're beyond the last page. Check `totalPages` and adjust:

```typescript
if (result.data.length === 0 && result.pagination.total > 0) {
  // Go to last page
  fetchNodes(result.pagination.totalPages);
}
```

## Migration Guide

If you're updating existing code that used the non-paginated API:

### Before (Legacy)

```typescript
const nodes = await fetch('/api/nodes').then(r => r.json());
// nodes is an array
```

### After (With Pagination)

```typescript
const response = await fetch('/api/nodes?page=1').then(r => r.json());
const nodes = response.data;
const pagination = response.pagination;
// nodes is still an array, but wrapped in response.data
```

### Maintaining Compatibility

To support both formats:

```typescript
async function fetchNodes(usePagination = false) {
  const url = usePagination
    ? '/api/nodes?page=1&limit=20'
    : '/api/nodes';

  const data = await fetch(url).then(r => r.json());

  // Handle both formats
  if (Array.isArray(data)) {
    return { nodes: data, pagination: null };
  } else {
    return { nodes: data.data, pagination: data.pagination };
  }
}
```

## Additional Resources

- [API Documentation](./API.md)
- [Database Schema](./DATABASE.md)
- [Testing Guide](./TESTING.md)
- [Implementation Details](../PAGINATION_IMPLEMENTATION.md)
