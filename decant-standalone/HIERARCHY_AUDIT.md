# Hierarchy Audit System

## Overview

The Hierarchy Audit System provides comprehensive tracking of all hierarchy code changes in Decant. It maintains a complete audit trail for debugging, accountability, and understanding how nodes have been classified and organized over time.

## Purpose

- **Debugging**: Understand why a node has a particular hierarchy code
- **Accountability**: Track who/what changed codes and when
- **AI Quality**: Analyze AI classification accuracy and patterns
- **Rollback Support**: Enable reverting problematic reorganizations
- **Analytics**: Study code change patterns and system evolution

## Database Schema

### `hierarchy_code_changes` Table

```sql
CREATE TABLE hierarchy_code_changes (
  id TEXT PRIMARY KEY,                    -- UUID
  node_id TEXT NOT NULL,                  -- References nodes(id)
  hierarchy_type TEXT NOT NULL,           -- 'function' or 'organization'
  old_code TEXT,                          -- Previous code (NULL for initial assignment)
  new_code TEXT NOT NULL,                 -- New code
  change_type TEXT NOT NULL,              -- 'created', 'updated', 'moved', 'restructured'
  reason TEXT,                            -- Optional explanation
  triggered_by TEXT NOT NULL,             -- 'import', 'user_move', 'restructure', 'merge'
  related_node_ids TEXT,                  -- JSON array of affected nodes
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT,                          -- JSON for additional context
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);
```

### Indexes

- `idx_hierarchy_changes_node_id`: Fast node history lookup
- `idx_hierarchy_changes_changed_at`: Recent changes query
- `idx_hierarchy_changes_node_type_time`: Node + hierarchy type + time
- `idx_hierarchy_changes_change_type`: Filter by change type
- `idx_hierarchy_changes_triggered_by`: Filter by trigger source
- `idx_hierarchy_changes_type_change`: Hierarchy type + change type

## Change Types

### `created`
Initial code assignment to a node.
- `old_code` will be `null`
- Typically triggered by `import`

### `updated`
Code changed within same hierarchy level.
- Code modified but node stays in similar location
- May be triggered by AI reclassification or user adjustment

### `moved`
Node moved to different parent/location.
- Represents physical repositioning in hierarchy
- Common with `user_move` trigger

### `restructured`
Batch operation affecting multiple nodes.
- Part of larger reorganization
- Uses `metadata.batchId` to group related changes
- Common with `restructure` trigger

## Trigger Sources

### `import`
Change made by AI during import process.
- Initial classifications
- Automated code assignments

### `user_move`
Manual change by user.
- Drag-and-drop operations
- Manual code editing

### `restructure`
Bulk reorganization operation.
- Category splits/merges
- Hierarchy refactoring
- Mass reclassification

### `merge`
Changes from merging duplicate nodes.
- Consolidating duplicate entries
- Resolving conflicts

## API Functions

### Log Changes

```typescript
import { logCodeChange } from './database/audit.js';

// Log initial assignment
logCodeChange({
  nodeId: 'node-123',
  hierarchyType: 'function',
  oldCode: null,
  newCode: 'A.LLM.T.1',
  changeType: 'created',
  triggeredBy: 'import',
  reason: 'AI classified as LLM tutorial',
  metadata: {
    confidence: 0.95,
    modelVersion: 'gpt-4'
  }
});

// Log user move
logCodeChange({
  nodeId: 'node-123',
  hierarchyType: 'function',
  oldCode: 'A.LLM.T.1',
  newCode: 'A.LLM.T.2',
  changeType: 'moved',
  triggeredBy: 'user_move',
  reason: 'User repositioned via drag-and-drop'
});

// Log batch restructure
const batchId = uuidv4();
affectedNodes.forEach(node => {
  logCodeChange({
    nodeId: node.id,
    hierarchyType: 'function',
    oldCode: node.oldCode,
    newCode: node.newCode,
    changeType: 'restructured',
    triggeredBy: 'restructure',
    reason: 'Category reorganization',
    relatedNodeIds: otherAffectedNodeIds,
    metadata: { batchId }
  });
});
```

### Query Changes

```typescript
import {
  getNodeHistory,
  getRecentChanges,
  getChangesByType,
  getBatchChanges,
  getChangesByTrigger,
  getChangeStatistics
} from './database/audit.js';

// Get complete history for a node
const history = getNodeHistory('node-123');

// Get only function hierarchy changes
const functionHistory = getNodeHistory('node-123', {
  hierarchyType: 'function'
});

// Get recent changes across system
const recentChanges = getRecentChanges(50);

// Get all restructure operations
const restructures = getChangesByType('restructured', 100);

// Get all AI import changes
const imports = getChangesByTrigger('import', 100);

// Get all changes from a batch operation
const batchChanges = getBatchChanges('batch-id-123');

// Get system statistics
const stats = getChangeStatistics();
console.log(`Total changes: ${stats.totalChanges}`);
console.log(`AI-driven: ${stats.byTrigger.import}`);
console.log(`User-driven: ${stats.byTrigger.user_move}`);
```

## Common Use Cases

### 1. Debugging Classification

**Problem**: "Why does this node have code A.LLM.T.3?"

```typescript
const history = getNodeHistory(nodeId);
history.forEach(change => {
  console.log(`${change.changedAt}: ${change.oldCode} → ${change.newCode}`);
  console.log(`  Triggered by: ${change.triggeredBy}`);
  console.log(`  Reason: ${change.reason}`);
});
```

### 2. Analyzing AI Quality

**Problem**: "Is the AI making good classification decisions?"

```typescript
const imports = getChangesByTrigger('import', 1000);

// Find nodes that were reclassified after import
const reclassified = imports.filter(change => {
  const laterChanges = getNodeHistory(change.nodeId)
    .filter(c => c.changedAt > change.changedAt);
  return laterChanges.length > 0;
});

console.log(`${reclassified.length}/${imports.length} nodes were reclassified`);
```

### 3. Reverting Bad Restructure

**Problem**: "The last batch operation broke the hierarchy"

```typescript
const batchChanges = getBatchChanges('problematic-batch-id');

// Revert each change
batchChanges.forEach(change => {
  if (change.oldCode) {
    // Update node back to old code
    updateNodeHierarchyCode(change.nodeId, change.hierarchyType, change.oldCode);

    // Log the revert
    logCodeChange({
      nodeId: change.nodeId,
      hierarchyType: change.hierarchyType,
      oldCode: change.newCode,
      newCode: change.oldCode,
      changeType: 'updated',
      triggeredBy: 'user_move',
      reason: `Reverted batch ${batchId}`,
      metadata: { revertedChangeId: change.id }
    });
  }
});
```

### 4. Finding Unstable Classifications

**Problem**: "Which nodes are changing codes frequently?"

```typescript
const recentChanges = getRecentChanges(1000);
const changeCounts = new Map<string, number>();

recentChanges.forEach(change => {
  const count = changeCounts.get(change.nodeId) || 0;
  changeCounts.set(change.nodeId, count + 1);
});

const unstable = Array.from(changeCounts.entries())
  .filter(([_, count]) => count > 3)
  .sort((a, b) => b[1] - a[1]);

console.log('Nodes with frequent code changes:');
unstable.forEach(([nodeId, count]) => {
  console.log(`  ${nodeId}: ${count} changes`);
});
```

### 5. Audit Report Generation

```typescript
const stats = getChangeStatistics();

console.log('=== Hierarchy Audit Report ===');
console.log(`Total Changes: ${stats.totalChanges}`);
console.log('\nBy Source:');
Object.entries(stats.byTrigger).forEach(([trigger, count]) => {
  const pct = ((count / stats.totalChanges) * 100).toFixed(1);
  console.log(`  ${trigger}: ${count} (${pct}%)`);
});

console.log('\nBy Type:');
Object.entries(stats.byType).forEach(([type, count]) => {
  const pct = ((count / stats.totalChanges) * 100).toFixed(1);
  console.log(`  ${type}: ${count} (${pct}%)`);
});
```

## Best Practices

### Always Log Changes

Every hierarchy code modification should be logged:

```typescript
// ❌ Bad: Direct update without logging
updateNode(nodeId, { function_hierarchy_code: newCode });

// ✅ Good: Log the change
const oldCode = node.function_hierarchy_code;
updateNode(nodeId, { function_hierarchy_code: newCode });
logCodeChange({
  nodeId,
  hierarchyType: 'function',
  oldCode,
  newCode,
  changeType: 'updated',
  triggeredBy: 'user_move',
  reason: 'User manual adjustment'
});
```

### Provide Meaningful Reasons

```typescript
// ❌ Bad: Generic reason
logCodeChange({
  nodeId,
  hierarchyType: 'function',
  oldCode: null,
  newCode: 'A.LLM.T.1',
  changeType: 'created',
  triggeredBy: 'import',
  reason: 'Import'  // Not helpful
});

// ✅ Good: Specific, actionable reason
logCodeChange({
  nodeId,
  hierarchyType: 'function',
  oldCode: null,
  newCode: 'A.LLM.T.1',
  changeType: 'created',
  triggeredBy: 'import',
  reason: 'AI classified as LLM tutorial based on keywords: "embeddings", "vector search"',
  metadata: {
    confidence: 0.95,
    keyTokens: ['embeddings', 'vector search'],
    modelVersion: 'gpt-4'
  }
});
```

### Use Batch IDs for Related Changes

```typescript
const batchId = uuidv4();

for (const node of affectedNodes) {
  logCodeChange({
    nodeId: node.id,
    hierarchyType: 'function',
    oldCode: node.oldCode,
    newCode: node.newCode,
    changeType: 'restructured',
    triggeredBy: 'restructure',
    reason: 'Split LLM category into subcategories',
    relatedNodeIds: affectedNodes.map(n => n.id),
    metadata: {
      batchId,
      operation: 'category_split',
      totalAffected: affectedNodes.length
    }
  });
}
```

### Include Rich Metadata

```typescript
logCodeChange({
  nodeId,
  hierarchyType: 'function',
  oldCode: 'A.LLM.T.1',
  newCode: 'A.LLM.T.2',
  changeType: 'moved',
  triggeredBy: 'user_move',
  reason: 'User repositioned in hierarchy',
  metadata: {
    userId: 'user-123',
    sessionId: 'session-456',
    userAgent: 'Mozilla/5.0...',
    timestamp: new Date().toISOString(),
    previousSiblingCode: 'A.LLM.T.1',
    newSiblingCode: 'A.LLM.T.3'
  }
});
```

## Performance Considerations

### Indexes Optimize Common Queries

- Node history: Uses `idx_hierarchy_changes_node_id`
- Recent changes: Uses `idx_hierarchy_changes_changed_at`
- Filtered queries: Use type-specific indexes

### Cleanup Old Data

Consider periodically archiving old audit records:

```typescript
// Archive changes older than 1 year
const oneYearAgo = new Date();
oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

db.prepare(`
  DELETE FROM hierarchy_code_changes
  WHERE changed_at < ?
`).run(oneYearAgo.toISOString());
```

### Batch Operations

For large restructures, use transactions:

```typescript
import { withTransactionSync } from './database/transaction.js';

withTransactionSync(db => {
  for (const node of largeNodeSet) {
    logCodeChange({ /* ... */ }, db);
  }
});
```

## Migration

The audit system is added via migration `009_add_hierarchy_audit`:

```bash
# Check migration status
npm run migrate:status

# Apply migration
npm run migrate:up

# Rollback if needed
npm run migrate -- rollback 009_add_hierarchy_audit
```

## See Also

- `src/backend/database/audit.ts` - Core implementation
- `src/backend/database/audit.example.ts` - Usage examples
- `src/backend/database/__tests__/audit.spec.ts` - Tests
- `src/backend/database/migrations/009_add_hierarchy_audit.ts` - Migration
