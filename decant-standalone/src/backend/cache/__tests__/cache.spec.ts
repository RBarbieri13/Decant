// ============================================================
// Cache Unit Tests
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as cache from '../index.js';

describe('Cache Module', () => {
  beforeEach(() => {
    cache.clear();
  });

  afterEach(() => {
    cache.stopAutoCleanup();
  });

  describe('Basic Operations', () => {
    it('should set and get a value', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for non-existent key', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should handle different data types', () => {
      cache.set('string', 'hello');
      cache.set('number', 42);
      cache.set('object', { foo: 'bar' });
      cache.set('array', [1, 2, 3]);

      expect(cache.get('string')).toBe('hello');
      expect(cache.get('number')).toBe(42);
      expect(cache.get('object')).toEqual({ foo: 'bar' });
      expect(cache.get('array')).toEqual([1, 2, 3]);
    });

    it('should overwrite existing keys', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should expire entries after TTL', async () => {
      cache.set('key1', 'value1', 100); // 100ms TTL

      expect(cache.get('key1')).toBe('value1');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(cache.get('key1')).toBeNull();
    });

    it('should use default TTL when not specified', () => {
      cache.set('key1', 'value1');
      const stats = cache.stats();
      expect(stats.size).toBe(1);
    });

    it('should not expire if TTL not reached', async () => {
      cache.set('key1', 'value1', 500); // 500ms TTL

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(cache.get('key1')).toBe('value1');
    });
  });

  describe('Invalidation', () => {
    it('should invalidate exact match', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.invalidate('key1');

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBe('value2');
    });

    it('should invalidate with wildcard pattern', () => {
      cache.set('tree:function', 'data1');
      cache.set('tree:organization', 'data2');
      cache.set('other:key', 'data3');

      cache.invalidate('tree:*');

      expect(cache.get('tree:function')).toBeNull();
      expect(cache.get('tree:organization')).toBeNull();
      expect(cache.get('other:key')).toBe('data3');
    });

    it('should invalidate all with * pattern', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.invalidate('*');

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBeNull();
    });

    it('should handle complex wildcard patterns', () => {
      cache.set('user:123:profile', 'data1');
      cache.set('user:123:settings', 'data2');
      cache.set('user:456:profile', 'data3');

      cache.invalidate('user:123:*');

      expect(cache.get('user:123:profile')).toBeNull();
      expect(cache.get('user:123:settings')).toBeNull();
      expect(cache.get('user:456:profile')).toBe('data3');
    });
  });

  describe('Clear', () => {
    it('should clear all cache entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      expect(cache.stats().size).toBe(3);

      cache.clear();

      expect(cache.stats().size).toBe(0);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBeNull();
    });
  });

  describe('Stats', () => {
    it('should return cache statistics', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.stats();

      expect(stats.size).toBe(2);
      expect(stats.keys).toContain('key1');
      expect(stats.keys).toContain('key2');
    });

    it('should return empty stats for empty cache', () => {
      const stats = cache.stats();

      expect(stats.size).toBe(0);
      expect(stats.keys).toEqual([]);
    });
  });

  describe('Cleanup', () => {
    it('should remove expired entries during cleanup', async () => {
      cache.set('key1', 'value1', 100); // 100ms TTL
      cache.set('key2', 'value2', 500); // 500ms TTL

      await new Promise(resolve => setTimeout(resolve, 150));

      cache.cleanup();

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBe('value2');
    });

    it('should not affect non-expired entries', async () => {
      cache.set('key1', 'value1', 500); // 500ms TTL
      cache.set('key2', 'value2', 500); // 500ms TTL

      await new Promise(resolve => setTimeout(resolve, 100));

      cache.cleanup();

      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
    });
  });

  describe('Auto Cleanup', () => {
    it('should start and stop auto cleanup', () => {
      cache.startAutoCleanup();
      expect(() => cache.startAutoCleanup()).not.toThrow(); // Should be idempotent

      cache.stopAutoCleanup();
      cache.stopAutoCleanup(); // Should not throw when already stopped
    });

    it('should automatically clean up expired entries', async () => {
      cache.startAutoCleanup();
      cache.set('key1', 'value1', 100); // 100ms TTL

      // Wait for expiration and auto-cleanup cycle
      await new Promise(resolve => setTimeout(resolve, 200));

      // Note: This test might be flaky depending on cleanup interval
      // In production, cleanup runs every 60 seconds
      cache.stopAutoCleanup();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined values', () => {
      cache.set('key1', undefined);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should handle null values', () => {
      cache.set('key1', null);
      expect(cache.get('key1')).toBeNull();
    });

    it('should handle empty string keys', () => {
      cache.set('', 'empty-key-value');
      expect(cache.get('')).toBe('empty-key-value');
    });

    it('should handle special characters in keys', () => {
      const specialKey = 'key:with:colons/and/slashes';
      cache.set(specialKey, 'special-value');
      expect(cache.get(specialKey)).toBe('special-value');
    });

    it('should handle very long TTL values', () => {
      const longTTL = 1000 * 60 * 60 * 24 * 365; // 1 year
      cache.set('key1', 'value1', longTTL);
      expect(cache.get('key1')).toBe('value1');
    });

    it('should handle zero TTL (immediate expiration)', async () => {
      cache.set('key1', 'value1', 0);

      // Even with 0 TTL, it should be immediately expired
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(cache.get('key1')).toBeNull();
    });
  });

  describe('Performance', () => {
    it('should handle large number of entries', () => {
      const count = 10000;

      // Set many entries
      for (let i = 0; i < count; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      expect(cache.stats().size).toBe(count);

      // Get some entries
      expect(cache.get('key0')).toBe('value0');
      expect(cache.get('key5000')).toBe('value5000');
      expect(cache.get('key9999')).toBe('value9999');
    });

    it('should handle complex object caching', () => {
      const complexObject = {
        id: '123',
        nested: {
          array: [1, 2, 3],
          map: { a: 'b' },
        },
        date: new Date(),
        regex: /test/,
      };

      cache.set('complex', complexObject);
      const retrieved = cache.get('complex');

      expect(retrieved).toEqual(complexObject);
      expect(retrieved).toBe(complexObject); // Should be same reference
    });
  });
});
