# Decant Project - Codex Onboarding Guide

## Quick Start

Clone and set up the Decant project from GitHub:

```bash
git clone https://github.com/RBarbieri13/Decant.git
cd Decant
corepack enable
pnpm install
```

## Project Overview

**Decant** is an advanced hierarchical note-taking and knowledge management application built on top of Trilium Notes. It features:

- **Hierarchical note organization** with multiple parent support (notes can exist in multiple locations)
- **Rich content types**: Text, Code, Images, Canvas/Drawing, Mermaid diagrams, Web views
- **AI-powered import system** for automatically classifying and extracting content from URLs, YouTube, GitHub, and more
- **Real-time synchronization** across devices
- **Advanced search** with custom operators and filters
- **Scripting API** for automation and custom functionality
- **Desktop (Electron) and Web** deployment options

## Architecture Overview

### Monorepo Structure
```
Decant/
├── apps/
│   ├── server/          # Node.js backend with REST API and WebSocket
│   ├── client/          # Frontend application (shared by web and desktop)
│   ├── desktop/         # Electron desktop wrapper
│   └── web-clipper/     # Browser extension
├── packages/
│   ├── commons/         # Shared TypeScript interfaces and utilities
│   ├── ckeditor5/       # Custom rich text editor
│   └── codemirror/      # Code editor customizations
└── decant-standalone/   # Standalone demo application
```

### Key Technologies
- **TypeScript** - Primary language
- **pnpm** - Package manager with workspace support
- **Vite** - Build tool and dev server
- **SQLite** (better-sqlite3) - Database
- **CKEditor5** - Rich text editing
- **CodeMirror** - Code editing
- **React** (in decant-standalone) - UI framework for demo

### Core Architecture Patterns

#### Three-Layer Cache System
1. **Becca** (Backend Cache): Server-side entity cache in `apps/server/src/becca/`
2. **Froca** (Frontend Cache): Client-side data mirror in `apps/client/src/services/froca.ts`
3. **Shaca** (Share Cache): Optimized for shared/published notes in `apps/server/src/share/`

#### Entity System
Located in `apps/server/src/becca/entities/`:
- `BNote` - Notes with content and metadata
- `BBranch` - Hierarchical relationships (enables multiple parents)
- `BAttribute` - Key-value metadata attached to notes
- `BRevision` - Version history
- `BOption` - Application configuration

#### Widget-Based UI
Frontend components in `apps/client/src/widgets/`:
- `BasicWidget` - Base class for all UI components
- `NoteContextAwareWidget` - Widgets that respond to note changes
- `RightPanelWidget` - Right sidebar widgets
- Type-specific widgets in `type_widgets/` directory

**New Decant Widget System** in `apps/client/src/widgets/decant/`:
- **Atoms**: Basic UI elements (SearchInput, Tag, TypeIcon, etc.)
- **Composites**: Composed components (DataTableRow, TreeNode, TopBar)
- **Containers**: Full layouts (DataTable, HierarchyTree, PropertiesPanel)

## Recent Development - AI Import System

### What's New
The latest feature is an **AI-powered import service** that automatically:
1. Classifies URLs (YouTube, GitHub, web articles, etc.)
2. Extracts content using specialized extractors
3. Processes with LLM (Gemini) for summarization and metadata
4. Creates structured notes in the Decant hierarchy

### Key Files
- `apps/server/src/services/ai_import_service.ts` - Main import orchestration
- `apps/server/src/services/extractors/` - Content extractors (YouTube, GitHub, Firecrawl)
- `apps/server/src/routes/api/ai_import.ts` - REST API endpoint
- `apps/server/src/services/llm/tools/classification_schema.ts` - LLM classification logic
- `decant-standalone/src/renderer/components/import/BatchImportModal.tsx` - UI for batch imports
- `decant-standalone/src/renderer/components/import/BatchImportResults.tsx` - Results display

### Documentation
- `docs/AI_IMPORT_SERVICE.md` - Complete service documentation
- `docs/AI_IMPORT_IMPLEMENTATION_SUMMARY.md` - Implementation details
- `docs/CONFIGURATION.md` - API key and configuration guide
- `docs/DEPLOYMENT.md` - Deployment instructions

## Development Commands

### Initial Setup
```bash
pnpm install                    # Install all dependencies
```

### Running the Application
```bash
pnpm run server:start           # Start dev server at http://localhost:8080
pnpm run server:start-prod      # Run in production mode
```

### Building
```bash
pnpm run client:build           # Build client application
pnpm run server:build           # Build server application
pnpm run electron:build         # Build desktop application
```

### Testing
```bash
pnpm test:all                   # Run all tests
pnpm test:parallel              # Run parallelizable tests
pnpm test:sequential            # Run sequential tests (server, plugins)
pnpm coverage                   # Generate coverage reports
```

### Standalone Demo
```bash
cd decant-standalone
pnpm install
pnpm dev                        # Start demo at http://localhost:5173
```

## Configuration Requirements

### API Keys (for AI Import)
Create options in the database or use environment variables:
- `firecrawlApiKey` - For web scraping (Firecrawl.dev)
- `geminiApiKey` - For LLM processing (Google Gemini)
- `youtubeApiKey` - For YouTube metadata
- `githubAccessToken` - For GitHub API access

**Security Note**: Never commit API keys to the repository. They should be configured via:
1. Database options table (see `apps/server/src/services/options_init.ts`)
2. Environment variables
3. Secure configuration management

### Database
- Default location: `apps/server/data/document.db`
- Schema: `apps/server/src/assets/db/schema.sql`
- Migrations: `apps/server/src/migrations/`

## Current State & Next Steps

### What's Working
✅ Core note-taking and hierarchy system
✅ AI import service with multiple extractors
✅ Batch import UI with progress tracking
✅ Rich text and code editing
✅ Desktop and web deployment
✅ Search and filtering
✅ Widget system with Decant components

### Areas for Development

#### High Priority
1. **Extractor Expansion**: Add more content sources (Twitter, Reddit, PDFs, emails)
2. **Import Refinement**: Improve metadata extraction and categorization accuracy
3. **UI Polish**: Complete the Decant widget system integration into main app
4. **Error Handling**: Enhance error recovery in import service
5. **Testing**: Increase test coverage for AI import flows

#### Medium Priority
6. **Performance**: Optimize large note hierarchies and search
7. **Mobile Support**: Responsive design and mobile app
8. **Collaboration**: Real-time multi-user editing
9. **Export**: Better export formats (Markdown, PDF, OPML)
10. **Plugins**: Plugin system for community extensions

#### Technical Debt
- Remove deprecated layout components (already done in standalone)
- Standardize error handling patterns
- Improve TypeScript coverage
- Consolidate cache implementations

## Important Patterns & Conventions

### Code Style
- **TypeScript strict mode** enabled
- **Functional components** preferred for React
- **Async/await** for asynchronous operations
- **Error boundaries** for graceful failure handling

### Database Patterns
- All entities have `utcDateModified` for sync
- Use prepared statements for SQL queries
- Transactions for multi-step operations
- Soft deletes with `isDeleted` flag

### API Patterns
- REST endpoints in `apps/server/src/routes/api/`
- ETAPI for external integrations in `apps/server/src/etapi/`
- WebSocket for real-time updates via `apps/server/src/services/ws.ts`
- Consistent error responses with status codes

### Testing Patterns
- Unit tests alongside source files (`.spec.ts`)
- Integration tests in separate directories
- E2E tests use Playwright
- Server tests run sequentially (shared database)

## Helpful Context

### When Adding New Features
1. Check existing patterns in similar features
2. Update relevant cache layers (Becca/Froca)
3. Add appropriate error handling
4. Write tests before implementation (TDD encouraged)
5. Update documentation in `/docs`

### When Debugging
- Server logs: Check console output from `pnpm run server:start`
- Client errors: Browser DevTools console
- Database inspection: Use SQLite tools on `document.db`
- Network: Check browser Network tab for API calls

### When Modifying Database Schema
1. Create migration in `apps/server/src/migrations/`
2. Update `schema.sql`
3. Update entity classes in `apps/server/src/becca/entities/`
4. Test migration on existing database

## Project Philosophy

### Design Principles
- **Hierarchical by default**: Everything should support multiple parents
- **Fast and local-first**: Prioritize local performance over cloud features
- **Extensible**: Support scripting and plugins
- **Privacy-focused**: Optional encryption, self-hosted
- **Power user friendly**: Keyboard shortcuts, advanced features

### User Experience Goals
- **Zero learning curve** for basic note-taking
- **Progressive disclosure** of advanced features
- **Fast navigation** between notes
- **Flexible organization** (tags, hierarchy, relations)
- **Seamless synchronization** across devices

## Getting Help

### Key Documentation Files
- `CLAUDE.md` - Development guidance for AI assistants
- `README.md` - Project overview and quick start
- `docs/` - Comprehensive documentation
- `apps/server/docs/` - Server-specific docs

### Useful Entry Points for Understanding Code
1. **Server startup**: `apps/server/src/main.ts`
2. **Client initialization**: `apps/client/src/desktop.ts`
3. **Data management**: `apps/server/src/becca/becca.ts`
4. **Frontend sync**: `apps/client/src/services/froca.ts`
5. **Database schema**: `apps/server/src/assets/db/schema.sql`

### Common Tasks Reference

**Adding a new note type:**
1. Create widget in `apps/client/src/widgets/type_widgets/`
2. Register in `apps/client/src/services/note_types.ts`
3. Add backend handling in `apps/server/src/services/notes.ts`

**Adding a new API endpoint:**
1. Create route handler in `apps/server/src/routes/api/`
2. Register route in `apps/server/src/routes/routes.ts`
3. Add service logic if needed
4. Add client-side API call

**Extending search:**
1. Modify search context in `apps/server/src/services/search/`
2. Add new operators or filters
3. Update search documentation

## Summary for Codex

You are joining an active TypeScript monorepo project that extends Trilium Notes with advanced features. The codebase is well-structured with clear separation of concerns:
- Backend (Node.js + SQLite)
- Frontend (TypeScript widgets)
- Shared packages (CKEditor, CodeMirror, commons)

Recent work focused on building an AI-powered import system that intelligently extracts and categorizes content from various sources. The project values code quality, testing, and thoughtful architecture over rapid iteration.

Start by exploring the `apps/server/src/services/ai_import_service.ts` and related extractors to understand the latest feature. Review the entity system in `apps/server/src/becca/entities/` to understand data modeling. Check out the widget system in `apps/client/src/widgets/decant/` to see the new UI components.

**Your mission**: Continue development by improving the AI import system, expanding content extractors, refining the UI, and maintaining the high quality bar established in the codebase.
