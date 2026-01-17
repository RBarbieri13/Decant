# Decant - Visual Content Curation App

## Overview

Decant is a visual content curation application built on top of Trilium Notes, inspired by Toby's visual workspace UI. It transforms browser tabs, links, documents, and online resources into an organized, AI-powered knowledge management system.

## Core Value Propositions

1. **One-Click Content Capture** - Import any URL and the system automatically processes it
2. **AI-Powered Organization** - Automatic categorization, tagging, summarization, and hierarchical placement
3. **Visual Workspace UI** - Card-based visual organization with Spaces and Collections
4. **Multi-Content Type Support** - Handles diverse content types uniformly

## Supported Content Types

| Type | Description | Detection Pattern |
|------|-------------|-------------------|
| Website | General web pages | Default |
| Article | Long-form written content | Medium, Substack, news sites |
| YouTube | Video content | youtube.com, youtu.be |
| Podcast | Audio content | Spotify, Apple Podcasts, podcast RSS |
| Paper | Academic/research papers | arxiv.org, DOI links, .pdf |
| Tool | Software/SaaS tools | Product pages, GitHub repos |
| File | Downloadable files | Direct file links |
| Image | Visual content | Image URLs, Pinterest, Unsplash |
| Text | Plain text/notes | Manual text input |

## Architecture

### Layer Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                     Visual Workspace UI                          │
│  ┌─────────────┐  ┌─────────────────────────────────────────┐   │
│  │   Spaces    │  │          Content Grid                    │   │
│  │   Sidebar   │  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │   │
│  │             │  │  │ Card │ │ Card │ │ Card │ │ Card │   │   │
│  │  - Space 1  │  │  └──────┘ └──────┘ └──────┘ └──────┘   │   │
│  │  - Space 2  │  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │   │
│  │  - Space 3  │  │  │ Card │ │ Card │ │ Card │ │ Card │   │   │
│  │             │  │  └──────┘ └──────┘ └──────┘ └──────┘   │   │
│  └─────────────┘  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Decant Services Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Content   │  │     AI      │  │     Space               │  │
│  │   Importer  │  │   Service   │  │     Manager             │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Trilium Core (Backend)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │    Becca    │  │    Notes    │  │     Attributes          │  │
│  │    Cache    │  │   Service   │  │     System              │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Model

#### Space (Collection Container)
Maps to a Trilium Note with type `decantSpace`:
```
Note {
  type: "decantSpace"
  attributes: {
    #decantSpaceIcon: string (emoji or icon name)
    #decantSpaceColor: string (hex color)
    #decantSpaceOrder: number
    #decantSpaceView: "grid" | "list" | "board"
  }
}
```

#### Content Item (Saved Resource)
Maps to a Trilium Note with type `decantItem`:
```
Note {
  type: "decantItem"
  attributes: {
    #contentType: "website" | "article" | "youtube" | "podcast" | ...
    #sourceUrl: string (original URL)
    #favicon: string (favicon URL or data URI)
    #thumbnail: string (preview image URL)
    #domain: string (source domain)
    #aiSummary: text (AI-generated summary)
    #aiTags: string[] (AI-generated tags)
    #aiCategory: string (AI-suggested category)
    #importedAt: datetime
    #lastAccessed: datetime
    label~tag: string (user or AI tags)
  }
}
```

### Directory Structure

```
apps/client/src/
├── decant/                          # Decant-specific code
│   ├── components/                  # React/Preact components
│   │   ├── DecantApp.tsx           # Main app container
│   │   ├── SpacesSidebar.tsx       # Left sidebar with spaces
│   │   ├── ContentGrid.tsx         # Main content grid view
│   │   ├── ContentCard.tsx         # Individual content card
│   │   ├── ContentCardTypes/       # Type-specific card renderers
│   │   │   ├── ArticleCard.tsx
│   │   │   ├── YouTubeCard.tsx
│   │   │   ├── PodcastCard.tsx
│   │   │   ├── ToolCard.tsx
│   │   │   ├── PaperCard.tsx
│   │   │   ├── ImageCard.tsx
│   │   │   └── WebsiteCard.tsx
│   │   ├── ImportModal.tsx         # URL import modal
│   │   ├── QuickCapture.tsx        # Quick capture input
│   │   ├── SearchBar.tsx           # Search/filter bar
│   │   └── TagCloud.tsx            # Tag visualization
│   │
│   ├── services/                    # Business logic
│   │   ├── contentImporter.ts      # URL import & processing
│   │   ├── contentDetector.ts      # Content type detection
│   │   ├── aiService.ts            # AI categorization & summary
│   │   ├── spaceManager.ts         # Space CRUD operations
│   │   ├── metadataExtractor.ts    # Metadata extraction
│   │   └── thumbnailService.ts     # Thumbnail generation
│   │
│   ├── hooks/                       # Custom React hooks
│   │   ├── useSpaces.ts            # Space data hook
│   │   ├── useContentItems.ts      # Content items hook
│   │   ├── useDragDrop.ts          # Drag & drop logic
│   │   └── useImport.ts            # Import functionality
│   │
│   ├── styles/                      # Decant-specific styles
│   │   ├── decant.css              # Main stylesheet
│   │   ├── cards.css               # Card component styles
│   │   ├── sidebar.css             # Sidebar styles
│   │   └── themes/                 # Theme variants
│   │       ├── light.css
│   │       └── dark.css
│   │
│   └── types/                       # TypeScript types
│       ├── content.ts              # Content type definitions
│       ├── space.ts                # Space type definitions
│       └── ai.ts                   # AI service types

apps/server/src/
├── decant/                          # Server-side Decant code
│   ├── routes/                      # API routes
│   │   ├── import.ts               # Content import endpoints
│   │   ├── spaces.ts               # Space management endpoints
│   │   └── ai.ts                   # AI processing endpoints
│   │
│   ├── services/                    # Server services
│   │   ├── urlFetcher.ts           # URL content fetching
│   │   ├── metadataParser.ts       # HTML metadata parsing
│   │   ├── aiProcessor.ts          # AI processing logic
│   │   └── contentTypeResolver.ts  # Content type detection
│   │
│   └── migrations/                  # Database migrations
│       └── 001_decant_setup.ts     # Initial Decant setup
```

## UI Components

### 1. Spaces Sidebar
- Collapsible left panel
- List of Spaces with icons and colors
- Drag-to-reorder functionality
- Quick space creation
- All Items / Recent / Favorites sections

### 2. Content Grid
- Responsive grid of content cards
- Masonry or fixed-grid layout options
- Virtual scrolling for performance
- Drag-and-drop reorganization
- Multi-select capability

### 3. Content Card
- Thumbnail/preview image
- Title (auto-extracted or user-defined)
- Domain/source indicator
- Content type icon badge
- AI-generated tags (compact)
- Quick actions (open, edit, delete)
- Hover state with expanded info

### 4. Quick Capture
- Persistent input field at top
- Paste URL or type text
- Auto-detection of content type
- Immediate AI processing feedback
- Drag-and-drop URL support

### 5. Import Modal
- Multi-URL batch import
- Content preview before saving
- Space selection
- Manual tag override
- AI suggestion review

## AI Integration

### Processing Pipeline

```
URL Input → Fetch Content → Extract Metadata → AI Analysis → Store
    │            │               │                │           │
    └────────────┴───────────────┴────────────────┴───────────┘
                              Async Pipeline
```

### AI Capabilities

1. **Content Type Detection**
   - URL pattern analysis
   - HTML structure analysis
   - MIME type detection

2. **Metadata Extraction**
   - Title, description, author
   - Publication date
   - Canonical URL
   - Open Graph / Twitter cards

3. **Summarization**
   - Extract key points
   - Generate 2-3 sentence summary
   - Identify main topics

4. **Categorization**
   - Suggest appropriate Space
   - Generate relevant tags
   - Identify related content

5. **Knowledge Extraction**
   - Key facts and insights
   - Notable quotes
   - Action items (if applicable)

## Implementation Phases

### Phase 1: Foundation
- [ ] Project structure setup
- [ ] Basic data models
- [ ] Space management
- [ ] Simple content import
- [ ] Basic card grid UI

### Phase 2: Core Features
- [ ] Content type detection
- [ ] Metadata extraction
- [ ] Thumbnail generation
- [ ] Drag-and-drop
- [ ] Search and filter

### Phase 3: AI Integration
- [ ] AI service setup
- [ ] Auto-categorization
- [ ] Summarization
- [ ] Tag generation
- [ ] Smart suggestions

### Phase 4: Polish
- [ ] Keyboard shortcuts
- [ ] Bulk operations
- [ ] Export/import
- [ ] Browser extension
- [ ] Performance optimization

## Technical Decisions

### Why Trilium as Backend
- Hierarchical note structure perfect for Spaces/Collections
- Robust attribute system for metadata
- Full-text search built-in
- Sync capabilities
- Extensible scripting system

### UI Technology
- Preact for lightweight React compatibility
- CSS custom properties for theming
- Virtual scrolling for large collections
- Intersection Observer for lazy loading

### AI Integration
- Server-side AI processing (privacy)
- Queueing system for batch processing
- Caching for duplicate URLs
- Configurable AI providers
