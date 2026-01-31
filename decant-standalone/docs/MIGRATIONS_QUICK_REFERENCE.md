# Database Migrations - Quick Reference

## Common Commands

```bash
# Check status
npm run migrate status

# Apply all pending migrations
npm run migrate up

# Create new migration
npm run migrate create <description>

# Rollback specific migration
npm run migrate down <migration_name>

# Rollback all (DESTRUCTIVE!)
npm run migrate reset
```

## Creating a Migration

### 1. Generate File
```bash
npm run migrate create add_search_history
```

### 2. Implement Migration
Edit `00X_add_search_history.ts`:

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

### 3. Register Migration
In `runner.ts`:

```typescript
import migration003 from './003_add_search_history.js';

export const migrations: Migration[] = [
  migration001,
  migration002,
  migration003,  // <-- Add here
];
```

### 4. Test
```bash
npm run migrate status   # Should show as pending
npm run migrate up       # Apply migration
npm test                 # Run tests
```

## Migration Patterns

### Add Table
```typescript
export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS table_name (
      id TEXT PRIMARY KEY,
      column1 TEXT NOT NULL,
      column2 INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export function down(db: Database.Database): void {
  db.exec(`DROP TABLE IF EXISTS table_name;`);
}
```

### Add Column
```typescript
export function up(db: Database.Database): void {
  db.exec(`
    ALTER TABLE nodes ADD COLUMN new_column TEXT;
  `);
}

export function down(db: Database.Database): void {
  // SQLite limitation - requires table recreation
  db.exec(`
    PRAGMA foreign_keys=off;

    CREATE TABLE nodes_backup AS SELECT
      id, title, url, source_domain  -- List all original columns
      FROM nodes;

    DROP TABLE nodes;
    ALTER TABLE nodes_backup RENAME TO nodes;

    PRAGMA foreign_keys=on;
  `);
}
```

### Add Index
```typescript
export function up(db: Database.Database): void {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nodes_status
      ON nodes(status);
  `);
}

export function down(db: Database.Database): void {
  db.exec(`DROP INDEX IF EXISTS idx_nodes_status;`);
}
```

### Add Composite Index
```typescript
export function up(db: Database.Database): void {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nodes_parent_date
      ON nodes(function_parent_id, date_added);
  `);
}

export function down(db: Database.Database): void {
  db.exec(`DROP INDEX IF EXISTS idx_nodes_parent_date;`);
}
```

### Rename Table
```typescript
export function up(db: Database.Database): void {
  db.exec(`ALTER TABLE old_name RENAME TO new_name;`);
}

export function down(db: Database.Database): void {
  db.exec(`ALTER TABLE new_name RENAME TO old_name;`);
}
```

### Data Migration
```typescript
export function up(db: Database.Database): void {
  // Add column
  db.exec(`ALTER TABLE nodes ADD COLUMN status TEXT DEFAULT 'active';`);

  // Migrate data
  db.exec(`
    UPDATE nodes
    SET status = CASE
      WHEN is_deleted = 1 THEN 'archived'
      ELSE 'active'
    END;
  `);
}

export function down(db: Database.Database): void {
  // Revert data if needed
  db.exec(`
    UPDATE nodes
    SET is_deleted = CASE
      WHEN status = 'archived' THEN 1
      ELSE 0
    END;
  `);

  // Remove column (requires table recreation in SQLite)
}
```

### Create FTS Table
```typescript
export function up(db: Database.Database): void {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts
    USING fts5(
      title,
      description,
      content='nodes',
      content_rowid='rowid'
    );

    -- Populate FTS table
    INSERT INTO nodes_fts(rowid, title, description)
    SELECT rowid, title, short_description FROM nodes;
  `);
}

export function down(db: Database.Database): void {
  db.exec(`DROP TABLE IF EXISTS nodes_fts;`);
}
```

## Checklist

When creating a migration:

- [ ] Sequential number (check `ls migrations/*.ts`)
- [ ] Descriptive name (verb_noun format)
- [ ] `up()` function implemented
- [ ] `down()` function implemented
- [ ] Uses `IF EXISTS` / `IF NOT EXISTS`
- [ ] Registered in `runner.ts`
- [ ] Tested locally: `npm run migrate up`
- [ ] Tested rollback: `npm run migrate down <name>`
- [ ] Re-tested apply: `npm run migrate up`
- [ ] Tests pass: `npm test`
- [ ] Committed to git

## Rollback Safety

### Safe to Rollback
✅ Adding indexes
✅ Adding optional columns
✅ Creating new tables
✅ Adding constraints (if no data violates them)

### Risky Rollback
⚠️ Data transformations (may lose data)
⚠️ Required columns (data must be preserved)
⚠️ Foreign key changes (data dependencies)

### Never Rollback in Production
❌ Migrations with irreversible data changes
❌ Old migrations (after other teams deployed)

## Debugging

### Check what's applied
```bash
npm run migrate status
```

### Inspect database directly
```bash
sqlite3 ~/.decant/data/decant.db

sqlite> .tables
sqlite> .schema nodes
sqlite> SELECT * FROM _migrations;
sqlite> .quit
```

### See migration history
```bash
sqlite3 ~/.decant/data/decant.db "SELECT * FROM _migrations ORDER BY id;"
```

### Force clean state (DEVELOPMENT ONLY)
```bash
rm ~/.decant/data/decant.db
npm run dev  # Migrations run automatically
```

## Common Errors

### "Migration failed: UNIQUE constraint"
**Cause:** Trying to add UNIQUE constraint with duplicate data
**Fix:** Add data cleanup before constraint, or make column nullable

### "later migrations depend on it"
**Cause:** Trying to rollback a migration with dependent migrations
**Fix:** Rollback dependent migrations first

### "Migration not found"
**Cause:** Typo in migration name or not registered in runner.ts
**Fix:** Check spelling, verify registration

### "table already exists"
**Cause:** Migration run twice or missing `IF NOT EXISTS`
**Fix:** Add `IF NOT EXISTS` to CREATE TABLE statements

## Pro Tips

1. **Keep migrations small and focused** - one logical change per migration
2. **Test rollback immediately** after creating migration
3. **Use descriptive names** - `add_user_authentication` not `update1`
4. **Comment complex SQL** - future you will thank you
5. **Don't modify deployed migrations** - create new migration instead
6. **Backup before production migrations** - especially data migrations
7. **Run migrations in maintenance window** - if they take >1 second
8. **Use transactions** - they're automatic but good to know
9. **Check constraints** - ensure data meets new requirements before adding them
10. **Document breaking changes** - in migration comments and docs

## Migration Lifecycle

```
Development:
  create → implement → register → test → commit

Testing:
  pull → migrate up → run tests → verify

Staging:
  deploy → auto-migrate → smoke test

Production:
  deploy → auto-migrate → monitor → verify
```

## Migration Naming Convention

Format: `NNN_verb_noun.ts`

Examples:
- ✅ `001_initial_schema.ts`
- ✅ `002_add_indexes.ts`
- ✅ `003_add_user_preferences.ts`
- ✅ `004_create_search_history.ts`
- ✅ `005_rename_nodes_to_items.ts`
- ❌ `update.ts`
- ❌ `migration.ts`
- ❌ `new_migration_jan_15.ts`

## Resources

- Full documentation: `docs/MIGRATIONS.md`
- Test examples: `src/backend/database/migrations/__tests__/runner.spec.ts`
- Existing migrations: `src/backend/database/migrations/00X_*.ts`
