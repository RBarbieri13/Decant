# Database Migration System Documentation

## Overview

This directory contains comprehensive documentation for the Decant database migration system. The migration system provides versioned schema evolution, transaction safety, and developer-friendly tools for managing database changes.

## Quick Links

### For Developers

- **[Quick Reference](MIGRATIONS_QUICK_REFERENCE.md)** - Commands and patterns for daily use
- **[Full Guide](MIGRATIONS.md)** - Comprehensive migration system guide
- **[Architecture](MIGRATIONS_ARCHITECTURE.md)** - Visual diagrams and flow charts

### For Administrators

- **[Database Architecture](DATABASE_ARCHITECTURE.md)** - Overall database design and schema
- **[Implementation Summary](IMPLEMENTATION_SUMMARY_MIGRATIONS.md)** - Technical details and features

### For New Contributors

1. Start with [Quick Reference](MIGRATIONS_QUICK_REFERENCE.md)
2. Read [Full Guide](MIGRATIONS.md) sections on creating migrations
3. Review [existing migrations](../src/backend/database/migrations/) for examples
4. Check [Architecture](MIGRATIONS_ARCHITECTURE.md) for visual understanding

## Documentation Index

### 1. MIGRATIONS_QUICK_REFERENCE.md
**Purpose**: Quick reference for daily development tasks

**Contents**:
- Common CLI commands
- Migration creation workflow
- Code patterns and templates
- Checklists and debugging tips
- Best practices summary

**When to use**: Daily development, creating migrations, troubleshooting

**Length**: ~250 lines | Reading time: 10 minutes

---

### 2. MIGRATIONS.md
**Purpose**: Comprehensive guide to the migration system

**Contents**:
- System architecture and design
- Complete CLI reference
- Migration creation workflow
- Best practices and patterns
- Testing guide
- Troubleshooting section
- Production deployment
- Examples for all scenarios

**When to use**: Learning the system, reference for complex scenarios, onboarding

**Length**: ~350 lines | Reading time: 25 minutes

---

### 3. MIGRATIONS_ARCHITECTURE.md
**Purpose**: Visual architecture diagrams and flow charts

**Contents**:
- System overview diagrams
- Component architecture
- Execution flow charts
- Transaction wrapping model
- Rollback flow diagrams
- Error handling flows
- Schema evolution examples

**When to use**: Understanding system design, debugging complex issues, presentations

**Length**: ~400 lines | Reading time: 20 minutes

---

### 4. DATABASE_ARCHITECTURE.md
**Purpose**: Overall database design and schema documentation

**Contents**:
- Database location and configuration
- Schema overview (all tables)
- Entity relationships
- Index strategy
- Query patterns
- Performance considerations
- Backup and recovery
- Security practices

**When to use**: Database design questions, optimization, schema understanding

**Length**: ~500 lines | Reading time: 30 minutes

---

### 5. IMPLEMENTATION_SUMMARY_MIGRATIONS.md
**Purpose**: Technical implementation details and task completion

**Contents**:
- Implementation status
- All delivered components
- Architecture details
- Usage examples
- Testing results
- File structure
- Future enhancements

**When to use**: Understanding what was built, technical review, planning future work

**Length**: ~600 lines | Reading time: 35 minutes

---

## Quick Start

### I want to...

#### Create a new migration
```bash
npm run migrate create add_feature_name
# Then edit the generated file
# Register in runner.ts
# Test with: npm run migrate up
```
📖 See: [Quick Reference - Creating a Migration](MIGRATIONS_QUICK_REFERENCE.md#creating-a-migration)

#### Check migration status
```bash
npm run migrate status
```
📖 See: [Quick Reference - Common Commands](MIGRATIONS_QUICK_REFERENCE.md#common-commands)

#### Apply pending migrations
```bash
npm run migrate up
```
📖 See: [Full Guide - Running Migrations](MIGRATIONS.md#running-migrations)

#### Rollback a migration
```bash
npm run migrate down <migration_name>
```
📖 See: [Full Guide - Rollback Strategy](MIGRATIONS.md#rollback-strategy)

#### Understand the architecture
📖 See: [Architecture - System Overview](MIGRATIONS_ARCHITECTURE.md#system-overview)

#### Learn best practices
📖 See: [Full Guide - Best Practices](MIGRATIONS.md#best-practices)

#### Troubleshoot an issue
📖 See: [Full Guide - Troubleshooting](MIGRATIONS.md#troubleshooting)

## File Locations

```
decant-standalone/
├── docs/                                           # Documentation
│   ├── README_MIGRATIONS.md                        # This file
│   ├── MIGRATIONS_QUICK_REFERENCE.md               # Quick reference
│   ├── MIGRATIONS.md                               # Full guide
│   ├── MIGRATIONS_ARCHITECTURE.md                  # Architecture diagrams
│   ├── DATABASE_ARCHITECTURE.md                    # Database design
│   └── IMPLEMENTATION_SUMMARY_MIGRATIONS.md        # Implementation details
│
├── src/backend/database/migrations/                # Migration system
│   ├── __tests__/
│   │   └── runner.spec.ts                         # Test suite
│   ├── README.md                                  # Directory guide
│   ├── types.ts                                   # TypeScript interfaces
│   ├── runner.ts                                  # Core engine
│   ├── cli.ts                                     # CLI interface
│   ├── index.ts                                   # Public exports
│   ├── 001_initial_schema.ts                      # Initial schema
│   ├── 002_add_indexes.ts                         # Performance indexes
│   └── 003_add_tree_indexes.ts                    # Tree optimization
│
└── TASK_4_COMPLETION_SUMMARY.md                    # Task completion report
```

## Common Workflows

### Development Workflow

```bash
# 1. Create migration
npm run migrate create add_search_history

# 2. Edit the generated file
# vim src/backend/database/migrations/00X_add_search_history.ts

# 3. Register in runner.ts
# Add import and append to migrations array

# 4. Test
npm run migrate status   # Check pending
npm run migrate up       # Apply
npm test                 # Run tests

# 5. Test rollback
npm run migrate down 00X_add_search_history
npm run migrate up       # Re-apply

# 6. Commit
git add .
git commit -m "feat: Add search history table"
```

📖 See: [Full Guide - Development Workflow](MIGRATIONS.md#development-workflow)

### Production Deployment

```bash
# Pre-deployment
npm run migrate status

# Deploy (migrations auto-run on startup)
# Or manually:
npm run migrate up

# Verify
npm run migrate status
```

📖 See: [Full Guide - Production Deployment](MIGRATIONS.md#production-deployment)

## Key Concepts

### Migration File Structure

Every migration has three components:

1. **Name**: Unique identifier (e.g., `001_initial_schema`)
2. **up()**: Function to apply changes
3. **down()**: Function to undo changes

```typescript
export const name = '001_initial_schema';

export function up(db: Database.Database): void {
  // Apply changes
  db.exec(`CREATE TABLE ...`);
}

export function down(db: Database.Database): void {
  // Undo changes
  db.exec(`DROP TABLE ...`);
}
```

📖 See: [Architecture - Migration File Structure](MIGRATIONS_ARCHITECTURE.md#migration-file-structure)

### Transaction Safety

Each migration runs in a transaction:
- Changes are atomic (all-or-nothing)
- Automatic rollback on failure
- Migration is not recorded if it fails
- Safe to retry after fixing issues

📖 See: [Architecture - Transaction Wrapping](MIGRATIONS_ARCHITECTURE.md#transaction-wrapping)

### Migration Tracking

The `_migrations` table tracks applied migrations:

```sql
CREATE TABLE _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

📖 See: [Architecture - Database State Tracking](MIGRATIONS_ARCHITECTURE.md#database-state-tracking)

## Current Migrations

### 001_initial_schema
- **Purpose**: Initial database schema
- **Tables**: nodes, key_concepts, segments, organizations
- **Indexes**: Basic hierarchy and filtering indexes
- **FTS**: Full-text search on nodes

### 002_add_indexes
- **Purpose**: Performance optimization
- **Indexes**: source_domain, company, date_added, updated_at
- **Impact**: Improved filtering and sorting queries

### 003_add_tree_indexes
- **Purpose**: Tree query optimization
- **Indexes**: Composite indexes for hierarchy traversal
- **Impact**: Faster parent-child queries with sorting and filtering

📖 See: [Full Guide - Current Migrations](MIGRATIONS.md#current-migrations)

## CLI Commands

```bash
# Show status
npm run migrate status

# Apply pending migrations
npm run migrate up

# Rollback specific migration
npm run migrate down <name>

# Rollback all (DESTRUCTIVE!)
npm run migrate reset

# Create new migration
npm run migrate create <description>

# Show help
npm run migrate help
```

📖 See: [Quick Reference - Common Commands](MIGRATIONS_QUICK_REFERENCE.md#common-commands)

## Testing

Run the comprehensive test suite:

```bash
npm test src/backend/database/migrations/__tests__/runner.spec.ts
```

**Test Coverage**:
- 34 test cases
- All runner functions tested
- Transaction safety verified
- Rollback functionality tested
- Error handling validated

📖 See: [Full Guide - Testing Migrations](MIGRATIONS.md#testing-migrations)

## Best Practices

### DO ✅

- Use sequential numbering (001, 002, 003...)
- Descriptive names (`add_feature`, not `update`)
- Always implement both `up()` and `down()`
- Use `IF EXISTS` / `IF NOT EXISTS`
- Test rollback before committing
- Keep migrations focused (one logical change)
- Comment complex SQL

### DON'T ❌

- Modify deployed migrations
- Skip version numbers
- Delete old migrations
- Mix schema and data changes
- Forget to register in `runner.ts`

📖 See: [Full Guide - Best Practices](MIGRATIONS.md#best-practices)

## Troubleshooting

### Common Issues

**Migration failed**:
1. Check error message
2. Fix SQL in migration file
3. Retry: `npm run migrate up`

**Cannot rollback**:
- Rollback dependent migrations first
- Check: `npm run migrate status`

**Database inconsistent**:
```bash
sqlite3 ~/.decant/data/decant.db "SELECT * FROM _migrations;"
```

📖 See: [Full Guide - Troubleshooting](MIGRATIONS.md#troubleshooting)

## Resources

### Internal Documentation
- [Quick Reference](MIGRATIONS_QUICK_REFERENCE.md)
- [Full Guide](MIGRATIONS.md)
- [Architecture](MIGRATIONS_ARCHITECTURE.md)
- [Database Design](DATABASE_ARCHITECTURE.md)
- [Implementation](IMPLEMENTATION_SUMMARY_MIGRATIONS.md)

### External Resources
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [FTS5 Full-Text Search](https://www.sqlite.org/fts5.html)
- [WAL Mode](https://www.sqlite.org/wal.html)
- [Better-SQLite3 API](https://github.com/WiseLibs/better-sqlite3/wiki/API)

## Getting Help

1. **Check the documentation** (start with Quick Reference)
2. **Review existing migrations** for examples
3. **Run tests** to verify functionality
4. **Inspect database** with sqlite3 CLI
5. **Contact the team** with specific questions

## Contributing

When contributing migrations:

1. Follow the [development workflow](#development-workflow)
2. Read [best practices](MIGRATIONS.md#best-practices)
3. Test thoroughly (apply, rollback, re-apply)
4. Run the test suite
5. Update documentation if needed
6. Submit PR with clear description

## Version History

- **v1.0** - Initial migration system implementation
  - Core infrastructure (types, runner, CLI)
  - Three initial migrations
  - Comprehensive test suite
  - Complete documentation

## License

Part of the Decant project - MIT License

---

**Last Updated**: 2024-01-28

**Maintainer**: Development Team

**Status**: Production Ready ✅
