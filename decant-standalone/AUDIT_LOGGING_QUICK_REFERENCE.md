# Audit Logging Quick Reference

## Overview

Quick reference for using the hierarchy code audit logging system.

## Database Functions

### Insert Changes

```typescript
import * as audit from './backend/database/audit.js';

// Single change
const id = audit.insertCodeChange({
  nodeId: 'node-123',
  hierarchyType: 'function',
  oldCode: 'A.LLM.T1',
  newCode: 'A.LLM.T1.1',
  changeType: 'restructure',
  changeReason: 'Split category',
  triggeredByNodeId: 'node-456'
});

// Batch changes
const batchId = uuidv4();
const ids = audit.insertCodeChanges([
  { nodeId: 'node-1', hierarchyType: 'function', oldCode: 'A.LLM.T1', newCode: 'A.LLM.T1.1', changeType: 'restructure', changeReason: 'Split' },
  { nodeId: 'node-2', hierarchyType: 'function', oldCode: 'A.LLM.T2', newCode: 'A.LLM.T1.2', changeType: 'restructure', changeReason: 'Split' }
], batchId);
```

### Query History

```typescript
// Node history
const history = audit.getNodeChangeHistory('node-123');
const funcHistory = audit.getNodeChangeHistory('node-123', { hierarchyType: 'function', limit: 10 });

// Recent changes
const recent = audit.getRecentChanges({ limit: 50 });
const recentMoves = audit.getRecentChanges({ changeType: 'move', limit: 20 });

// Batch changes
const batchChanges = audit.getBatchChanges('batch-456');

// Triggered changes
const cascades = audit.getChangesTriggeredBy('node-789');

// Statistics
const stats = audit.getChangeStats();
// { total: 1000, byType: {...}, byTrigger: {...} }
```

## Service Layer

### Log Changes

```typescript
import * as auditService from './backend/services/audit_service.js';

// Single change
await auditService.logChange({
  nodeId: 'node-123',
  hierarchyType: 'function',
  oldCode: null,
  newCode: 'A.LLM.T1',
  changeType: 'initial',
  changeReason: 'Node created'
});

// Batch changes
await auditService.logBatchChanges([
  { nodeId: 'node-1', hierarchyType: 'function', oldCode: 'A.LLM.T1', newCode: 'A.LLM.T1.1', changeType: 'restructure', changeReason: 'Split' },
  { nodeId: 'node-2', hierarchyType: 'function', oldCode: 'A.LLM.T2', newCode: 'A.LLM.T1.2', changeType: 'restructure', changeReason: 'Split' }
], 'Category split due to conflict');
```

### Query History

```typescript
// Same as database layer but async
const history = await auditService.getNodeHistory('node-123');
const recent = await auditService.getRecentChanges({ limit: 50 });
const stats = await auditService.getChangeStats();
```

## Integration Points

### 1. Node Creation

```typescript
// In createNode()
const node = createNode({...});

auditService.logChange({
  nodeId: node.id,
  hierarchyType: 'function',
  oldCode: null,
  newCode: node.functionHierarchyCode,
  changeType: 'initial',
  changeReason: 'Node created with initial hierarchy code'
});
```

### 2. Node Update

```typescript
// In updateNode() when hierarchy code changes
if (updates.functionHierarchyCode !== currentNode.functionHierarchyCode) {
  auditService.logChange({
    nodeId: id,
    hierarchyType: 'function',
    oldCode: currentNode.functionHierarchyCode,
    newCode: updates.functionHierarchyCode,
    changeType: 'update',
    changeReason: 'Hierarchy code manually updated'
  });
}
```

### 3. Node Move

```typescript
// In moveNode()
auditService.logChange({
  nodeId,
  hierarchyType,
  oldCode: currentCode,
  newCode: newHierarchyCode,
  changeType: 'move',
  changeReason: `Node moved to parent ${newParentId}`
});
```

### 4. Restructure (Batch)

```typescript
// In splitCategory()
const batchId = uuidv4();
const changes = siblings.map((sibling, i) => ({
  nodeId: sibling.id,
  hierarchyType: 'function',
  oldCode: sibling.code,
  newCode: `${categoryCode}.${i + 1}`,
  changeType: 'restructure',
  changeReason: `Split category (sibling ${i + 1} of ${siblings.length})`,
  triggeredByNodeId: newNodeId,
  batchId
}));

await auditService.logBatchChanges(changes, 'Category split due to conflict');
```

### 5. Merge

```typescript
// In mergeNodes()
auditService.logChange({
  nodeId: sourceNodeId,
  hierarchyType,
  oldCode: sourceNode.code,
  newCode: targetNode.code,
  changeType: 'merge',
  changeReason: `Node merged into target ${targetNodeId}`,
  triggeredByNodeId: targetNodeId
});
```

## API Endpoints

### Node History
```bash
GET /api/audit/node/:nodeId?hierarchyType=function&limit=10
```

### Recent Changes
```bash
GET /api/audit/recent?limit=50&changeType=restructure
```

### Batch Changes
```bash
GET /api/audit/batch/:batchId
```

### Triggered Changes
```bash
GET /api/audit/triggered/:nodeId?limit=20
```

### Statistics
```bash
GET /api/audit/stats
```

## Change Types

- **initial**: First assignment of hierarchy code (node creation)
- **update**: Manual hierarchy code update
- **move**: Node moved to different parent
- **restructure**: Automatic reorganization (sibling differentiation)
- **merge**: Node merged into another node

## Response Format

```json
{
  "id": "change-123",
  "nodeId": "node-456",
  "hierarchyType": "function",
  "oldCode": "A.LLM.T1",
  "newCode": "A.LLM.T1.1",
  "changeType": "restructure",
  "changeReason": "New similar node created conflict (sibling 1 of 2)",
  "triggeredByNodeId": "node-789",
  "batchId": "batch-abc",
  "changedAt": "2026-01-30T10:30:00Z"
}
```

## Transaction Pattern

```typescript
const transaction = db.transaction(() => {
  // 1. Make change
  updateStmt.run(newCode, nodeId);

  // 2. Log change (in same transaction)
  auditService.logChange({...});

  // Both succeed or both fail together
});

transaction();
```

## Common Queries

### "What happened to this node?"
```typescript
const history = await auditService.getNodeHistory(nodeId);
```

### "What restructures happened today?"
```typescript
const recent = await auditService.getRecentChanges({
  changeType: 'restructure',
  limit: 100
});
```

### "What did adding this node affect?"
```typescript
const cascades = await auditService.getChangesTriggeredBy(newNodeId);
```

### "Show me all changes in this batch"
```typescript
const batch = await auditService.getBatchChanges(batchId);
```

### "How many restructures vs moves?"
```typescript
const stats = await auditService.getChangeStats();
console.log(stats.byType);
```

## Performance Tips

1. **Use indexes**: All query patterns are indexed
2. **Limit results**: Use `limit` parameter for large datasets
3. **Filter early**: Use `hierarchyType` and `changeType` filters
4. **Batch operations**: Use `logBatchChanges()` for multiple related changes
5. **Archive old data**: Use `deleteOldChanges()` for maintenance

## Testing Checklist

- [ ] Test initial code assignment logs correctly
- [ ] Test manual updates log correctly
- [ ] Test move operations log correctly
- [ ] Test restructure creates batch with correct batch ID
- [ ] Test merge operations log with triggered_by
- [ ] Test transaction rollback doesn't create orphan logs
- [ ] Test query by hierarchy type
- [ ] Test query by change type
- [ ] Test batch query returns all related changes
- [ ] Test triggered query shows cascade effects
- [ ] Test statistics accurately reflect data

## Files to Modify

1. **Migration**: `src/backend/database/migrations/004_add_audit_table.ts`
2. **Database Layer**: `src/backend/database/audit.ts` (new)
3. **Service Layer**: `src/backend/services/audit_service.ts` (new)
4. **Restructure Service**: `src/backend/services/hierarchy/restructure.ts`
5. **Nodes Database**: `src/backend/database/nodes.ts`
6. **Import Orchestrator**: `src/backend/services/import_orchestrator.ts`
7. **API Routes**: `src/backend/routes/api/audit.ts` (new)
8. **Route Registration**: `src/backend/routes/index.ts`

## Summary

The audit logging system provides:
- Complete traceability of all hierarchy code changes
- Batch tracking for related changes
- Cascade visibility for triggered changes
- Transaction-safe logging
- Flexible querying via database, service, or API layers
- Performance-optimized with strategic indexes

All hierarchy operations automatically log their changes, creating a complete audit trail for debugging, analysis, and compliance.
