import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['src/backend/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        // Core database operations
        'src/backend/database/nodes.ts',
        'src/backend/database/taxonomy.ts',
        'src/backend/database/search.ts',
        // Core routes
        'src/backend/routes/nodes.ts',
        'src/backend/routes/import.ts',
        // Core services
        'src/backend/services/scraper.ts',
        'src/backend/services/classifier.ts',
        // Validation
        'src/backend/validation/schemas.ts',
        // Middleware
        'src/backend/middleware/validate.ts',
      ],
      exclude: [
        'src/backend/__tests__/**',
        'src/backend/**/*.spec.ts',
        'src/backend/**/*.test.ts',
        // Exclude infrastructure code not covered in basic tests
        'src/backend/database/migrations/**',
        'src/backend/database/connection.ts',
        'src/backend/database/schema.ts',
        'src/backend/database/transaction.ts',
        'src/backend/services/backup.ts',
        'src/backend/routes/backup.ts',
        'src/backend/routes/health.ts',
        'src/backend/routes/hierarchy.ts',
        'src/backend/routes/search.ts',
        'src/backend/health/**',
        'src/backend/middleware/requestLogger.ts',
        'src/backend/middleware/rateLimit.ts',
      ],
      thresholds: {
        // Core backend code coverage thresholds
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
    },
  },
});
