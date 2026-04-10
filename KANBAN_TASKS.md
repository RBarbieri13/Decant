# Decant Backend Improvement — Kanban Cards

**Constraint on ALL tasks:** Do NOT modify classification logic, LLM prompts, hierarchy placement algorithms, or the holistic-first principle.

---

## Phase 1: Database Foundation (all parallel)

### 1.1 — Add SQLite Performance PRAGMAs
Add `synchronous=NORMAL`, `busy_timeout=5000`, `temp_store=MEMORY`, `mmap_size=268435456` to `connection.ts`. Immediate write perf boost. Do NOT modify classification logic.

### 1.2 — Add Missing Database Indexes
New migration: indexes on `segment_code`, `category_code`, `content_type_code`, composite `processing_queue(status, priority, created_at)`. Used in search filters and queue polling with no index today.

### 1.3 — Fix FTS5 Sync Bug
`updateNode()` and `deleteNode()` don't sync `nodes_fts`. Search returns stale/deleted results. Add FTS INSERT/DELETE around mutations or add SQLite triggers. Correctness bug.

### 1.4 — Replace Parent-Walk N+1 with Recursive CTEs
`markBranchDirty()`, `incrementNodeCounts()`, `getBranchPath()` each fire D+1 queries walking up the tree. Replace with single recursive CTE queries each. Do NOT change hierarchy placement logic.

---

## Phase 2: Query & Data Efficiency (after Phase 1)

### 2.1 — Column Projection on getAllNodes() [depends: 1.2]
Stop `SELECT *` on list endpoints. Exclude `ai_summary`, `extracted_fields` from list view. Full data only on single-node detail fetch. Cuts payload ~80%.

### 2.2 — Cap Unbounded Queries in taxonomy.ts [depends: 1.2]
Add LIMIT clauses to 5+ `SELECT * FROM nodes` calls with no bound at lines 222, 308, 315, 374, 433.

### 2.3 — Wire Up buildHierarchyTree() Caching [depends: 1.4]
General cache has `tree:*` invalidation but `buildHierarchyTree()` never reads/writes it. Wire cache read/write so tree builds are cached. Invalidate on mutations.

### 2.4 — Fix readNodes() Ordering Bug [independent]
`getRelatedNodes` assumes index correspondence with similarity scores but `readNodes` doesn't preserve order. Sort returned nodes to match input ID order. Correctness bug.

---

## Phase 3: Server & Deployment (after Phase 2)

### 3.1 — Static Asset Cache-Control Headers [independent]
Add `maxAge: '1y'`, `immutable: true` to `express.static()` for hashed assets in `dist/`. Eliminates redundant asset re-fetches.

### 3.2 — Set min_machines_running=1 in fly.toml [independent]
Eliminates 3-6s cold starts. ~$1.94/mo. Do NOT deploy yet — local testing first.

### 3.3 — Add LRU Ceiling to In-Memory Caches [depends: 2.3]
Add `maxEntries` limit (200) with LRU eviction to `cache/index.ts` and `hierarchy_cache.ts`. Prevents unbounded growth.

### 3.4 — Consolidate Error Handling [independent]
Remove raw `res.status(500).json(error.message)` from route handlers. Use `asyncHandler` + centralized error handler everywhere. Remove dead `setupGlobalErrorHandlers()`.

### 3.5 — Set CORS_ALLOWED_ORIGINS in fly.toml [independent]
Set to `https://decant-app.fly.dev`. Stop allowing all origins in production.

---

## Phase 4: Advanced Optimizations (after Phase 3)

### 4.1 — Vite Code Splitting [depends: 3.1]
Add `manualChunks` to split vendor libs (React, Mantine, Tabler icons) from app code. Target: 862KB bundle → ~200-300KB app + cached vendor chunks.

### 4.2 — Pre-Compress Static Assets [depends: 4.1]
Add `vite-plugin-compression` for .gz and .br files. Serve pre-compressed instead of runtime `compression()`.

### 4.3 — Batch admin/rescrape-poor-quality [depends: 2.1]
Replace sequential for loop with `p-limit(3)` concurrency. Add SSE progress tracking like reclassify does. Do NOT change orchestrator classification logic.

### 4.4 — Prepared Statement Caching [depends: 1.1]
Move frequent `db.prepare()` calls out of function bodies into module-level cached statements. Avoids re-preparing on every call.

### 4.5 — Lightweight Dockerfile Healthcheck [independent]
Replace `node -e "fetch(...)"` with `wget --spider` to avoid spawning a Node process every 30s.

---

## Phase 5: Verify & Deploy (final gate)

### 5.1 — Local Integration Test [depends: all above]
Run `pnpm run dev`, test all features locally: import a URL, reclassify all, search, hierarchy tree, collections, related nodes. Verify NO classification behavior changes. Compare hierarchy output before/after.

### 5.2 — Deploy to Fly.io [depends: 5.1]
Only after local testing passes. Use `/deploy-decant` skill. Back up database first.
