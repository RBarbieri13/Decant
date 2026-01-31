# Testing Architecture Documentation

## Overview

This document describes the testing architecture for the Decant standalone application, including design patterns, mocking strategies, and best practices.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Test Suite (147 tests)                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │         Unit Tests (85 tests)                  │    │
│  │  ┌──────────────────────────────────────────┐  │    │
│  │  │  Database Layer                          │  │    │
│  │  │  - nodes.spec.ts (47 tests)              │  │    │
│  │  │  - taxonomy.spec.ts (17 tests)           │  │    │
│  │  │  - search.spec.ts (21 tests)             │  │    │
│  │  └──────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │      Integration Tests (34 tests)              │    │
│  │  ┌──────────────────────────────────────────┐  │    │
│  │  │  API Routes                              │  │    │
│  │  │  - nodes.spec.ts (23 tests)              │  │    │
│  │  │  - import.spec.ts (11 tests)             │  │    │
│  │  └──────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │     Service Tests (28 tests)                   │    │
│  │  ┌──────────────────────────────────────────┐  │    │
│  │  │  External Services with Mocks            │  │    │
│  │  │  - scraper.spec.ts (22 tests)            │  │    │
│  │  │  - classifier.spec.ts (6 tests)          │  │    │
│  │  └──────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │    Test Infrastructure               │
        │  ┌───────────────────────────────┐  │
        │  │  setup.ts                     │  │
        │  │  - In-memory SQLite           │  │
        │  │  - Mock connections           │  │
        │  │  - Global hooks               │  │
        │  └───────────────────────────────┘  │
        │  ┌───────────────────────────────┐  │
        │  │  test-app.ts                  │  │
        │  │  - Express app factory        │  │
        │  │  - Route registration         │  │
        │  └───────────────────────────────┘  │
        └─────────────────────────────────────┘
```

---

## Test Infrastructure

### Setup File: `setup.ts`

**Purpose**: Global test setup and in-memory database initialization

**Key Functions**:
- `getTestDatabase()` - Returns or creates in-memory SQLite instance
- `closeTestDatabase()` - Closes the test database
- `resetTestDatabase()` - Clears all data but preserves schema

**Schema Initialization**:
```typescript
function initializeTestSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (...);
    CREATE TABLE IF NOT EXISTS key_concepts (...);
    CREATE TABLE IF NOT EXISTS segments (...);
    CREATE TABLE IF NOT EXISTS organizations (...);
    CREATE INDEX IF NOT EXISTS idx_nodes_function_parent ON nodes(function_parent_id);
    // ... additional indexes
  `);
}
```

**Mocking Strategy**:
```typescript
// Mock database connection to use in-memory DB
vi.mock('../database/connection.js', () => ({
  getDatabase: () => getTestDatabase(),
  closeDatabase: () => closeTestDatabase(),
  getDatabasePath: () => ':memory:',
  isDatabaseInitialized: () => true,
}));

// Mock transactions to execute directly
vi.mock('../database/transaction.js', () => ({
  withTransaction: <T>(fn: () => T): T => fn(),
  withTransactionSync: <T>(fn: () => T): T => fn(),
}));
```

**Global Hooks**:
```typescript
beforeEach(() => {
  getTestDatabase(); // Ensure DB initialized
});

afterEach(() => {
  resetTestDatabase(); // Clean state between tests
});

afterAll(() => {
  closeTestDatabase(); // Final cleanup
});
```

---

### Test App Factory: `test-app.ts`

**Purpose**: Create Express app for integration testing

```typescript
export function createTestApp(): express.Application {
  const app = express();
  app.use(express.json());
  registerAPIRoutes(app);

  // Error handling
  app.use((err, req, res, next) => {
    console.error('Test app error:', err);
    res.status(500).json({ error: err.message });
  });

  return app;
}
```

**Usage in Tests**:
```typescript
const app = createTestApp();

it('should return nodes', async () => {
  const response = await request(app).get('/api/nodes');
  expect(response.status).toBe(200);
});
```

---

## Test Patterns

### 1. Unit Test Pattern (Database Layer)

**File Structure**:
```
src/backend/database/
  nodes.ts                     # Source file
  __tests__/
    nodes.spec.ts              # Test file
```

**Test Pattern**:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createNode, readNode } from '../nodes.js';
import { resetTestDatabase } from '../../__tests__/setup.js';

describe('Node Operations', () => {
  beforeEach(() => {
    resetTestDatabase();
  });

  it('should create a node', () => {
    const node = createNode({
      title: 'Test',
      url: 'https://example.com',
      source_domain: 'example.com',
    });

    expect(node).toBeDefined();
    expect(node.id).toBeDefined();
  });

  it('should read a node', () => {
    const created = createNode({ /* ... */ });
    const read = readNode(created.id);
    expect(read).toEqual(created);
  });
});
```

---

### 2. Integration Test Pattern (API Routes)

**File Structure**:
```
src/backend/routes/
  nodes.ts                     # Route handlers
  __tests__/
    nodes.spec.ts              # Integration tests
```

**Test Pattern**:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../../__tests__/test-app.js';
import { resetTestDatabase } from '../../__tests__/setup.js';

describe('Node API Routes', () => {
  const app = createTestApp();

  beforeEach(() => {
    resetTestDatabase();
  });

  describe('GET /api/nodes', () => {
    it('should return all nodes', async () => {
      const response = await request(app).get('/api/nodes');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/nodes', () => {
    it('should create a node', async () => {
      const response = await request(app)
        .post('/api/nodes')
        .send({
          title: 'New Node',
          url: 'https://example.com',
          source_domain: 'example.com',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
    });
  });
});
```

---

### 3. Service Test Pattern with Mocks

**File Structure**:
```
src/backend/services/
  scraper.ts                   # Service
  __tests__/
    scraper.spec.ts            # Tests with mocks
```

**Test Pattern**:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scrapeUrl } from '../scraper.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Scraper Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should scrape basic metadata', async () => {
    const html = `<html><head><title>Test</title></head></html>`;

    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    });

    const result = await scrapeUrl('https://example.com');

    expect(result.title).toBe('Test');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        headers: expect.any(Object),
      })
    );
  });
});
```

---

## Mocking Strategies

### 1. Database Mocking

**Strategy**: Replace real database with in-memory SQLite

**Implementation**:
```typescript
// In setup.ts
vi.mock('../database/connection.js', () => ({
  getDatabase: () => getTestDatabase(),
  // ... other exports
}));
```

**Benefits**:
- Fast execution (in-memory)
- No file system dependencies
- Isolated test environment
- Automatic cleanup

---

### 2. HTTP Request Mocking

**Strategy**: Mock global fetch API

**Implementation**:
```typescript
const mockFetch = vi.fn();
global.fetch = mockFetch;

mockFetch.mockResolvedValue({
  ok: true,
  text: () => Promise.resolve('<html>...</html>'),
});
```

**Benefits**:
- No real HTTP calls
- Predictable responses
- Fast execution
- Test edge cases (errors, timeouts)

---

### 3. Service Mocking (for Integration Tests)

**Strategy**: Mock entire service modules

**Implementation**:
```typescript
vi.mock('../../services/scraper.js', () => ({
  scrapeUrl: vi.fn(),
}));

import { scrapeUrl } from '../../services/scraper.js';

vi.mocked(scrapeUrl).mockResolvedValue({
  url: 'https://example.com',
  title: 'Test',
  // ... other fields
});
```

**Benefits**:
- Isolate route testing from service logic
- Control service behavior
- Test error handling

---

## Coverage Configuration

### vitest.config.ts

```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/backend/database/nodes.ts',
        'src/backend/database/taxonomy.ts',
        'src/backend/database/search.ts',
        'src/backend/routes/nodes.ts',
        'src/backend/routes/import.ts',
        'src/backend/services/scraper.ts',
        'src/backend/services/classifier.ts',
        'src/backend/validation/schemas.ts',
        'src/backend/middleware/validate.ts',
      ],
      exclude: [
        'src/backend/__tests__/**',
        'src/backend/**/*.spec.ts',
        // Infrastructure code
        'src/backend/database/migrations/**',
        'src/backend/database/connection.ts',
        // ... etc
      ],
      thresholds: {
        lines: 70,
        functions: 60,
        branches: 60,
        statements: 70,
      },
    },
  },
});
```

---

## Best Practices

### 1. Test Isolation

**Rule**: Each test should be completely independent

**Implementation**:
```typescript
beforeEach(() => {
  resetTestDatabase(); // Clean slate for each test
});
```

**Anti-pattern**:
```typescript
// DON'T do this - tests depend on each other
let sharedNode: any;

it('creates node', () => {
  sharedNode = createNode({ /* ... */ });
});

it('reads node', () => {
  expect(readNode(sharedNode.id)).toBeDefined(); // FRAGILE
});
```

---

### 2. Descriptive Test Names

**Good**:
```typescript
it('should return 404 when node does not exist', () => { /* ... */ });
it('should merge metadata when keepMetadata option is true', () => { /* ... */ });
```

**Bad**:
```typescript
it('test 1', () => { /* ... */ });
it('works', () => { /* ... */ });
```

---

### 3. Arrange-Act-Assert Pattern

**Pattern**:
```typescript
it('should update node title', () => {
  // Arrange - Set up test data
  const node = createNode({
    title: 'Original',
    url: 'https://example.com',
    source_domain: 'example.com',
  });

  // Act - Perform the operation
  const updated = updateNode(node.id, { title: 'Updated' });

  // Assert - Verify the result
  expect(updated.title).toBe('Updated');
});
```

---

### 4. Test Edge Cases

**Examples**:
```typescript
// Empty input
it('should return empty array for empty input', () => {
  expect(readNodes([])).toEqual([]);
});

// Null values
it('should return null for non-existent node', () => {
  expect(readNode('non-existent')).toBeNull();
});

// Boundary conditions
it('should respect default limit of 20', () => {
  // Create 25 nodes
  for (let i = 0; i < 25; i++) { /* ... */ }

  const results = searchNodes('test');
  expect(results.length).toBe(20);
});

// Error cases
it('should throw error for duplicate URLs', () => {
  createNode({ url: 'https://example.com', /* ... */ });
  expect(() => createNode({ url: 'https://example.com', /* ... */ }))
    .toThrow();
});
```

---

### 5. Dynamic vs Static Imports

**Use static imports for functions under test**:
```typescript
import { createNode, readNode } from '../nodes.js';
```

**Use dynamic imports for functions tested via dynamic require**:
```typescript
it('should count nodes', () => {
  const { countNodes } = require('../nodes.js');
  const count = countNodes();
  expect(count).toBe(0);
});
```

---

## Performance Optimization

### 1. In-Memory Database

**Why**: 100x faster than disk-based testing

**Trade-off**: Requires schema initialization in setup

---

### 2. Batch Operations

**Source Code Optimization**:
```typescript
export function batchLoadKeyConcepts(nodeIds: string[]): Map<string, string[]> {
  const placeholders = nodeIds.map(() => '?').join(', ');
  const concepts = db.prepare(`
    SELECT node_id, concept FROM key_concepts WHERE node_id IN (${placeholders})
  `).all(...nodeIds);
  // ... build map
}
```

**Benefit**: Avoid N+1 queries in tests

---

### 3. Parallel Test Execution

**Vitest Default**: Tests run in parallel by default

**When to disable**:
- Tests share global state
- Database contention issues

**How to disable**:
```typescript
// In specific test file
describe.sequential('Sequential Tests', () => {
  // These run sequentially
});
```

---

## Debugging Tests

### 1. Run Single Test

```bash
pnpm test -- --run src/backend/database/__tests__/nodes.spec.ts
```

### 2. Run Specific Describe Block

```typescript
describe.only('createNode', () => {
  // Only this block runs
});
```

### 3. Run Specific Test

```typescript
it.only('should create a node', () => {
  // Only this test runs
});
```

### 4. Add Debug Output

```typescript
it('should do something', () => {
  const result = doSomething();
  console.log('DEBUG:', result); // Visible in test output
  expect(result).toBe(expected);
});
```

### 5. Inspect Database State

```typescript
it('should update correctly', () => {
  const db = getTestDatabase();
  const raw = db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId);
  console.log('Raw DB record:', raw);
});
```

---

## Common Pitfalls and Solutions

### 1. ESM Import Errors

**Problem**: `Cannot use import statement outside a module`

**Solution**: Use `.js` extension in imports, even for `.ts` files

```typescript
// ✅ Correct
import { createNode } from '../nodes.js';

// ❌ Wrong
import { createNode } from '../nodes.ts';
import { createNode } from '../nodes';
```

---

### 2. Database Not Initialized

**Problem**: Tests fail with "Database not initialized"

**Solution**: Ensure `setup.ts` is in `setupFiles` in `vitest.config.ts`

```typescript
export default defineConfig({
  test: {
    setupFiles: ['src/backend/__tests__/setup.ts'],
  },
});
```

---

### 3. Mocks Not Working

**Problem**: Mock doesn't intercept calls

**Solution**: Place `vi.mock()` at top of file, before imports

```typescript
// ✅ Correct order
vi.mock('../services/scraper.js', () => ({ /* ... */ }));
import { scrapeUrl } from '../services/scraper.js';

// ❌ Wrong order
import { scrapeUrl } from '../services/scraper.js';
vi.mock('../services/scraper.js', () => ({ /* ... */ }));
```

---

### 4. Flaky Tests

**Problem**: Tests pass sometimes, fail other times

**Common Causes**:
- Tests depend on execution order
- Shared state between tests
- Timing issues (async)

**Solution**:
```typescript
// Ensure isolation
beforeEach(() => {
  resetTestDatabase();
  vi.clearAllMocks();
});

// Use proper async/await
it('should handle async', async () => {
  const result = await asyncFunction();
  expect(result).toBe(expected);
});
```

---

## Future Improvements

### 1. E2E Tests

Consider adding Playwright tests for:
- Full user workflows
- Browser-based interactions
- Visual regression testing

---

### 2. Performance Tests

Add benchmarks for:
- Large dataset handling
- Pagination efficiency
- Search performance

---

### 3. Snapshot Testing

Use for:
- API response structures
- Complex object comparisons

```typescript
it('should return expected structure', () => {
  const result = complexFunction();
  expect(result).toMatchSnapshot();
});
```

---

## Summary

The testing architecture for Decant standalone follows these principles:

1. **Isolation**: In-memory database, clean state per test
2. **Speed**: Fast execution via in-memory SQLite and mocking
3. **Coverage**: 70%+ on all core backend code
4. **Maintainability**: Clear patterns, descriptive names, good organization
5. **Reliability**: No flaky tests, deterministic results

**Total Test Count**: 147 tests covering 85 database operations, 34 API routes, and 28 service functions.
