# Decant iMessage Sync Implementation Plan

## Overview
Integrate iMessage self-texts into Decant app as a live data source. Every message with a URL in Chat ID 117 will be:
1. Extracted for URLs
2. Enriched with metadata
3. Categorized with Claude AI
4. Inserted into Decant's node hierarchy

## Architecture

```
iMessage Database (~/Library/Messages/chat.db)
    ↓ (read Chat ID 117 messages)
URL Extraction Service
    ↓ (find URLs in messages)
Metadata Enrichment Service
    ↓ (fetch title, description, thumbnail)
Claude Categorization Service
    ↓ (categorize with AI)
Decant Nodes Database
    ↓ (insert as nodes with full metadata)
Sync State Tracker
    ↓ (remember last_imessage_rowid)
```

## Implementation Modules

### 1. `src/main/services/imessage/connection.ts`
- Read iMessage database with proper permission handling
- Copy database to temp location (permission workaround)
- Query Chat ID 117 for new messages

### 2. `src/main/services/imessage/extractor.ts`
- Extract URLs from message text and attributedBody blob
- Parse Apple timestamp to ISO datetime
- Deduplicate URLs

### 3. `src/main/services/imessage/enricher.ts`
- Fetch metadata for each URL (async, concurrent)
- Parse HTML for OpenGraph, Twitter Card, standard meta tags
- Handle errors gracefully

### 4. `src/main/services/imessage/categorizer.ts`
- Batch send to Claude API
- Parse response JSON
- Map to Decant category/subcategory/tags

### 5. `src/main/services/imessage/sync.ts`
- Orchestrate the complete pipeline
- Handle sync state tracking
- Create nodes in Decant database

### 6. `src/main/services/imessage/scheduler.ts`
- Background interval task (hourly or on-demand)
- Error handling and retry logic

### 7. Database Schema Updates
- Add `sync_state` table
- Add `imessage_source_id` field to nodes for tracking

## Database Changes

### New Table: sync_state
```sql
CREATE TABLE IF NOT EXISTS sync_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_imessage_rowid INTEGER DEFAULT 0,
    last_sync_at TEXT
);
```

### Nodes Table Update
Add column for tracking iMessage source:
```sql
ALTER TABLE nodes ADD COLUMN imessage_rowid INTEGER UNIQUE;
```

## IPC Handlers

Add to `src/main/ipc/handlers.ts`:
- `IMESSAGE_SYNC_NOW` - Trigger immediate sync
- `IMESSAGE_SYNC_STATUS` - Get sync status
- `IMESSAGE_SYNC_HISTORY` - Get recent synced items

## Configuration

Add to environment:
```
ANTHROPIC_API_KEY=sk-ant-...
IMESSAGE_DB_PATH=/Users/robert.barbieri/Library/Messages/chat.db
IMESSAGE_CHAT_ID=117
IMESSAGE_SYNC_INTERVAL_HOURS=1
```

## Error Handling

- Missing iMessage database → Skip sync, show user warning
- Permission denied → Show dialog requesting Full Disk Access
- URL fetch timeout → Continue with partial metadata
- Claude API error → Insert with placeholder categorization
- Duplicate URL → Skip via UNIQUE constraint

## Performance Targets

- First sync: 2-5 minutes (depends on message count)
- Subsequent syncs: <30 seconds (no new messages)
- Concurrent requests: 5-10 simultaneous URL fetches
- Batch Claude calls: 10 URLs per request

## Phase 1 Implementation

Focus on:
1. Database schema updates
2. iMessage connection and URL extraction
3. Sync state tracking
4. Basic node creation pipeline
5. Manual trigger (IPC handler)

Phase 2 (later):
- Background scheduler
- Full UI for sync status
- Advanced filtering/curation
