# Testing Guide for Decant Standalone

This document describes the test suite for the Decant standalone application and how to run tests.

## Test Structure

```
decant-standalone/
├── src/
│   ├── backend/
│   │   └── __tests__/           # Backend unit tests
│   └── renderer/
│       ├── __tests__/            # React component tests
│       │   ├── setup.tsx         # React Testing Library setup
│       │   ├── ImportDialog.spec.tsx
│       │   └── DetailPanel.spec.tsx
│       └── hooks/
│           └── __tests__/        # Hook tests
│               ├── useDragAndDrop.spec.ts
│               └── usePolling.spec.ts
└── e2e/
    └── import-flow.spec.ts       # End-to-end tests
```

## Test Categories

### 1. Backend Tests (✅ Ready)
- **Location**: `src/backend/**/__tests__/*.spec.ts`
- **Framework**: Vitest
- **Coverage**: Database operations, API routes, services
- **Status**: Working, no additional dependencies needed

### 2. Hook Tests (✅ Ready)
- **Location**: `src/renderer/hooks/__tests__/*.spec.ts`
- **Framework**: Vitest + React Testing Library hooks
- **Tests**:
  - `useDragAndDrop.spec.ts` - Drag and drop operations
  - `usePolling.spec.ts` - Polling behavior
- **Status**: Ready to run after installing React Testing Library

### 3. Component Tests (⚠️ Needs Dependencies)
- **Location**: `src/renderer/__tests__/*.spec.tsx`
- **Framework**: Vitest + React Testing Library
- **Tests**:
  - `ImportDialog.spec.tsx` - Import dialog behavior
  - `DetailPanel.spec.tsx` - Detail panel rendering
- **Status**: Requires React Testing Library installation

### 4. E2E Tests (⚠️ Needs Playwright)
- **Location**: `e2e/*.spec.ts`
- **Framework**: Playwright
- **Tests**:
  - `import-flow.spec.ts` - Complete import workflow
- **Status**: Requires Playwright installation or manual testing

## Installation

### For Component Tests (Required)

Install React Testing Library and related packages:

```bash
pnpm add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

### For E2E Tests (Optional)

Install Playwright:

```bash
pnpm add -D @playwright/test
pnpm exec playwright install
```

## Configuration

### Update `vitest.config.ts`

For component tests to work, update your `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom', // Add this for React components
    include: [
      'src/**/*.spec.ts',
      'src/**/*.spec.tsx', // Add .tsx support
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],
    exclude: ['node_modules', 'dist', 'e2e'], // Exclude E2E tests
    setupFiles: [
      'src/backend/__tests__/setup.ts',
      'src/renderer/__tests__/setup.tsx', // Add React setup
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        // Backend
        'src/backend/database/nodes.ts',
        'src/backend/database/taxonomy.ts',
        'src/backend/database/search.ts',
        'src/backend/routes/nodes.ts',
        'src/backend/routes/import.ts',
        'src/backend/services/scraper.ts',
        'src/backend/services/classifier.ts',
        'src/backend/validation/schemas.ts',
        'src/backend/middleware/validate.ts',
        // Frontend
        'src/renderer/hooks/*.ts',
        'src/renderer/components/**/*.tsx',
      ],
      exclude: [
        'src/backend/__tests__/**',
        'src/renderer/__tests__/**',
        'src/backend/**/*.spec.ts',
        'src/renderer/**/*.spec.tsx',
        'src/backend/database/migrations/**',
        'src/backend/database/connection.ts',
        'src/backend/database/schema.ts',
        'src/backend/database/transaction.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 60,
        branches: 60,
        statements: 70,
      },
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@backend': path.resolve(__dirname, 'src/backend'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
    },
  },
});
```

### Create `playwright.config.ts` (if using Playwright)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

## Running Tests

### All Tests
```bash
pnpm test
```

### Watch Mode
```bash
pnpm test --watch
```

### Coverage Report
```bash
pnpm test:coverage
```

### Specific Test File
```bash
pnpm test src/renderer/hooks/__tests__/useDragAndDrop.spec.ts
```

### Backend Tests Only
```bash
pnpm test src/backend
```

### Frontend Tests Only
```bash
pnpm test src/renderer
```

### E2E Tests (Playwright)
```bash
pnpm exec playwright test
```

### E2E Tests in UI Mode (Interactive)
```bash
pnpm exec playwright test --ui
```

## Test Coverage

### Current Coverage (Backend)
- ✅ Database operations (nodes, taxonomy, search)
- ✅ API routes (nodes, import, pagination, health, backup)
- ✅ Services (scraper, classifier, backup)
- ✅ Middleware (validation)
- ✅ Migrations system

### Hooks Coverage
- ✅ `useDragAndDrop` - Comprehensive drag/drop testing
  - Drag start/end events
  - Drop position calculation (before/inside/after)
  - Drop validation with canDrop callback
  - Auto-expand on hover
  - Undo/cleanup functionality

- ✅ `usePolling` - Complete polling behavior
  - Start/stop functionality
  - Interval-based polling
  - Error handling
  - Success callbacks
  - Cleanup on unmount
  - Manual refetch

### Component Coverage (Pending RTL Installation)
- ⚠️ `ImportDialog` - Comprehensive UI testing
  - Dialog visibility and controls
  - URL input validation
  - Progress indicator states
  - Classification preview
  - Error handling
  - Success state
  - Keyboard navigation

- ⚠️ `DetailPanel` - Full component testing
  - Empty state rendering
  - Node data display
  - Tab navigation
  - Edit mode
  - Actions (open, copy, delete)
  - Delete confirmation
  - Loading states

### E2E Coverage (Pending Playwright)
- ⚠️ Complete import workflow
- ⚠️ Phase 1 → Phase 2 transition
- ⚠️ Error recovery
- ⚠️ Keyboard navigation
- ⚠️ Accessibility checks

## Writing Tests

### Backend Test Example
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp } from '../../__tests__/test-app';
import request from 'supertest';

describe('My API Route', () => {
  const app = createTestApp();

  beforeEach(() => {
    resetTestDatabase();
  });

  it('should return data', async () => {
    const response = await request(app).get('/api/my-route');
    expect(response.status).toBe(200);
  });
});
```

### Hook Test Example
```typescript
import { renderHook, act } from '@testing-library/react';
import { useMyHook } from '../useMyHook';

it('should update state', () => {
  const { result } = renderHook(() => useMyHook());

  act(() => {
    result.current.doSomething();
  });

  expect(result.current.value).toBe(expectedValue);
});
```

### Component Test Example
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from '../MyComponent';

it('should render and respond to clicks', async () => {
  const user = userEvent.setup();
  render(<MyComponent />);

  const button = screen.getByRole('button', { name: /click me/i });
  await user.click(button);

  expect(screen.getByText(/clicked/i)).toBeInTheDocument();
});
```

### E2E Test Example
```typescript
import { test, expect } from '@playwright/test';

test('should complete workflow', async ({ page }) => {
  await page.goto('/');
  await page.click('button:has-text("Start")');
  await expect(page.locator('.result')).toBeVisible();
});
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run tests
        run: pnpm test:run

      - name: Generate coverage
        run: pnpm test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Troubleshooting

### "Cannot find module '@testing-library/react'"
- Run: `pnpm add -D @testing-library/react @testing-library/jest-dom jsdom`

### "ReferenceError: document is not defined"
- Ensure `environment: 'jsdom'` is in vitest.config.ts
- Check that setup file is in setupFiles array

### "Cannot find name 'test'"
- Ensure `globals: true` is in vitest.config.ts
- Or import: `import { test, expect } from 'vitest'`

### E2E tests fail with "Target closed"
- Ensure dev server is running: `pnpm run dev`
- Check baseURL in playwright.config.ts matches your dev server

### Tests are slow
- Use `vi.useFakeTimers()` for time-dependent tests
- Mock network requests
- Consider running tests in parallel

## Best Practices

1. **Arrange-Act-Assert**: Structure tests clearly
2. **User-centric testing**: Test from the user's perspective
3. **Avoid implementation details**: Test behavior, not internals
4. **Mock external dependencies**: Keep tests isolated
5. **Descriptive test names**: Use "should" statements
6. **One assertion per test**: Keep tests focused
7. **Cleanup**: Reset state between tests
8. **Accessibility**: Include accessibility checks

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
