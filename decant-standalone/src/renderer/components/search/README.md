# Search Filters Component Suite

Complete search filtering UI for the Decant knowledge base application.

## Files Created

### Components
- **`SearchFiltersPanel.tsx`** - Main filter panel with collapsible UI
- **`FilterChips.tsx`** - Active filter display with dismiss buttons
- **`SearchBar.tsx`** - Existing search input (already present)

### Hooks
- **`useSearchFilters.ts`** - Filter state management hook with URL params and localStorage

### Tests
- **`useSearchFilters.spec.ts`** - Unit tests for the filter hook

### Documentation
- **`USAGE.md`** - Complete integration guide
- **`README.md`** - This file

## Quick Start

```tsx
import { SearchFiltersPanel } from './components/search';
import { useSearchFilters } from './hooks/useSearchFilters';

function MySearchPage() {
  const { filters } = useSearchFilters();

  return (
    <SearchFiltersPanel
      onFiltersChange={(filters) => performSearch(filters)}
      resultCount={42}
      isLoading={false}
      availableCategories={['AI', 'ML', 'LLMs']}
    />
  );
}
```

## Features

### 1. Filter Controls
- **Segment Dropdown**: Select from 10 predefined segments (AI, Tech, Finance, etc.)
- **Category Dropdown**: Dynamically populated from available categories
- **Content Type Checkboxes**: Multi-select from 12 content types
- **Date Range Picker**: Start/end date selection with apply/clear
- **Metadata Toggle**: Filter for items with complete metadata

### 2. Active Filters Display
- Color-coded chips for each filter type
- Individual dismiss buttons
- "Clear all" button
- Result count display
- Responsive layout

### 3. State Management
- **URL Params**: Shareable filter states via query params
- **localStorage**: Persist last used filters between sessions
- **Debouncing**: 300ms delay on filter changes
- **Type Safety**: Full TypeScript support

### 4. UI/UX Features
- Collapsible panel
- Loading states
- Disabled states during search
- Mobile-responsive design
- Keyboard navigation
- WCAG AA accessible

## Filter Types

### Segments (Single-select)
```typescript
type SegmentCode = 'A' | 'T' | 'F' | 'S' | 'H' | 'B' | 'E' | 'L' | 'X' | 'C';
```
- A: AI & ML
- T: Technology
- F: Finance
- S: Sports
- H: Health
- B: Business
- E: Entertainment
- L: Lifestyle
- X: Science
- C: Creative

### Content Types (Multi-select)
```typescript
type ContentTypeCode = 'T' | 'A' | 'V' | 'P' | 'R' | 'G' | 'S' | 'C' | 'I' | 'N' | 'K' | 'U';
```
- T: Tool/Website
- A: Article
- V: Video
- P: Podcast
- R: Research Paper
- G: Repository
- S: Social Post
- C: Course/Tutorial
- I: Image/Graphic
- N: Newsletter
- K: Book/eBook
- U: Audio

### Categories (Dynamic)
Populated from backend facets/aggregations based on your data.

### Date Range
ISO date strings (YYYY-MM-DD format).

### Metadata Completeness
Boolean flag for filtering items with all metadata fields populated.

## State Shape

```typescript
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
```

## Integration Points

### With Search API
```typescript
const response = await searchAPI.searchPaginated(
  query,
  { page: 1, limit: 20 },
  filters  // SearchFilterState
);
```

### With Tree/List Views
```typescript
const { filters } = useSearchFilters();

useEffect(() => {
  // Filter tree nodes based on current filters
  const filtered = filterTreeNodes(treeData, filters);
  setFilteredTree(filtered);
}, [filters, treeData]);
```

### With URL Routing
Filters automatically sync to URL query params:
```
/search?segments=A&contentTypes=V,A&dateStart=2024-01-01&dateEnd=2024-12-31
```

## Styling

Uses Decant design system CSS variables:

### Colors
- `--decant-forest-*` - Primary brand colors
- `--decant-tag-*-bg/text/border` - Filter chip colors
- `--decant-gray-*` - Neutral colors

### Spacing
- `--decant-space-1` through `--decant-space-12`

### Typography
- `--decant-text-xs` through `--decant-text-3xl`
- `--decant-font-*` for weights

### Layout
- Responsive breakpoint at 768px
- Mobile-first approach
- Flexbox and Grid layouts

## Performance Considerations

1. **Debouncing**: Filter changes debounced 300ms to prevent excessive API calls
2. **Memoization**: Active filters computed with useMemo
3. **Lazy Updates**: Date range only applied when "Apply" clicked
4. **Efficient Re-renders**: useCallback for event handlers

## Accessibility

- ✓ Semantic HTML (label, select, input elements)
- ✓ Keyboard navigation (Tab, Enter, Space)
- ✓ Focus indicators on all interactive elements
- ✓ ARIA attributes where appropriate
- ✓ Color contrast meets WCAG AA
- ✓ Screen reader friendly labels

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari/Chrome

## Testing

Run tests:
```bash
npm test -- useSearchFilters.spec.ts
```

Coverage:
- Filter initialization
- State updates
- localStorage persistence
- URL param loading
- Filter removal
- Clear all functionality

## Future Enhancements

Potential additions:
- [ ] Saved filter presets
- [ ] Recent filter history
- [ ] Advanced boolean operators
- [ ] Fuzzy matching options
- [ ] Sort order controls
- [ ] View density toggle
- [ ] Export filtered results
- [ ] Filter suggestions based on data

## Troubleshooting

### Filters not persisting
Check localStorage quota and browser settings.

### URL params not updating
Ensure component is mounted and useEffect dependencies are correct.

### Categories not showing
Verify `availableCategories` prop is populated from backend.

### Styling issues
Confirm CSS variables are loaded from `variables.css`.

## Support

For questions or issues, refer to:
- USAGE.md for integration examples
- useSearchFilters.spec.ts for test examples
- Decant design system documentation
