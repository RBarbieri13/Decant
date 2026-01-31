# Backup & Restore Quick Reference

## Quick Commands

### Create Backup
```bash
curl -X POST http://localhost:3000/api/backup
```

### List All Backups
```bash
curl http://localhost:3000/api/backups | jq
```

### Restore from Backup
```bash
curl -X POST http://localhost:3000/api/restore \
  -H "Content-Type: application/json" \
  -d '{"filename": "decant-backup-20260128-143022.db"}'
```

### Delete Backup
```bash
curl -X DELETE http://localhost:3000/api/backups/decant-backup-20260128-143022.db
```

### Export Data as JSON
```bash
curl http://localhost:3000/api/export > backup.json
```

### Import Data from JSON (Merge)
```bash
curl -X POST http://localhost:3000/api/import/json \
  -H "Content-Type: application/json" \
  -d @backup.json
```

### Import Data from JSON (Replace)
```bash
curl -X POST http://localhost:3000/api/import/json \
  -H "Content-Type: application/json" \
  -d "{\"data\": $(cat backup.json), \"mode\": \"replace\"}"
```

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/backup` | Create new backup |
| GET | `/api/backups` | List all backups |
| POST | `/api/restore` | Restore from backup |
| DELETE | `/api/backups/:filename` | Delete a backup |
| GET | `/api/export` | Export as JSON |
| POST | `/api/import/json` | Import from JSON |

## File Locations

| Item | Path |
|------|------|
| Database | `~/.decant/data/decant.db` |
| Backups | `~/.decant/data/backups/` |
| Backup Pattern | `decant-backup-YYYYMMDD-HHMMSS.db` |

## Import Modes

| Mode | Behavior |
|------|----------|
| `merge` | Skip duplicates, add new records (default) |
| `replace` | Delete all data, then import |

## Duplicate Detection

| Table | Unique Key |
|-------|------------|
| nodes | `url` |
| segments | `code` |
| organizations | `code` |
| key_concepts | `node_id` + `concept` |

## Common Workflows

### Daily Backup Routine
```bash
# 1. Create backup
curl -X POST http://localhost:3000/api/backup

# 2. List backups to verify
curl http://localhost:3000/api/backups | jq '.[0]'

# 3. Clean old backups (optional)
# Delete backups older than 30 days manually or via script
```

### Disaster Recovery
```bash
# 1. List available backups
curl http://localhost:3000/api/backups | jq '.[] | .filename'

# 2. Restore from most recent backup
curl -X POST http://localhost:3000/api/restore \
  -H "Content-Type: application/json" \
  -d '{"filename": "decant-backup-20260128-143022.db"}'

# 3. Verify data
curl http://localhost:3000/api/nodes | jq 'length'
```

### Data Migration
```bash
# On source system
curl http://localhost:3000/api/export > migration.json

# Transfer file to target system
scp migration.json user@target:/tmp/

# On target system
curl -X POST http://localhost:3001/api/import/json \
  -H "Content-Type: application/json" \
  -d @/tmp/migration.json
```

### Merge Multiple Instances
```bash
# Export from instance 1
curl http://instance1:3000/api/export > instance1.json

# Export from instance 2
curl http://instance2:3000/api/export > instance2.json

# Merge into target
curl -X POST http://target:3000/api/import/json \
  -H "Content-Type: application/json" \
  -d @instance1.json

curl -X POST http://target:3000/api/import/json \
  -H "Content-Type: application/json" \
  -d @instance2.json
```

## Response Examples

### Successful Backup Creation
```json
{
  "success": true,
  "filename": "decant-backup-20260128-143022.db",
  "path": "/Users/username/.decant/data/backups/decant-backup-20260128-143022.db"
}
```

### Backup List
```json
[
  {
    "filename": "decant-backup-20260128-143022.db",
    "path": "/Users/username/.decant/data/backups/decant-backup-20260128-143022.db",
    "createdAt": "2026-01-28T14:30:22.000Z",
    "sizeBytes": 98304
  }
]
```

### Import Summary
```json
{
  "success": true,
  "imported": 150,
  "skipped": 25,
  "errors": 0,
  "details": [
    "Cleared existing data",
    "Imported 2 segments",
    "Imported 2 organizations",
    "Imported 100 nodes",
    "Imported 50 key concepts"
  ]
}
```

### Error Response
```json
{
  "success": false,
  "error": "Backup file not found: invalid-backup.db"
}
```

## Automation Examples

### Cron Job - Daily Backup
```bash
# Add to crontab: crontab -e
0 2 * * * curl -X POST http://localhost:3000/api/backup
```

### Shell Script - Backup with Cleanup
```bash
#!/bin/bash
# backup.sh - Create backup and clean old ones

# Create new backup
echo "Creating backup..."
curl -X POST http://localhost:3000/api/backup

# Delete backups older than 30 days
echo "Cleaning old backups..."
find ~/.decant/data/backups/ -name "decant-backup-*.db" -mtime +30 -delete

echo "Backup complete!"
```

### Shell Script - Backup Before Import
```bash
#!/bin/bash
# safe-import.sh - Backup before importing data

if [ -z "$1" ]; then
  echo "Usage: $0 <import-file.json>"
  exit 1
fi

# Create safety backup
echo "Creating safety backup..."
BACKUP=$(curl -s -X POST http://localhost:3000/api/backup | jq -r '.filename')
echo "Backup created: $BACKUP"

# Import data
echo "Importing data from $1..."
curl -X POST http://localhost:3000/api/import/json \
  -H "Content-Type: application/json" \
  -d @"$1"

echo "Import complete!"
echo "To rollback: curl -X POST http://localhost:3000/api/restore -H 'Content-Type: application/json' -d '{\"filename\": \"$BACKUP\"}'"
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Backup fails with "database is locked" | Wait a moment and retry |
| Restore fails with "Invalid backup file" | Verify backup file is valid SQLite database |
| Import fails with "Invalid import data" | Check JSON structure matches export format |
| Large backups taking too long | Consider using JSON export for specific tables |
| Out of disk space | Delete old backups with `DELETE /api/backups/:filename` |

## Performance Tips

1. **Create backups during low-traffic periods**
2. **Compress old backups**: `gzip ~/.decant/data/backups/*.db`
3. **Use JSON exports for specific data subsets**
4. **Monitor backup directory size**: `du -sh ~/.decant/data/backups/`
5. **Test restore process periodically**

## Security Checklist

- [ ] Restrict backup directory permissions: `chmod 700 ~/.decant/data/backups`
- [ ] Encrypt backups for sensitive data
- [ ] Store backups in multiple locations
- [ ] Use authentication for backup endpoints in production
- [ ] Regularly test restore procedures
- [ ] Keep backup retention policy documented
- [ ] Monitor backup file integrity

## Testing

```bash
# Run all backup tests
npm test backup

# Run specific test file
npm test backup.spec.ts

# Run with coverage
npm run test:coverage -- backup
```

## Related Documentation

- [Full Backup & Restore Guide](./BACKUP_AND_RESTORE.md)
- [API Documentation](./API.md)
- [Database Schema](./DATABASE_SCHEMA.md)
