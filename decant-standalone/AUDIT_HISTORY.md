# Audit History Feature

This document describes the audit history functionality in the Decant application, which tracks all hierarchy code changes for nodes.

## Overview

The audit history system provides complete visibility into how nodes are classified and reorganized over time. It tracks:

- Initial code assignments from AI import
- Manual moves by users
- Automatic restructuring operations
- Node merge operations

## Architecture

### Backend Components

#### Database Layer (`src/backend/database/audit.ts`)

Core functions for logging and querying audit data:

- `logCodeChange()` - Log a hierarchy code change
- `getNodeHistory()` - Get complete history for a node
- `getRecentChanges()` - Get recent changes across all nodes
- `getChangesByType()` - Filter by change type
- `getChangesByTrigger()` - Filter by trigger source
- `getBatchChanges()` - Get all changes from a batch operation
- `getChangeStatistics()` - Get aggregate statistics

#### API Routes (`src/backend/routes/audit.ts`)

Three main endpoints:

1. **GET /api/nodes/:id/history** - Get node's complete history
   - Query params: `hierarchyType`, `limit`, `offset`
   - Returns: Array of changes with related node details

2. **GET /api/audit/recent** - Get recent changes across all nodes
   - Query params: `limit` (default: 50, max: 500)
   - Returns: Recent changes with node titles

3. **GET /api/audit/stats** - Get audit statistics
   - Returns: Aggregate counts by type, trigger, and hierarchy

### Frontend Components

#### API Service (`src/renderer/services/api.ts`)

TypeScript client for audit endpoints with full type definitions:

```typescript
export const auditAPI = {
  getNodeHistory(nodeId, options),
  getRecentChanges(limit),
  getStatistics()
}
```

#### React Component (`src/renderer/components/detail/NodeHistorySection.tsx`)

Timeline-based UI showing node's history with:

- **Filters**: Filter by hierarchy type and change type
- **Timeline view**: Visual chronological display
- **Change cards**: Show old → new code transformations
- **Metadata**: Reason, trigger source, related nodes
- **Relative timestamps**: "2 hours ago" with full date on hover

#### Detail Panel Integration (`src/renderer/components/layout/DetailPanel.tsx`)

Added "History" tab to the detail panel's tab navigation.

## Data Model

### Change Record

```typescript
interface AuditChange {
  id: string;                    // Unique change ID
  hierarchyType: HierarchyType;  // 'function' | 'organization'
  oldCode: string | null;        // Previous code (null for creation)
  newCode: string;               // New code assigned
  changeType: ChangeType;        // Type of change
  reason?: string;               // Optional explanation
  triggeredBy: TriggeredBy;      // What caused the change
  changedAt: string;             // ISO timestamp
  relatedNodes?: Array<{         // Nodes affected in batch
    id: string;
    title: string;
  }>;
  metadata?: Record<string, unknown>; // Additional context
}
```

### Change Types

- **created**: Initial code assignment (oldCode will be null)
- **updated**: Code changed within same hierarchy level
- **moved**: Node moved to different parent/location
- **restructured**: Batch operation affecting multiple nodes

### Trigger Sources

- **import**: AI import process assigned the code
- **user_move**: User manually dragged/moved the node
- **restructure**: Bulk reorganization operation
- **merge**: Result of merging duplicate nodes

## Usage Examples

### Backend - Logging Changes

```typescript
import { logCodeChange } from './database/audit.js';

// Log initial import
logCodeChange({
  nodeId: 'node-123',
  hierarchyType: 'function',
  oldCode: null,
  newCode: 'A.LLM.T.1',
  changeType: 'created',
  triggeredBy: 'import',
  reason: 'AI classified as AI/LLM Tool'
});

// Log user move
logCodeChange({
  nodeId: 'node-123',
  hierarchyType: 'function',
  oldCode: 'A.LLM.T.1',
  newCode: 'A.AGT.T.1',
  changeType: 'moved',
  triggeredBy: 'user_move',
  reason: 'User moved to Agents category'
});

// Log batch restructure
const batchId = uuidv4();
for (const node of affectedNodes) {
  logCodeChange({
    nodeId: node.id,
    hierarchyType: 'function',
    oldCode: node.oldCode,
    newCode: node.newCode,
    changeType: 'restructured',
    triggeredBy: 'restructure',
    relatedNodeIds: affectedNodes.map(n => n.id),
    metadata: { batchId }
  });
}
```

### Backend - Querying History

```typescript
import { getNodeHistory, getRecentChanges } from './database/audit.js';

// Get all changes for a node
const history = getNodeHistory('node-123');

// Get only function hierarchy changes
const functionHistory = getNodeHistory('node-123', {
  hierarchyType: 'function'
});

// Get paginated history
const recentHistory = getNodeHistory('node-123', {
  limit: 10,
  offset: 0
});

// Get recent changes across all nodes
const recentChanges = getRecentChanges(20);
```

### Frontend - Using the Component

```typescript
import { NodeHistorySection } from './components/detail/NodeHistorySection';

function DetailPanel({ selectedNode }) {
  return (
    <div>
      {/* Other tabs... */}
      {activeTab === 'history' && (
        <NodeHistorySection nodeId={selectedNode.id} />
      )}
    </div>
  );
}
```

### Frontend - API Calls

```typescript
import { auditAPI } from './services/api';

// Get node history
const { changes } = await auditAPI.getNodeHistory('node-123', {
  hierarchyType: 'function',
  limit: 50
});

// Get recent changes
const { changes, total } = await auditAPI.getRecentChanges(20);

// Get statistics
const stats = await auditAPI.getStatistics();
console.log(`Total changes: ${stats.totalChanges}`);
console.log(`Import changes: ${stats.byTrigger.import}`);
```

## UI Features

### Timeline View

- Visual timeline with connecting line
- Chronological order (newest first)
- Dots marking each change point

### Change Cards

Each change displays:

1. **Header**: Change type badge + hierarchy icon + relative timestamp
2. **Code transformation**: `OLD CODE → NEW CODE` (or just `NEW CODE` for creation)
3. **Reason**: Optional explanation text with icon
4. **Trigger source**: Icon + label showing what caused the change
5. **Related nodes**: Expandable list if batch operation affected multiple nodes

### Filters

- **Hierarchy Type**: All / Function / Organization
- **Change Type**: All / Created / Updated / Moved / Restructured

### Color Coding

- **Created**: Green badge
- **Updated**: Blue badge
- **Moved**: Purple badge
- **Restructured**: Orange badge

### Icons

- **Function hierarchy**: 🔧 (wrench)
- **Organization hierarchy**: 🏢 (building)
- **Import**: 🤖 (robot)
- **User move**: 👤 (person)
- **Restructure**: 🔄 (arrows)
- **Merge**: 🔗 (link)

## Performance Considerations

### Database

- Indexed queries on `node_id`, `changed_at`, `hierarchy_type`
- Composite indexes for common filter combinations
- Efficient JSON parsing for related nodes and metadata

### Frontend

- Lazy loading: History loaded only when tab is selected
- Local filtering: Change type filter applied in memory
- Memoization: Filter callbacks use `useCallback`

### API

- Pagination support via `limit` and `offset`
- Max limit of 500 changes per request
- Node titles enriched server-side to avoid N+1 queries

## Testing

Test file: `src/backend/routes/__tests__/audit.spec.ts`

Coverage includes:
- 404 handling for non-existent nodes
- Empty history for new nodes
- Multiple changes in chronological order
- Filtering by hierarchy type
- Pagination with limit parameter
- Recent changes endpoint
- Statistics endpoint
- Invalid parameter validation

Run tests:
```bash
npm run test src/backend/routes/__tests__/audit.spec.ts
```

## Migration

Database table created by migration `009_add_hierarchy_audit.ts`:

- Creates `hierarchy_code_changes` table
- Adds 6 indexes for efficient querying
- Includes cascade deletion on node removal

## Future Enhancements

Potential improvements:

1. **Revert functionality**: Ability to revert to a previous code
2. **Diff visualization**: Side-by-side code comparison
3. **Export history**: Download as CSV or JSON
4. **Bulk operations**: Filter and act on multiple changes
5. **Notifications**: Alert when specific changes occur
6. **Analytics dashboard**: Visualize change patterns over time
7. **Search within history**: Find specific changes by keyword

## File Structure

```
decant-standalone/
├── src/
│   ├── backend/
│   │   ├── database/
│   │   │   ├── audit.ts                       # Core audit functions
│   │   │   └── migrations/
│   │   │       └── 009_add_hierarchy_audit.ts # Database schema
│   │   └── routes/
│   │       ├── audit.ts                       # API endpoints
│   │       ├── index.ts                       # Route registration
│   │       └── __tests__/
│   │           └── audit.spec.ts              # Tests
│   └── renderer/
│       ├── components/
│       │   ├── detail/
│       │   │   └── NodeHistorySection.tsx     # History UI component
│       │   └── layout/
│       │       └── DetailPanel.tsx            # Tab integration
│       └── services/
│           └── api.ts                         # API client
└── AUDIT_HISTORY.md                           # This documentation
```

## Key Files Summary

| File | Purpose | Lines |
|------|---------|-------|
| `audit.ts` (database) | Core audit logging and querying | ~443 |
| `audit.ts` (routes) | HTTP API endpoints | ~165 |
| `NodeHistorySection.tsx` | React timeline UI | ~450 |
| `api.ts` (audit section) | TypeScript API client | ~100 |
| `audit.spec.ts` | Integration tests | ~170 |
| `009_add_hierarchy_audit.ts` | Database migration | ~110 |

Total implementation: ~1,438 lines of code across 6 files.
