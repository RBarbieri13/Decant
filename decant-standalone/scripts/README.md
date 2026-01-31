# Decant Scripts

This directory contains utility scripts for testing and managing the Decant application.

## Available Scripts

### test-rate-limits.sh

Tests the rate limiting functionality of the Decant API.

**Usage:**

```bash
# Make the script executable (first time only)
chmod +x scripts/test-rate-limits.sh

# Run the tests (server must be running)
./scripts/test-rate-limits.sh

# Run with verbose output
VERBOSE=1 ./scripts/test-rate-limits.sh

# Test against a different server
API_URL=http://localhost:3000 ./scripts/test-rate-limits.sh
```

**What it tests:**

1. Health check endpoints are NOT rate limited
2. Global rate limiter on API endpoints (100 req/min)
3. Settings rate limiter (5 req/min)
4. Rate limit headers are present
5. Error response format
6. Rate limiter sharing across endpoints

**Prerequisites:**

- Server must be running: `npm run dev`
- `curl` must be installed
- Python 3 (optional, for pretty-printing JSON)

**Example output:**

```
=== Checking Server Status ===
✓ Server is running at http://localhost:3000

=== Test 1: Health Check Endpoint (No Rate Limit) ===
  Making 20 requests to /health endpoint...
✓ All 20 requests succeeded (no rate limiting on health checks)

=== Test 2: Global Rate Limiter (100 req/min on /api/nodes) ===
  Making 10 requests to /api/nodes endpoint...
  Results: 10 succeeded, 0 rate limited
✓ All requests within limit succeeded

...
```

### test-backup-restore.sh

Tests the complete backup and restore functionality of the Decant application.

**Usage:**

```bash
# Make the script executable (first time only)
chmod +x scripts/test-backup-restore.sh

# Run the tests (server must be running)
./scripts/test-backup-restore.sh
```

**What it tests:**

1. Backup creation with timestamped filenames
2. Backup listing with metadata
3. JSON export with complete data
4. Export structure validation
5. JSON import (merge mode)
6. Backup deletion
7. SQLite file validation

**Prerequisites:**

- Server must be running: `npm run dev`
- `curl` must be installed
- `jq` must be installed (for JSON parsing)

**Example output:**

```
============================================================
Decant Backup & Restore Verification
============================================================

[1/8] Checking if server is running...
✓ Server is running

[2/8] Creating backup...
✓ Backup created: decant-backup-20260128-143022.db

[3/8] Listing all backups...
✓ Found 3 backup(s)

[4/8] Exporting data as JSON...
✓ Export successful (45678 bytes)
  - Nodes: 150
  - Segments: 5
  - Organizations: 3

...

============================================================
✅ ALL TESTS PASSED
============================================================
```

### verify-logging.sh

Verifies that the logging system is working correctly.

**Usage:**

```bash
chmod +x scripts/verify-logging.sh
./scripts/verify-logging.sh
```

## Adding New Scripts

When adding new scripts to this directory:

1. Create the script file
2. Make it executable: `chmod +x scripts/your-script.sh`
3. Add shebang line: `#!/bin/bash`
4. Document it in this README
5. Use the helper functions for consistent output:
   - `print_header "Section Title"`
   - `print_success "Success message"`
   - `print_error "Error message"`
   - `print_info "Info message"`

## Environment Variables

Scripts in this directory may use these environment variables:

- `API_URL` - Base URL for API requests (default: http://localhost:3000)
- `VERBOSE` - Enable verbose output (0 or 1)
- `PORT` - Server port (default: 3000)
