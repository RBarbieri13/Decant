# End-to-End Tests for Decant

This directory contains E2E tests for the Decant application using Playwright.

## Setup

Install Playwright:

```bash
pnpm add -D @playwright/test
pnpm exec playwright install
```

## Running Tests

Run all E2E tests:

```bash
pnpm exec playwright test
```

Run specific test file:

```bash
pnpm exec playwright test e2e/import-flow.spec.ts
```

Run tests in UI mode (interactive):

```bash
pnpm exec playwright test --ui
```

Run tests in headed mode (see browser):

```bash
pnpm exec playwright test --headed
```

## Prerequisites

Before running E2E tests:

1. Start the development server:
   ```bash
   pnpm run dev
   ```

2. Ensure the application is running at `http://localhost:5173` (or set `APP_URL` environment variable)

3. Configure OpenAI API key in the application settings (required for import flow tests)

## Test Files

- `import-flow.spec.ts` - Tests the complete import workflow from URL submission to classified node viewing
  - Basic import flow
  - Error handling (invalid URLs, network errors)
  - Progress indicators
  - Classification preview
  - Phase 2 enrichment status
  - Multiple imports
  - Accessibility

## Writing New Tests

Follow the existing pattern:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('should do something', async ({ page }) => {
    // Test implementation
  });
});
```

## Debugging

Generate trace for debugging:

```bash
pnpm exec playwright test --trace on
```

View trace:

```bash
pnpm exec playwright show-trace trace.zip
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Install Playwright
  run: pnpm exec playwright install --with-deps

- name: Run E2E tests
  run: pnpm exec playwright test
  env:
    APP_URL: http://localhost:5173

- name: Upload test results
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: playwright-report
    path: playwright-report/
```
