# Wave 0 Contract — Data Layer

**Branch:** main
**Base:** 406c17e6b (wip: in-flight UI polish before 18-feature push)
**Status:** DONE

All 5 migrations applied cleanly, type check passes, no new test regressions.
Downstream agents (Wave 1a + Wave 1b) should branch from the Wave 0 commit on
main and treat these columns as stable.

---

## nodes table — new columns

| Column | Type | Nullable | Default | Migration |
|---|---|---|---|---|
| why_saved_text | TEXT | yes | NULL | 020 |
| why_saved_is_auto | INTEGER | no | 1 | 020 |
| why_saved_generated_at | TEXT (ISO 8601) | yes | NULL | 020 |
| saved_from_context | TEXT (JSON) | yes | NULL | 021 |
| surface_mode | TEXT | no | 'reference' | 022 |
| classification_reasoning | TEXT (JSON) | yes | NULL | 024 |

**Indexes added:**
- `idx_nodes_surface_mode` on `nodes(surface_mode) WHERE is_deleted = 0`

**CHECK constraints:**
- `surface_mode IN ('read_later', 'reference')`

---

## collections table — new columns

| Column | Type | Nullable | Default | Migration |
|---|---|---|---|---|
| collection_type | TEXT | no | 'folder' | 023 |
| saved_search_json | TEXT (JSON) | yes | NULL | 023 |

**Indexes added:**
- `idx_collections_type` on `collections(collection_type)`

**CHECK constraints:**
- `collection_type IN ('folder', 'smart')`

---

## JSON schemas

### saved_from_context (nodes)

```ts
{
  source: 'imessage' | 'browser' | 'manual' | 'batch',
  surrounding_messages?: string[],   // 2-3 snippets, imessage only
  timestamp?: string                  // ISO 8601
}
```

NOTE: `sender` field intentionally omitted. iMessage extractor only reads
user's outgoing thread, so sender is always "you". Decision locked in plan.

### classification_reasoning (nodes)

```ts
{
  primaryDomainReason: string,    // one sentence
  resourceTypeReason: string,     // one sentence
  confidence: number              // 0..1
}
```

Populated on import and on reclassify by the semantic profiler. NULL for
existing rows until backfilled.

### saved_search_json (collections)

Shape matches `columnFilters` + `hierarchyFilter` state in `DecantDemo.tsx`.
Exact shape to be locked by Wave 1a Agent B3 (collections-surface-backend).

---

## Code changes (non-migration)

- `decant-standalone/src/backend/database/migrations/runner.ts` — imports
  and registers migrations 020–024
- `decant-standalone/src/backend/database/nodes.ts` — `NODE_LIST_COLUMNS` now
  includes `why_saved_text`, `why_saved_is_auto`, `surface_mode`. List
  endpoints automatically return these fields.
- `INSERT INTO nodes` prepared statement NOT modified — new columns all have
  sensible defaults and can be omitted from inserts. Wave 1a agents that
  populate these fields will use separate UPDATE statements.

---

## Migration files created

- `src/backend/database/migrations/020_add_why_saved.ts`
- `src/backend/database/migrations/021_add_saved_from_context.ts`
- `src/backend/database/migrations/022_add_surface_mode.ts`
- `src/backend/database/migrations/023_add_smart_collections.ts`
- `src/backend/database/migrations/024_add_classification_reasoning.ts`

---

## Verification

| Check | Result |
|---|---|
| `npm run migrate:status` | 25/25 applied (was 20, added 5) |
| `npm run migrate:up` | clean, no errors |
| `npx tsc --noEmit -p tsconfig.server.json` | zero errors |
| `npx vitest run src/backend/database` | pre-existing failures only — identical 72 failures on base commit (406c17e6b) BEFORE Wave 0. No new regressions. Failures in runner.spec.ts, similarity.spec.ts, audit.spec.ts, search.spec.ts. Flagged for integrator. |

---

## Notes for Wave 1a / Wave 1b agents

1. Do not add another column without coordinating. New columns go as
   migration 025+ and require updating this contract.
2. Use defaults. All new columns are nullable or have defaults, so existing
   INSERT statements continue to work unmodified.
3. UPDATE statements for new fields should follow the lazy-init pattern in
   nodes.ts: `let _xxxStmt: Stmt | null = null; const xxxStmt = () => (_xxxStmt ??= ...)`
4. Feature-to-column mapping:
   - #2, #3, #4 (why saved, auto-blurb, regenerate title) → migration 020
   - #5 (saved from trail) → migration 021
   - #17 (read later vs reference) → migration 022
   - #13 (smart collections) → migration 023
   - #14 (explain classification) → migration 024
5. Pre-existing test failures on main are unrelated to Wave 0. Wave 2
   integrator can address or defer.