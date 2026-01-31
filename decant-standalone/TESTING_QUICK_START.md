# Testing Quick Start Guide

## Quick Commands

```bash
# Navigate to project
cd /Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone

# Run all tests (watch mode)
pnpm test

# Run all tests once
pnpm test:run

# Generate coverage report
pnpm test:coverage

# Run specific test file
pnpm test src/backend/database/__tests__/nodes.spec.ts

# Run tests matching pattern
pnpm test nodes
```

---

## Test File Locations

### Database Layer Tests
- `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/backend/database/__tests__/nodes.spec.ts`
- `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/backend/database/__tests__/taxonomy.spec.ts`
- `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/backend/database/__tests__/search.spec.ts`

### Route Integration Tests
- `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/backend/routes/__tests__/nodes.spec.ts`
- `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/backend/routes/__tests__/import.spec.ts`

### Service Tests
- `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/backend/services/__tests__/scraper.spec.ts`
- `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/backend/services/__tests__/classifier.spec.ts`

### Test Infrastructure
- `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/backend/__tests__/setup.ts`
- `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/backend/__tests__/test-app.ts`

---

## Configuration Files

- **Vitest Config**: `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/vitest.config.ts`
- **TypeScript Config**: `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/tsconfig.json`
- **Package.json**: `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/package.json`

---

## Coverage Report Locations

After running `pnpm test:coverage`:

- **HTML Report**: `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/coverage/index.html`
- **JSON Report**: `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/coverage/coverage-final.json`
- **Console**: Displayed in terminal

---

## Test Statistics

- **Total Tests**: 147
- **Database Layer**: 85 tests
- **Route Layer**: 34 tests
- **Service Layer**: 28 tests

---

## Coverage Targets

- **Lines**: 70%
- **Functions**: 60%
- **Branches**: 60%
- **Statements**: 70%

---

## Adding New Tests

### 1. Create test file next to source
```
src/backend/services/my-service.ts
src/backend/services/__tests__/my-service.spec.ts
```

### 2. Import test utilities
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetTestDatabase } from '../../__tests__/setup.js';
```

### 3. Write tests
```typescript
describe('MyService', () => {
  beforeEach(() => {
    resetTestDatabase();
  });

  it('should do something', () => {
    // Test implementation
    expect(true).toBe(true);
  });
});
```

---

## Debugging Tests

### Run single test
```bash
pnpm test -- --run src/backend/database/__tests__/nodes.spec.ts
```

### Run with verbose output
```bash
pnpm test -- --reporter=verbose
```

### Debug in VS Code
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "runtimeExecutable": "pnpm",
  "runtimeArgs": ["test:run"],
  "console": "integratedTerminal"
}
```

---

## Common Patterns

### Testing database operations
```typescript
it('should create a node', () => {
  const node = createNode({
    title: 'Test',
    url: 'https://example.com',
    source_domain: 'example.com',
  });
  expect(node.id).toBeDefined();
});
```

### Testing API routes
```typescript
it('should return 200', async () => {
  const response = await request(app).get('/api/nodes');
  expect(response.status).toBe(200);
});
```

### Mocking external services
```typescript
vi.mock('../../services/scraper.js', () => ({
  scrapeUrl: vi.fn().mockResolvedValue({ /* mock data */ }),
}));
```

---

## Troubleshooting

### Tests fail with "Database not initialized"
- Check that `setup.ts` is in setupFiles in `vitest.config.ts`
- Ensure `beforeEach` calls `resetTestDatabase()`

### ESM import errors
- Use `.js` extension in imports (not `.ts`)
- Check `tsconfig.json` has `"module": "ESNext"`

### Coverage not updating
- Delete `coverage/` directory and re-run
- Check file is in coverage `include` list in `vitest.config.ts`

---

## CI/CD Integration

```yaml
# Example GitHub Actions workflow
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - uses: pnpm/action-setup@v2
    - run: pnpm install
    - run: pnpm test:coverage
    - uses: codecov/codecov-action@v3
      with:
        files: ./coverage/coverage-final.json
```

---

## Next Steps

1. Review coverage report: `pnpm test:coverage`
2. Check HTML report in browser: `open coverage/index.html`
3. Add tests for new features as you build them
4. Keep coverage above 70% for core code

---

For detailed implementation information, see `TEST_IMPLEMENTATION_SUMMARY.md`.
