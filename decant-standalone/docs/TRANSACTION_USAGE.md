# Transaction Support Documentation

## Overview

The Decant standalone application uses better-sqlite3's transaction support to ensure data consistency across multi-step database operations. This document provides a comprehensive guide to transaction usage in the codebase.

## Transaction Helper

**Location**: `src/backend/database/transaction.ts`

### Core Function

```typescript
withTransaction<T>(fn: () => T): T
```

Wraps a function in a database transaction. The function executes synchronously, and:
- If it returns normally, the transaction is committed
- If it throws an error, the transaction is rolled back
- The error is re-thrown after rollback

### How It Works

better-sqlite3 provides native transaction support through `db.transaction()`:

```typescript
const transaction = db.transaction(() => {
  // All database operations here are atomic
  db.prepare('INSERT INTO nodes ...').run(...);
  db.prepare('INSERT INTO key_concepts ...').run(...);
});

// Execute the transaction
transaction();
```

Our `withTransaction()` helper simplifies this pattern:

```typescript
withTransaction(() => {
  db.prepare('INSERT INTO nodes ...').run(...);
  db.prepare('INSERT INTO key_concepts ...').run(...);
});
```

## When to Use Transactions

### ✅ Use Transactions For

1. **Creating Related Records**
   ```typescript
   // Create node with key concepts atomically
   withTransaction(() => {
     db.prepare('INSERT INTO nodes ...').run(...);
     db.prepare('INSERT INTO key_concepts ...').run(...);
   });
   ```

2. **Updating Multiple Tables**
   ```typescript
   // Update node and replace key concepts atomically
   withTransaction(() => {
     db.prepare('UPDATE nodes SET ...').run(...);
     db.prepare('DELETE FROM key_concepts WHERE node_id = ?').run(id);
     db.prepare('INSERT INTO key_concepts ...').run(...);
   });
   ```

3. **Bulk Operations**
   ```typescript
   // Insert multiple segments atomically
   withTransaction(() => {
     const stmt = db.prepare('INSERT INTO segments ...');
     for (const seg of DEFAULT_SEGMENTS) {
       stmt.run(...);
     }
   });
   ```

4. **Merge/Archive Operations**
   ```typescript
   // Update primary and soft-delete secondary atomically
   withTransaction(() => {
     db.prepare('UPDATE nodes SET ... WHERE id = ?').run(primaryId);
     db.prepare('UPDATE nodes SET is_deleted = 1 WHERE id = ?').run(secondaryId);
   });
   ```

5. **Schema Migrations**
   ```typescript
   // Apply schema changes and record migration atomically
   withTransaction(() => {
     db.exec('CREATE TABLE ...');
     db.prepare('INSERT INTO _migrations ...').run(...);
   });
   ```

### ❌ Don't Use Transactions For

1. **Single Read Operations**
   ```typescript
   // ❌ Unnecessary transaction
   withTransaction(() => {
     return db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
   });

   // ✅ Direct query
   return db.prepare('SELECT * FROM nodes WHERE id = ?').get(id);
   ```

2. **Single Write Operations**
   ```typescript
   // ❌ Unnecessary transaction
   withTransaction(() => {
     db.prepare('UPDATE nodes SET title = ? WHERE id = ?').run(title, id);
   });

   // ✅ Direct update
   db.prepare('UPDATE nodes SET title = ? WHERE id = ?').run(title, id);
   ```

3. **Read-Only Batch Operations**
   ```typescript
   // ❌ Unnecessary transaction (reads don't need atomicity)
   withTransaction(() => {
     const nodes = db.prepare('SELECT * FROM nodes').all();
     const concepts = db.prepare('SELECT * FROM key_concepts').all();
     return { nodes, concepts };
   });
   ```

## Current Usage in Codebase

### nodes.ts

#### createNode()
```typescript
export function createNode(data: CreateNodeInput): any {
  return withTransaction(() => {
    // INSERT to nodes table
    db.prepare('INSERT INTO nodes ...').run(...);

    // INSERT to key_concepts table
    if (data.key_concepts) {
      const stmt = db.prepare('INSERT INTO key_concepts ...');
      for (const concept of data.key_concepts) {
        stmt.run(...);
      }
    }

    return readNode(id);
  });
}
```

**Why**: Ensures node and key_concepts are created atomically. If key_concepts insertion fails, the node creation is rolled back.

#### updateNode()
```typescript
export function updateNode(id: string, data: UpdateNodeInput): any {
  return withTransaction(() => {
    // UPDATE nodes table
    if (updates.length > 0) {
      db.prepare('UPDATE nodes SET ...').run(...);
    }

    // DELETE and INSERT key_concepts
    if (data.key_concepts !== undefined) {
      db.prepare('DELETE FROM key_concepts WHERE node_id = ?').run(id);
      const stmt = db.prepare('INSERT INTO key_concepts ...');
      for (const concept of data.key_concepts) {
        stmt.run(...);
      }
    }

    return readNode(id);
  });
}
```

**Why**: Ensures node update and key_concepts replacement are atomic. If concepts insertion fails, the node update is rolled back.

#### mergeNodes()
```typescript
export function mergeNodes(
  primaryId: string,
  secondaryId: string,
  options?: MergeNodesOptions
): any {
  return withTransaction(() => {
    // Get both nodes
    const primaryNode = readNode(primaryId);
    const secondaryNode = readNode(secondaryId);

    // Update primary node with merged data
    db.prepare('UPDATE nodes SET ... WHERE id = ?').run(primaryId);

    // Soft-delete secondary node
    db.prepare('UPDATE nodes SET is_deleted = 1 WHERE id = ?').run(secondaryId);

    return readNode(primaryId);
  });
}
```

**Why**: Ensures primary node update and secondary node deletion are atomic. Prevents partial merges where one operation succeeds and the other fails.

**Important Note**: mergeNodes() performs direct database operations instead of calling updateNode() to avoid nested transactions.

### taxonomy.ts

#### getSegments()
```typescript
export function getSegments(): any[] {
  // If no segments exist, create defaults
  if (segments.length === 0) {
    segments = withTransaction(() => {
      const stmt = db.prepare('INSERT INTO segments ...');
      for (const seg of DEFAULT_SEGMENTS) {
        stmt.run(uuidv4(), seg.name, seg.code, colors[i]);
      }
      return db.prepare('SELECT * FROM segments').all();
    });
  }
  return segments;
}
```

**Why**: Ensures all default segments are created atomically. If any segment insertion fails, all are rolled back.

#### getOrganizations()
```typescript
export function getOrganizations(): any[] {
  // If no organizations exist, create defaults
  if (orgs.length === 0) {
    orgs = withTransaction(() => {
      const stmt = db.prepare('INSERT INTO organizations ...');
      for (const org of DEFAULT_ORGANIZATIONS) {
        stmt.run(uuidv4(), org.name, org.code, colors[i]);
      }
      return db.prepare('SELECT * FROM organizations').all();
    });
  }
  return orgs;
}
```

**Why**: Ensures all default organizations are created atomically. Prevents partial creation of taxonomy.

### migrations/runner.ts

#### runPendingMigrations()
```typescript
export function runPendingMigrations(db: Database.Database): string[] {
  for (const migration of pending) {
    // Each migration runs in its own transaction
    const runMigration = db.transaction(() => {
      migration.up(db);
      recordMigration(db, migration.name);
    });

    try {
      runMigration();
      applied.push(migration.name);
    } catch (error) {
      // If migration fails, it's rolled back
      throw new Error(`Migration ${migration.name} failed: ${error.message}`);
    }
  }
  return applied;
}
```

**Why**: Each migration is atomic. If the migration SQL fails, the migration record is not saved. This prevents the database from being in an inconsistent state where a migration is marked as applied but didn't actually complete.

#### rollbackMigration() and rollbackAllMigrations()
```typescript
const doRollback = db.transaction(() => {
  migration.down(db);
  removeMigrationRecord(db, name);
});
```

**Why**: Ensures rollback SQL and migration record removal are atomic. Prevents the migration from being marked as unapplied while the schema is still in the migrated state.

## Nested Transactions Warning

⚠️ **CRITICAL**: better-sqlite3 does NOT support nested transactions.

### The Problem

```typescript
// ❌ BAD: Nested transactions will cause issues
export function bulkCreateNodes(nodes: CreateNodeInput[]): any[] {
  return withTransaction(() => {
    const results = [];
    for (const nodeData of nodes) {
      // createNode() internally uses withTransaction() - NESTED!
      results.push(createNode(nodeData));
    }
    return results;
  });
}
```

When `createNode()` is called inside the outer `withTransaction()`, it tries to start a new transaction, which can cause:
- Unexpected behavior
- Deadlocks
- Silent data inconsistencies

### The Solution

Perform direct database operations within a single transaction:

```typescript
// ✅ GOOD: Single transaction with direct DB operations
export function bulkCreateNodes(nodes: CreateNodeInput[]): any[] {
  return withTransaction(() => {
    const results = [];
    const nodeStmt = db.prepare('INSERT INTO nodes ...');
    const conceptStmt = db.prepare('INSERT INTO key_concepts ...');

    for (const nodeData of nodes) {
      const id = uuidv4();
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

### Real Example: mergeNodes()

The `mergeNodes()` function demonstrates this pattern:

```typescript
export function mergeNodes(...): any {
  return withTransaction(() => {
    // ✅ Direct database operations (not calling updateNode)
    const updates: string[] = [];
    const values: any[] = [];

    if (mergedData.metadata_tags !== undefined) {
      updates.push('metadata_tags = ?');
      values.push(JSON.stringify(mergedData.metadata_tags));
    }

    if (updates.length > 0) {
      const sql = `UPDATE nodes SET ${updates.join(', ')} WHERE id = ?`;
      db.prepare(sql).run(...values);
    }

    // Direct soft-delete (not calling deleteNode)
    db.prepare('UPDATE nodes SET is_deleted = 1 WHERE id = ?').run(secondaryId);

    return readNode(primaryId);
  });
}
```

## Performance Considerations

### Transactions Add Overhead

Every transaction involves:
1. Beginning a transaction (acquiring locks)
2. Executing operations
3. Committing or rolling back (releasing locks)

For single operations, this overhead is unnecessary.

### Batch Operations

For bulk inserts/updates, use a single transaction with prepared statements:

```typescript
// ✅ GOOD: Single transaction with prepared statement
withTransaction(() => {
  const stmt = db.prepare('INSERT INTO nodes ...');
  for (const data of bulkData) {
    stmt.run(...);
  }
});

// ❌ BAD: Multiple transactions
for (const data of bulkData) {
  withTransaction(() => {
    db.prepare('INSERT INTO nodes ...').run(...);
  });
}
```

### Read Operations Don't Need Transactions

better-sqlite3 uses SQLite's default isolation level, which provides consistent reads without explicit transactions:

```typescript
// ❌ Unnecessary transaction
withTransaction(() => {
  return db.prepare('SELECT * FROM nodes').all();
});

// ✅ Direct read (SQLite handles consistency)
return db.prepare('SELECT * FROM nodes').all();
```

## Testing Transaction Rollback

To verify transaction behavior, you can test rollback scenarios:

```typescript
try {
  withTransaction(() => {
    db.prepare('INSERT INTO nodes ...').run(...);
    db.prepare('INSERT INTO key_concepts ...').run(...);

    // Simulate an error
    throw new Error('Simulated failure');
  });
} catch (error) {
  // Transaction was rolled back
  // Neither nodes nor key_concepts were inserted
  console.log('Transaction rolled back:', error.message);
}
```

## Future Considerations

### Potential Additions

If the application grows, consider adding:

1. **Batch Operations Helper**
   ```typescript
   export function withBatchTransaction<T, R>(
     items: T[],
     fn: (item: T, db: Database.Database) => R
   ): R[] {
     return withTransaction(() => {
       const results: R[] = [];
       for (const item of items) {
         results.push(fn(item, getDatabase()));
       }
       return results;
     });
   }
   ```

2. **Retry Logic for Busy Database**
   ```typescript
   export function withRetryableTransaction<T>(
     fn: () => T,
     maxRetries = 3
   ): T {
     let lastError: Error;
     for (let i = 0; i < maxRetries; i++) {
       try {
         return withTransaction(fn);
       } catch (error) {
         if (error.code === 'SQLITE_BUSY') {
           lastError = error;
           continue;
         }
         throw error;
       }
     }
     throw lastError;
   }
   ```

3. **Transaction Profiling**
   ```typescript
   export function withProfiledTransaction<T>(
     name: string,
     fn: () => T
   ): T {
     const start = Date.now();
     try {
       const result = withTransaction(fn);
       log.debug(`Transaction ${name} completed`, {
         duration: Date.now() - start,
       });
       return result;
     } catch (error) {
       log.error(`Transaction ${name} failed`, {
         duration: Date.now() - start,
         error,
       });
       throw error;
     }
   }
   ```

## Summary

### Current State ✅

- **Transaction helper implemented**: `withTransaction()` in `transaction.ts`
- **Used in node operations**: `createNode()`, `updateNode()`, `mergeNodes()`
- **Used in taxonomy initialization**: `getSegments()`, `getOrganizations()`
- **Used in migrations**: All migration apply/rollback operations
- **Comprehensive documentation**: JSDoc comments and this guide

### Best Practices

1. **Use transactions for multi-step writes** that must be atomic
2. **Avoid transactions for single operations** (reads or writes)
3. **Never nest transactions** - perform direct DB operations instead
4. **Use prepared statements** within transactions for bulk operations
5. **Let transactions fail** - don't catch errors inside the transaction function

### Files Modified

- `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/backend/database/transaction.ts`
  - Enhanced JSDoc documentation
  - Added usage examples
  - Added nested transaction warnings
  - Documented current usage in codebase

### Verification Complete

All subtasks verified:
- ✅ Subtask 9.1: Transaction helper verified and documented
- ✅ Subtask 9.2: Node creation uses transactions
- ✅ Subtask 9.3: Node updates use transactions
- ✅ Subtask 9.4: Merge operations use transactions
- ✅ Additional: Taxonomy operations use transactions
- ✅ Additional: Comprehensive documentation added
