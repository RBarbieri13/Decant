// ============================================================
// Hierarchy Cache LRU Tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import * as hCache from '../hierarchy_cache.js';

describe('Hierarchy Cache — LRU Eviction', () => {
  beforeEach(() => {
    hCache.clearAll();
  });

  it('should cap entries per view at 200', () => {
    for (let i = 0; i < 250; i++) {
      hCache.setTree('function', [{ id: `n${i}`, title: `Node ${i}`, children: [] }], `path.${i}`);
    }

    const stats = hCache.getStats();
    expect(stats.function.size).toBe(200);
    expect(stats.function.maxEntries).toBe(200);
  });

  it('should evict oldest entries first', () => {
    for (let i = 0; i < 250; i++) {
      hCache.setTree('function', [{ id: `n${i}`, title: `Node ${i}`, children: [] }], `path.${i}`);
    }

    // First 50 entries should be evicted
    expect(hCache.getTree('function', 'path.0')).toBeNull();
    expect(hCache.getTree('function', 'path.49')).toBeNull();

    // Last 200 should remain
    expect(hCache.getTree('function', 'path.50')).not.toBeNull();
    expect(hCache.getTree('function', 'path.249')).not.toBeNull();
  });

  it('should promote accessed entries on getTree hit', () => {
    // Fill to capacity
    for (let i = 0; i < 200; i++) {
      hCache.setTree('function', [{ id: `n${i}`, title: `Node ${i}`, children: [] }], `path.${i}`);
    }

    // Access path.0 to promote it
    expect(hCache.getTree('function', 'path.0')).not.toBeNull();

    // Add 50 more to trigger eviction
    for (let i = 200; i < 250; i++) {
      hCache.setTree('function', [{ id: `n${i}`, title: `Node ${i}`, children: [] }], `path.${i}`);
    }

    // path.0 was promoted so should survive
    expect(hCache.getTree('function', 'path.0')).not.toBeNull();

    // path.1 through path.50 should be evicted
    expect(hCache.getTree('function', 'path.1')).toBeNull();
    expect(hCache.getTree('function', 'path.50')).toBeNull();
  });

  it('should enforce limits independently per view', () => {
    for (let i = 0; i < 250; i++) {
      hCache.setTree('function', [{ id: `fn${i}`, title: `FN ${i}`, children: [] }], `fn.${i}`);
      hCache.setTree('organization', [{ id: `org${i}`, title: `ORG ${i}`, children: [] }], `org.${i}`);
    }

    const stats = hCache.getStats();
    expect(stats.function.size).toBe(200);
    expect(stats.organization.size).toBe(200);
  });

  it('should expose maxEntries in stats', () => {
    const stats = hCache.getStats();
    expect(stats.function.maxEntries).toBe(200);
    expect(stats.organization.maxEntries).toBe(200);
  });
});
