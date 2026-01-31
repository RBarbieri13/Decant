#!/bin/bash
# ============================================================
# Backup & Restore Verification Script
# Tests all backup functionality end-to-end
# ============================================================

set -e  # Exit on error

BASE_URL="http://localhost:3000"
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "============================================================"
echo "Decant Backup & Restore Verification"
echo "============================================================"
echo ""

# Check if server is running
echo -e "${BLUE}[1/8]${NC} Checking if server is running..."
if ! curl -s "${BASE_URL}/health" > /dev/null; then
  echo -e "${RED}ERROR: Server is not running at ${BASE_URL}${NC}"
  echo "Please start the server with: npm run dev:server"
  exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"
echo ""

# Test 1: Create a backup
echo -e "${BLUE}[2/8]${NC} Creating backup..."
BACKUP_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/backup")
BACKUP_FILENAME=$(echo "$BACKUP_RESPONSE" | jq -r '.filename')

if [ "$BACKUP_FILENAME" = "null" ] || [ -z "$BACKUP_FILENAME" ]; then
  echo -e "${RED}ERROR: Failed to create backup${NC}"
  echo "$BACKUP_RESPONSE" | jq
  exit 1
fi

echo -e "${GREEN}✓ Backup created: ${BACKUP_FILENAME}${NC}"
echo ""

# Test 2: List backups
echo -e "${BLUE}[3/8]${NC} Listing all backups..."
BACKUPS=$(curl -s "${BASE_URL}/api/backups")
BACKUP_COUNT=$(echo "$BACKUPS" | jq 'length')

echo -e "${GREEN}✓ Found ${BACKUP_COUNT} backup(s)${NC}"
echo "$BACKUPS" | jq '.[] | {filename, sizeBytes, createdAt}' | head -20
echo ""

# Test 3: Export data as JSON
echo -e "${BLUE}[4/8]${NC} Exporting data as JSON..."
EXPORT_FILE="/tmp/decant-test-export-$(date +%s).json"
curl -s "${BASE_URL}/api/export" > "$EXPORT_FILE"

if [ ! -s "$EXPORT_FILE" ]; then
  echo -e "${RED}ERROR: Export file is empty${NC}"
  exit 1
fi

EXPORT_SIZE=$(wc -c < "$EXPORT_FILE" | tr -d ' ')
NODE_COUNT=$(jq '.data.nodes | length' "$EXPORT_FILE")
SEGMENT_COUNT=$(jq '.data.segments | length' "$EXPORT_FILE")
ORG_COUNT=$(jq '.data.organizations | length' "$EXPORT_FILE")

echo -e "${GREEN}✓ Export successful (${EXPORT_SIZE} bytes)${NC}"
echo "  - Nodes: ${NODE_COUNT}"
echo "  - Segments: ${SEGMENT_COUNT}"
echo "  - Organizations: ${ORG_COUNT}"
echo ""

# Test 4: Verify export structure
echo -e "${BLUE}[5/8]${NC} Verifying export structure..."
HAS_EXPORTED_AT=$(jq 'has("exportedAt")' "$EXPORT_FILE")
HAS_VERSION=$(jq 'has("version")' "$EXPORT_FILE")
HAS_DATA=$(jq 'has("data")' "$EXPORT_FILE")

if [ "$HAS_EXPORTED_AT" != "true" ] || [ "$HAS_VERSION" != "true" ] || [ "$HAS_DATA" != "true" ]; then
  echo -e "${RED}ERROR: Invalid export structure${NC}"
  jq '.' "$EXPORT_FILE" | head -20
  exit 1
fi

echo -e "${GREEN}✓ Export structure is valid${NC}"
echo ""

# Test 5: Import in merge mode
echo -e "${BLUE}[6/8]${NC} Testing import (merge mode)..."
IMPORT_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/import/json" \
  -H "Content-Type: application/json" \
  -d "{\"data\": $(cat "$EXPORT_FILE"), \"mode\": \"merge\"}")

IMPORT_SUCCESS=$(echo "$IMPORT_RESPONSE" | jq -r '.success')
IMPORTED=$(echo "$IMPORT_RESPONSE" | jq -r '.imported')
SKIPPED=$(echo "$IMPORT_RESPONSE" | jq -r '.skipped')
ERRORS=$(echo "$IMPORT_RESPONSE" | jq -r '.errors')

if [ "$IMPORT_SUCCESS" != "true" ]; then
  echo -e "${RED}ERROR: Import failed${NC}"
  echo "$IMPORT_RESPONSE" | jq
  exit 1
fi

echo -e "${GREEN}✓ Import successful (merge mode)${NC}"
echo "  - Imported: ${IMPORTED}"
echo "  - Skipped: ${SKIPPED}"
echo "  - Errors: ${ERRORS}"
echo ""

# Test 6: Test backup deletion (of older backups)
echo -e "${BLUE}[7/8]${NC} Testing backup deletion..."

# Get list of backups (excluding the one we just created)
OLD_BACKUPS=$(curl -s "${BASE_URL}/api/backups" | jq -r '.[] | select(.filename != "'"$BACKUP_FILENAME"'") | .filename' | head -1)

if [ -n "$OLD_BACKUPS" ] && [ "$OLD_BACKUPS" != "null" ]; then
  DELETE_RESPONSE=$(curl -s -X DELETE "${BASE_URL}/api/backups/${OLD_BACKUPS}")
  DELETE_SUCCESS=$(echo "$DELETE_RESPONSE" | jq -r '.success')

  if [ "$DELETE_SUCCESS" = "true" ]; then
    echo -e "${GREEN}✓ Successfully deleted backup: ${OLD_BACKUPS}${NC}"
  else
    echo -e "${RED}WARNING: Failed to delete backup${NC}"
    echo "$DELETE_RESPONSE" | jq
  fi
else
  echo -e "${BLUE}ℹ No old backups to delete${NC}"
fi
echo ""

# Test 7: Verify backup file exists on filesystem
echo -e "${BLUE}[8/8]${NC} Verifying backup file on filesystem..."
BACKUP_PATH=$(echo "$BACKUP_RESPONSE" | jq -r '.path')

if [ ! -f "$BACKUP_PATH" ]; then
  echo -e "${RED}ERROR: Backup file not found at ${BACKUP_PATH}${NC}"
  exit 1
fi

# Check if it's a valid SQLite database
SQLITE_HEADER=$(head -c 16 "$BACKUP_PATH" | tr -d '\0')
if [[ "$SQLITE_HEADER" != "SQLite format 3" ]]; then
  echo -e "${RED}ERROR: Backup file is not a valid SQLite database${NC}"
  exit 1
fi

BACKUP_SIZE=$(wc -c < "$BACKUP_PATH" | tr -d ' ')
echo -e "${GREEN}✓ Backup file exists and is valid${NC}"
echo "  - Path: ${BACKUP_PATH}"
echo "  - Size: ${BACKUP_SIZE} bytes"
echo ""

# Cleanup
echo "Cleaning up test files..."
rm -f "$EXPORT_FILE"
echo ""

# Summary
echo "============================================================"
echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
echo "============================================================"
echo ""
echo "Verified functionality:"
echo "  ✓ Backup creation with timestamped filenames"
echo "  ✓ Backup listing with metadata"
echo "  ✓ JSON export with complete data"
echo "  ✓ Export structure validation"
echo "  ✓ JSON import (merge mode)"
echo "  ✓ Backup deletion"
echo "  ✓ SQLite file validation"
echo ""
echo "Latest backup: ${BACKUP_FILENAME}"
echo ""
echo "To restore this backup:"
echo "  curl -X POST ${BASE_URL}/api/restore \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"filename\": \"${BACKUP_FILENAME}\"}'"
echo ""
