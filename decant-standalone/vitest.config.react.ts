// ============================================================
// Vitest Config with React Testing Library Support
// ============================================================
//
// This is an extended version of vitest.config.ts that includes
// support for React component testing.
//
// To use this config:
// 1. Install dependencies:
//    pnpm add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
//
// 2. Rename this file to vitest.config.ts (backup the old one first)
//
// 3. Run tests:
//    pnpm test
// ============================================================

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()], // Enable React support
  test: {
    globals: true,
    // Use different environments for different test types
    // Backend tests use 'node', frontend tests use 'jsdom'
    environment: 'jsdom', // Default to jsdom for React components
    include: [
      'src/**/*.spec.ts',
      'src/**/*.spec.tsx', // Include .tsx test files
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],
    exclude: ['node_modules', 'dist', 'e2e'], // Exclude E2E tests from unit tests
    setupFiles: [
      'src/backend/__tests__/setup.ts',
      'src/renderer/__tests__/setup.tsx', // React Testing Library setup
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        // Backend coverage
        'src/backend/database/nodes.ts',
        'src/backend/database/taxonomy.ts',
        'src/backend/database/search.ts',
        'src/backend/routes/nodes.ts',
        'src/backend/routes/import.ts',
        'src/backend/services/scraper.ts',
        'src/backend/services/classifier.ts',
        'src/backend/validation/schemas.ts',
        'src/backend/middleware/validate.ts',
        // Frontend coverage
        'src/renderer/hooks/*.ts',
        'src/renderer/hooks/*.tsx',
        'src/renderer/components/**/*.tsx',
        'src/renderer/components/**/*.ts',
      ],
      exclude: [
        // Test files
        'src/backend/__tests__/**',
        'src/renderer/__tests__/**',
        'src/**/*.spec.ts',
        'src/**/*.spec.tsx',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        // Infrastructure
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
        // Frontend infrastructure
        'src/renderer/index.tsx',
        'src/renderer/App.tsx',
        'src/renderer/services/api.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 60,
        branches: 60,
        statements: 70,
      },
    },
    testTimeout: 10000,
    // Allow tests to use different environments based on path
    environmentMatchGlobs: [
      ['src/backend/**', 'node'], // Backend tests use Node environment
      ['src/renderer/**', 'jsdom'], // Frontend tests use jsdom
    ],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@backend': path.resolve(__dirname, 'src/backend'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
    },
  },
});
