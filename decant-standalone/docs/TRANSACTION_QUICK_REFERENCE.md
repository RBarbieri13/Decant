# Transaction Quick Reference

## TL;DR

- Use `withTransaction()` for multi-step write operations that must be atomic
- Don't use transactions for single operations or reads
- Never nest transactions (perform direct DB operations instead)
- All or nothing: if any operation fails, everything rolls back

## Import

```typescript
import { withTransaction } from './transaction.js';
```

## Basic Usage

```typescript
// Create node with concepts atomically
const node = withTransaction(() => {
  db.prepare('INSERT INTO nodes ...').run(...);
  db.prepare('INSERT INTO key_concepts ...').run(...);
  return readNode(id);
});
```

## Quick Decision Guide

| Scenario | Use Transaction? | Example |
|----------|------------------|---------|
| Single SELECT | ❌ No | `db.prepare('SELECT * FROM nodes').get(id)` |
| Single INSERT | ❌ No | `db.prepare('INSERT INTO nodes ...').run(...)` |
| Single UPDATE | ❌ No | `db.prepare('UPDATE nodes SET ...').run(...)` |
| INSERT + INSERT | ✅ Yes | Node + Key Concepts |
| UPDATE + DELETE + INSERT | ✅ Yes | Update node + Replace concepts |
| UPDATE + UPDATE | ✅ Yes | Merge nodes (update primary + soft-delete secondary) |
| Bulk INSERTs | ✅ Yes | Create default segments |
| Schema migration | ✅ Yes | Create table + Record migration |

## Common Patterns

### Pattern 1: Create with Related Data

```typescript
function createNode(data: CreateNodeInput) {
  return withTransaction(() => {
    const id = uuidv4();

    // Insert main record
    db.prepare('INSERT INTO nodes ...').run(id, ...);

    // Insert related records
    if (data.key_concepts) {
      const stmt = db.prepare('INSERT INTO key_concepts ...');
      for (const concept of data.key_concepts) {
        stmt.run(uuidv4(), id, concept);
      }
    }

    return readNode(id);
  });
}
```

### Pattern 2: Update with Related Data

```typescript
function updateNode(id: string, data: UpdateNodeInput) {
  return withTransaction(() => {
    // Update main record
    db.prepare('UPDATE nodes SET ... WHERE id = ?').run(..., id);

    // Replace related records
    if (data.key_concepts !== undefined) {
      db.prepare('DELETE FROM key_concepts WHERE node_id = ?').run(id);

      const stmt = db.prepare('INSERT INTO key_concepts ...');
      for (const concept of data.key_concepts) {
        stmt.run(uuidv4(), id, concept);
      }
    }

    return readNode(id);
  });
}
```

### Pattern 3: Bulk Insert

```typescript
function initializeDefaults() {
  return withTransaction(() => {
    const stmt = db.prepare('INSERT INTO segments ...');

    for (const segment of DEFAULT_SEGMENTS) {
      stmt.run(uuidv4(), segment.name, segment.code);
    }

    return db.prepare('SELECT * FROM segments').all();
  });
}
```

### Pattern 4: Merge/Archive Operations

```typescript
function mergeNodes(primaryId: string, secondaryId: string) {
  return withTransaction(() => {
    // Update primary
    db.prepare('UPDATE nodes SET ... WHERE id = ?').run(..., primaryId);

    // Soft-delete secondary
    db.prepare('UPDATE nodes SET is_deleted = 1 WHERE id = ?').run(secondaryId);

    return readNode(primaryId);
  });
}
```

### Pattern 5: Migration

```typescript
function applyMigration(migration: Migration) {
  const runMigration = db.transaction(() => {
    // Apply schema changes
    migration.up(db);

    // Record migration
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migration.name);
  });

  runMigration();
}
```

## Avoiding Nested Transactions

### ❌ WRONG

```typescript
// This creates nested transactions (will fail)
function bulkCreate(nodes: CreateNodeInput[]) {
  return withTransaction(() => {
    const results = [];
    for (const nodeData of nodes) {
      // createNode() uses withTransaction() internally - NESTED!
      results.push(createNode(nodeData));
    }
    return results;
  });
}
```

### ✅ CORRECT

```typescript
// Perform direct DB operations in a single transaction
function bulkCreate(nodes: CreateNodeInput[]) {
  return withTransaction(() => {
    const results = [];
    const nodeStmt = db.prepare('INSERT INTO nodes ...');
    const conceptStmt = db.prepare('INSERT INTO key_concepts ...');

    for (const nodeData of nodes) {
      const id = uuidv4();

      // Direct DB operations (no nested transactions)
      nodeStmt.run(id, ...);

      if (nodeData.key_concepts) {
        for (const concept of nodeData.key_concepts) {
          conceptStmt.run(uuidv4(), id, concept);
        }
      }

      results.push(readNode(id));
    }

    return results;
  });
}
```

## Error Handling

Transactions automatically rollback on error:

```typescript
try {
  const result = withTransaction(() => {
    db.prepare('INSERT INTO nodes ...').run(...);
    db.prepare('INSERT INTO key_concepts ...').run(...);

    // If this throws, both inserts are rolled back
    if (someCondition) {
      throw new Error('Validation failed');
    }

    return readNode(id);
  });
} catch (error) {
  // Transaction was rolled back
  console.error('Operation failed:', error.message);
  // Database is in consistent state (no partial inserts)
}
```

## Performance Tips

### Use Prepared Statements in Transactions

```typescript
// ✅ GOOD: Prepare once, run many times
withTransaction(() => {
  const stmt = db.prepare('INSERT INTO nodes ...');
  for (const data of bulkData) {
    stmt.run(...); // Fast!
  }
});

// ❌ BAD: Prepare every time
withTransaction(() => {
  for (const data of bulkData) {
    db.prepare('INSERT INTO nodes ...').run(...); // Slow!
  }
});
```

### Don't Use Transactions for Reads

```typescript
// ❌ UNNECESSARY
const nodes = withTransaction(() => {
  return db.prepare('SELECT * FROM nodes').all();
});

// ✅ DIRECT READ
const nodes = db.prepare('SELECT * FROM nodes').all();
```

## Testing Transactions

### Test Successful Execution

```typescript
test('createNode creates node and concepts atomically', () => {
  const node = createNode({
    title: 'Test',
    url: 'https://example.com',
    source_domain: 'example.com',
    key_concepts: ['concept1', 'concept2'],
  });

  expect(node).toBeDefined();
  expect(node.key_concepts).toEqual(['concept1', 'concept2']);
});
```

### Test Rollback on Error

```typescript
test('createNode rolls back on error', () => {
  const nodeCountBefore = countNodes();

  try {
    withTransaction(() => {
      db.prepare('INSERT INTO nodes ...').run(...);
      db.prepare('INSERT INTO key_concepts ...').run(...);

      // Simulate error
      throw new Error('Test error');
    });
  } catch (error) {
    // Expected
  }

  const nodeCountAfter = countNodes();

  // Node count should be unchanged (rollback successful)
  expect(nodeCountAfter).toBe(nodeCountBefore);
});
```

## Checklist for Adding Transactions

When implementing a new operation that needs transactions:

- [ ] Identify all database operations that must be atomic
- [ ] Check if any called functions already use transactions (avoid nesting)
- [ ] Wrap operations in `withTransaction()`
- [ ] Use prepared statements for bulk operations
- [ ] Test successful execution
- [ ] Test rollback on error
- [ ] Add JSDoc comment explaining why transaction is needed
- [ ] Update this documentation

## Common Mistakes

### Mistake 1: Using transactions for single operations

```typescript
// ❌ Unnecessary overhead
const node = withTransaction(() => {
  return db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
});

// ✅ Direct operation
const node = db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
```

### Mistake 2: Nesting transactions

```typescript
// ❌ Will fail or behave unexpectedly
withTransaction(() => {
  createNode(data); // This internally calls withTransaction()
});

// ✅ Direct DB operations
withTransaction(() => {
  db.prepare('INSERT INTO nodes ...').run(...);
  db.prepare('INSERT INTO key_concepts ...').run(...);
});
```

### Mistake 3: Catching errors inside transaction

```typescript
// ❌ Error is caught, but transaction may not rollback properly
withTransaction(() => {
  try {
    db.prepare('INSERT INTO nodes ...').run(...);
    db.prepare('INSERT INTO key_concepts ...').run(...);
  } catch (error) {
    console.error('Error:', error);
    return null; // Transaction will commit!
  }
});

// ✅ Let errors propagate for automatic rollback
try {
  withTransaction(() => {
    db.prepare('INSERT INTO nodes ...').run(...);
    db.prepare('INSERT INTO key_concepts ...').run(...);
  });
} catch (error) {
  console.error('Error:', error);
  // Transaction already rolled back
}
```

### Mistake 4: Mixing transaction patterns

```typescript
// ❌ Inconsistent transaction handling
withTransaction(() => {
  db.prepare('INSERT INTO nodes ...').run(...);
  updateNode(id, data); // This also uses withTransaction()
});

// ✅ All direct operations in one transaction
withTransaction(() => {
  db.prepare('INSERT INTO nodes ...').run(...);
  db.prepare('UPDATE nodes SET ... WHERE id = ?').run(...);
});
```

## Further Reading

- **Full Documentation**: `TRANSACTION_USAGE.md`
- **Flow Diagrams**: `TRANSACTION_FLOW.md`
- **better-sqlite3 Docs**: https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md#transactionfunction---function
- **SQLite Transactions**: https://www.sqlite.org/lang_transaction.html

## Summary

| Do | Don't |
|----|-------|
| Use for multi-step writes | Use for single operations |
| Use for related data creation | Use for read operations |
| Let errors propagate | Catch errors inside transaction |
| Use prepared statements | Prepare statements in loop |
| Test rollback behavior | Nest transactions |
| Document why it's needed | Forget to update docs |

## Quick Test

```typescript
// Q: Does this need a transaction?
db.prepare('SELECT * FROM nodes').all();

// A: No - single read operation

// Q: Does this need a transaction?
db.prepare('INSERT INTO nodes ...').run(...);

// A: No - single write operation

// Q: Does this need a transaction?
db.prepare('INSERT INTO nodes ...').run(...);
db.prepare('INSERT INTO key_concepts ...').run(...);

// A: Yes - multiple related writes that must be atomic
```
