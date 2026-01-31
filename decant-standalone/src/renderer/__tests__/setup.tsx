// ============================================================
// React Testing Library Setup
// ============================================================
//
// This file configures the test environment for React component tests.
// It must be added to vitest.config.ts setupFiles array.
//
// Required packages (install with pnpm):
// - @testing-library/react
// - @testing-library/jest-dom
// - @testing-library/user-event
// - jsdom (for DOM environment)
//
// Update vitest.config.ts:
//   test: {
//     environment: 'jsdom',
//     setupFiles: ['src/renderer/__tests__/setup.tsx'],
//     globals: true,
//   }
// ============================================================

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '@testing-library/jest-dom';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia (used by many UI components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock window.open
Object.defineProperty(window, 'open', {
  writable: true,
  value: () => null,
});

// Mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
  writable: true,
  value: {
    writeText: async (text: string) => Promise.resolve(),
    readText: async () => Promise.resolve(''),
  },
});

// Mock IntersectionObserver (if needed for components)
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock ResizeObserver (if needed for components)
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Suppress console errors/warnings during tests (optional)
// Uncomment if tests produce too much noise
// const originalError = console.error;
// const originalWarn = console.warn;
// beforeAll(() => {
//   console.error = (...args: any[]) => {
//     if (
//       typeof args[0] === 'string' &&
//       args[0].includes('Warning: ReactDOM.render')
//     ) {
//       return;
//     }
//     originalError.call(console, ...args);
//   };
//   console.warn = (...args: any[]) => {
//     if (
//       typeof args[0] === 'string' &&
//       args[0].includes('Warning: ')
//     ) {
//       return;
//     }
//     originalWarn.call(console, ...args);
//   };
// });
//
// afterAll(() => {
//   console.error = originalError;
//   console.warn = originalWarn;
// });
