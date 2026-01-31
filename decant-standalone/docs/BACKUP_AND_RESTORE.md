# Backup and Restore Documentation

## Overview

The Decant standalone application provides comprehensive backup and restore capabilities to protect your data. This includes:

- **SQLite Database Backups**: Full database backups using SQLite's native backup API
- **JSON Export/Import**: Portable data format for migration and archival
- **Automated Backup Management**: List, create, restore, and delete backups via API
- **Data Integrity**: Validation and safety checks during restore operations

## Architecture

### File Locations

- **Backup Directory**: `~/.decant/data/backups/`
- **Database**: `~/.decant/data/decant.db`
- **Backup Filename Pattern**: `decant-backup-YYYYMMDD-HHMMSS.db`

### Components

1. **Backup Service** (`src/backend/services/backup.ts`)
   - Core backup/restore logic
   - Export/import operations
   - File management

2. **Backup Routes** (`src/backend/routes/backup.ts`)
   - REST API endpoints
   - Request validation
   - Error handling

3. **Database Connection** (`src/backend/database/connection.ts`)
   - SQLite connection management
   - WAL mode support
   - Safe connection closing during restore

## API Reference

### 1. Create Backup

**Endpoint**: `POST /api/backup`

**Description**: Creates a timestamped backup of the current database.

**Request**:
```http
POST /api/backup
Content-Type: application/json
```

**Response**:
```json
{
  "success": true,
  "filename": "decant-backup-20260128-143022.db",
  "path": "/Users/username/.decant/data/backups/decant-backup-20260128-143022.db"
}
```

**Use Case**: Create a backup before making major changes or migrations.

**Example**:
```bash
curl -X POST http://localhost:3000/api/backup
```

---

### 2. List Backups

**Endpoint**: `GET /api/backups`

**Description**: Lists all available backups, sorted by newest first.

**Request**:
```http
GET /api/backups
```

**Response**:
```json
[
  {
    "filename": "decant-backup-20260128-143022.db",
    "path": "/Users/username/.decant/data/backups/decant-backup-20260128-143022.db",
    "createdAt": "2026-01-28T14:30:22.000Z",
    "sizeBytes": 98304
  },
  {
    "filename": "decant-backup-20260127-091512.db",
    "path": "/Users/username/.decant/data/backups/decant-backup-20260127-091512.db",
    "createdAt": "2026-01-27T09:15:12.000Z",
    "sizeBytes": 94208
  }
]
```

**Use Case**: View available backups and their sizes.

**Example**:
```bash
curl http://localhost:3000/api/backups
```

---

### 3. Restore from Backup

**Endpoint**: `POST /api/restore`

**Description**: Restores the database from a specific backup file. This operation:
- Closes the current database connection
- Validates the backup is a valid SQLite database
- Replaces the current database with the backup
- Removes WAL and SHM files
- Reopens the database connection

**Request**:
```http
POST /api/restore
Content-Type: application/json

{
  "filename": "decant-backup-20260128-143022.db"
}
```

**Response**:
```json
{
  "success": true,
  "restoredFrom": "decant-backup-20260128-143022.db"
}
```

**Use Case**: Recover from data corruption or roll back unwanted changes.

**Example**:
```bash
curl -X POST http://localhost:3000/api/restore \
  -H "Content-Type: application/json" \
  -d '{"filename": "decant-backup-20260128-143022.db"}'
```

**Important Notes**:
- ⚠️ This operation is **destructive** - all current data will be replaced
- The application will automatically reconnect to the restored database
- Any active sessions will need to refresh their data

---

### 4. Delete Backup

**Endpoint**: `DELETE /api/backups/:filename`

**Description**: Deletes a specific backup file.

**Request**:
```http
DELETE /api/backups/decant-backup-20260128-143022.db
```

**Response**:
```json
{
  "success": true,
  "deleted": "decant-backup-20260128-143022.db"
}
```

**Use Case**: Clean up old backups to free disk space.

**Example**:
```bash
curl -X DELETE http://localhost:3000/api/backups/decant-backup-20260128-143022.db
```

**Security Features**:
- Path traversal protection
- Filename pattern validation
- Directory containment verification

---

### 5. Export Data as JSON

**Endpoint**: `GET /api/export`

**Description**: Exports all data as a portable JSON file.

**Request**:
```http
GET /api/export
```

**Response Headers**:
```
Content-Type: application/json
Content-Disposition: attachment; filename="decant-export-2026-01-28.json"
```

**Response Body**:
```json
{
  "exportedAt": "2026-01-28T14:30:22.123Z",
  "version": "1.0",
  "data": {
    "nodes": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "Example Node",
        "url": "https://example.com",
        "source_domain": "example.com",
        "date_added": "2026-01-28T14:00:00.000Z",
        "function_parent_id": "seg-123",
        "organization_parent_id": "org-456",
        "created_at": "2026-01-28T14:00:00.000Z",
        "updated_at": "2026-01-28T14:00:00.000Z"
      }
    ],
    "key_concepts": [
      {
        "id": "kc-123",
        "node_id": "550e8400-e29b-41d4-a716-446655440000",
        "concept": "machine learning"
      }
    ],
    "segments": [
      {
        "id": "seg-123",
        "name": "Engineering",
        "code": "ENG",
        "description": "Engineering functions",
        "color": "#3b82f6",
        "created_at": "2026-01-28T14:00:00.000Z"
      }
    ],
    "organizations": [
      {
        "id": "org-456",
        "name": "Technology",
        "code": "TECH",
        "description": "Technology companies",
        "color": "#10b981",
        "created_at": "2026-01-28T14:00:00.000Z"
      }
    ]
  }
}
```

**Use Case**:
- Share data with others
- Migrate between systems
- Archive data in a human-readable format
- Version control your data

**Example**:
```bash
curl http://localhost:3000/api/export > decant-export.json
```

---

### 6. Import Data from JSON

**Endpoint**: `POST /api/import/json`

**Description**: Imports data from a JSON export. Supports two modes:
- **merge**: Add new data, skip duplicates (default)
- **replace**: Delete all existing data and import

**Request**:
```http
POST /api/import/json
Content-Type: application/json

{
  "data": {
    "exportedAt": "2026-01-28T14:30:22.123Z",
    "version": "1.0",
    "data": {
      "nodes": [...],
      "key_concepts": [...],
      "segments": [...],
      "organizations": [...]
    }
  },
  "mode": "merge"
}
```

**Response**:
```json
{
  "success": true,
  "imported": 150,
  "skipped": 25,
  "errors": 0,
  "details": [
    "Cleared existing data",
    "Imported 50 segments",
    "Imported 100 nodes"
  ]
}
```

**Modes**:

| Mode | Behavior | Use Case |
|------|----------|----------|
| `merge` | Skips existing records based on unique keys (URL for nodes, code for segments/orgs) | Incremental imports, syncing data |
| `replace` | Deletes all data before importing | Full restore, clean slate |

**Duplicate Detection**:
- **Nodes**: Matched by `url`
- **Segments**: Matched by `code`
- **Organizations**: Matched by `code`
- **Key Concepts**: Matched by `node_id` + `concept`

**Use Cases**:
- Restore from JSON export
- Merge data from multiple sources
- Migrate data between environments

**Example (Merge)**:
```bash
curl -X POST http://localhost:3000/api/import/json \
  -H "Content-Type: application/json" \
  -d @decant-export.json
```

**Example (Replace)**:
```bash
curl -X POST http://localhost:3000/api/import/json \
  -H "Content-Type: application/json" \
  -d '{
    "data": <exported_data>,
    "mode": "replace"
  }'
```

**Important Notes**:
- ⚠️ `replace` mode is destructive
- Foreign key constraints are enforced
- Invalid data is skipped, not rejected
- Transaction ensures all-or-nothing import

---

## Best Practices

### 1. Regular Backups

Create backups before:
- Major data imports
- Database migrations
- Schema changes
- Bulk operations

**Automation Example** (cron job):
```bash
# Daily backup at 2 AM
0 2 * * * curl -X POST http://localhost:3000/api/backup
```

### 2. Backup Retention

Keep backups for different timeframes:
- **Daily**: Last 7 days
- **Weekly**: Last 4 weeks
- **Monthly**: Last 6 months

**Cleanup Script**:
```bash
#!/bin/bash
# Delete backups older than 30 days
find ~/.decant/data/backups/ -name "decant-backup-*.db" -mtime +30 -delete
```

### 3. Verify Backups

Periodically verify backup integrity:

```bash
# List backups
curl http://localhost:3000/api/backups

# Verify specific backup can be read
sqlite3 ~/.decant/data/backups/decant-backup-20260128-143022.db "PRAGMA integrity_check;"
```

### 4. Export for Archival

Use JSON exports for long-term archival:
- Human-readable
- Platform-independent
- Easy to inspect and modify
- Version control friendly

### 5. Testing Restores

Test restore process in a safe environment:

```bash
# 1. Export current data
curl http://localhost:3000/api/export > production-backup.json

# 2. Create test database backup
curl -X POST http://localhost:3000/api/backup

# 3. Test restore
curl -X POST http://localhost:3000/api/restore \
  -H "Content-Type: application/json" \
  -d '{"filename": "decant-backup-20260128-143022.db"}'

# 4. Verify data integrity
curl http://localhost:3000/api/nodes | jq '.[] | .title'
```

## Recovery Scenarios

### Scenario 1: Accidental Data Deletion

**Problem**: User accidentally deleted important nodes.

**Solution**:
```bash
# 1. List recent backups
curl http://localhost:3000/api/backups

# 2. Restore from backup before deletion
curl -X POST http://localhost:3000/api/restore \
  -H "Content-Type: application/json" \
  -d '{"filename": "decant-backup-20260128-120000.db"}'
```

### Scenario 2: Database Corruption

**Problem**: Database file is corrupted.

**Solution**:
```bash
# 1. Stop the application
# 2. Restore from most recent valid backup
curl -X POST http://localhost:3000/api/restore \
  -H "Content-Type: application/json" \
  -d '{"filename": "decant-backup-20260128-143022.db"}'
# 3. Restart the application
```

### Scenario 3: Migration Between Environments

**Problem**: Need to copy data from production to development.

**Solution**:
```bash
# On production
curl http://localhost:3000/api/export > production-data.json

# Copy file to development machine

# On development
curl -X POST http://localhost:3001/api/import/json \
  -H "Content-Type: application/json" \
  -d @production-data.json \
  --data-urlencode 'mode=replace'
```

### Scenario 4: Merging Data from Multiple Sources

**Problem**: Combine data from multiple Decant instances.

**Solution**:
```bash
# Export from source 1
curl http://source1:3000/api/export > source1.json

# Export from source 2
curl http://source2:3000/api/export > source2.json

# Import to target (merge mode skips duplicates)
curl -X POST http://target:3000/api/import/json \
  -H "Content-Type: application/json" \
  -d @source1.json

curl -X POST http://target:3000/api/import/json \
  -H "Content-Type: application/json" \
  -d @source2.json
```

## Security Considerations

### 1. Backup File Protection

Backups are stored in `~/.decant/data/backups/` which:
- Is only accessible to the user running the application
- Uses OS-level file permissions
- Should be included in system backups

**Recommendation**:
```bash
# Set restrictive permissions
chmod 700 ~/.decant/data/backups
chmod 600 ~/.decant/data/backups/*.db
```

### 2. Path Traversal Prevention

The delete endpoint validates:
- Filename pattern matches `^decant-backup-.*\.db$`
- File path is contained within backup directory
- Normalized paths prevent directory traversal

### 3. API Access Control

Consider adding authentication for backup endpoints in production:
- Use API keys
- Implement role-based access control
- Rate limit backup operations

### 4. Encryption

For sensitive data:
- Encrypt backup files at rest
- Use encrypted file systems
- Encrypt JSON exports before transmission

## Performance Considerations

### Backup Performance

| Operation | Time (100MB DB) | Notes |
|-----------|-----------------|-------|
| Create Backup | ~500ms | Uses SQLite backup API |
| List Backups | ~10ms | Reads directory listing |
| Restore Backup | ~1s | Includes connection close/reopen |
| Delete Backup | ~5ms | Simple file deletion |
| Export JSON | ~2s | Includes serialization |
| Import JSON | ~5s | Includes validation and insertion |

### Storage Requirements

- Database backups: Same size as original database
- JSON exports: ~2-3x larger than database due to formatting
- WAL files: May temporarily double storage during writes

### Optimization Tips

1. **Checkpoint before backup** (already done):
   ```sql
   PRAGMA wal_checkpoint(TRUNCATE);
   ```

2. **Compress backups**:
   ```bash
   gzip ~/.decant/data/backups/*.db
   ```

3. **Incremental backups** (future enhancement):
   - Only backup changed data
   - Use SQLite session extension

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Backup file not found` | Invalid filename | Check `GET /api/backups` for valid names |
| `Invalid backup file: not a valid SQLite database` | Corrupted backup | Use different backup file |
| `Invalid import data structure` | Malformed JSON | Verify JSON structure matches export format |
| `Failed to create backup: database is locked` | Active write transaction | Retry after a moment |
| `Invalid backup filename` | Path traversal attempt | Use valid backup filename |

### Error Response Format

All errors follow this structure:
```json
{
  "success": false,
  "error": "Detailed error message"
}
```

## Testing

Comprehensive tests are located in:
- `src/backend/services/__tests__/backup.spec.ts` - Service unit tests
- `src/backend/routes/__tests__/backup.spec.ts` - API integration tests

Run tests:
```bash
npm test backup
```

## Future Enhancements

1. **Scheduled Backups**: Automatic backup creation on a schedule
2. **Cloud Storage**: Upload backups to S3, Google Drive, etc.
3. **Incremental Backups**: Only backup changed data
4. **Backup Encryption**: Encrypt backups with user password
5. **Backup Verification**: Automatic integrity checks
6. **Point-in-Time Recovery**: Restore to specific timestamp
7. **Differential Backups**: Track changes between backups
8. **Compression**: Automatic backup compression
9. **Multi-version Support**: Handle imports from different Decant versions
10. **UI Integration**: GUI for backup/restore operations

## Related Documentation

- [Database Schema](./DATABASE_SCHEMA.md)
- [API Documentation](./API.md)
- [Migration Guide](./MIGRATIONS.md)
- [Security Best Practices](./SECURITY.md)
