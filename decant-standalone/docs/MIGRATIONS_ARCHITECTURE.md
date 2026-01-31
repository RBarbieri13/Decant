# Database Migration System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Decant Application                          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Application Startup                      │  │
│  │                         │                                 │  │
│  │                         ▼                                 │  │
│  │              initializeDatabase()                        │  │
│  │                  (schema.ts)                             │  │
│  │                         │                                 │  │
│  │                         ▼                                 │  │
│  │           ┌─────────────────────────────┐                │  │
│  │           │  runPendingMigrations()     │                │  │
│  │           │     (runner.ts)             │                │  │
│  │           └─────────────────────────────┘                │  │
│  │                         │                                 │  │
│  │          ┌──────────────┼──────────────┐                 │  │
│  │          ▼              ▼              ▼                 │  │
│  │    migration001   migration002   migration003            │  │
│  │     (initial)     (indexes)      (tree indexes)          │  │
│  │          │              │              │                 │  │
│  │          └──────────────┴──────────────┘                 │  │
│  │                         │                                 │  │
│  │                         ▼                                 │  │
│  │              ┌──────────────────┐                        │  │
│  │              │  SQLite Database │                        │  │
│  │              │   decant.db      │                        │  │
│  │              └──────────────────┘                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Developer CLI                           │  │
│  │                         │                                 │  │
│  │          ┌──────────────┼──────────────┐                 │  │
│  │          ▼              ▼              ▼                 │  │
│  │       status          up            down                 │  │
│  │          │              │              │                 │  │
│  │          └──────────────┴──────────────┘                 │  │
│  │                         │                                 │  │
│  │                         ▼                                 │  │
│  │              Migration Runner API                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Migration System                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────┐    ┌────────────────┐    ┌──────────┐ │
│  │   types.ts     │───▶│   runner.ts    │◀───│  cli.ts  │ │
│  │                │    │                │    │          │ │
│  │  - Migration   │    │  Core Engine:  │    │ Commands:│ │
│  │  - Record      │    │  - execute     │    │  - status│ │
│  │  - Status      │    │  - rollback    │    │  - up    │ │
│  └────────────────┘    │  - track       │    │  - down  │ │
│                        └────────────────┘    │  - create│ │
│                                 │            └──────────┘ │
│                                 │                         │
│                                 ▼                         │
│                    ┌─────────────────────┐               │
│                    │  Migration Files    │               │
│                    ├─────────────────────┤               │
│                    │  001_initial_schema │               │
│                    │  002_add_indexes    │               │
│                    │  003_add_tree_idx   │               │
│                    └─────────────────────┘               │
│                                 │                         │
│                                 ▼                         │
│                    ┌─────────────────────┐               │
│                    │  SQLite Database    │               │
│                    │                     │               │
│                    │  ┌───────────────┐  │               │
│                    │  │  _migrations  │  │               │
│                    │  │   tracking    │  │               │
│                    │  └───────────────┘  │               │
│                    │  ┌───────────────┐  │               │
│                    │  │  Application  │  │               │
│                    │  │    Tables     │  │               │
│                    │  └───────────────┘  │               │
│                    └─────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

## Migration Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Migration Execution                          │
└─────────────────────────────────────────────────────────────────┘

Start
  │
  ▼
┌─────────────────────────┐
│ ensureMigrationsTable() │  Creates _migrations table if needed
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  getAppliedMigrations() │  Query _migrations table
└────────────┬────────────┘  Return: ['001_initial_schema', '002_add_indexes']
             │
             ▼
┌─────────────────────────┐
│ getPendingMigrations()  │  Filter migrations array
└────────────┬────────────┘  Return: [migration003]
             │
             ▼
         ┌───────┐
         │ Loop  │  For each pending migration
         └───┬───┘
             │
             ▼
    ┌────────────────┐
    │ Begin Transaction│
    └────────┬─────────┘
             │
             ▼
    ┌────────────────┐
    │ migration.up() │  Execute SQL changes
    └────────┬───────┘
             │
             │  Success?
             │
      ┌──────┴──────┐
      │             │
     Yes           No
      │             │
      ▼             ▼
┌──────────────┐  ┌──────────────┐
│ recordMigr() │  │   Rollback   │
│ in _migr.    │  │  Transaction │
└──────┬───────┘  └──────┬───────┘
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│   Commit     │  │  Throw Error │
│ Transaction  │  │   & Stop     │
└──────┬───────┘  └──────────────┘
       │
       ▼
   Next migration
       │
       ▼
     Done
```

## Transaction Wrapping

```
┌─────────────────────────────────────────────────────────┐
│              Transaction Safety Model                   │
└─────────────────────────────────────────────────────────┘

Migration Execution:

┌───────────────────────────────────────────────────────┐
│ const runMigration = db.transaction(() => {          │
│                                                       │
│   ┌─────────────────────────────────────────────┐   │
│   │     Database Changes (migration.up())       │   │
│   │                                             │   │
│   │  CREATE TABLE ...                           │   │
│   │  CREATE INDEX ...                           │   │
│   │  ALTER TABLE ...                            │   │
│   │  INSERT INTO ...                            │   │
│   └─────────────────────────────────────────────┘   │
│                                                       │
│   ┌─────────────────────────────────────────────┐   │
│   │  Track Migration (recordMigration())        │   │
│   │                                             │   │
│   │  INSERT INTO _migrations (name) VALUES (?); │   │
│   └─────────────────────────────────────────────┘   │
│                                                       │
│ });                                                   │
└───────────────────────────────────────────────────────┘
                        │
                        ▼
                  Try Execute
                        │
           ┌────────────┴────────────┐
           │                         │
        Success                   Failure
           │                         │
           ▼                         ▼
      ┌─────────┐              ┌─────────┐
      │ COMMIT  │              │ROLLBACK │
      │  ALL    │              │   ALL   │
      │ CHANGES │              │ CHANGES │
      └─────────┘              └─────────┘
           │                         │
           ▼                         ▼
    ┌──────────┐              ┌──────────┐
    │Migration │              │Migration │
    │ RECORDED │              │    NOT   │
    │in _migr. │              │ RECORDED │
    └──────────┘              └──────────┘
```

## Rollback Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Rollback Execution                           │
└─────────────────────────────────────────────────────────────────┘

rollbackMigration(db, '003_add_tree_indexes')
  │
  ▼
┌──────────────────────────┐
│ Find migration by name   │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ Check if applied         │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ Check for dependent migrations       │
│ (migrations applied after this one)  │
└────────────┬─────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
Dependencies?        No
    │                 │
   Yes                │
    │                 │
    ▼                 ▼
┌────────────┐  ┌──────────────┐
│   Throw    │  │Begin Transaction│
│   Error    │  └────────┬───────┘
└────────────┘           │
                         ▼
                ┌────────────────┐
                │migration.down()│  Undo changes
                └────────┬───────┘
                         │
                         ▼
                ┌────────────────┐
                │ Remove from    │
                │  _migrations   │
                └────────┬───────┘
                         │
                         ▼
                ┌────────────────┐
                │     Commit     │
                └────────┬───────┘
                         │
                         ▼
                       Done
```

## Migration Registry Pattern

```
┌─────────────────────────────────────────────────────────┐
│                    runner.ts                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  // Import migrations                                   │
│  import migration001 from './001_initial_schema.js';    │
│  import migration002 from './002_add_indexes.js';       │
│  import migration003 from './003_add_tree_indexes.js';  │
│                                                         │
│  // Register in array (ORDER MATTERS!)                  │
│  export const migrations: Migration[] = [              │
│    migration001,  ◀─── Must be in sequential order     │
│    migration002,  ◀─── Index determines execution order│
│    migration003,  ◀─── New migrations added at end     │
│  ];                                                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
                        │
                        │ Used by
                        ▼
        ┌───────────────────────────────┐
        │  Migration Execution Engine   │
        ├───────────────────────────────┤
        │  - runPendingMigrations()     │
        │  - rollbackMigration()        │
        │  - getMigrationStatus()       │
        └───────────────────────────────┘
```

## Migration File Structure

```
┌─────────────────────────────────────────────────────────┐
│              001_initial_schema.ts                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  export const name = '001_initial_schema';             │
│                                                         │
│  export function up(db: Database.Database): void {     │
│    // Apply changes                                    │
│    db.exec(`                                           │
│      CREATE TABLE nodes (...);                         │
│      CREATE INDEX idx_nodes_function_parent ...;       │
│    `);                                                 │
│  }                                                     │
│                                                         │
│  export function down(db: Database.Database): void {   │
│    // Undo changes (reverse order!)                    │
│    db.exec(`                                           │
│      DROP INDEX IF EXISTS idx_nodes_function_parent;   │
│      DROP TABLE IF EXISTS nodes;                       │
│    `);                                                 │
│  }                                                     │
│                                                         │
│  const migration: Migration = { name, up, down };      │
│  export default migration;                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Database State Tracking

```
┌─────────────────────────────────────────────────────────┐
│                  _migrations Table                      │
├──────┬───────────────────────────┬──────────────────────┤
│  id  │          name             │     applied_at       │
├──────┼───────────────────────────┼──────────────────────┤
│  1   │  001_initial_schema       │ 2024-01-15 10:30:22  │
│  2   │  002_add_indexes          │ 2024-01-15 10:30:23  │
│  3   │  003_add_tree_indexes     │ 2024-01-15 10:30:24  │
└──────┴───────────────────────────┴──────────────────────┘
            ▲
            │
            │ Queried by getMigrationStatus()
            │
            ▼
┌─────────────────────────────────────────────────────────┐
│              Migration Status Output                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [x] 001_initial_schema  (applied: 2024-01-15 10:30:22)│
│  [x] 002_add_indexes     (applied: 2024-01-15 10:30:23)│
│  [x] 003_add_tree_indexes(applied: 2024-01-15 10:30:24)│
│                                                         │
│  Total: 3 | Applied: 3 | Pending: 0                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## CLI Command Flow

```
┌─────────────────────────────────────────────────────────┐
│                 npm run migrate <cmd>                   │
└────────────────────────┬────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
    ┌────────┐      ┌────────┐      ┌────────┐
    │ status │      │   up   │      │  down  │
    └───┬────┘      └───┬────┘      └───┬────┘
        │               │                │
        ▼               ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│getMigration  │  │runPending    │  │rollback      │
│  Status()    │  │Migrations()  │  │Migration()   │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Display      │  │ Execute      │  │ Undo         │
│ table with   │  │ pending      │  │ specific     │
│ status icons │  │ migrations   │  │ migration    │
└──────────────┘  └──────────────┘  └──────────────┘

        │                │                │
        ▼                ▼                ▼
    ┌────────┐      ┌────────┐      ┌────────┐
    │ create │      │ reset  │      │  help  │
    └───┬────┘      └───┬────┘      └───┬────┘
        │               │                │
        ▼               ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│createMigr.() │  │rollbackAll   │  │showHelp()    │
│              │  │Migrations()  │  │              │
└──────┬───────┘  └──────┬───────┘  └──────────────┘
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ Generate     │  │ Undo ALL     │
│ template     │  │ migrations   │
│ file         │  │ (DANGER!)    │
└──────────────┘  └──────────────┘
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────┐
│               Migration Error Handling                  │
└─────────────────────────────────────────────────────────┘

Migration Execution
       │
       ▼
  Try Execute
       │
       │
    ┌──┴───────────────────┐
    │                      │
 Success                 Error
    │                      │
    ▼                      ▼
┌─────────┐         ┌──────────────┐
│ Commit  │         │   Rollback   │
│ Transaction│      │  Transaction │
└────┬────┘         └──────┬───────┘
     │                     │
     ▼                     ▼
┌─────────┐         ┌──────────────┐
│Migration│         │ Migration    │
│Recorded │         │ NOT Recorded │
└────┬────┘         └──────┬───────┘
     │                     │
     ▼                     ▼
┌─────────┐         ┌──────────────┐
│  Log    │         │  Log Error   │
│ Success │         │   Message    │
└────┬────┘         └──────┬───────┘
     │                     │
     ▼                     ▼
Next Migration      ┌──────────────┐
                    │ Throw Error  │
                    │   & Stop     │
                    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Developer   │
                    │  fixes SQL   │
                    │  in migration│
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Retry with  │
                    │npm run       │
                    │migrate up    │
                    └──────────────┘
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Application Startup                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ getDatabase()    │
                    │ - Open connection│
                    │ - Enable FK      │
                    │ - Enable WAL     │
                    └────────┬─────────┘
                             │
                             ▼
                  ┌────────────────────┐
                  │initializeDatabase()│
                  └────────┬───────────┘
                           │
                           ▼
               ┌─────────────────────────┐
               │ runPendingMigrations()  │
               └────────┬────────────────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
          ▼             ▼             ▼
    ┌─────────┐   ┌─────────┐   ┌─────────┐
    │  001    │   │  002    │   │  003    │
    │ Initial │   │  Index  │   │  Tree   │
    │ Schema  │   │  Perf.  │   │  Index  │
    └────┬────┘   └────┬────┘   └────┬────┘
         │             │             │
         └─────────────┴─────────────┘
                       │
                       ▼
            ┌────────────────────┐
            │  SQLite Database   │
            │                    │
            │  Tables:           │
            │  - nodes           │
            │  - key_concepts    │
            │  - segments        │
            │  - organizations   │
            │  - nodes_fts       │
            │  - _migrations     │
            │                    │
            │  Indexes: 12 total │
            └────────────────────┘
                       │
                       ▼
            ┌────────────────────┐
            │   Application      │
            │   Ready to Serve   │
            └────────────────────┘
```

## Schema Evolution Example

```
┌─────────────────────────────────────────────────────────────────┐
│           Database Schema Evolution Over Time                   │
└─────────────────────────────────────────────────────────────────┘

Version 1 (001_initial_schema):
┌────────────────────────────────────────┐
│  nodes                                 │
├────────────────────────────────────────┤
│  - id (PK)                             │
│  - title                               │
│  - url (UNIQUE)                        │
│  - source_domain                       │
│  - ...                                 │
└────────────────────────────────────────┘
Indexes: 4 basic indexes

                │
                │ Apply migration 002
                ▼

Version 2 (002_add_indexes):
┌────────────────────────────────────────┐
│  nodes (same structure)                │
└────────────────────────────────────────┘
Indexes: 4 basic + 4 performance indexes
         = 8 indexes total

                │
                │ Apply migration 003
                ▼

Version 3 (003_add_tree_indexes):
┌────────────────────────────────────────┐
│  nodes (same structure)                │
└────────────────────────────────────────┘
Indexes: 2 basic (deleted)
         + 4 performance (from 002)
         + 2 composite tree indexes
         + 2 composite deleted+tree
         = 10 indexes total

Note: Indexes upgraded from simple to composite
      for better query optimization
```

## Best Practices Flowchart

```
┌─────────────────────────────────────────────────────────────────┐
│            Creating a New Migration - Best Practices            │
└─────────────────────────────────────────────────────────────────┘

Start
  │
  ▼
Is schema change needed?
  │
  ├─ No ──▶ Don't create migration
  │
  └─ Yes
     │
     ▼
Can it be done in existing migration?
  │
  ├─ Yes ──▶ STOP! Don't modify deployed migrations
  │
  └─ No
     │
     ▼
Create new migration:
npm run migrate create <description>
     │
     ▼
Implement up() function
  - Use IF NOT EXISTS
  - Add proper indexes
  - Include comments
     │
     ▼
Implement down() function
  - Reverse changes
  - Use IF EXISTS
  - Proper order (reverse of up)
     │
     ▼
Register in runner.ts
  - Import migration
  - Add to migrations array
     │
     ▼
Test locally:
  - npm run migrate up
  - Verify changes
  - npm run migrate down
  - Verify rollback
  - npm run migrate up
     │
     ▼
Run test suite:
npm test
     │
     ▼
Commit to git
     │
     ▼
Done!
```

## Summary

The migration system provides:

1. **Type Safety**: TypeScript interfaces throughout
2. **Transaction Safety**: Automatic rollback on failure
3. **Version Control**: Sequential execution with tracking
4. **Developer Tools**: CLI for all operations
5. **Testing**: Comprehensive test coverage
6. **Documentation**: Multiple guides and references
7. **Best Practices**: Enforced through architecture
8. **Production Ready**: Battle-tested patterns

All components work together to provide a robust, reliable database migration system.
