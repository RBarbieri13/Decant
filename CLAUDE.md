# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Trilium Notes is a hierarchical note-taking application with advanced features like synchronization, scripting, and rich text editing. It's built as a TypeScript monorepo using pnpm, with multiple applications and shared packages.

## Development Commands

### Setup
- `pnpm install` - Install all dependencies
- `corepack enable` - Enable pnpm if not available

### Running Applications
- `pnpm run server:start` - Start development server (http://localhost:8080)
- `pnpm run server:start-prod` - Run server in production mode

### Building
- `pnpm run client:build` - Build client application
- `pnpm run server:build` - Build server application
- `pnpm run electron:build` - Build desktop application

### Testing
- `pnpm test:all` - Run all tests (parallel + sequential)
- `pnpm test:parallel` - Run tests that can run in parallel
- `pnpm test:sequential` - Run tests that must run sequentially (server, ckeditor5-mermaid, ckeditor5-math)
- `pnpm coverage` - Generate coverage reports

## Architecture Overview

### Monorepo Structure
- **apps/**: Runnable applications
  - `client/` - Frontend application (shared by server and desktop)
  - `server/` - Node.js server with web interface
  - `desktop/` - Electron desktop application
  - `web-clipper/` - Browser extension for saving web content
  - Additional tools: `db-compare`, `dump-db`, `edit-docs`

- **packages/**: Shared libraries
  - `commons/` - Shared interfaces and utilities
  - `ckeditor5/` - Custom rich text editor with Trilium-specific plugins
  - `codemirror/` - Code editor customizations
  - `highlightjs/` - Syntax highlighting
  - Custom CKEditor plugins: `ckeditor5-admonition`, `ckeditor5-footnotes`, `ckeditor5-math`, `ckeditor5-mermaid`

### Core Architecture Patterns

#### Three-Layer Cache System
- **Becca** (Backend Cache): Server-side entity cache (`apps/server/src/becca/`)
- **Froca** (Frontend Cache): Client-side mirror of backend data (`apps/client/src/services/froca.ts`)
- **Shaca** (Share Cache): Optimized cache for shared/published notes (`apps/server/src/share/`)

#### Entity System
Core entities are defined in `apps/server/src/becca/entities/`:
- `BNote` - Notes with content and metadata
- `BBranch` - Hierarchical relationships between notes (allows multiple parents)
- `BAttribute` - Key-value metadata attached to notes
- `BRevision` - Note version history
- `BOption` - Application configuration

#### Widget-Based UI
Frontend uses a widget system (`apps/client/src/widgets/`):
- `BasicWidget` - Base class for all UI components
- `NoteContextAwareWidget` - Widgets that respond to note changes
- `RightPanelWidget` - Widgets displayed in the right panel
- Type-specific widgets in `type_widgets/` directory

#### API Architecture
- **Internal API**: REST endpoints in `apps/server/src/routes/api/`
- **ETAPI**: External API for third-party integrations (`apps/server/src/etapi/`)
- **WebSocket**: Real-time synchronization (`apps/server/src/services/ws.ts`)

### Key Files for Understanding Architecture

1. **Application Entry Points**:
   - `apps/server/src/main.ts` - Server startup
   - `apps/client/src/desktop.ts` - Client initialization

2. **Core Services**:
   - `apps/server/src/becca/becca.ts` - Backend data management
   - `apps/client/src/services/froca.ts` - Frontend data synchronization
   - `apps/server/src/services/backend_script_api.ts` - Scripting API

3. **Database Schema**:
   - `apps/server/src/assets/db/schema.sql` - Core database structure

4. **Configuration**:
   - `package.json` - Project dependencies and scripts

## Note Types and Features

Trilium supports multiple note types, each with specialized widgets:
- **Text**: Rich text with CKEditor5 (markdown import/export)
- **Code**: Syntax-highlighted code editing with CodeMirror
- **File**: Binary file attachments
- **Image**: Image display with editing capabilities
- **Canvas**: Drawing/diagramming with Excalidraw
- **Mermaid**: Diagram generation
- **Relation Map**: Visual note relationship mapping
- **Web View**: Embedded web pages
- **Doc/Book**: Hierarchical documentation structure

## Development Guidelines

### Testing Strategy
- Server tests run sequentially due to shared database
- Client tests can run in parallel
- E2E tests use Playwright for both server and desktop apps
- Build validation tests check artifact integrity

### Scripting System
Trilium provides powerful user scripting capabilities:
- Frontend scripts run in browser context
- Backend scripts run in Node.js context with full API access
- Script API documentation available in `docs/Script API/`

### Internationalization
- Translation files in `apps/client/src/translations/`
- Supported languages: English, German, Spanish, French, Romanian, Chinese

### Security Considerations
- Per-note encryption with granular protected sessions
- CSRF protection for API endpoints
- OpenID and TOTP authentication support
- Sanitization of user-generated content

## Common Development Tasks

### Adding New Note Types
1. Create widget in `apps/client/src/widgets/type_widgets/`
2. Register in `apps/client/src/services/note_types.ts`
3. Add backend handling in `apps/server/src/services/notes.ts`

### Extending Search
- Search expressions handled in `apps/server/src/services/search/`
- Add new search operators in search context files

### Custom CKEditor Plugins
- Create new package in `packages/` following existing plugin structure
- Register in `packages/ckeditor5/src/plugins.ts`

### Database Migrations
- Add migration scripts in `apps/server/src/migrations/`
- Update schema in `apps/server/src/assets/db/schema.sql`

## Build System Notes
- Uses pnpm for monorepo management
- Vite for fast development builds
- ESBuild for production optimization
- pnpm workspaces for dependency management
- Docker support with multi-stage builds

---

## Plan Review Protocol

Review any plan thoroughly before making code changes. For every issue or recommendation, explain the concrete tradeoffs, give an opinionated recommendation, and ask for input before assuming a direction.

### Engineering Preferences

Use these to guide all recommendations:

- **DRY is important** — flag repetition aggressively.
- **Well-tested code is non-negotiable** — too many tests > too few.
- **"Engineered enough"** — not fragile/hacky, not over-abstracted or prematurely complex.
- **Err on the side of handling more edge cases**, not fewer. Thoughtfulness > speed.
- **Bias toward explicit over clever.**

### BEFORE YOU START

Ask the user to choose:

1. **BIG CHANGE** — Work through interactively, one section at a time (Architecture → Code Quality → Tests → Performance), up to 4 top issues per section.
2. **SMALL CHANGE** — Work through interactively with ONE question per review section.

### Review Sections

#### 1. Architecture Review
Evaluate:
- Overall system design and component boundaries.
- Dependency graph and coupling concerns.
- Data flow patterns and potential bottlenecks.
- Scaling characteristics and single points of failure.
- Security architecture (auth, data access, API boundaries).

#### 2. Code Quality Review
Evaluate:
- Code organization and module structure.
- DRY violations — be aggressive here.
- Error handling patterns and missing edge cases (call these out explicitly).
- Technical debt hotspots.
- Areas that are over- or under-engineered relative to the preferences above.

#### 3. Test Review
Evaluate:
- Test coverage gaps (unit, integration, e2e).
- Test quality and assertion strength.
- Missing edge case coverage — be thorough.
- Untested failure modes and error paths.

#### 4. Performance Review
Evaluate:
- N+1 queries and database access patterns.
- Memory-usage concerns.
- Caching opportunities.
- Slow or high-complexity code paths.

### Per-Issue Format

For every specific issue (bug, smell, design concern, or risk):

1. Describe the problem concretely, with file and line references.
2. Present 2–3 options, including "do nothing" where reasonable.
3. For each option: implementation effort, risk, impact on other code, maintenance burden.
4. Give the recommended option and why, mapped to the engineering preferences above.
5. Use `AskUserQuestion` to confirm direction before proceeding.

### Interaction Rules

- Do not assume priorities on timeline or scale.
- After each section, pause and ask for feedback before moving on.
- **NUMBER issues. Give LETTERS for options** (e.g., Issue 1 Option A).
- Output explanation + pros/cons + opinionated recommendation, then use `AskUserQuestion`.
- Always make the recommended option the 1st option in `AskUserQuestion`.
- Each option in `AskUserQuestion` must clearly label the issue NUMBER and option LETTER.
