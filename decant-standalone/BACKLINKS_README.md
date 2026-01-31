# Backlinks Feature - Quick Reference

## Overview

The Backlinks feature shows bidirectional relationships between nodes, allowing users to discover which items reference or relate to the current node. This creates a knowledge graph navigation system.

## Implementation Summary

### Files Created/Modified

#### Backend
1. **`src/backend/routes/nodes.ts`** - Added `getBacklinks()` endpoint
   - GET `/api/nodes/:id/backlinks?limit=10`
   - Returns backlinks grouped by reference type
   - Uses existing similarity data

2. **`src/backend/routes/index.ts`** - Registered backlinks route
   - Added route with UUID validation

#### Frontend
3. **`src/renderer/services/api.ts`** - Added API types and method
   - `Backlink` interface
   - `BacklinksResponse` interface
   - `nodesAPI.getBacklinks()` method

4. **`src/renderer/components/detail/BacklinksSection.tsx`** - Main component
   - Full implementation with grouped/list views
   - Loading, error, and empty states
   - Click-to-navigate functionality
   - Color-coded strength indicators

5. **`src/renderer/components/layout/DetailPanel.tsx`** - Integration
   - Connected BacklinksSection to Backlinks tab
   - Passed navigation callback

#### Testing & Documentation
6. **`src/renderer/components/detail/BacklinksSection.test.tsx`** - Unit tests
7. **`src/renderer/components/detail/BacklinksSection.example.tsx`** - Usage examples
8. **`docs/BACKLINKS_FEATURE.md`** - Comprehensive documentation

## Quick Start

### Using the Component

```typescript
import { BacklinksSection } from './components/detail/BacklinksSection';

<BacklinksSection
  nodeId="your-node-id"
  onNavigate={(nodeId) => console.log('Navigate to:', nodeId)}
/>
```

### API Usage

```typescript
import { nodesAPI } from './services/api';

// Fetch backlinks for a node
const response = await nodesAPI.getBacklinks('node-id', 10);
console.log(response.backlinks); // Array of backlinks
console.log(response.grouped);   // Grouped by reference type
console.log(response.total);     // Total count
```

## Features

### View Modes
- **Grouped View** (default) - Backlinks organized by reference type
- **List View** - All backlinks in a single list

### Reference Types
- **Similar** - High similarity score (>= 80%)
- **Sibling** - Good similarity (>= 60%) with shared attributes
- **Related** - Lower similarity
- **Manual** - User-created links

### Visual Indicators
- **Strength Colors**:
  - Green: >= 80%
  - Yellow: >= 60%
  - Pink: >= 40%
  - Gray: < 40%

### UI States
- Loading state with animated spinner
- Error state with message
- Empty state with helpful hint
- Hover effects for interactivity

## Component Props

```typescript
interface BacklinksSectionProps {
  nodeId: string;              // Required: Node to show backlinks for
  onNavigate?: (nodeId: string) => void;  // Optional: Navigation callback
}
```

## API Response Structure

```typescript
{
  nodeId: string;
  backlinks: [
    {
      node: {
        id: string;
        title: string;
        segment: string;
        category: string;
        contentType: string;
        logo_url?: string;
        phrase_description?: string;
      },
      referenceType: 'similar' | 'sibling' | 'related' | 'manual';
      strength: number;        // 0-100
      sharedAttributes: string[];
      computedAt: string;
    }
  ],
  grouped: {
    similar: Backlink[];
    sibling: Backlink[];
    related: Backlink[];
    manual: Backlink[];
  },
  total: number;
}
```

## Integration Points

### In DetailPanel
The BacklinksSection is already integrated into the DetailPanel component as the "Backlinks" tab. It automatically:
- Fetches backlinks when the tab is selected
- Updates when a different node is selected
- Allows navigation to backlinked nodes

### Standalone Usage
You can also use BacklinksSection as a standalone component in any part of your application.

## Styling

The component uses inline styles with CSS variables from the Gum design system:
- `--gum-black`, `--gum-white`
- `--gum-gray-*` shades
- `--gum-yellow`, `--gum-green`, `--gum-pink`
- `--space-*` spacing variables
- `--font-size-*` typography scales
- `--border-radius`, `--transition-fast`

## Performance

- Default limit of 10 backlinks prevents UI overload
- Batch loading of node details
- Server-side grouping reduces client processing
- Efficient database queries with indexes

## Testing

Run tests:
```bash
npm test BacklinksSection
```

Test coverage:
- Loading state
- Data display
- Empty state
- Error handling
- Navigation
- View toggling

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES2015+ required
- CSS Grid and Flexbox support needed

## Accessibility

- Semantic HTML with `<button>` elements
- Keyboard navigation support
- Title attributes on interactive elements
- High contrast colors
- Screen reader friendly

## Troubleshooting

### No backlinks showing
- Verify similarity data exists in database
- Check API endpoint accessibility
- Verify node ID is valid

### Slow loading
- Check database indexes on `node_similarity` table
- Consider reducing limit parameter
- Monitor network conditions

### Navigation not working
- Ensure `onNavigate` prop is passed
- Check console for errors
- Verify navigation logic in parent component

## Example Scenarios

### Basic Usage
```typescript
<BacklinksSection nodeId="abc-123" />
```

### With Navigation
```typescript
<BacklinksSection
  nodeId="abc-123"
  onNavigate={(id) => {
    window.location.href = `/nodes/${id}`;
  }}
/>
```

### In a Tab System
```typescript
{activeTab === 'backlinks' && (
  <BacklinksSection
    nodeId={selectedNode.id}
    onNavigate={handleNavigate}
  />
)}
```

## Future Enhancements

- Graph visualization with D3.js
- Manual link creation
- Filtering by reference type
- Search within backlinks
- Export backlinks list
- Breadcrumb trail navigation

## Related Components

- **RelatedItemsSection** - Shows similar items (different from backlinks)
- **NodeHistorySection** - Shows node edit history
- **NodeMetadataSection** - Shows node properties

## Database Schema

Uses existing `node_similarity` table:
```sql
CREATE TABLE node_similarity (
  id TEXT PRIMARY KEY,
  node_a_id TEXT NOT NULL,
  node_b_id TEXT NOT NULL,
  similarity_score REAL NOT NULL,
  computation_method TEXT NOT NULL,
  computed_at TEXT NOT NULL
);
```

## API Endpoint Details

**Request**:
```
GET /api/nodes/:id/backlinks?limit=10
```

**Response** (Success - 200):
```json
{
  "nodeId": "abc-123",
  "backlinks": [...],
  "grouped": {...},
  "total": 5
}
```

**Response** (Error - 404):
```json
{
  "error": "Node not found"
}
```

**Response** (Error - 500):
```json
{
  "error": "Internal server error"
}
```

## Code Examples

See `BacklinksSection.example.tsx` for comprehensive examples:
1. Basic usage
2. Read-only mode
3. Tab integration
4. Custom styling
5. Loading state handling
6. Multiple nodes comparison
7. Analytics tracking
8. Responsive layout

## Support

For issues or questions:
1. Check the comprehensive documentation in `docs/BACKLINKS_FEATURE.md`
2. Review the test file for expected behavior
3. Examine the example file for usage patterns
4. Check browser console for errors

## Version History

- **v1.0.0** (2024-01-30) - Initial implementation
  - Grouped and list views
  - Navigation support
  - Loading/error/empty states
  - Color-coded strength indicators
  - Shared attributes display

## License

Same as the parent Decant project.
