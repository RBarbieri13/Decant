# Enhanced Search Results Display

## Overview

This document describes the enhanced search results display features added to the Decant application. These components work alongside the existing SearchFiltersPanel to provide a comprehensive search experience.

## New Components

### 1. SearchView.tsx
**Main search results view with comprehensive features**

Features:
- Relevance scoring display with color-coded badges
- Sort options (relevance, date, title)
- Pagination controls
- Enhanced result cards with context snippets
- Highlighted search terms
- No results state with helpful suggestions
- Recent searches integration
- Loading states

Usage:
```tsx
import { SearchView } from './components/search';

<SearchView
  query="ai tools"
  results={searchResults}
  isLoading={false}
  onSelectResult={handleSelect}
  onClearSearch={clearSearch}
/>
```

### 2. SearchResultCard.tsx
**Enhanced individual result display**

Features:
- Highlighted matched terms in title and snippet
- Relevance score badge (0-100%) with color coding:
  - Green: 80%+ (high relevance)
  - Yellow: 50-79% (medium relevance)
  - Pink: 0-49% (low relevance)
- Exact match indicator (green checkmark)
- Content type and segment badges
- Context snippets (50 chars before/after match)
- Favicon/logo display
- Matched field indicator (shows which field matched)

Usage:
```tsx
<SearchResultCard
  result={searchResult}
  searchTerms={["ai", "tool"]}
  onClick={() => selectNode(result.node.id)}
  isSelected={false}
/>
```

### 3. HighlightedText.tsx
**Utility component for highlighting search terms**

Features:
- Multiple search term support
- Case-insensitive matching
- Safe regex escaping
- Styled `<mark>` tags with yellow highlighting

Usage:
```tsx
<HighlightedText
  text="This is a sample text with keywords"
  searchTerms={["sample", "keywords"]}
/>
```

### 4. SearchPagination.tsx
**Pagination controls for search results**

Features:
- Previous/Next buttons with disabled states
- Smart page number display with ellipsis (1 ... 5 6 7 ... 20)
- Page size selector (10, 25, 50 items per page)
- Results count display ("Showing X-Y of Z results")
- Mobile-responsive layout

Usage:
```tsx
<SearchPagination
  currentPage={1}
  totalPages={5}
  pageSize={10}
  totalResults={47}
  onPageChange={setPage}
  onPageSizeChange={setPageSize}
/>
```

### 5. RecentSearches.tsx
**Recent search history management**

Features:
- Stores last 10 searches in localStorage
- Shows as dropdown when search field is focused and empty
- Clear history option
- Duplicate prevention (case-insensitive)
- Clickable to re-run searches

Usage:
```tsx
import { RecentSearches, saveRecentSearch } from './components/search';

// Display recent searches
<RecentSearches
  onSelectSearch={setQuery}
  currentQuery={query}
/>

// Save a search (call after successful search)
saveRecentSearch("ai tools");
```

### 6. EnhancedSearchBar.tsx
**Improved search bar with dual modes**

Features:
- Dropdown quick-search showing first 5 results
- "View all X results" button to open full modal
- Recent searches when input is focused and empty
- Full search modal with all SearchView features
- Keyboard navigation (Arrow keys, Enter, Escape)
- Debounced search (300ms)
- AppContext integration for tree highlighting

Usage:
```tsx
import { EnhancedSearchBar } from './components/search';

<EnhancedSearchBar
  onSelectResult={(result) => selectNode(result.node.id)}
/>
```

## Integration

### Update AppShell to use EnhancedSearchBar

Replace the existing SearchBar in `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/renderer/components/layout/AppShell.tsx`:

```tsx
// Before:
import { SearchBar } from '../search/SearchBar';
<SearchBar onSelectResult={handleSearchSelect} />

// After:
import { EnhancedSearchBar } from '../search';
<EnhancedSearchBar onSelectResult={handleSearchSelect} />
```

### AppContext Integration

The enhanced components use these AppContext actions:

```typescript
actions.setSearchQuery(query: string, resultIds: Set<string>)  // Update search state
actions.clearSearch()  // Clear search state
```

These have been added to AppContext at:
`/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/renderer/context/AppContext.tsx`

## Features Breakdown

### Relevance Scoring
- Scores calculated by backend search API (0-1 range)
- Displayed as percentage (0-100%)
- Color-coded badges for quick visual assessment
- Sortable (relevance is default sort)

### Search Term Highlighting
- All search terms highlighted in yellow `<mark>` tags
- Bold font weight for visibility
- Applied to both title and snippet text
- Case-insensitive matching

### Context Snippets
- Shows 50 characters before and after first match
- Ellipsis for truncated text ("...")
- Max 2 lines displayed with overflow hidden
- Falls back to first 150 chars if no match found

### Exact vs Fuzzy Matches
- Green checkmark (✓) badge for exact title matches
- Helps users quickly identify precise results
- Case-insensitive comparison

### Sorting Options
- **Relevance** (default): Highest score first
- **Date**: Most recently updated first
- **Title**: Alphabetical order (A-Z)

### Pagination
- Default page size: 10 results
- Options: 10, 25, 50 per page
- Smart page number display (shows ellipsis for large ranges)
- Always shows first and last page
- Shows 2 pages around current page

### Recent Searches
- Last 10 searches stored in localStorage
- Key: `decant_recent_searches`
- Deduplication (case-insensitive)
- Newest search at top
- Clear all option

### No Results State
- Helpful suggestions:
  - Check spelling
  - Try more general keywords
  - Try different keywords
  - Remove filters
- Actions:
  - Clear search
  - Import new item

## State Management

### Search State Flow

1. User types in EnhancedSearchBar
2. Debounced search (300ms) calls `window.decantAPI.search.query()`
3. Results displayed in dropdown (first 5) or modal (all)
4. AppContext updated with query and result IDs for tree highlighting
5. Search saved to recent searches (if results > 0)

### Local Storage

Keys used:
- `decant_recent_searches`: Array of recent query strings

### URL Parameters (Future Enhancement)

Could add URL param support for shareable searches:
```
/search?q=ai+tools&page=2&size=25&sort=relevance
```

## Styling

Uses Gumroad design system CSS variables:

### Colors
- `--gum-pink`: Primary brand
- `--gum-yellow`: Highlights, selected states
- `--gum-green`: Success, high relevance
- `--gum-blue`: Information, secondary actions
- `--gum-gray-*`: Neutral colors

### Spacing
- `--space-xs` through `--space-xl`

### Typography
- `--font-size-xs` through `--font-size-xxl`
- `--font-weight-medium`, `--font-weight-bold`

### Layout
- All components are mobile-responsive
- Breakpoint: 768px
- Flexbox layouts

## Accessibility

All components follow WCAG AA guidelines:

- ✓ Keyboard navigation (Tab, Arrow keys, Enter, Escape)
- ✓ Focus indicators on all interactive elements
- ✓ Semantic HTML (button, select, input elements)
- ✓ Color contrast meets WCAG AA (4.5:1 for text)
- ✓ Screen reader friendly labels
- ✓ Disabled states clearly indicated

## Performance

Optimizations:
- Debounced search (300ms)
- useMemo for sorted/filtered results
- useCallback for event handlers
- Pagination prevents rendering all results at once
- Lazy loading ready (virtual scrolling for >1000 results)

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari/Chrome

## Testing Recommendations

### Unit Tests
```typescript
// HighlightedText
- Highlights single term
- Highlights multiple terms
- Handles special regex characters
- Case-insensitive matching

// SearchResultCard
- Displays relevance score
- Shows exact match badge
- Truncates long snippets
- Renders favicon

// SearchPagination
- Calculates page ranges
- Disables prev/next appropriately
- Changes page size
- Shows correct result counts

// RecentSearches
- Saves searches to localStorage
- Prevents duplicates
- Clears history
- Limits to 10 searches
```

### Integration Tests
```typescript
// EnhancedSearchBar
- Performs search on input
- Shows dropdown results
- Opens full modal
- Navigates with keyboard
- Selects result
- Clears search
```

## Future Enhancements

Potential improvements:

- [ ] Faceted search filters (integrate with SearchFiltersPanel)
- [ ] Search suggestions/autocomplete
- [ ] Search history analytics (most searched terms)
- [ ] Saved searches (bookmarkable queries)
- [ ] Advanced search operators (AND, OR, NOT, "exact phrase")
- [ ] Search within results
- [ ] Export search results (CSV, JSON)
- [ ] Keyboard shortcuts (Cmd+K to open search)
- [ ] Voice search
- [ ] Search result previews (hover tooltip)
- [ ] Related searches
- [ ] Search performance metrics

## Files Created

All files are in `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/renderer/components/search/`:

- `SearchView.tsx` - Main search results view (354 lines)
- `SearchResultCard.tsx` - Individual result card (220 lines)
- `SearchPagination.tsx` - Pagination controls (183 lines)
- `RecentSearches.tsx` - Recent search history (150 lines)
- `HighlightedText.tsx` - Text highlighting utility (68 lines)
- `EnhancedSearchBar.tsx` - Enhanced search bar (374 lines)
- `SEARCH_ENHANCEMENTS.md` - This documentation

Updated files:
- `index.ts` - Added new component exports
- `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/renderer/context/AppContext.tsx` - Added setSearchQuery and clearSearch actions

## Complete Usage Example

```tsx
import React from 'react';
import { EnhancedSearchBar } from './components/search';
import { useApp } from './context/AppContext';

function MyApp() {
  const { actions } = useApp();

  const handleSearchSelect = (result) => {
    actions.selectNode(result.node.id);
  };

  return (
    <div className="app">
      <header>
        <h1>Decant</h1>
        <EnhancedSearchBar onSelectResult={handleSearchSelect} />
      </header>
      {/* Rest of app */}
    </div>
  );
}
```

## Troubleshooting

### Recent searches not persisting
- Check browser localStorage quota
- Verify localStorage is enabled
- Check for browser extensions blocking storage

### Highlights not working
- Verify searchTerms array is populated
- Check for special characters in search terms
- Ensure text prop is a string

### Pagination showing wrong counts
- Verify totalResults matches actual array length
- Check currentPage is 1-indexed (not 0-indexed)
- Ensure pageSize is positive integer

### Modal not opening
- Check showFullView state
- Verify z-index (should be 2000)
- Check for CSS conflicts

## Support

For questions or issues:
- Refer to component JSDoc comments
- Check USAGE.md for filter integration
- Review AppContext for state management
- See existing SearchBar.tsx for reference implementation
