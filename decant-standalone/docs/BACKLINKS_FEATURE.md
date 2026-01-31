# Backlinks Feature Documentation

## Overview

The Backlinks feature allows users to see which nodes reference or relate to the currently selected node. This creates a bidirectional navigation system that helps users understand the context and relationships within their knowledge graph.

## Architecture

### Backend Components

#### 1. API Endpoint
**Location**: `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/backend/routes/nodes.ts`

```typescript
GET /api/nodes/:id/backlinks?limit=10
```

**Parameters**:
- `id` (path): Node ID to get backlinks for
- `limit` (query, optional): Maximum number of backlinks to return (default: 10)

**Response**:
```typescript
{
  nodeId: string;
  backlinks: Backlink[];
  grouped: Record<string, Backlink[]>;
  total: number;
}
```

**Reference Types**:
- `similar` - High similarity score (>= 0.8)
- `sibling` - Good similarity (>= 0.6) with shared attributes (>= 3)
- `related` - Lower similarity or fewer shared attributes
- `manual` - Manually created links

#### 2. Data Source
Uses the existing `node_similarity` table which stores bidirectional similarity relationships between nodes. The backlinks endpoint queries this table to find all nodes that have a similarity relationship with the target node.

### Frontend Components

#### 1. BacklinksSection Component
**Location**: `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/renderer/components/detail/BacklinksSection.tsx`

**Features**:
- Loading state with animated spinner
- Error handling with user-friendly messages
- Empty state with helpful hints
- Two view modes: Grouped and List
- Click-to-navigate functionality
- Strength indicators with color coding
- Shared attributes display
- Content type icons

**Props**:
```typescript
interface BacklinksSectionProps {
  nodeId: string;
  onNavigate?: (nodeId: string) => void;
}
```

#### 2. Integration with DetailPanel
The BacklinksSection is integrated into the DetailPanel as a tab, allowing users to switch between Overview, Properties, Related, Backlinks, and History views.

### API Service

**Location**: `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/renderer/services/api.ts`

```typescript
// Get backlinks for a node
const response = await nodesAPI.getBacklinks(nodeId, limit);
```

**Types**:
```typescript
interface Backlink {
  node: {
    id: string;
    title: string;
    segment: string;
    category: string;
    contentType: string;
    logo_url?: string;
    phrase_description?: string;
  };
  referenceType: 'similar' | 'sibling' | 'related' | 'manual';
  strength: number; // 0-100
  sharedAttributes: string[];
  computedAt: string;
}
```

## User Interface

### View Modes

#### Grouped View (Default)
- Backlinks are grouped by reference type
- Each group shows a header with icon, label, and count
- Visually organized for quick scanning
- Expandable groups for better organization

#### List View
- All backlinks in a single list
- Reference type shown as a badge on each item
- Sorted by strength (highest first)
- Better for scanning all items at once

### Visual Design

**Color-Coded Strength**:
- Green (>= 80%): Very strong connection
- Yellow (>= 60%): Strong connection
- Pink (>= 40%): Moderate connection
- Gray (< 40%): Weak connection

**Interactive Elements**:
- Hover effect: Border changes to black, slight transform
- Active state: Yellow background for visual feedback
- Cursor changes to pointer over clickable items

### Accessibility

- Semantic HTML with proper button elements
- Keyboard navigation support
- Title attributes for icons and buttons
- Screen reader friendly labels
- High contrast color scheme

## Usage Example

```typescript
import { BacklinksSection } from './components/detail/BacklinksSection';

function MyComponent() {
  const handleNavigate = (nodeId: string) => {
    // Navigate to the selected node
    console.log('Navigating to:', nodeId);
  };

  return (
    <BacklinksSection
      nodeId="current-node-id"
      onNavigate={handleNavigate}
    />
  );
}
```

## Performance Considerations

1. **Query Optimization**: Uses indexed queries on the `node_similarity` table
2. **Batch Loading**: Loads full node details in a single batch operation
3. **Limit Parameter**: Default limit of 10 prevents overwhelming the UI
4. **Efficient Grouping**: Grouping is done server-side to reduce client processing

## Future Enhancements

### Graph Visualization (Optional)
A lightweight force-directed graph could be added to show visual connections:

```typescript
// Potential implementation using D3.js or similar
<BacklinksGraph
  nodeId={nodeId}
  backlinks={backlinks}
  width={400}
  height={300}
/>
```

**Features**:
- Central node representing the current item
- Connected nodes for backlinks
- Color-coded connections by strength
- Interactive zoom and pan
- Click nodes to navigate

### Filtering Options
- Filter by reference type
- Filter by strength threshold
- Search within backlinks
- Sort by different criteria

### Manual Link Creation
- Allow users to manually create backlinks
- Add notes/context to links
- Tag relationships with custom labels

## Testing

### Unit Tests
**Location**: `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/renderer/components/detail/BacklinksSection.test.tsx`

**Coverage**:
- Loading state rendering
- Successful data display
- Empty state handling
- Error state handling
- Navigation callback
- View mode toggling
- Strength display
- Shared attributes display

### Integration Tests
Test the full flow from API to UI:
1. Mock database with similarity data
2. Call backlinks endpoint
3. Verify response format
4. Render component with response
5. Verify UI elements

### Manual Testing Checklist
- [ ] Backlinks load correctly for nodes with similarity data
- [ ] Empty state displays for nodes without backlinks
- [ ] Loading spinner appears during data fetch
- [ ] Error message displays on API failure
- [ ] Grouped view displays correctly
- [ ] List view displays correctly
- [ ] View toggle buttons work
- [ ] Navigation works when clicking backlinks
- [ ] Strength colors are correct
- [ ] Shared attributes display properly
- [ ] Content type icons appear
- [ ] Responsive layout on different screen sizes

## API Routes Registration

The backlinks endpoint is registered in the routes configuration:

**Location**: `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/backend/routes/index.ts`

```typescript
app.get('/api/nodes/:id/backlinks', validateParams(UuidParamSchema), nodeRoutes.getBacklinks);
```

## Database Schema

The feature uses the existing `node_similarity` table:

```sql
CREATE TABLE node_similarity (
  id TEXT PRIMARY KEY,
  node_a_id TEXT NOT NULL,
  node_b_id TEXT NOT NULL,
  similarity_score REAL NOT NULL,
  computation_method TEXT NOT NULL,
  computed_at TEXT NOT NULL,
  FOREIGN KEY (node_a_id) REFERENCES nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (node_b_id) REFERENCES nodes(id) ON DELETE CASCADE
);
```

**Indexes**:
- `idx_node_similarity_a` on `node_a_id`
- `idx_node_similarity_b` on `node_b_id`

## Error Handling

### Backend Errors
- 404: Node not found
- 500: Database or internal server error

### Frontend Errors
- Network failures: Display "Failed to load backlinks"
- Invalid data: Gracefully handle missing fields
- Console logging for debugging

## Security Considerations

- Validates node ID parameter using UUID schema
- Respects existing node permissions (if implemented)
- Sanitizes all displayed content
- No direct SQL injection vectors (uses parameterized queries)

## Monitoring

Track these metrics for the backlinks feature:
- Average backlinks per node
- Most common reference types
- API response times
- Error rates
- User engagement (click-through rate)

## Troubleshooting

### No backlinks showing
1. Check if similarity data exists in database
2. Verify API endpoint is accessible
3. Check browser console for errors
4. Verify node ID is valid

### Slow loading
1. Check database indexes
2. Consider reducing default limit
3. Monitor API response time
4. Check network conditions

### Incorrect grouping
1. Verify reference type logic in backend
2. Check similarity score thresholds
3. Validate shared attributes calculation
