# Transaction Flow Diagrams

## Transaction Wrapper Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  (API Routes, Service Functions)                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                Database Operation Layer                     │
│  - createNode()                                             │
│  - updateNode()                                             │
│  - mergeNodes()                                             │
│  - getSegments() / getOrganizations()                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              withTransaction() Helper                       │
│  1. Get database connection                                 │
│  2. Create transaction wrapper: db.transaction(fn)          │
│  3. Execute transaction                                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              better-sqlite3 Transaction                     │
│  BEGIN TRANSACTION                                          │
│    → Execute all operations                                 │
│    → If success: COMMIT                                     │
│    → If error: ROLLBACK                                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     SQLite Database                         │
│  (data.db)                                                  │
└─────────────────────────────────────────────────────────────┘
```

## Node Creation Flow

```
createNode(data)
     │
     ▼
withTransaction()
     │
     ├─── BEGIN TRANSACTION
     │
     ├─── INSERT INTO nodes (id, title, url, ...)
     │    VALUES (?, ?, ?, ...)
     │
     ├─── For each key_concept:
     │    │
     │    └─── INSERT INTO key_concepts (id, node_id, concept)
     │         VALUES (?, ?, ?)
     │
     ├─── If all succeed:
     │    │
     │    ├─── COMMIT
     │    │
     │    └─── return readNode(id)
     │
     └─── If any fail:
          │
          ├─── ROLLBACK
          │
          └─── throw error
```

## Node Update Flow

```
updateNode(id, data)
     │
     ▼
withTransaction()
     │
     ├─── BEGIN TRANSACTION
     │
     ├─── UPDATE nodes SET title = ?, company = ?, ...
     │    WHERE id = ?
     │
     ├─── DELETE FROM key_concepts WHERE node_id = ?
     │
     ├─── For each new key_concept:
     │    │
     │    └─── INSERT INTO key_concepts (id, node_id, concept)
     │         VALUES (?, ?, ?)
     │
     ├─── If all succeed:
     │    │
     │    ├─── COMMIT
     │    │
     │    └─── return readNode(id)
     │
     └─── If any fail:
          │
          ├─── ROLLBACK
          │
          └─── throw error
```

## Node Merge Flow

```
mergeNodes(primaryId, secondaryId, options)
     │
     ▼
withTransaction()
     │
     ├─── BEGIN TRANSACTION
     │
     ├─── readNode(primaryId) ──────── SELECT * FROM nodes WHERE id = ?
     │                                  SELECT * FROM key_concepts WHERE node_id = ?
     │
     ├─── readNode(secondaryId) ────── SELECT * FROM nodes WHERE id = ?
     │                                  SELECT * FROM key_concepts WHERE node_id = ?
     │
     ├─── Merge data (in memory)
     │
     ├─── UPDATE nodes SET metadata_tags = ?, ai_summary = ?
     │    WHERE id = ? (primaryId)
     │
     ├─── UPDATE nodes SET is_deleted = 1
     │    WHERE id = ? (secondaryId)
     │
     ├─── If all succeed:
     │    │
     │    ├─── COMMIT
     │    │
     │    └─── return readNode(primaryId)
     │
     └─── If any fail:
          │
          ├─── ROLLBACK  (both updates are undone)
          │
          └─── throw error
```

## Taxonomy Initialization Flow

```
getSegments()
     │
     ├─── Check if segments exist
     │
     └─── If empty:
          │
          ▼
     withTransaction()
          │
          ├─── BEGIN TRANSACTION
          │
          ├─── For each DEFAULT_SEGMENT:
          │    │
          │    └─── INSERT INTO segments (id, name, code, color)
          │         VALUES (?, ?, ?, ?)
          │
          ├─── If all succeed:
          │    │
          │    ├─── COMMIT
          │    │
          │    └─── return SELECT * FROM segments
          │
          └─── If any fail:
               │
               ├─── ROLLBACK  (no segments created)
               │
               └─── throw error
```

## Migration Execution Flow

```
runPendingMigrations(db)
     │
     ├─── For each pending migration:
     │    │
     │    ▼
     │    withTransaction() via db.transaction()
     │         │
     │         ├─── BEGIN TRANSACTION
     │         │
     │         ├─── migration.up(db)
     │         │    (e.g., CREATE TABLE, ALTER TABLE, etc.)
     │         │
     │         ├─── INSERT INTO _migrations (name)
     │         │    VALUES (?)
     │         │
     │         ├─── If both succeed:
     │         │    │
     │         │    ├─── COMMIT
     │         │    │
     │         │    └─── Log success
     │         │
     │         └─── If either fails:
     │              │
     │              ├─── ROLLBACK
     │              │    (schema changes undone, migration not recorded)
     │              │
     │              └─── throw error (stop processing remaining migrations)
     │
     └─── Return list of applied migrations
```

## Transaction Decision Tree

```
Do you need to perform a database operation?
     │
     ├─── Is it a READ operation?
     │    │
     │    └─── NO TRANSACTION NEEDED
     │         (SQLite provides consistent reads)
     │
     ├─── Is it a SINGLE write operation?
     │    │
     │    └─── NO TRANSACTION NEEDED
     │         (Single operations are atomic by default)
     │
     └─── Is it MULTIPLE write operations that must be atomic?
          │
          ├─── Are you calling a function that already uses transactions?
          │    │
          │    └─── YES: Perform DIRECT DB operations
          │         (Avoid nested transactions!)
          │
          └─── NO: Use withTransaction()
               │
               ├─── INSERT to multiple tables?
               │    └─── USE TRANSACTION
               │
               ├─── UPDATE + DELETE?
               │    └─── USE TRANSACTION
               │
               ├─── Bulk inserts/updates?
               │    └─── USE TRANSACTION
               │
               └─── Merge/archive operations?
                    └─── USE TRANSACTION
```

## Error Handling Flow

```
Try to execute operation
     │
     ▼
withTransaction(() => {
     │
     ├─── Operation 1: SUCCESS
     │
     ├─── Operation 2: SUCCESS
     │
     └─── Operation 3: ERROR!
          │
          ▼
     Exception thrown
})
     │
     ▼
better-sqlite3 catches error
     │
     ├─── ROLLBACK all operations
     │    (Operation 1 and 2 are undone)
     │
     └─── Re-throw error
          │
          ▼
     Application catches error
          │
          └─── Handle/log error
```

## Nested Transaction Problem (AVOID)

```
❌ BAD PATTERN:

withTransaction(() => {
     │
     ├─── BEGIN TRANSACTION (Outer)
     │
     ├─── Some operations...
     │
     └─── createNode(data)
          │
          └─── withTransaction(() => {
               │
               ├─── BEGIN TRANSACTION (Inner) ← PROBLEM!
               │
               └─── ... operations will fail or behave unexpectedly
          })
})
```

## Correct Pattern for Complex Operations

```
✅ GOOD PATTERN:

withTransaction(() => {
     │
     ├─── BEGIN TRANSACTION (Single)
     │
     ├─── Direct DB operation: INSERT INTO nodes ...
     │
     ├─── Direct DB operation: INSERT INTO key_concepts ...
     │
     ├─── Direct DB operation: UPDATE other_table ...
     │
     └─── COMMIT
})
```

## Real-World Example: Bulk Node Creation

### ❌ WRONG: Multiple Transactions

```
export function bulkCreateNodes(nodes: CreateNodeInput[]): any[] {
  const results = [];
  for (const nodeData of nodes) {
    results.push(createNode(nodeData)); // Each call starts new transaction
  }
  return results;
}

Flow:
  Transaction 1: Create Node A ──► COMMIT
  Transaction 2: Create Node B ──► COMMIT
  Transaction 3: Create Node C ──► ERROR ──► ROLLBACK

Result: Nodes A and B exist, Node C doesn't (INCONSISTENT!)
```

### ✅ CORRECT: Single Transaction

```
export function bulkCreateNodes(nodes: CreateNodeInput[]): any[] {
  return withTransaction(() => {
    const results = [];
    const nodeStmt = db.prepare('INSERT INTO nodes ...');
    const conceptStmt = db.prepare('INSERT INTO key_concepts ...');

    for (const nodeData of nodes) {
      // Direct DB operations
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

Flow:
  BEGIN TRANSACTION
  Insert Node A ──► OK
  Insert Node B ──► OK
  Insert Node C ──► ERROR
  ROLLBACK (All operations undone)

Result: No nodes created (CONSISTENT!)
```

## Performance Impact

### Without Transaction (Multiple Operations)

```
Time: ─────────────────────────────────────────────────►

Operation 1: [BEGIN] [EXECUTE] [COMMIT]
                                          Lock overhead
Operation 2:                              [BEGIN] [EXECUTE] [COMMIT]
                                                                       Lock overhead
Operation 3:                                                           [BEGIN] [EXECUTE] [COMMIT]

Total Time = 3 × (lock acquisition + execution + lock release)
```

### With Transaction (Single)

```
Time: ─────────────────────────────────────────────────►

[BEGIN] [OP1] [OP2] [OP3] [COMMIT]
        │     │     │
        └─────┴─────┴──── All executed under single lock

Total Time = 1 × (lock acquisition + all executions + lock release)
```

## Summary

### Key Principles

1. **Atomicity**: All operations succeed or all fail
2. **Consistency**: Database is never in a half-updated state
3. **Isolation**: Operations are isolated from concurrent operations
4. **No Nesting**: Never nest transactions in better-sqlite3

### Current Usage

| Module | Function | Purpose | Operations |
|--------|----------|---------|------------|
| nodes.ts | createNode | Create node + concepts | INSERT nodes, INSERT key_concepts |
| nodes.ts | updateNode | Update node + concepts | UPDATE nodes, DELETE + INSERT key_concepts |
| nodes.ts | mergeNodes | Merge two nodes | UPDATE primary, UPDATE secondary (soft-delete) |
| taxonomy.ts | getSegments | Initialize segments | Bulk INSERT segments |
| taxonomy.ts | getOrganizations | Initialize organizations | Bulk INSERT organizations |
| migrations/runner.ts | runPendingMigrations | Apply migration | Migration SQL + INSERT _migrations |
| migrations/runner.ts | rollbackMigration | Rollback migration | Rollback SQL + DELETE _migrations |

### Testing Checklist

When adding new transactional operations:

- [ ] Test successful execution (all operations commit)
- [ ] Test failure rollback (all operations undo)
- [ ] Verify no nested transactions
- [ ] Check performance impact for bulk operations
- [ ] Ensure error messages are clear
- [ ] Document the transaction in this guide
