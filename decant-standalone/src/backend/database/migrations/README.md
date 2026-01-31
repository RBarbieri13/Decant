# Database Migrations

This directory contains the database migration system for Decant.

## Quick Start

```bash
# Check migration status
npm run migrate status

# Apply all pending migrations
npm run migrate up

# Create new migration
npm run migrate create add_feature_name

# Rollback specific migration
npm run migrate down 00X_migration_name
```

## Directory Structure

```
migrations/
├── __tests__/
│   └── runner.spec.ts           # Comprehensive test suite
├── types.ts                      # TypeScript interfaces
├── runner.ts                     # Core migration engine
├── cli.ts                        # Command-line interface
├── index.ts                      # Public exports
├── 001_initial_schema.ts         # Database foundation
├── 002_add_indexes.ts            # Performance indexes
└── README.md                     # This file
```

## Files

### Core System

- **types.ts**: TypeScript interfaces for migrations
  - `Migration`: Interface for migration objects
  - `MigrationRecord`: Database records in `_migrations` table
  - `MigrationStatus`: Status information for display

- **runner.ts**: Migration execution engine
  - `ensureMigrationsTable()`: Creates tracking table
  - `runPendingMigrations()`: Executes unapplied migrations
  - `rollbackMigration()`: Reverses a migration
  - `getMigrationStatus()`: Gets current state
  - `migrations[]`: Registry of all migrations

- **cli.ts**: Command-line interface
  - `status`: Show migration status
  - `up`: Run pending migrations
  - `down <name>`: Rollback migration
  - `reset`: Rollback all (destructive)
  - `create <name>`: Generate new migration file

- **index.ts**: Public API exports for use in application code

### Migration Files

Each migration file follows this pattern:

```typescript
// 00X_description.ts
import type Database from 'better-sqlite3';
import type { Migration } from './types.js';

export const name = '00X_description';

export function up(db: Database.Database): void {
  // SQL to apply changes
  db.exec(`...`);
}

export function down(db: Database.Database): void {
  // SQL to undo changes
  db.exec(`...`);
}

const migration: Migration = { name, up, down };
export default migration;
```

## Current Migrations

### 001_initial_schema.ts
Creates the foundational database schema:

**Tables:**
- `nodes`: Core data storage for collected items
- `key_concepts`: Extracted concepts from nodes
- `segments`: Functional hierarchy (HR, Finance, etc.)
- `organizations`: Organizational hierarchy

**Indexes:**
- `idx_nodes_function_parent`: Function hierarchy lookups
- `idx_nodes_organization_parent`: Organization hierarchy lookups
- `idx_nodes_deleted`: Filtering deleted items
- `idx_key_concepts_node`: Concept lookups

**FTS:**
- `nodes_fts`: Full-text search on node content

### 002_add_indexes.ts
Adds performance optimization indexes:

**Indexes:**
- `idx_nodes_source_domain`: Filter by domain
- `idx_nodes_company`: Filter/group by company
- `idx_nodes_date_added`: Chronological sorting
- `idx_nodes_updated_at`: Recently modified queries

## Creating a New Migration

### Step 1: Generate File
```bash
npm run migrate create add_search_history
```

This creates: `00X_add_search_history.ts` (where X is next number)

### Step 2: Implement
Edit the generated file:

```typescript
import type Database from 'better-sqlite3';
import type { Migration } from './types.js';

export const name = '003_add_search_history';

export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE search_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      query TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_search_history_user
      ON search_history(user_id);
  `);
}

export function down(db: Database.Database): void {
  db.exec(`
    DROP INDEX IF EXISTS idx_search_history_user;
    DROP TABLE IF EXISTS search_history;
  `);
}

const migration: Migration = { name, up, down };
export default migration;
```

### Step 3: Register
In `runner.ts`, add:

```typescript
// Import
import migration003 from './003_add_search_history.js';

// Add to array
export const migrations: Migration[] = [
  migration001,
  migration002,
  migration003,  // <-- Add here
];
```

### Step 4: Test
```bash
npm run migrate status   # Should show pending
npm run migrate up       # Apply migration
npm test                 # Run test suite
npm run migrate down 003_add_search_history  # Test rollback
npm run migrate up       # Re-apply
```

## Best Practices

### DO
✅ Use sequential numbering (001, 002, 003)
✅ Descriptive names (`add_feature`, not `update`)
✅ Always implement both `up()` and `down()`
✅ Use `IF EXISTS` / `IF NOT EXISTS`
✅ Test rollback before committing
✅ Keep migrations focused (one logical change)
✅ Comment complex SQL

### DON'T
❌ Modify deployed migrations
❌ Skip version numbers
❌ Delete old migrations
❌ Mix schema and data changes
❌ Forget to register in `runner.ts`

## Migration Safety

### Transaction Protection
Each migration runs in a transaction:
- Changes are atomic (all-or-nothing)
- Failed migrations roll back automatically
- Migration is not recorded if it fails
- Safe to retry after fixing issues

### Rollback Protection
Can only rollback in reverse order:
```bash
# Must rollback newer migrations first
✅ npm run migrate down 003_latest
✅ npm run migrate down 002_middle
✅ npm run migrate down 001_initial

# Cannot skip migrations
❌ npm run migrate down 002_middle  # Error if 003 still applied
```

### Testing
Comprehensive test suite in `__tests__/runner.spec.ts`:
- Migration execution order
- Rollback functionality
- Transaction safety
- Error handling
- Idempotency

Run tests:
```bash
npm test migrations
```

## Troubleshooting

### Migration Failed
1. Check error message
2. Verify SQL syntax
3. Fix migration file
4. Retry: `npm run migrate up`

### Cannot Rollback
Rollback dependent migrations first:
```bash
npm run migrate status  # See what's applied
npm run migrate down 00X_dependent
npm run migrate down 00X_target
```

### Inconsistent State
Check database directly:
```bash
sqlite3 ~/.decant/data/decant.db
sqlite> SELECT * FROM _migrations;
sqlite> .tables
sqlite> .quit
```

## Documentation

- **Full Guide**: `docs/MIGRATIONS.md`
- **Quick Reference**: `docs/MIGRATIONS_QUICK_REFERENCE.md`
- **Test Suite**: `__tests__/runner.spec.ts`

## Architecture

```
Application Startup
    ↓
initializeDatabase() (schema.ts)
    ↓
runPendingMigrations() (runner.ts)
    ↓
    ├─→ ensureMigrationsTable()
    ├─→ getPendingMigrations()
    ├─→ For each pending migration:
    │   ├─→ Begin transaction
    │   ├─→ Run migration.up(db)
    │   ├─→ Record in _migrations
    │   └─→ Commit transaction
    └─→ Return applied migrations
```

## CLI Usage

```bash
# Show status
npm run migrate status

Migration Status:
=================

[x] 001_initial_schema  (applied: 2024-01-15 10:30:22)
[x] 002_add_indexes     (applied: 2024-01-15 10:30:23)
[ ] 003_add_feature

Total: 3 | Applied: 2 | Pending: 1

# Apply migrations
npm run migrate up

Running pending migrations...

Applied migration: 003_add_feature

Migrations applied successfully!

# Create migration
npm run migrate create add_notifications

Created migration: 004_add_notifications.ts

Don't forget to:
1. Implement the up() and down() functions
2. Add the migration to the imports in runner.ts
3. Add the migration to the migrations array in runner.ts
```

## Integration

### In Application Code

```typescript
import { initializeDatabase } from './database/schema.js';

// Run migrations on startup
initializeDatabase();
```

### Programmatic Control

```typescript
import { getDatabase } from './database/connection.js';
import {
  runPendingMigrations,
  getMigrationStatus,
  rollbackMigration
} from './database/migrations/runner.js';

const db = getDatabase();

// Run pending migrations
const applied = runPendingMigrations(db);
console.log(`Applied ${applied.length} migrations`);

// Check status
const status = getMigrationStatus(db);
const pending = status.filter(s => !s.applied);
console.log(`${pending.length} pending migrations`);

// Rollback specific migration
const success = rollbackMigration(db, '003_add_feature');
if (success) {
  console.log('Rollback successful');
}
```

## Contributing

When adding a migration:
1. Create migration file with `npm run migrate create`
2. Implement both `up()` and `down()` functions
3. Register in `runner.ts`
4. Test locally (apply, rollback, re-apply)
5. Run test suite: `npm test`
6. Commit with descriptive message
7. Document breaking changes in migration comments

## Questions?

- Check `docs/MIGRATIONS.md` for comprehensive guide
- Review `__tests__/runner.spec.ts` for examples
- Inspect existing migrations for patterns
