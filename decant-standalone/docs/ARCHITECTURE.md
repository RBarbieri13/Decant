# Architecture Documentation

Architecture Decision Records (ADR) style documentation for Decant's system design.

## Table of Contents

- [System Overview](#system-overview)
- [Architecture Decisions](#architecture-decisions)
- [Data Flow](#data-flow)
- [Component Architecture](#component-architecture)
- [Security Model](#security-model)
- [Scalability Considerations](#scalability-considerations)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │   React UI   │  │  API Client  │  │  SSE Realtime       │  │
│  │              │◄─┤  (fetch)     │  │  Updates            │  │
│  └──────────────┘  └──────┬───────┘  └──────────┬──────────┘  │
│                            │                     │              │
└────────────────────────────┼─────────────────────┼──────────────┘
                             │                     │
                    HTTP/REST│            SSE      │
                             │                     │
┌────────────────────────────┼─────────────────────┼──────────────┐
│                   EXPRESS.JS SERVER               │              │
│                                                   │              │
│  ┌─────────────────────────▼──────────────────────▼──────────┐  │
│  │                  Route Handlers                            │  │
│  │  /api/nodes  /api/import  /api/search  /api/events        │  │
│  └─────────────┬───────────────────────────┬──────────────────┘  │
│                │                           │                     │
│  ┌─────────────▼──────────┐   ┌───────────▼──────────────────┐  │
│  │  Business Services     │   │  Background Services         │  │
│  │  - Import Orchestrator │   │  - Processing Queue          │  │
│  │  - Phase1 Classifier   │   │  - Metrics Collector         │  │
│  │  - Phase2 Enricher     │   │  - Cache Manager             │  │
│  │  - Hierarchy Manager   │   │  - Notification Service      │  │
│  └─────────────┬──────────┘   └───────────┬──────────────────┘  │
│                │                           │                     │
│  ┌─────────────▼───────────────────────────▼──────────────────┐  │
│  │              Database Layer (SQLite)                       │  │
│  │  - Connection Manager (WAL mode, connection pooling)      │  │
│  │  - Transaction Handler (ACID guarantees)                  │  │
│  │  - Migration System (versioned schema changes)            │  │
│  └───────────────────────────┬────────────────────────────────┘  │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                   ┌───────────▼───────────┐
                   │   SQLite Database     │
                   │   ~/.decant/data/     │
                   │   decant.db           │
                   └───────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    External Services                             │
│                                                                  │
│  ┌──────────────┐        ┌──────────────┐                       │
│  │  OpenAI API  │        │  Target URLs │                       │
│  │  (LLM)       │        │  (Scraping)  │                       │
│  └──────────────┘        └──────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

---

### Component Responsibilities

**Client Layer**:
- **React UI**: User interface components, state management
- **API Client**: HTTP communication with retry logic
- **SSE Service**: Real-time event subscription

**Server Layer**:
- **Route Handlers**: HTTP request validation and routing
- **Business Services**: Core application logic
- **Background Services**: Asynchronous processing
- **Database Layer**: Data persistence and queries

**External Services**:
- **OpenAI API**: LLM-powered content analysis
- **Target URLs**: Web content for import

---

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 | UI framework |
| | TypeScript | Type safety |
| | Vite | Build tool, dev server |
| | Native fetch | HTTP client |
| **Backend** | Express.js | HTTP server |
| | Node.js 18+ | Runtime (ES modules) |
| | TypeScript | Type safety |
| | Pino | Structured logging |
| **Database** | SQLite 3 | Embedded database |
| | better-sqlite3 | Synchronous bindings |
| | WAL mode | Concurrency support |
| **Validation** | Zod | Runtime schema validation |
| **AI** | OpenAI API | LLM integration |
| **Testing** | Vitest | Unit/integration tests |
| | Playwright | E2E tests |

---

## Architecture Decisions

### ADR-001: Why SQLite (not PostgreSQL)

**Status**: Accepted

**Context**:
Decant is a personal knowledge management tool, typically used by a single user or small team.

**Decision**: Use SQLite as the primary database instead of PostgreSQL or MySQL.

**Rationale**:

**Pros**:
1. **Zero Configuration**: No database server to install, configure, or manage
2. **Single File**: Entire database in one file (`~/.decant/data/decant.db`)
3. **Embedded**: Runs in-process with the application
4. **Portable**: Easy to backup, copy, or move (just copy the file)
5. **Sufficient Performance**: Handles millions of rows for single-user workloads
6. **ACID Compliant**: Full transaction support
7. **Mature**: Battle-tested, stable, widely supported

**Cons**:
1. **Write Concurrency**: Limited (but WAL mode helps)
2. **Network Access**: No built-in client/server architecture
3. **Replication**: No native replication support
4. **Scale Ceiling**: Not suitable for high-concurrency multi-user systems

**Mitigations**:
- Use WAL (Write-Ahead Logging) mode for better concurrency
- Use connection pooling (via better-sqlite3)
- Set pragmas for performance (`journal_mode=WAL`, `synchronous=NORMAL`)
- Accept the trade-off: Decant is optimized for single-user/small team use

**Consequences**:
- Simple deployment: Just run `npm start`, no database setup needed
- Easy backups: Copy the `.db` file or use backup API
- Reduced operational complexity
- Not suitable for high-traffic multi-tenant deployments

**Alternatives Considered**:
- **PostgreSQL**: Overkill for personal use, requires separate server
- **MySQL**: Same issues as PostgreSQL
- **MongoDB**: Schemaless adds complexity, overkill for relational data
- **In-memory only**: Data loss on restart, not acceptable

---

### ADR-002: Why Dual Hierarchy System

**Status**: Accepted

**Context**:
Knowledge can be organized by different dimensions: functional (what it is) vs organizational (who created it).

**Decision**: Implement two independent hierarchy trees: Function and Organization.

**Rationale**:

**Problem Statement**:
- Users want to browse by **topic** (AI, Technology, Finance)
- Users also want to browse by **source** (OpenAI, Anthropic, Google)
- Single hierarchy forces choosing one dimension over the other
- Tags are flat and don't provide hierarchical browsing

**Solution**:
Each node can exist in TWO independent hierarchies simultaneously:
1. **Function Hierarchy**: Organized by topic/category (Segment → Category → Item)
2. **Organization Hierarchy**: Organized by creator/company (Organization → Items)

**Implementation**:
```typescript
interface Node {
  // Function hierarchy
  functionCode: string | null;      // e.g., "T.LLM"
  functionParentId: string | null;  // Parent in function tree
  functionPosition: number;         // Sibling order

  // Organization hierarchy
  organizationCode: string | null;      // e.g., "OAIA"
  organizationParentId: string | null;  // Parent in org tree
  organizationPosition: number;         // Sibling order
}
```

**Benefits**:
1. **Flexibility**: View the same content from different perspectives
2. **No Duplication**: Single node exists in both hierarchies
3. **Intuitive**: Matches how humans naturally categorize information
4. **Scalable**: Each hierarchy can grow independently

**Trade-offs**:
- **Complexity**: Two parent pointers, two position fields
- **UI Challenge**: Must clearly indicate which hierarchy is active
- **Migration Complexity**: Harder to move nodes between hierarchies

**Example**:
An article about Claude AI appears:
- Function: AI → LLMs → Anthropic → "Claude 3 Released"
- Organization: Anthropic → Articles → "Claude 3 Released"

Same node, two navigation paths.

---

### ADR-003: Why Two-Phase Classification

**Status**: Accepted

**Context**:
LLM-based content analysis is slow (2-5 seconds per request) but valuable.

**Decision**: Split import into two phases:
1. **Phase 1 (Quick)**: Fast classification for immediate hierarchy placement (synchronous)
2. **Phase 2 (Deep)**: Background enrichment for detailed metadata (asynchronous)

**Rationale**:

**User Experience Requirements**:
- User imports URL, expects quick feedback
- Waiting 10+ seconds for deep analysis is poor UX
- Background processing is acceptable for non-critical metadata

**Phase 1 - Quick Classification** (~2-3 seconds):
- **Goal**: Immediate hierarchy placement
- **Outputs**:
  - Segment (e.g., "T" for Technology)
  - Category (e.g., "LLM")
  - Content Type (e.g., "A" for Article)
  - Organization (e.g., "ANTH" for Anthropic)
  - Confidence score
- **LLM Call**: Single, fast request
- **Processing**: Synchronous, blocks import response
- **Result**: Node is created and visible immediately

**Phase 2 - Deep Enrichment** (~5-10 seconds):
- **Goal**: Rich metadata extraction
- **Outputs**:
  - Company name
  - Phrase description (100 char tagline)
  - Short description (1-3 sentences)
  - Key concepts (tags)
  - Metadata codes (ORG, FNC, TEC, etc.)
- **LLM Call**: More detailed prompts, longer response
- **Processing**: Asynchronous via processing queue
- **Result**: Node is updated in background

**Implementation**:
```typescript
// Phase 1 - During import (synchronous)
const phase1Result = await classifyContent(content);
const node = createNode({
  title: phase1Result.title,
  functionCode: phase1Result.category,
  organizationCode: phase1Result.organization,
  // ... minimal fields
});

// Phase 2 - Queue for background processing
enqueueForEnrichment(node.id, { priority: 0 });

// Return immediately
return { success: true, nodeId: node.id };
```

**Benefits**:
1. **Fast Response**: User gets feedback in ~2-3 seconds
2. **Better UX**: Node appears immediately, enriches later
3. **Fault Tolerance**: Phase 2 failures don't block import
4. **Cost Optimization**: Can batch Phase 2 requests
5. **Scalability**: Queue can be rate-limited independently

**Trade-offs**:
- **Eventual Consistency**: Full metadata not immediately available
- **Complexity**: Two separate LLM integrations
- **Queue Management**: Need background job system

**User Experience**:
```
[Import URL]
   ↓
Phase 1 (2-3s): "Classifying..."
   ↓
✓ Node created, appears in tree
   ↓
Phase 2 (background): "Enriching metadata..."
   ↓
✓ Metadata updated (user notified via SSE)
```

---

### ADR-004: Why SSE (not WebSocket)

**Status**: Accepted

**Context**:
Need real-time updates for background job completion (Phase 2 enrichment).

**Decision**: Use Server-Sent Events (SSE) instead of WebSocket for real-time notifications.

**Rationale**:

**Requirements**:
- Notify UI when Phase 2 enrichment completes
- Notify UI of queue status changes
- Unidirectional communication (server → client only)
- Reconnect automatically on connection loss

**Why SSE**:
1. **Simpler Protocol**: Built on HTTP, no special handshake
2. **Auto-Reconnect**: Browsers handle reconnection automatically
3. **Unidirectional**: Perfect for server→client push (we don't need client→server)
4. **HTTP/2 Friendly**: Works well with HTTP/2 multiplexing
5. **Firewall Friendly**: Just HTTP, no special ports or protocols
6. **Built-in Event Types**: Native support for named events

**Why Not WebSocket**:
1. **Overkill**: We don't need bidirectional communication
2. **More Complex**: Requires WebSocket upgrade handshake
3. **No Auto-Reconnect**: Must implement manually
4. **Firewall Issues**: Some corporate firewalls block WebSocket

**Implementation**:
```typescript
// Server (src/backend/routes/index.ts)
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const unsubscribe = notificationService.subscribeAll((event) => {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  req.on('close', () => unsubscribe());
});

// Client (src/renderer/services/realtimeService.ts)
const eventSource = new EventSource('/api/events');

eventSource.addEventListener('enrichment:complete', (event) => {
  const data = JSON.parse(event.data);
  console.log('Node enriched:', data.nodeId);
});
```

**Event Types**:
- `connected` - Initial connection established
- `ping` - Keep-alive heartbeat (every 30s)
- `enrichment:complete` - Phase 2 enrichment finished
- `import:progress` - Import job progress updates
- `queue:status` - Queue statistics changed

**Benefits**:
- Simple to implement (built into browsers and Node.js)
- Reliable reconnection
- Works through proxies
- Easy to debug (just HTTP)

**Trade-offs**:
- One-way only (but that's all we need)
- Some old proxies may buffer SSE streams
- Not suitable for binary data (but we only send JSON)

---

## Data Flow

### Import Pipeline Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                         IMPORT PIPELINE                           │
└──────────────────────────────────────────────────────────────────┘

1. User submits URL
   │
   ├─► URL Validation
   │   ├─ Check format (valid URL)
   │   ├─ Check protocol (http/https only)
   │   ├─ SSRF protection (no private IPs)
   │   └─ Duplicate check (URL hash in cache)
   │
2. Content Extraction
   │
   ├─► Scraper Service
   │   ├─ Fetch URL (with timeout)
   │   ├─ Check content size (< 5MB)
   │   ├─ Detect content type
   │   └─ Route to appropriate extractor
   │
   ├─► Content Extractors
   │   ├─ ArticleExtractor (generic)
   │   ├─ YouTubeExtractor (videos)
   │   ├─ GitHubExtractor (repos)
   │   └─ Returns: { title, content, metadata }
   │
3. PHASE 1: Quick Classification (2-3s)
   │
   ├─► Phase1 Classifier
   │   ├─ Build LLM prompt with extracted content
   │   ├─ Call OpenAI API (gpt-4o-mini)
   │   ├─ Parse response (JSON with Zod validation)
   │   └─ Returns: { segment, category, contentType, org, confidence }
   │
4. Node Creation
   │
   ├─► Create Node in Database
   │   ├─ Generate hierarchy codes (e.g., "T.LLM")
   │   ├─ Insert into nodes table
   │   ├─ Update hierarchy positions
   │   └─ Returns: { nodeId, success: true }
   │
5. PHASE 2: Queue for Enrichment (background)
   │
   ├─► Enqueue Job
   │   ├─ Insert into processing_queue table
   │   ├─ Set priority (default: 0)
   │   └─ Status: pending
   │
6. Return Response to Client (~2-3s total)
   │
   └─► { success: true, nodeId, classification }

┌──────────────────────────────────────────────────────────────────┐
│                    BACKGROUND PROCESSING                          │
└──────────────────────────────────────────────────────────────────┘

7. Processing Queue (polls every 5s)
   │
   ├─► Fetch pending jobs (status=pending)
   ├─► Mark as processing
   └─► Execute Phase 2 Enrichment
       │
       ├─► Phase2 Enricher
       │   ├─ Fetch node from database
       │   ├─ Build detailed LLM prompt
       │   ├─ Call OpenAI API (structured output)
       │   ├─ Parse and validate response
       │   └─ Returns: { company, descriptions, concepts, metadata }
       │
       ├─► Update Node
       │   ├─ Update all Phase 2 fields
       │   ├─ Set phase2_completed = true
       │   └─ Commit transaction
       │
       ├─► Mark Job Complete
       │   ├─ Update processing_queue (status=complete)
       │   └─ Set processed_at timestamp
       │
       └─► Notify Client (via SSE)
           └─ Emit event: enrichment:complete
```

---

### Hierarchy Code Generation

```
┌──────────────────────────────────────────────────────────────────┐
│                   HIERARCHY CODE SYSTEM                           │
└──────────────────────────────────────────────────────────────────┘

Function Hierarchy:
├─ Segment (single char): T
│  └─ Category (3 chars): LLM
│     └─ Items have full code: T.LLM

Organization Hierarchy:
├─ Organization (4 chars): ANTH
   └─ Items have org code: ANTH

Example Node:
{
  "id": "abc-123",
  "title": "Claude 3 Opus Released",
  "functionCode": "T.LLM",          // Technology → LLMs
  "organizationCode": "ANTH",       // Anthropic
  "functionParentId": "cat-llm-id", // Parent category
  "organizationParentId": "org-anth-id" // Parent org
}

Code Generation Rules:
1. Segments: Single letter (A, T, F, S, H, B, E, L, X, C)
2. Categories: Three letters under segment (LLM, AGT, FND)
3. Content Types: Single letter (T, A, V, P, R, G, etc.)
4. Organizations: Four letters (ANTH, OAIA, GOOG)

Code Uniqueness:
- Function codes must be unique within hierarchy
- Organization codes are globally unique
- Differentiator adds numbers if collision (LLM2, LLM3)
```

---

## Component Architecture

### Database Schema

**Core Tables**:

```sql
-- Main node table (all hierarchy entities)
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  node_type TEXT NOT NULL, -- segment|category|item|organization

  -- Dual hierarchy
  function_code TEXT,
  organization_code TEXT,
  function_parent_id TEXT REFERENCES nodes(id),
  organization_parent_id TEXT REFERENCES nodes(id),
  function_position INTEGER DEFAULT 0,
  organization_position INTEGER DEFAULT 0,

  -- Content metadata
  source_url TEXT,
  favicon_path TEXT,
  thumbnail_path TEXT,
  content_type_code TEXT,

  -- Phase 1 outputs
  ai_summary TEXT,
  ai_key_points TEXT, -- JSON array
  ai_confidence REAL,

  -- Phase 2 outputs
  company TEXT,
  phrase_description TEXT,
  short_description TEXT,
  descriptor_string TEXT,
  phase2_completed INTEGER DEFAULT 0,

  -- Timestamps
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  is_deleted INTEGER DEFAULT 0
);

-- Processing queue (background jobs)
CREATE TABLE processing_queue (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES nodes(id),
  phase TEXT NOT NULL, -- phase1|phase2
  status TEXT NOT NULL, -- pending|processing|complete|failed
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT
);

-- Metadata tags (extensible metadata system)
CREATE TABLE metadata_tags (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES nodes(id),
  tag_type TEXT NOT NULL, -- ORG|FNC|TEC|CON|IND|AUD|PRC|PLT
  tag_code TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Audit log (change tracking)
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  node_id TEXT REFERENCES nodes(id),
  action TEXT NOT NULL, -- create|update|delete|merge
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  changed_by TEXT
);

-- Migrations tracking
CREATE TABLE migrations (
  name TEXT PRIMARY KEY,
  applied_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes**:
```sql
-- Hierarchy traversal
CREATE INDEX idx_nodes_function_parent ON nodes(function_parent_id);
CREATE INDEX idx_nodes_organization_parent ON nodes(organization_parent_id);
CREATE INDEX idx_nodes_function_code ON nodes(function_code);
CREATE INDEX idx_nodes_organization_code ON nodes(organization_code);

-- Filtering and search
CREATE INDEX idx_nodes_content_type ON nodes(content_type_code);
CREATE INDEX idx_nodes_created_at ON nodes(created_at);
CREATE INDEX idx_nodes_is_deleted ON nodes(is_deleted);

-- Queue processing
CREATE INDEX idx_queue_status ON processing_queue(status);
CREATE INDEX idx_queue_node_id ON processing_queue(node_id);
CREATE INDEX idx_queue_priority_created ON processing_queue(priority DESC, created_at ASC);

-- Full-text search
CREATE VIRTUAL TABLE nodes_fts USING fts5(
  title, ai_summary, short_description, content=nodes
);
```

---

### Service Layer Architecture

**Layered Architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                     ROUTES LAYER                             │
│  - HTTP request handling                                     │
│  - Input validation (Zod schemas)                            │
│  - Response formatting                                       │
│  - Error handling                                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                             │
│  - Business logic                                            │
│  - Orchestration                                             │
│  - External integrations (LLM, scraping)                     │
│  - Transaction coordination                                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   DATABASE LAYER                             │
│  - CRUD operations                                           │
│  - Query building                                            │
│  - Transaction management                                    │
│  - Connection pooling                                        │
└─────────────────────────────────────────────────────────────┘
```

**Key Services**:

1. **Import Orchestrator**: Coordinates entire import pipeline
2. **Phase1 Classifier**: Fast AI classification
3. **Phase2 Enricher**: Deep AI enrichment
4. **Processing Queue**: Background job management
5. **Hierarchy Manager**: Code generation and tree building
6. **Metadata Registry**: Dynamic metadata management
7. **Similarity Computer**: Content similarity analysis
8. **Backup Service**: Database backup/restore
9. **Notification Service**: Real-time event bus

---

### Error Handling Strategy

**Error Hierarchy**:

```typescript
AppError (base class)
├─ ValidationError (400)
│  ├─ InvalidInputError
│  └─ SchemaValidationError
├─ NotFoundError (404)
│  └─ NodeNotFoundError
├─ UnauthorizedError (401)
├─ ForbiddenError (403)
│  └─ SSRFError
├─ ConflictError (409)
├─ RateLimitError (429)
├─ LLMError (502/503)
│  ├─ LLMUnavailableError
│  ├─ LLMTimeoutError
│  ├─ LLMInvalidResponseError
│  └─ LLMRateLimitError
├─ ExternalServiceError (502)
│  ├─ ScrapeError
│  └─ NetworkError
├─ ImportError (500)
│  ├─ ExtractionError
│  ├─ ClassificationError
│  └─ HierarchyGenerationError
├─ DatabaseError (500/503)
│  ├─ DatabaseConnectionError
│  ├─ DatabaseQueryError
│  └─ DatabaseTransactionError
└─ ServiceUnavailableError (503)
```

**Error Context**:
All errors include:
- HTTP status code
- Machine-readable error code
- Human-readable message
- Timestamp
- Optional context object

---

## Security Model

### SSRF Protection

**Threat**: Server-Side Request Forgery allows attackers to make the server request internal resources.

**Protection**:
```typescript
// Blocked URL patterns:
- Private IP ranges: 10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12
- Localhost: 127.0.0.0/8, ::1
- Link-local: 169.254.0.0/16
- Non-HTTP protocols: file://, ftp://, gopher://, etc.
```

**Disabled in development**: Set `NODE_ENV=development` to allow localhost URLs.

---

### Rate Limiting

**Strategy**: Token bucket algorithm with three tiers:

1. **Global**: 100 requests/minute
2. **Import**: 10 requests/minute (expensive LLM calls)
3. **Settings**: 5 requests/minute (sensitive operations)

**Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706641200
```

---

### Input Validation

**Strategy**: Defense in depth with Zod schemas

1. **Request validation**: All inputs validated at route level
2. **Type safety**: TypeScript ensures compile-time safety
3. **Runtime validation**: Zod ensures runtime safety
4. **SQL injection**: Prevented by parameterized queries
5. **XSS**: Prevented by React's automatic escaping

---

## Scalability Considerations

### Current Limitations

**Single-user optimized**:
- SQLite has write concurrency limits
- No horizontal scaling support
- No built-in replication

**Suitable for**:
- Personal knowledge base (1 user)
- Small team (2-5 concurrent users)
- Up to 100k nodes
- Moderate import frequency (< 100/day)

**Not suitable for**:
- High-traffic multi-tenant SaaS
- Thousands of concurrent users
- Real-time collaborative editing
- Complex analytics workloads

---

### Future Scaling Options

**If SQLite becomes a bottleneck**:

1. **PostgreSQL Migration**:
   - Swap database layer only
   - Keep same service layer
   - Use migration scripts

2. **Read Replicas**:
   - SQLite read-only replicas
   - Route reads to replicas
   - Single primary for writes

3. **Horizontal Sharding**:
   - Shard by user ID
   - Each shard gets own SQLite DB
   - Route based on auth

4. **Caching Layer**:
   - Redis for frequently accessed data
   - Reduce database load
   - Already have in-memory cache

---

### Performance Optimization

**Current optimizations**:

1. **Database**:
   - WAL mode for concurrency
   - Prepared statement caching
   - Strategic indexes
   - FTS5 for full-text search

2. **Application**:
   - In-memory caching (hierarchy, metadata)
   - Connection pooling (via better-sqlite3)
   - Background job queue (offload Phase 2)

3. **LLM**:
   - Retry with exponential backoff
   - Circuit breaker pattern
   - Request deduplication
   - Streaming responses (future)

4. **Frontend**:
   - Vite for fast builds
   - Code splitting
   - SSE for push updates (vs polling)

---

## Monitoring and Observability

### Health Checks

**Endpoints**:
- `/health` - Basic health check
- `/health/live` - Liveness probe (Kubernetes)
- `/health/ready` - Readiness probe (Kubernetes)
- `/health/full` - Detailed component health

**Components monitored**:
- Database connectivity
- LLM provider status
- Processing queue health
- Cache status

---

### Metrics

**Application metrics** (`/metrics`):
- Request count, rate, errors
- Memory usage (RSS, heap)
- Queue statistics
- LLM call count, latency, tokens

**Logging**:
- Structured JSON logging (Pino)
- Request/response logging
- Error tracking with stack traces
- Audit trail for data changes

---

## Summary

Decant is designed as a **personal knowledge management tool** with:

- **Simple deployment**: Single binary, no external dependencies
- **Fast user experience**: Two-phase classification for instant feedback
- **Flexible organization**: Dual hierarchy for multi-dimensional browsing
- **AI-powered**: LLM integration for automatic classification and enrichment
- **Reliable**: ACID transactions, audit logging, backup/restore
- **Scalable enough**: Handles single-user/small team workloads efficiently

The architecture makes deliberate trade-offs:
- **Simplicity over scalability**: SQLite over PostgreSQL
- **User experience over cost**: Two LLM calls per import
- **Flexibility over simplicity**: Dual hierarchy adds complexity
- **Real-time over simplicity**: SSE for push notifications

These decisions align with the target use case: a powerful personal tool that "just works" without operational overhead.
