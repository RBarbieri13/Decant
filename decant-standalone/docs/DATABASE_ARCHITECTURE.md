# Database Architecture

## Overview

Decant uses SQLite as its database engine, providing a lightweight, serverless, and self-contained data storage solution. The database architecture is designed for:

- **Dual Hierarchy Organization**: Functional and organizational taxonomies
- **Full-Text Search**: Fast content discovery
- **Migration Management**: Versioned schema evolution
- **Transaction Safety**: ACID compliance
- **Performance**: Strategic indexing and query optimization

## Database Location

**Development:**
```
~/.decant/data/decant.db
```

**Configuration:**
- **Journal Mode**: WAL (Write-Ahead Logging) for better concurrency
- **Foreign Keys**: Enabled for referential integrity
- **Connection**: Singleton pattern with connection pooling

## Schema Overview

### Core Tables

#### nodes
The central table storing all collected items.

```sql
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,                    -- UUID
  title TEXT NOT NULL,                    -- Item title
  url TEXT NOT NULL UNIQUE,               -- Source URL (unique)
  source_domain TEXT NOT NULL,            -- Domain for filtering
  date_added DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Content fields
  company TEXT,                           -- Company/organization name
  phrase_description TEXT,                -- One-liner description
  short_description TEXT,                 -- Brief summary
  logo_url TEXT,                          -- Logo image URL
  ai_summary TEXT,                        -- AI-generated summary

  -- Structured data
  extracted_fields JSON,                  -- Custom extracted data
  metadata_tags JSON DEFAULT '[]',        -- Flexible tagging

  -- Hierarchy relationships
  function_parent_id TEXT,                -- Functional taxonomy parent
  organization_parent_id TEXT,            -- Organizational taxonomy parent

  -- Status
  is_deleted INTEGER DEFAULT 0,           -- Soft delete flag

  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_nodes_function_parent`: Function hierarchy lookups
- `idx_nodes_organization_parent`: Organization hierarchy lookups
- `idx_nodes_deleted`: Filter deleted items
- `idx_nodes_source_domain`: Filter by domain
- `idx_nodes_company`: Group by company
- `idx_nodes_date_added`: Chronological sorting
- `idx_nodes_updated_at`: Recently modified queries

#### key_concepts
Extracted concepts from nodes for semantic search and categorization.

```sql
CREATE TABLE key_concepts (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  concept TEXT NOT NULL,
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
  UNIQUE(node_id, concept)
);
```

**Indexes:**
- `idx_key_concepts_node`: Node lookups

#### segments
Functional taxonomy (e.g., HR, Finance, Engineering).

```sql
CREATE TABLE segments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,                       -- Short code (e.g., "HR", "FIN")
  description TEXT,
  color TEXT,                             -- UI color coding
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### organizations
Organizational hierarchy (e.g., divisions, departments).

```sql
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,                       -- Short code
  description TEXT,
  color TEXT,                             -- UI color coding
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Virtual Tables

#### nodes_fts
Full-text search index using SQLite FTS5.

```sql
CREATE VIRTUAL TABLE nodes_fts USING fts5(
  title,
  source_domain,
  company,
  phrase_description,
  short_description,
  ai_summary,
  content='nodes',
  content_rowid='rowid'
);
```

**Features:**
- Fast full-text search across content fields
- Automatically synchronized with nodes table
- Supports ranking and snippets

### System Tables

#### _migrations
Tracks applied database migrations.

```sql
CREATE TABLE _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Purpose:**
- Migration version control
- Prevents duplicate execution
- Audit trail of schema changes

## Data Model

### Entity Relationships

```
┌─────────────┐
│  segments   │
└──────┬──────┘
       │ 1
       │
       │ N
┌──────┴────────────────────┐
│        nodes              │
│  ┌──────────────────────┐ │
│  │ function_parent_id   │─┼──┐ Self-referencing
│  │ organization_parent  │─┼──┘ for hierarchies
│  └──────────────────────┘ │
└──────┬────────────────────┘
       │ 1
       │
       │ N
┌──────┴──────┐
│key_concepts │
└─────────────┘

┌──────────────┐
│organizations │
└──────┬───────┘
       │ 1
       │
       │ N
       └──────(same nodes table)
```

### Hierarchy Model

Nodes support two independent hierarchies:

1. **Functional Hierarchy** (via `function_parent_id`)
   - Based on business function (HR, Engineering, etc.)
   - Linked to `segments` table
   - Allows categorizing tools/resources by purpose

2. **Organizational Hierarchy** (via `organization_parent_id`)
   - Based on org structure (divisions, teams, etc.)
   - Linked to `organizations` table
   - Allows categorizing by ownership/responsibility

**Example:**
```
Node: "Employee Onboarding Portal"
├─ function_parent_id: "HR Tools" (segment)
└─ organization_parent_id: "Corporate HR" (organization)
```

## Data Types

### JSON Fields

**extracted_fields**: Flexible storage for custom data
```json
{
  "pricing": "Free tier available",
  "platform": "Web, iOS, Android",
  "integration": ["Slack", "Teams"]
}
```

**metadata_tags**: Array of tags
```json
["saas", "productivity", "collaboration"]
```

## Indexes Strategy

### Primary Indexes (from 001_initial_schema)

1. **Hierarchy Lookups**
   - `idx_nodes_function_parent`: Find children in functional hierarchy
   - `idx_nodes_organization_parent`: Find children in org hierarchy

2. **Status Filtering**
   - `idx_nodes_deleted`: Exclude deleted items efficiently

3. **Concept Lookups**
   - `idx_key_concepts_node`: Find concepts for a node

### Performance Indexes (from 002_add_indexes)

1. **Domain Filtering**
   - `idx_nodes_source_domain`: Filter by source domain

2. **Company Grouping**
   - `idx_nodes_company`: Group/filter by company

3. **Temporal Sorting**
   - `idx_nodes_date_added`: Chronological ordering
   - `idx_nodes_updated_at`: Recently modified queries

### Index Selection Guidelines

**When to add an index:**
- Column used in WHERE clauses frequently
- Column used in JOIN conditions
- Column used for sorting (ORDER BY)
- Column used for grouping (GROUP BY)

**When NOT to add an index:**
- Low cardinality columns (e.g., boolean flags)
- Columns rarely queried
- Small tables (< 1000 rows)
- Write-heavy tables (indexes slow down INSERT/UPDATE)

## Query Patterns

### Common Queries

**Get all nodes in a functional segment:**
```sql
SELECT * FROM nodes
WHERE function_parent_id = ?
  AND is_deleted = 0
ORDER BY date_added DESC;
```
*Uses: idx_nodes_function_parent, idx_nodes_deleted*

**Full-text search:**
```sql
SELECT n.*, fts.rank
FROM nodes_fts fts
JOIN nodes n ON n.rowid = fts.rowid
WHERE nodes_fts MATCH ?
ORDER BY rank;
```
*Uses: nodes_fts (FTS5 index)*

**Recently added nodes:**
```sql
SELECT * FROM nodes
WHERE is_deleted = 0
ORDER BY date_added DESC
LIMIT 50;
```
*Uses: idx_nodes_date_added*

**Filter by company and domain:**
```sql
SELECT * FROM nodes
WHERE company = ?
  AND source_domain = ?
  AND is_deleted = 0;
```
*Uses: idx_nodes_company, idx_nodes_source_domain*

### Query Optimization

**EXPLAIN QUERY PLAN** usage:
```sql
EXPLAIN QUERY PLAN
SELECT * FROM nodes WHERE function_parent_id = ?;
```

Look for:
- `SEARCH` (good - using index)
- `SCAN` (bad - full table scan)
- `USING INDEX` (good - index used)

## Transaction Model

### ACID Properties

**Atomicity**: All-or-nothing execution
```typescript
db.transaction(() => {
  createNode(data);
  createKeyConcepts(data.concepts);
  // Both succeed or both fail
})();
```

**Consistency**: Constraints maintained
- Foreign keys enforced
- Unique constraints checked
- NOT NULL validated

**Isolation**: Concurrent access handled
- WAL mode provides better concurrency
- Readers don't block writers
- Writers don't block readers

**Durability**: Changes persisted
- WAL checkpointing
- Automatic journaling

### Transaction Helper

```typescript
import { withTransaction } from './database/transaction.js';

const result = withTransaction(() => {
  // Multiple operations in transaction
  const node = createNode(data);
  addKeyConcepts(node.id, concepts);
  return node;
});
```

## Migration System

### Architecture

```
initializeDatabase()
    ↓
runPendingMigrations()
    ↓
├─ ensureMigrationsTable()
├─ getPendingMigrations()
└─ For each pending:
   ├─ Begin transaction
   ├─ Run migration.up(db)
   ├─ Record in _migrations
   └─ Commit transaction
```

### Current Migrations

1. **001_initial_schema**: Core tables and indexes
2. **002_add_indexes**: Performance optimization indexes

### Adding Migrations

See `docs/MIGRATIONS.md` for comprehensive guide.

Quick steps:
```bash
npm run migrate create add_feature
# Edit generated file
# Register in runner.ts
npm run migrate up
```

## Performance Considerations

### Optimization Strategies

1. **Indexing**
   - Strategic indexes on frequently queried columns
   - Composite indexes for common query patterns
   - Regular ANALYZE for query optimizer

2. **Full-Text Search**
   - FTS5 for fast text search
   - Separate virtual table synchronized with content
   - Ranking and highlighting built-in

3. **Connection Management**
   - Singleton connection pattern
   - WAL mode for concurrency
   - Prepared statements for repeated queries

4. **Data Types**
   - TEXT for UUIDs (more readable in queries)
   - INTEGER for booleans (0/1)
   - JSON for flexible fields

### Monitoring

**Query performance:**
```sql
-- Enable query logging
PRAGMA optimize;

-- Check table stats
SELECT * FROM dbstat WHERE name='nodes';

-- Analyze index usage
PRAGMA index_list('nodes');
PRAGMA index_info('idx_nodes_function_parent');
```

**Database size:**
```bash
ls -lh ~/.decant/data/decant.db
sqlite3 ~/.decant/data/decant.db "SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size();"
```

## Backup and Recovery

### Backup Strategies

**Hot backup (database in use):**
```typescript
import { backupDatabase } from './services/backup.js';

const backupPath = await backupDatabase();
// Creates timestamped backup at ~/.decant/backups/
```

**Cold backup (database closed):**
```bash
cp ~/.decant/data/decant.db ~/.decant/backups/decant-$(date +%Y%m%d).db
```

**SQLite backup command:**
```bash
sqlite3 ~/.decant/data/decant.db ".backup ~/.decant/backups/backup.db"
```

### Recovery

**Restore from backup:**
```bash
cp ~/.decant/backups/decant-20240115.db ~/.decant/data/decant.db
```

**Verify integrity:**
```bash
sqlite3 ~/.decant/data/decant.db "PRAGMA integrity_check;"
```

## Security

### SQL Injection Prevention

**Always use prepared statements:**
```typescript
// ✅ SAFE
db.prepare('SELECT * FROM nodes WHERE id = ?').get(userId);

// ❌ UNSAFE
db.prepare(`SELECT * FROM nodes WHERE id = '${userId}'`).get();
```

### Data Validation

**Input validation at API layer:**
```typescript
import { z } from 'zod';

const NodeSchema = z.object({
  title: z.string().min(1).max(500),
  url: z.string().url(),
  source_domain: z.string(),
});

// Validate before database operations
const validData = NodeSchema.parse(input);
```

### Foreign Key Enforcement

```sql
PRAGMA foreign_keys = ON;
```

Enabled by default, prevents orphaned records.

## Database Files

```
~/.decant/data/
├── decant.db           # Main database file
├── decant.db-shm       # Shared memory file (WAL mode)
└── decant.db-wal       # Write-ahead log file

~/.decant/backups/
└── decant-YYYYMMDD-HHMMSS.db  # Timestamped backups
```

## Tooling

### SQLite Browser
```bash
sqlite3 ~/.decant/data/decant.db
```

Common commands:
```sql
.tables                    -- List tables
.schema nodes              -- Show table schema
.indexes nodes             -- Show indexes
.quit                      -- Exit
```

### Database Inspection

**Table info:**
```sql
PRAGMA table_info(nodes);
```

**Index info:**
```sql
PRAGMA index_list(nodes);
PRAGMA index_info(idx_nodes_function_parent);
```

**Foreign keys:**
```sql
PRAGMA foreign_key_list(nodes);
```

**Statistics:**
```sql
SELECT COUNT(*) FROM nodes;
SELECT COUNT(*) FROM nodes WHERE is_deleted = 0;
SELECT source_domain, COUNT(*) FROM nodes GROUP BY source_domain;
```

## Best Practices

### Schema Design

1. **Use UUIDs for IDs** - Better for distributed systems
2. **Soft deletes** - `is_deleted` flag instead of DELETE
3. **Timestamps** - `created_at`, `updated_at` for auditing
4. **JSON for flexibility** - When schema is unclear
5. **Normalize when stable** - Extract to tables when schema is known

### Query Patterns

1. **Use prepared statements** - Security and performance
2. **Index strategically** - Don't over-index
3. **EXPLAIN plans** - Verify index usage
4. **Batch operations** - Use transactions for multiple writes
5. **Pagination** - LIMIT/OFFSET for large result sets

### Maintenance

1. **Regular backups** - Automated daily backups
2. **VACUUM** - Reclaim space periodically
3. **ANALYZE** - Update query optimizer statistics
4. **Monitor size** - Track database growth
5. **Test migrations** - Always test rollback

## Resources

- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [FTS5 Full-Text Search](https://www.sqlite.org/fts5.html)
- [WAL Mode](https://www.sqlite.org/wal.html)
- [Query Planner](https://www.sqlite.org/queryplanner.html)
- [Better-SQLite3 API](https://github.com/WiseLibs/better-sqlite3/wiki/API)

## Related Documentation

- **Migration Guide**: `docs/MIGRATIONS.md`
- **Quick Reference**: `docs/MIGRATIONS_QUICK_REFERENCE.md`
- **API Documentation**: `docs/API.md`
