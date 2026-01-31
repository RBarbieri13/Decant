// ============================================================
// In-Memory Cache with TTL
// Simple cache implementation for query results
// ============================================================

import { log } from '../logger/index.js';

interface CacheEntry<T> {
  data: T;
  expires: number;
}

// Default TTL: 5 minutes
const DEFAULT_TTL = 5 * 60 * 1000;

// In-memory cache storage
const cache = new Map<string, CacheEntry<any>>();

/**
 * Get a value from the cache
 * Returns null if the key doesn't exist or has expired
 */
export function get<T>(key: string): T | null {
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  // Check if expired
  if (Date.now() > entry.expires) {
    cache.delete(key);
    log.debug('Cache expired', { key, module: 'cache' });
    return null;
  }

  log.debug('Cache hit', { key, module: 'cache' });
  return entry.data as T;
}

/**
 * Set a value in the cache with optional TTL
 * @param key - Cache key
 * @param value - Value to cache
 * @param ttl - Time to live in milliseconds (default: 5 minutes)
 */
export function set<T>(key: string, value: T, ttl: number = DEFAULT_TTL): void {
  const expires = Date.now() + ttl;
  cache.set(key, { data: value, expires });
  log.debug('Cache set', { key, ttl, module: 'cache' });
}

/**
 * Invalidate cache entries matching a pattern
 * Supports wildcards: 'tree:*' will invalidate all keys starting with 'tree:'
 */
export function invalidate(pattern: string): void {
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  let invalidated = 0;

  for (const key of cache.keys()) {
    if (regex.test(key)) {
      cache.delete(key);
      invalidated++;
    }
  }

  if (invalidated > 0) {
    log.debug('Cache invalidated', { pattern, count: invalidated, module: 'cache' });
  }
}

/**
 * Clear all cache entries
 */
export function clear(): void {
  const size = cache.size;
  cache.clear();
  log.debug('Cache cleared', { entriesCleared: size, module: 'cache' });
}

/**
 * Get cache statistics
 */
export function stats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}

/**
 * Clean up expired entries
 * Should be called periodically (e.g., every minute)
 */
export function cleanup(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of cache.entries()) {
    if (now > entry.expires) {
      cache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    log.debug('Cache cleanup completed', { entriesRemoved: cleaned, module: 'cache' });
  }
}

/**
 * Start automatic cleanup interval
 * Cleans up expired entries every minute
 */
let cleanupInterval: NodeJS.Timeout | null = null;

export function startAutoCleanup(): void {
  if (cleanupInterval) {
    log.debug('Cache auto-cleanup already running', { module: 'cache' });
    return;
  }

  // Run cleanup every minute
  cleanupInterval = setInterval(cleanup, 60 * 1000);
  log.debug('Cache auto-cleanup started', { module: 'cache' });
}

/**
 * Stop automatic cleanup interval
 */
export function stopAutoCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    log.debug('Cache auto-cleanup stopped', { module: 'cache' });
  }
}
