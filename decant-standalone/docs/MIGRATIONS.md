# Database Migration System

## Overview

Decant uses a robust database migration system to manage schema changes and database evolution. The system is built on better-sqlite3 and provides:

- **Sequential Execution**: Migrations run in order by numeric prefix
- **Transaction Safety**: Each migration runs in a transaction (automatic rollback on failure)
- **Rollback Support**: All migrations include both `up` and `down` functions
- **Status Tracking**: `_migrations` table tracks which migrations have been applied
- **CLI Interface**: Easy-to-use command-line tools for migration management

## Architecture

### Key Components

1. **Migration Types** (`types.ts`)
   - `Migration`: Interface defining a migration with name, up, and down functions
   - `MigrationRecord`: Database record of applied migrations
   - `MigrationStatus`: Status information for UI/CLI display

2. **Migration Runner** (`runner.ts`)
   - Core logic for executing and tracking migrations
   - Functions: `runPendingMigrations`, `rollbackMigration`, `getMigrationStatus`
   - Maintains migration registry and execution order

3. **Migration Files** (`00X_*.ts`)
   - Individual migration files with sequential numbering
   - Each exports a `Migration` object with `name`, `up()`, and `down()` functions

4. **CLI Tool** (`cli.ts`)
   - Command-line interface for developers and ops teams
   - Commands: `status`, `up`, `down`, `reset`, `create`

5. **Schema Module** (`schema.ts`)
   - Main entry point that calls migration runner
   - `initializeDatabase()`: Idempotent initialization function

## Directory Structure

```
src/backend/database/migrations/
├── __tests__/
│   └── runner.spec.ts          # Comprehensive test suite
├── types.ts                     # TypeScript interfaces
├── runner.ts                    # Core migration logic
├── cli.ts                       # Command-line interface
├── index.ts                     # Public API exports
├── 001_initial_schema.ts        # Initial database schema
├── 002_add_indexes.ts           # Performance indexes
└── 00X_your_migration.ts        # Future migrations
```

## Usage

### Running Migrations

**Apply all pending migrations:**
```bash
npm run migrate up
# or
npm run migrate:up
```

**Check migration status:**
```bash
npm run migrate status
# or
npm run migrate:status
```

**Rollback specific migration:**
```bash
npm run migrate down 002_add_indexes
```

**Rollback all migrations (DESTRUCTIVE):**
```bash
npm run migrate reset
```

### Creating New Migrations

**Generate migration file:**
```bash
npm run migrate create add_user_preferences
# or
npm run migrate:create
# Then provide the migration name when prompted
```

This creates a new file: `00X_add_user_preferences.ts` with a template.

**Migration file template:**
```typescript
import type Database from 'better-sqlite3';
import type { Migration } from './types.js';

export const name = '003_add_user_preferences';

export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE user_preferences (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, key)
    );

    CREATE INDEX idx_user_prefs_user ON user_preferences(user_id);
  `);
}

export function down(db: Database.Database): void {
  db.exec(`
    DROP INDEX IF EXISTS idx_user_prefs_user;
    DROP TABLE IF EXISTS user_preferences;
  `);
}

const migration: Migration = { name, up, down };
export default migration;
```

**Register the migration:**

After creating the migration file, add it to `runner.ts`:

```typescript
// Import the migration
import migration003 from './003_add_user_preferences.js';

// Add to migrations array
export const migrations: Migration[] = [
  migration001,
  migration002,
  migration003,  // <-- Add here
];
```

## Migration Workflow

### Development Workflow

1. **Create migration**
   ```bash
   npm run migrate create add_feature_xyz
   ```

2. **Implement up() and down()**
   - Edit the generated file
   - Add SQL for schema changes in `up()`
   - Add SQL to undo changes in `down()`

3. **Register migration**
   - Import in `runner.ts`
   - Add to `migrations` array

4. **Test migration**
   ```bash
   npm run migrate status    # Check status
   npm run migrate up        # Apply migration
   npm test                  # Run test suite
   ```

5. **Test rollback**
   ```bash
   npm run migrate down 00X_your_migration
   npm run migrate up        # Reapply
   ```

### Production Deployment

1. **Pre-deployment**
   ```bash
   npm run migrate status    # Review pending migrations
   ```

2. **Deploy code** with new migration files

3. **Auto-apply migrations**
   - Migrations run automatically on server start via `initializeDatabase()`
   - Or manually trigger: `npm run migrate up`

4. **Verify**
   ```bash
   npm run migrate status    # Confirm all applied
   ```

## Best Practices

### Writing Migrations

**DO:**
- ✅ Use sequential numbering (001, 002, 003...)
- ✅ Make migrations atomic and focused on one change
- ✅ Always include both `up()` and `down()` functions
- ✅ Test rollback before committing
- ✅ Use `IF EXISTS` / `IF NOT EXISTS` for idempotency
- ✅ Add indexes in separate migrations after initial schema
- ✅ Include comments explaining complex changes

**DON'T:**
- ❌ Modify existing migrations after they're deployed
- ❌ Delete old migrations
- ❌ Skip version numbers
- ❌ Include data migrations in schema migrations (separate them)
- ❌ Use hardcoded values (use variables/constants)

### Example: Adding a Column

```typescript
export function up(db: Database.Database): void {
  db.exec(`
    -- Add email_verified column to users table
    ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;

    -- Add index for quick filtering
    CREATE INDEX idx_users_email_verified ON users(email_verified);
  `);
}

export function down(db: Database.Database): void {
  db.exec(`
    DROP INDEX IF EXISTS idx_users_email_verified;

    -- SQLite doesn't support DROP COLUMN directly
    -- Need to recreate table without the column
    PRAGMA foreign_keys=off;

    CREATE TABLE users_backup AS SELECT
      id, username, email, created_at
      FROM users;

    DROP TABLE users;

    ALTER TABLE users_backup RENAME TO users;

    PRAGMA foreign_keys=on;
  `);
}
```

### Example: Creating an Index

```typescript
export function up(db: Database.Database): void {
  db.exec(`
    -- Composite index for common query pattern
    CREATE INDEX IF NOT EXISTS idx_nodes_function_date
      ON nodes(function_parent_id, date_added);

    -- Covering index for organization queries
    CREATE INDEX IF NOT EXISTS idx_nodes_org_date
      ON nodes(organization_parent_id, date_added);
  `);
}

export function down(db: Database.Database): void {
  db.exec(`
    DROP INDEX IF EXISTS idx_nodes_org_date;
    DROP INDEX IF EXISTS idx_nodes_function_date;
  `);
}
```

### Example: Data Migration

```typescript
export function up(db: Database.Database): void {
  // Add new column
  db.exec(`
    ALTER TABLE nodes ADD COLUMN status TEXT DEFAULT 'active';
  `);

  // Migrate existing data
  db.exec(`
    -- Mark deleted items as archived
    UPDATE nodes SET status = 'archived' WHERE is_deleted = 1;

    -- Mark active items explicitly
    UPDATE nodes SET status = 'active' WHERE is_deleted = 0;
  `);

  // Add constraint
  db.exec(`
    CREATE INDEX idx_nodes_status ON nodes(status);
  `);
}

export function down(db: Database.Database): void {
  db.exec(`
    DROP INDEX IF EXISTS idx_nodes_status;

    -- Cannot easily remove column in SQLite
    -- Would need table recreation (see previous example)
  `);
}
```

## Migration Tracking

### _migrations Table

The system automatically creates and manages a `_migrations` table:

```sql
CREATE TABLE _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Example records:**
```
id | name                 | applied_at
---+---------------------+-------------------
1  | 001_initial_schema  | 2024-01-15 10:30:22
2  | 002_add_indexes     | 2024-01-15 10:30:23
```

### Migration Status Output

```bash
$ npm run migrate status

Migration Status:
=================

[x] 001_initial_schema  (applied: 2024-01-15 10:30:22)
[x] 002_add_indexes     (applied: 2024-01-15 10:30:23)
[ ] 003_add_user_prefs

Total: 3 | Applied: 2 | Pending: 1
```

## Rollback Strategy

### Safe Rollback

Migrations can only be rolled back in reverse order:

```bash
# Must rollback later migrations first
npm run migrate down 003_add_user_prefs   # ✅ Success
npm run migrate down 002_add_indexes      # ✅ Success
npm run migrate down 001_initial_schema   # ✅ Success
```

Attempting to rollback out of order will fail:

```bash
# 003 is still applied
npm run migrate down 002_add_indexes      # ❌ Error: later migrations depend on it
```

### Emergency Rollback

For critical issues, rollback all migrations:

```bash
npm run migrate reset    # ⚠️ DESTRUCTIVE - drops all tables
```

Then reapply up to a safe point:

```bash
npm run migrate up
```

## Transaction Safety

Each migration runs in a transaction:

```typescript
// Automatic transaction wrapper
const runMigration = db.transaction(() => {
  migration.up(db);                    // Apply changes
  recordMigration(db, migration.name); // Track in _migrations
});

runMigration(); // Commits transaction or rolls back on error
```

**Benefits:**
- Changes are atomic (all-or-nothing)
- Failed migrations don't leave partial changes
- Migration is not recorded if it fails
- Safe to retry after fixing issues

## Testing Migrations

### Unit Tests

Run the comprehensive test suite:

```bash
npm test src/backend/database/migrations/__tests__/runner.spec.ts
```

Tests cover:
- Migration execution order
- Rollback functionality
- Transaction safety
- Error handling
- Idempotency
- Schema validation

### Manual Testing

1. **Fresh database test:**
   ```bash
   rm ~/.decant/data/decant.db
   npm run dev
   # Migrations run automatically
   npm run migrate status
   ```

2. **Rollback test:**
   ```bash
   npm run migrate down 00X_your_migration
   # Verify database state
   npm run migrate up
   # Verify reapplication works
   ```

3. **Data preservation test:**
   ```bash
   # Add test data
   # Run migration
   # Verify data intact
   # Rollback migration
   # Verify data still intact
   ```

## Programmatic API

### In Application Code

```typescript
import { initializeDatabase, getDatabaseMigrationStatus } from './database/schema.js';

// Run migrations on startup
initializeDatabase();

// Check migration status
const status = getDatabaseMigrationStatus();
console.log('Applied migrations:', status.filter(m => m.applied).length);
```

### Direct Migration Control

```typescript
import { getDatabase } from './database/connection.js';
import {
  runPendingMigrations,
  getMigrationStatus,
  rollbackMigration
} from './database/migrations/runner.js';

const db = getDatabase();

// Run pending
const applied = runPendingMigrations(db);

// Check status
const status = getMigrationStatus(db);

// Rollback
const success = rollbackMigration(db, '002_add_indexes');
```

## Troubleshooting

### Migration Failed

**Symptom:** Error message during migration

**Solution:**
1. Check error message for SQL syntax issues
2. Verify database is not corrupted: `npm run migrate status`
3. Fix the migration file
4. Retry: `npm run migrate up`

### Migration Stuck

**Symptom:** Migration appears applied but tables missing

**Solution:**
```bash
# Check actual database state
npm run migrate status

# Manual inspection
sqlite3 ~/.decant/data/decant.db
sqlite> .tables
sqlite> SELECT * FROM _migrations;

# If inconsistent, rollback and reapply
npm run migrate down <stuck_migration>
npm run migrate up
```

### Cannot Rollback

**Symptom:** Rollback fails with dependency error

**Solution:**
```bash
# Rollback later migrations first
npm run migrate status
# Identify dependent migrations
npm run migrate down <later_migration>
npm run migrate down <target_migration>
```

### Production Emergency

**Symptom:** Bad migration deployed to production

**Immediate actions:**
1. **Don't panic** - migrations are transactional
2. Check logs: `npm run migrate status`
3. If migration failed, fix is automatic (not applied)
4. If migration succeeded but wrong, rollback:
   ```bash
   npm run migrate down <bad_migration>
   ```
5. Deploy fixed migration
6. Reapply: `npm run migrate up`

## Current Migrations

### 001_initial_schema
- **Purpose**: Initial database schema
- **Tables**: nodes, key_concepts, segments, organizations
- **Indexes**: function_parent, organization_parent, deleted, key_concepts
- **FTS**: Full-text search on nodes table

### 002_add_indexes
- **Purpose**: Performance optimization indexes
- **Indexes**: source_domain, company, date_added, updated_at
- **Impact**: Improves filtering and sorting queries

## Future Considerations

### Planned Features
- [ ] Migration dependencies/prerequisites
- [ ] Reversible data transformations
- [ ] Migration performance profiling
- [ ] Automated backup before migrations
- [ ] Migration hooks (pre/post execution)
- [ ] Dry-run mode for testing

### SQLite Limitations

**Column removal:**
SQLite doesn't support `ALTER TABLE DROP COLUMN` directly. Workarounds:
1. Create new table without column
2. Copy data
3. Drop old table
4. Rename new table

**Column type changes:**
Similar limitation - requires table recreation.

**Best practice:** Design schema carefully to minimize such changes.

## Resources

- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [better-sqlite3 API](https://github.com/WiseLibs/better-sqlite3/wiki/API)
- [Migration Best Practices](https://www.brunton-spall.co.uk/post/2014/05/06/database-migrations-done-right/)

## Support

For questions or issues with migrations:
1. Check this documentation
2. Review test suite for examples
3. Inspect existing migrations for patterns
4. Contact the development team
