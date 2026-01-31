# Development Guide

Complete guide for setting up, developing, and extending the Decant application.

## Table of Contents

- [Local Setup](#local-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Adding Features](#adding-features)
- [Testing](#testing)
- [Code Style](#code-style)
- [Debugging](#debugging)

---

## Local Setup

### Prerequisites

**Required**:
- Node.js 18+ (for ES modules support)
- npm or pnpm
- Git

**Optional**:
- SQLite CLI tools (for database inspection)
- OpenAI API key (for AI features)
- curl or Postman (for API testing)

**Check versions**:
```bash
node --version    # Should be v18.0.0 or higher
npm --version     # Should be 9.0.0 or higher
```

---

### Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd decant-standalone

# Install dependencies
npm install

# Verify installation
npm run test:run
```

---

### Environment Setup

**Create `.env` file** (optional, defaults work for development):

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
DATABASE_PATH=~/.decant/data/decant.db

# OpenAI (required for import features)
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4o-mini

# Logging
LOG_LEVEL=debug
LOG_PRETTY=true

# Rate Limiting (optional)
RATE_LIMIT_MAX=100
RATE_LIMIT_IMPORT_MAX=10
RATE_LIMIT_WINDOW_MS=60000

# Security (optional)
DECANT_MASTER_KEY=your-32-char-minimum-secret-key
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Scraper (optional)
SCRAPER_TIMEOUT_MS=30000
SCRAPER_MAX_SIZE_BYTES=5242880
```

**Environment variable reference**:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `NODE_ENV` | development | Environment mode |
| `DATABASE_PATH` | `~/.decant/data/decant.db` | SQLite database location |
| `OPENAI_API_KEY` | - | OpenAI API key (required for imports) |
| `OPENAI_MODEL` | gpt-4o-mini | OpenAI model to use |
| `LOG_LEVEL` | info | Logging verbosity (trace/debug/info/warn/error) |
| `LOG_PRETTY` | true | Pretty-print logs (vs JSON) |
| `RATE_LIMIT_MAX` | 100 | Global requests per window |
| `RATE_LIMIT_IMPORT_MAX` | 10 | Import requests per window |
| `RATE_LIMIT_WINDOW_MS` | 60000 | Rate limit window (ms) |
| `SCRAPER_TIMEOUT_MS` | 30000 | Max scrape time (ms) |
| `SCRAPER_MAX_SIZE_BYTES` | 5242880 | Max content size (5MB) |

---

### Running in Development Mode

**Start development server** (with hot reload):

```bash
npm run dev
```

This runs two processes:
- **Backend**: Express server with `tsx watch` (auto-restart on changes)
- **Frontend**: Vite dev server (HMR for instant updates)

Access the app:
- **Frontend**: http://localhost:5173 (Vite dev server)
- **Backend API**: http://localhost:3000/api (Express server)

**Start only backend**:
```bash
npm run dev:server
```

**Start only frontend**:
```bash
npm run dev:client
```

---

### Building for Production

```bash
# Build both frontend and backend
npm run build

# This creates:
# - dist/ (compiled frontend + backend)
# - dist/assets/ (frontend static assets)
# - dist/server.js (backend entry point)

# Run production build
npm start
```

Access the app:
- **Full app**: http://localhost:3000

---

## Project Structure

```
decant-standalone/
├── src/
│   ├── backend/              # Backend application
│   │   ├── cache/            # In-memory caching layer
│   │   ├── config/           # Environment configuration
│   │   ├── database/         # Database layer
│   │   │   ├── connection.ts # SQLite connection setup
│   │   │   ├── schema.ts     # Database initialization
│   │   │   ├── nodes.ts      # Node CRUD operations
│   │   │   ├── taxonomy.ts   # Segments & Organizations
│   │   │   ├── search.ts     # Full-text search
│   │   │   ├── metadata.ts   # Metadata registry
│   │   │   ├── similarity.ts # Similarity computation
│   │   │   └── migrations/   # Database migrations
│   │   ├── errors/           # Error classes and codes
│   │   ├── health/           # Health check components
│   │   ├── logger/           # Pino logging setup
│   │   ├── middleware/       # Express middleware
│   │   │   ├── errorHandler.ts    # Global error handler
│   │   │   ├── rateLimit.ts       # Rate limiting
│   │   │   ├── security.ts        # CORS, headers, SSRF
│   │   │   ├── validate.ts        # Zod validation
│   │   │   └── requestLogger.ts   # HTTP request logging
│   │   ├── routes/           # API route handlers
│   │   │   ├── index.ts      # Route registration
│   │   │   ├── nodes.ts      # Node endpoints
│   │   │   ├── hierarchy.ts  # Hierarchy endpoints
│   │   │   ├── search.ts     # Search endpoints
│   │   │   ├── import.ts     # Import endpoints
│   │   │   ├── queue.ts      # Queue management
│   │   │   ├── backup.ts     # Backup/restore
│   │   │   ├── health.ts     # Health checks
│   │   │   └── audit.ts      # Audit log
│   │   ├── services/         # Business logic
│   │   │   ├── classifier.ts        # Legacy classifier
│   │   │   ├── phase1_classifier.ts # Quick classification
│   │   │   ├── phase2_enricher.ts   # Deep enrichment
│   │   │   ├── processing_queue.ts  # Background job queue
│   │   │   ├── backup.ts            # Backup service
│   │   │   ├── metadata_registry.ts # Metadata management
│   │   │   ├── keystore.ts          # Secure key storage
│   │   │   ├── extractors/          # Content extractors
│   │   │   │   ├── base.ts          # Base extractor
│   │   │   │   ├── article.ts       # Generic articles
│   │   │   │   ├── youtube.ts       # YouTube videos
│   │   │   │   └── github.ts        # GitHub repos
│   │   │   ├── hierarchy/           # Hierarchy management
│   │   │   │   ├── code_generator.ts
│   │   │   │   ├── differentiator.ts
│   │   │   │   └── restructure.ts
│   │   │   ├── import/              # Import orchestration
│   │   │   │   ├── orchestrator.ts  # Main import flow
│   │   │   │   └── cache.ts         # Import deduplication
│   │   │   ├── llm/                 # LLM integration
│   │   │   │   ├── provider.ts      # OpenAI provider
│   │   │   │   └── prompts/         # LLM prompts
│   │   │   ├── metrics/             # Application metrics
│   │   │   ├── notifications/       # Event notifications
│   │   │   ├── retry/               # Retry and circuit breaker
│   │   │   ├── similarity/          # Similarity computation
│   │   │   └── url/                 # URL validation
│   │   ├── types/            # TypeScript types
│   │   └── validation/       # Zod schemas
│   ├── renderer/             # Frontend application
│   │   ├── App.tsx           # Root component
│   │   ├── components/       # React components
│   │   ├── context/          # React context (global state)
│   │   ├── hooks/            # Custom React hooks
│   │   ├── services/         # Frontend services
│   │   │   ├── api.ts        # API client
│   │   │   └── realtimeService.ts # SSE connection
│   │   └── styles/           # CSS files
│   ├── shared/               # Shared types and constants
│   │   ├── types.ts          # Shared TypeScript interfaces
│   │   └── constants.ts      # Shared constants
│   └── server.ts             # Express server entry point
├── docs/                     # Documentation
├── dist/                     # Build output (generated)
├── node_modules/             # Dependencies (generated)
├── package.json              # Project manifest
├── tsconfig.json             # TypeScript config
├── vite.config.ts            # Vite config (frontend)
└── vitest.config.ts          # Vitest config (tests)
```

---

### Key Files Explained

**Backend entry point**:
- `src/server.ts` - Express server setup, middleware registration, graceful shutdown

**Database**:
- `src/backend/database/connection.ts` - SQLite connection with WAL mode
- `src/backend/database/schema.ts` - Database initialization
- `src/backend/database/migrations/` - Schema versioning

**API layer**:
- `src/backend/routes/index.ts` - Route registration and SSE
- `src/backend/middleware/errorHandler.ts` - Centralized error handling
- `src/backend/validation/schemas.ts` - Zod validation schemas

**Business logic**:
- `src/backend/services/import/orchestrator.ts` - Main import pipeline
- `src/backend/services/phase1_classifier.ts` - Fast AI classification
- `src/backend/services/phase2_enricher.ts` - Deep AI enrichment
- `src/backend/services/processing_queue.ts` - Background job system

**Frontend**:
- `src/renderer/App.tsx` - Main React component
- `src/renderer/context/AppContext.tsx` - Global state management
- `src/renderer/services/api.ts` - API client with error handling

**Configuration**:
- `src/backend/config/index.ts` - Zod-validated environment config
- `src/backend/logger/index.ts` - Pino logger setup

---

## Development Workflow

### Making Changes

1. **Create a feature branch**:
```bash
git checkout -b feature/my-new-feature
```

2. **Make changes** to source files

3. **Test changes**:
```bash
# Run tests
npm test

# Run specific test
npm test -- src/backend/services/classifier.spec.ts

# Run with coverage
npm run test:coverage
```

4. **Verify formatting** (if applicable):
```bash
# Check TypeScript compilation
npx tsc --noEmit

# Lint (if ESLint is configured)
npm run lint
```

5. **Commit changes**:
```bash
git add .
git commit -m "feat: Add new feature"
```

---

### Running Tests

**Run all tests**:
```bash
npm test          # Watch mode
npm run test:run  # Single run
```

**Run with coverage**:
```bash
npm run test:coverage
```

**Run E2E tests** (Playwright):
```bash
npm run test:e2e          # Headless
npm run test:e2e:headed   # With browser
npm run test:e2e:ui       # Interactive UI
```

**Run specific test suite**:
```bash
# Pattern matching
npm test -- classifier

# Specific file
npm test -- src/backend/database/nodes.spec.ts
```

---

### Debugging Tips

**Backend debugging**:

1. **Use debug logs**:
```typescript
import { log } from '../logger/index.js';

log.debug('Processing node', { nodeId, title });
```

2. **Set breakpoints** (VS Code):
```json
// .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Server",
  "program": "${workspaceFolder}/src/server.ts",
  "runtimeArgs": ["--loader", "tsx"],
  "env": {
    "NODE_ENV": "development",
    "LOG_LEVEL": "debug"
  }
}
```

3. **Inspect database**:
```bash
sqlite3 ~/.decant/data/decant.db

# Useful commands:
.tables              # List all tables
.schema nodes        # Show table schema
SELECT * FROM nodes LIMIT 5;
```

4. **Check health endpoints**:
```bash
curl http://localhost:3000/health/full | jq
```

**Frontend debugging**:

1. **React DevTools**: Install browser extension

2. **Console logging**:
```typescript
console.log('Current state:', state);
```

3. **Network tab**: Inspect API requests/responses

4. **Vite debug info**:
```bash
npm run dev:client -- --debug
```

---

## Adding Features

### Adding a New API Endpoint

**Example**: Add endpoint to get node statistics

1. **Create route handler** (`src/backend/routes/nodes.ts`):

```typescript
export async function getNodeStats(req: Request, res: Response): Promise<void> {
  const db = getDatabase();

  const stats = db.prepare(`
    SELECT
      node_type,
      COUNT(*) as count
    FROM nodes
    WHERE is_deleted = 0
    GROUP BY node_type
  `).all();

  res.json({ stats });
}
```

2. **Add validation schema** (`src/backend/validation/schemas.ts`):

```typescript
// If needed for query params
export const NodeStatsQuerySchema = z.object({
  includeDeleted: z.boolean().optional(),
});
```

3. **Register route** (`src/backend/routes/index.ts`):

```typescript
export function registerAPIRoutes(app: Express): void {
  // ... existing routes

  app.get('/api/nodes/stats', nodeRoutes.getNodeStats);
}
```

4. **Add tests** (`src/backend/routes/__tests__/nodes.spec.ts`):

```typescript
describe('GET /api/nodes/stats', () => {
  it('should return node statistics', async () => {
    const response = await request(app)
      .get('/api/nodes/stats')
      .expect(200);

    expect(response.body).toHaveProperty('stats');
    expect(Array.isArray(response.body.stats)).toBe(true);
  });
});
```

5. **Test manually**:

```bash
curl http://localhost:3000/api/nodes/stats
```

---

### Adding a New Database Table

**Example**: Add a `tags` table

1. **Create migration** (`src/backend/database/migrations/00X_add_tags.ts`):

```typescript
import { Database } from 'better-sqlite3';
import { Migration } from './types.js';

export const migration: Migration = {
  name: '00X_add_tags',
  up: (db: Database) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_tags_name ON tags(name);

      CREATE TABLE IF NOT EXISTS node_tags (
        node_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (node_id, tag_id),
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );
    `);
  },
  down: (db: Database) => {
    db.exec(`
      DROP TABLE IF EXISTS node_tags;
      DROP TABLE IF EXISTS tags;
    `);
  },
};
```

2. **Add to migration list** (`src/backend/database/migrations/index.ts`):

```typescript
import { migration as migration00X } from './00X_add_tags.js';

export const migrations: Migration[] = [
  // ... existing migrations
  migration00X,
];
```

3. **Create database functions** (`src/backend/database/tags.ts`):

```typescript
import { getDatabase } from './connection.js';

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export function createTag(name: string, color?: string): Tag {
  const db = getDatabase();
  const id = uuidv4();

  db.prepare(`
    INSERT INTO tags (id, name, color)
    VALUES (?, ?, ?)
  `).run(id, name, color || null);

  return getTag(id)!;
}

export function getTag(id: string): Tag | null {
  const db = getDatabase();
  return db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as Tag | null;
}
```

4. **Run migration**:

```bash
npm run migrate:up
```

5. **Test**:

```typescript
// src/backend/database/__tests__/tags.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTag, getTag } from '../tags.js';

describe('Tags Database', () => {
  it('should create and retrieve tags', () => {
    const tag = createTag('typescript', '#007ACC');
    expect(tag.name).toBe('typescript');

    const retrieved = getTag(tag.id);
    expect(retrieved?.name).toBe('typescript');
  });
});
```

---

### Adding a UI Component

**Example**: Add a "Recent Activity" panel

1. **Create component** (`src/renderer/components/RecentActivity.tsx`):

```typescript
import { useState, useEffect } from 'react';
import { api } from '../services/api';

interface ActivityItem {
  id: string;
  action: string;
  timestamp: string;
}

export function RecentActivity() {
  const [items, setItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    // Fetch recent activity
    api.get('/api/audit/recent')
      .then(response => setItems(response.data))
      .catch(error => console.error('Failed to load activity:', error));
  }, []);

  return (
    <div className="recent-activity">
      <h3>Recent Activity</h3>
      <ul>
        {items.map(item => (
          <li key={item.id}>
            {item.action} - {new Date(item.timestamp).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

2. **Add to main app** (`src/renderer/App.tsx`):

```typescript
import { RecentActivity } from './components/RecentActivity';

export function App() {
  return (
    <div className="app">
      {/* ... existing components */}
      <RecentActivity />
    </div>
  );
}
```

3. **Add styles** (`src/renderer/styles/components.css`):

```css
.recent-activity {
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.recent-activity h3 {
  margin-top: 0;
}
```

---

### Adding Tests

**Unit test example** (`src/backend/services/classifier.spec.ts`):

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { classifyContent } from './classifier.js';

describe('Classifier Service', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
  });

  it('should classify technical content correctly', async () => {
    const content = 'Building a React application with TypeScript';
    const result = await classifyContent(content);

    expect(result.segment).toBe('T'); // Technology
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('should handle errors gracefully', async () => {
    // Mock LLM failure
    vi.spyOn(llmProvider, 'complete').mockRejectedValue(new Error('API error'));

    await expect(classifyContent('test')).rejects.toThrow('API error');
  });
});
```

**Integration test example** (`src/backend/__tests__/import.integration.spec.ts`):

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../test-app.js';

describe('Import Integration', () => {
  it('should import URL end-to-end', async () => {
    const response = await request(app)
      .post('/api/import')
      .send({ url: 'https://example.com/article' })
      .expect(201);

    expect(response.body).toHaveProperty('nodeId');
    expect(response.body.success).toBe(true);
  });
});
```

**E2E test example** (`tests/import.spec.ts`):

```typescript
import { test, expect } from '@playwright/test';

test('import URL flow', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Click import button
  await page.click('[data-testid="import-button"]');

  // Enter URL
  await page.fill('[data-testid="url-input"]', 'https://example.com');

  // Submit
  await page.click('[data-testid="import-submit"]');

  // Verify success
  await expect(page.locator('[data-testid="import-success"]')).toBeVisible();
});
```

---

## Testing

### Test Structure

Tests are organized by type:
- **Unit tests**: Next to source files (`*.spec.ts`)
- **Integration tests**: In `__tests__/` directories
- **E2E tests**: In `tests/` directory (Playwright)

### Running Tests

```bash
# All tests (watch mode)
npm test

# Run once (CI mode)
npm run test:run

# With coverage
npm run test:coverage

# E2E tests
npm run test:e2e

# Specific suite
npm test -- classifier
```

### Writing Good Tests

**Follow AAA pattern**:
```typescript
it('should do something', () => {
  // Arrange
  const input = { value: 10 };

  // Act
  const result = process(input);

  // Assert
  expect(result).toBe(20);
});
```

**Use descriptive names**:
```typescript
// Good
it('should return 400 when title is missing')

// Bad
it('test validation')
```

**Test edge cases**:
```typescript
it('should handle empty array', () => { /* ... */ });
it('should handle null input', () => { /* ... */ });
it('should handle very large numbers', () => { /* ... */ });
```

---

## Code Style

### TypeScript Guidelines

**Use explicit types** for function signatures:
```typescript
// Good
export function createNode(title: string, type: NodeType): Node {
  // ...
}

// Avoid
export function createNode(title, type) {
  // ...
}
```

**Use interfaces** for object shapes:
```typescript
interface CreateNodeInput {
  title: string;
  nodeType: NodeType;
  parentId?: string;
}
```

**Prefer const** over let:
```typescript
// Good
const items = getItems();

// Avoid
let items = getItems();
```

**Use async/await** over promises:
```typescript
// Good
async function fetchData(): Promise<Data> {
  const response = await fetch('/api/data');
  return response.json();
}

// Avoid
function fetchData(): Promise<Data> {
  return fetch('/api/data').then(r => r.json());
}
```

---

### File Organization

**Imports order**:
1. External dependencies
2. Internal modules (aliased)
3. Relative imports
4. Types

```typescript
// 1. External
import express from 'express';
import { z } from 'zod';

// 2. Internal
import { log } from '../logger/index.js';
import { getDatabase } from '../database/connection.js';

// 3. Relative
import { validateInput } from './validation.js';

// 4. Types
import type { Node, CreateNodeInput } from '../../shared/types.js';
```

**Exports**:
```typescript
// Prefer named exports
export function processNode(node: Node): void { }
export class NodeProcessor { }

// Default exports for components only
export default function App() { }
```

---

### Error Handling

**Use custom error classes**:
```typescript
import { ValidationError, NodeNotFoundError } from '../errors/index.js';

if (!node) {
  throw new NodeNotFoundError(nodeId);
}

if (!input.title) {
  throw new ValidationError('Title is required');
}
```

**Catch and log errors**:
```typescript
try {
  await processNode(node);
} catch (error) {
  log.error('Failed to process node', {
    nodeId: node.id,
    error: error instanceof Error ? error.message : String(error),
  });
  throw error; // Re-throw if caller should handle
}
```

---

## Debugging

### VS Code Configuration

**Launch configuration** (`.vscode/launch.json`):
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "program": "${workspaceFolder}/src/server.ts",
      "runtimeArgs": ["--loader", "tsx"],
      "env": {
        "NODE_ENV": "development",
        "LOG_LEVEL": "debug"
      },
      "console": "integratedTerminal"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "${file}"],
      "console": "integratedTerminal"
    }
  ]
}
```

---

### Common Issues

**TypeScript errors after pulling**:
```bash
# Clean and reinstall
rm -rf node_modules dist
npm install
```

**Database locked in tests**:
```typescript
// Use separate database for each test
beforeEach(() => {
  process.env.DATABASE_PATH = ':memory:';
});
```

**Port already in use**:
```bash
# Find process using port 3000
lsof -ti:3000

# Kill it
kill -9 <pid>
```

---

## Getting Started Checklist

- [ ] Prerequisites installed (Node.js 18+)
- [ ] Repository cloned
- [ ] Dependencies installed (`npm install`)
- [ ] Environment configured (`.env` or env vars)
- [ ] OpenAI API key set (if using import features)
- [ ] Tests pass (`npm run test:run`)
- [ ] Development server runs (`npm run dev`)
- [ ] Production build works (`npm run build && npm start`)

---

## Resources

- **TypeScript**: https://www.typescriptlang.org/docs/
- **Express**: https://expressjs.com/
- **React**: https://react.dev/
- **Vite**: https://vitejs.dev/
- **Vitest**: https://vitest.dev/
- **better-sqlite3**: https://github.com/WiseLibs/better-sqlite3
- **Zod**: https://zod.dev/
- **Pino**: https://getpino.io/

---

## Contributing

When contributing:

1. **Follow existing patterns** in the codebase
2. **Write tests** for new features
3. **Update documentation** for significant changes
4. **Keep commits atomic** and well-described
5. **Run tests** before committing

For questions or help, check existing documentation or open an issue.
