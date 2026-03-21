# Project Memory: Decant

Decant project work.

Auto-maintained by Claude. Append key decisions, technical hurdles, and lessons learned after each session.

## Decisions

### 2026-03-19: Holistic classification replaces per-node profiling
- **Reclassify button** now uses `DynamicClassifier.classifyAll()` — one LLM call that sees all nodes and generates an emergent taxonomy (like a human librarian)
- Previously: N individual `SemanticProfiler` calls per node → discriminator splitting → poor results (everything was "Social Media" because tweets were classified by platform, not content)
- The holistic approach matches what the user demonstrated in their `hier713.docx` transcript — give the LLM all links at once and let it find natural groupings
- Key files: `reclassify.ts` → `DynamicClassifier` → `buildFromClassification()`
- `buildFromClassification()` in `hierarchy_engine.ts` creates segment branches (depth 1), category branches (depth 2), and optional subcategory branches (depth 3, only for groups with 3+ items)

### 2026-03-19: Social media classification rules
- Added explicit rules to all prompts: classify tweets by POST CONTENT, not platform
- `x.com` posts about AI → AI category; only classify as "Social Media" if the content is truly about social media as a subject

## Technical Notes

### Column alignment
- The table uses CSS Grid with `gridTemplateColumns` passed as inline style to header, filter row, and data rows
- Header/filter/body all need identical `gap` and `padding` for alignment
- `scrollbar-gutter: stable` on `.decant-table__body` prevents scrollbar from misaligning content vs header
- localStorage keys (column widths, order, visibility) should be bumped whenever column layout changes significantly

### Content type codes
- T=Tool, A=Article, V=Video, P=Paper, R=Repo, G=Guide, S=Service, C=Course, I=Image, N=News, K=Knowledge, U=Unknown
- Domain overrides: x.com/twitter.com → "X", youtube.com → "Video"

### Hierarchy color inheritance
- Segment branches (depth 1) get a color from `SEGMENT_PALETTE` based on their segment code letter
- Category and subcategory branches inherit their parent segment's color
- This is done via `parentColor` parameter in `buildBranchNode()` in `tree_builder.ts`

## Lessons Learned

### Per-node classification fails for topic-based organization
- Classifying each node individually (SemanticProfiler) misses the big picture — the LLM sees "x.com" and says "Social Media" without knowing that 40 other items are also AI-related
- Holistic classification (DynamicClassifier) produces dramatically better results because it sees the full collection and finds natural clusters
- This is the difference between "classify this one item" and "organize this library"

### CSS Grid + scrollbar = alignment headaches
- When the body has `overflow: auto` and the header is outside the scrollable area, the scrollbar steals width from the body but not the header
- `scrollbar-gutter: stable` is the modern fix — always reserves space for the scrollbar

### Session: 2026-03-19
- Deployed to fly.io: https://decant-app.fly.dev/
- Commit: `69906122f` — holistic classification, column fixes, progress bar
