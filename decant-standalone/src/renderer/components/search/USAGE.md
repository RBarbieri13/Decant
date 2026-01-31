# Search Filters Usage Guide

## Overview

The Search Filters Panel provides advanced filtering capabilities for the Decant search functionality. It includes:

- **Segment filtering** (AI & ML, Technology, Finance, etc.)
- **Category filtering** (dynamically populated from data)
- **Content Type checkboxes** (Tool, Video, Article, Course, etc.)
- **Date range picker** (start/end dates)
- **Metadata completeness toggle**
- **Active filter chips** with dismiss functionality
- **URL params** for shareable filtered searches
- **localStorage persistence** of last used filters

## Components

### 1. SearchFiltersPanel (Main Component)

Main UI component that renders all filter controls.

```tsx
import { SearchFiltersPanel } from './components/search/SearchFiltersPanel';

function SearchPage() {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleFiltersChange = async (filters) => {
    setIsLoading(true);
    try {
      const results = await searchAPI.searchPaginated(
        query,
        { page: 1, limit: 20 },
        filters
      );
      setResults(results);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <SearchFiltersPanel
        onFiltersChange={handleFiltersChange}
        resultCount={results.length}
        isLoading={isLoading}
        availableCategories={['Machine Learning', 'LLMs', 'Computer Vision']}
      />
      {/* Search results */}
    </div>
  );
}
```

### 2. FilterChips

Displays active filters as dismissible chips. Automatically shown by SearchFiltersPanel when filters are active.

```tsx
import { FilterChips } from './components/search/FilterChips';

<FilterChips
  activeFilters={activeFilters}
  onClearAll={clearAllFilters}
  resultCount={42}
/>
```

### 3. useSearchFilters Hook

Manages filter state, URL params, and localStorage persistence.

```tsx
import { useSearchFilters } from './hooks/useSearchFilters';

function CustomSearchUI() {
  const {
    filters,
    activeFilters,
    hasActiveFilters,
    setSegments,
    setCategories,
    setContentTypes,
    setDateRange,
    setHasCompleteMetadata,
    clearAllFilters,
    removeFilter,
  } = useSearchFilters();

  // Use filters in your search logic
  useEffect(() => {
    performSearch(filters);
  }, [filters]);

  return (
    <div>
      {/* Custom UI using the hook */}
    </div>
  );
}
```

## Integration with Backend

The filters object from `useSearchFilters()` is compatible with the backend search API:

```typescript
// Filter state shape
interface SearchFilterState {
  segments: SegmentCode[];
  categories: string[];
  contentTypes: ContentTypeCode[];
  dateRange: {
    start: string;
    end: string;
  } | null;
  hasCompleteMetadata: boolean;
}

// Backend expects:
searchAPI.searchPaginated(
  query: string,
  pagination: { page: number; limit: number },
  filters: SearchFilterState
);
```

## URL Parameters

Filters are automatically synced to URL query params for shareable searches:

```
/search?segments=A,T&contentTypes=V,A&dateStart=2024-01-01&dateEnd=2024-12-31&completeMetadata=true
```

Parameters:
- `segments` - Comma-separated segment codes (A, T, F, etc.)
- `categories` - Comma-separated category names
- `contentTypes` - Comma-separated content type codes (V, A, T, etc.)
- `dateStart` - ISO date string (YYYY-MM-DD)
- `dateEnd` - ISO date string (YYYY-MM-DD)
- `completeMetadata` - "true" if enabled

## localStorage Persistence

Last used filters are automatically saved to `localStorage` with key `decant-search-filters`. This allows users to return to their previous filter settings.

## Styling

Components use the Decant design system CSS variables:

- `--decant-forest-*` for primary colors
- `--decant-tag-*` for filter chip colors
- `--decant-space-*` for spacing
- `--decant-text-*` for typography
- Fully responsive with mobile breakpoints

## Accessibility

- All form controls have proper labels
- Keyboard navigation supported
- Focus states clearly indicated
- ARIA attributes where appropriate
- Color contrast meets WCAG AA standards

## Performance

- 300ms debounce on filter changes
- Minimal re-renders with useCallback/useMemo
- Lazy filter application for date ranges
- Efficient state updates

## Example: Complete Search Page

```tsx
import React, { useState, useEffect } from 'react';
import { SearchBar } from './components/search/SearchBar';
import { SearchFiltersPanel } from './components/search/SearchFiltersPanel';
import { searchAPI } from './services/api';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState([]);

  // Load available categories from facets
  useEffect(() => {
    // Fetch categories from your backend
    fetchCategories().then(setCategories);
  }, []);

  const handleSearch = async (searchQuery: string, filters: any) => {
    setIsLoading(true);
    try {
      const response = await searchAPI.searchPaginated(
        searchQuery,
        { page: 1, limit: 50 },
        filters
      );
      setResults(response.data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFiltersChange = (filters: any) => {
    if (query) {
      handleSearch(query, filters);
    }
  };

  return (
    <div className="search-page">
      <SearchBar onSearch={(q) => {
        setQuery(q);
        handleSearch(q, {});
      }} />

      <div className="search-content">
        <aside className="search-sidebar">
          <SearchFiltersPanel
            onFiltersChange={handleFiltersChange}
            resultCount={results.length}
            isLoading={isLoading}
            availableCategories={categories}
          />
        </aside>

        <main className="search-results">
          {isLoading && <div>Loading...</div>}
          {results.map((result) => (
            <SearchResultCard key={result.id} result={result} />
          ))}
        </main>
      </div>
    </div>
  );
}
```

## Testing

Unit tests are included for the `useSearchFilters` hook:

```bash
npm test -- useSearchFilters.spec.ts
```

Test coverage includes:
- Filter initialization
- Filter updates
- Clear all functionality
- Individual filter removal
- Active filter labels
- localStorage persistence
- URL param loading
