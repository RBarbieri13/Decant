# Decant Integration Strategy

This document describes how Decant extends Trilium Notes to create a Toby-like knowledge curation platform with AI-powered auto-organization.

## Architecture Overview

Decant is built on top of **Trilium Notes (TriliumNext)**, leveraging its existing infrastructure:

```
┌─────────────────────────────────────────────────────────────────┐
│                      DECANT LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Workspace    │  │ AI Import    │  │ Content Extractors   │  │
│  │ View Widget  │  │ Service      │  │ (YouTube, GitHub...) │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                              │                                   │
│  ┌──────────────────────────┴────────────────────────────────┐  │
│  │           Auto-Categorization LLM Tool                     │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┴───────────────────────────────────┐
│                      TRILIUM LAYER                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ LLM Pipeline │  │ Note/Branch  │  │ Attribute System     │  │
│  │ (OpenAI,     │  │ Entity       │  │ (Labels, Relations)  │  │
│  │  Anthropic)  │  │ System       │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Widget       │  │ REST API     │  │ SQLite Database      │  │
│  │ System       │  │ + ETAPI      │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Extension Points

### 1. LLM Tools (`apps/server/src/services/llm/tools/`)

Trilium has a complete LLM tool system. We add:

- **`auto_categorization_tool.ts`** - Analyzes content and determines optimal placement

The tool integrates with existing tools:
- `create_note` - Creates the item note
- `attribute_manager` - Sets labels and tags

### 2. Widget System (`apps/client/src/widgets/`)

Trilium's widget system allows custom UI components:

- **`workspace_view/`** - New widget directory for Toby-like grid view
  - Queries notes by `#decantType` attribute
  - Renders Spaces → Collections → Items hierarchy
  - Handles drag-and-drop reorganization

### 3. API Routes (`apps/server/src/routes/api/`)

Add new endpoint for AI-powered imports:

- **`POST /api/ai-import`** - Accepts URL, returns categorized note

### 4. Services (`apps/server/src/services/`)

New services for content processing:

- **`ai_import_service.ts`** - Orchestrates the import pipeline
- **`content_extractors/`** - Type-specific content extraction

## Data Model Convention

Decant uses Trilium's attribute system to mark notes for the workspace view:

```
Notes with #decantType:
├── #decantType=space      (Top-level workspace)
│   ├── #decantType=collection  (Group within space)
│   │   ├── #decantType=item    (Individual bookmark)
│   │   └── #decantType=item
│   └── #decantType=collection
└── #decantType=space
```

### Item Attributes

Each item note has these attributes:

| Attribute | Type | Description |
|-----------|------|-------------|
| `#decantType` | label | Always "item" |
| `#sourceUrl` | label | Original URL |
| `#contentType` | label | youtube, article, podcast, etc. |
| `#favicon` | label | URL to favicon |
| `#thumbnail` | label | URL to thumbnail image |
| `#aiSummary` | label | AI-generated summary |
| `#aiConfidence` | label | AI placement confidence (0-1) |
| `#aiTags` | label | Comma-separated AI tags |

## Implementation Phases

### Phase 1: AI Categorization Tool

**Files to create:**
```
apps/server/src/services/llm/tools/auto_categorization_tool.ts
```

**Files to modify:**
```
apps/server/src/services/llm/tools/tool_registry.ts  # Register new tool
```

**Testing:**
1. Use existing LLM chat to call `auto_categorize` tool
2. Verify correct Space/Collection suggestions
3. Test with various content types

### Phase 2: Content Extractors

**Files to create:**
```
apps/server/src/services/content_extractors/
├── extractor_interface.ts
├── youtube_extractor.ts
├── article_extractor.ts
├── github_extractor.ts
├── podcast_extractor.ts
├── paper_extractor.ts
└── generic_extractor.ts
```

**Dependencies to add:**
```json
{
  "youtube-transcript": "^1.x",
  "pdf-parse": "^1.x",
  "rss-parser": "^3.x"
}
```

### Phase 3: Import Pipeline

**Files to create:**
```
apps/server/src/services/ai_import_service.ts
apps/server/src/routes/api/ai_import.ts
```

**Files to modify:**
```
apps/server/src/routes/routes.ts  # Add ai_import routes
```

### Phase 4: Workspace Widget

**Files to create:**
```
apps/client/src/widgets/workspace_view/
├── workspace_view_widget.ts
├── space_panel.ts
├── collection_grid.ts
├── item_card.ts
├── workspace_toolbar.ts
└── workspace_styles.css
```

**Files to modify:**
```
apps/client/src/widgets/root_widgets.ts  # Register widget
```

### Phase 5: Web Clipper Enhancement

**Files to create:**
```
apps/web-clipper/ai_save.js
apps/web-clipper/popup/ai_preview.html
```

**Files to modify:**
```
apps/web-clipper/manifest.json  # Add permissions
apps/web-clipper/popup/popup.html  # Add AI save button
```

## Development Workflow

### Setup

```bash
# Clone and install
git clone https://github.com/RBarbieri13/Decant.git
cd Decant
corepack enable
pnpm install

# Start dev server
pnpm run server:start
```

### Testing Changes

```bash
# Run all tests
pnpm test:all

# Run specific test file
pnpm test apps/server/src/services/llm/tools/auto_categorization_tool.spec.ts
```

### Building

```bash
# Build client
pnpm run client:build

# Build for production
pnpm run server:build
```

## Configuration

### Environment Variables

Create `.env` in the root:

```env
# LLM Provider (at least one required)
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
# or local
OLLAMA_URL=http://localhost:11434

# Optional: Enhanced extraction
YOUTUBE_API_KEY=...
GITHUB_TOKEN=...
```

### LLM Provider Selection

Trilium's LLM infrastructure automatically selects providers based on availability. Configure in the app's AI settings (Options → AI).

## Migration from Standalone Plan

The original plan proposed a Next.js + PostgreSQL architecture. Here's how concepts map to Trilium:

| Original Concept | Trilium Equivalent |
|------------------|-------------------|
| PostgreSQL DB | SQLite (local-first) |
| Prisma ORM | Becca entity system |
| NextAuth.js | Trilium auth (password/OpenID) |
| React Query | Froca (frontend cache) |
| shadcn/ui | Trilium widget system |
| Vercel deploy | Self-hosted or Docker |

## File Structure Reference

```
Decant/
├── apps/
│   ├── client/
│   │   └── src/
│   │       ├── widgets/
│   │       │   └── workspace_view/     # NEW: Toby-like UI
│   │       └── services/
│   │           └── froca.ts            # Frontend cache
│   ├── server/
│   │   └── src/
│   │       ├── services/
│   │       │   ├── llm/
│   │       │   │   └── tools/
│   │       │   │       └── auto_categorization_tool.ts  # NEW
│   │       │   ├── content_extractors/  # NEW
│   │       │   └── ai_import_service.ts # NEW
│   │       ├── routes/
│   │       │   └── api/
│   │       │       └── ai_import.ts     # NEW
│   │       └── becca/
│   │           └── entities/            # Core entities
│   └── web-clipper/
│       └── ai_save.js                   # NEW
├── packages/
│   └── commons/                         # Shared types
└── docs/
    └── DECANT_INTEGRATION.md            # This file
```

## Next Steps

1. **Start with Phase 1** - Create the auto-categorization tool
2. **Test with manual taxonomy** - Create Spaces/Collections manually first
3. **Iterate on AI prompts** - Refine categorization accuracy
4. **Build extractors incrementally** - Start with article/generic, then YouTube
5. **Create workspace widget** - Basic grid view first, then polish
