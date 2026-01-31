// ============================================================
// Import Result Cache
// Caches import results by normalized URL to prevent duplicates
// ============================================================

import { log } from '../../logger/index.js';

// ============================================================
// Types
// ============================================================

/**
 * Cached import result data
 */
export interface CachedImportResult {
  nodeId: string;
  classification: {
    segment: string;
    category: string;
    contentType: string;
    organization: string;
    confidence: number;
  };
  hierarchyCodes: {
    function: string | null;
    organization: string | null;
  };
  metadata: {
    title: string;
    description: string | null;
    favicon: string | null;
    image: string | null;
  };
  cachedAt: number;
}

/**
 * Internal cache entry with expiration
 */
interface CacheEntry {
  data: CachedImportResult;
  expiresAt: number;
}

/**
 * Cache configuration options
 */
export interface ImportCacheOptions {
  /** Time-to-live in milliseconds (default: 24 hours) */
  ttlMs?: number;
  /** Maximum number of entries to cache (default: 1000) */
  maxEntries?: number;
  /** Enable cache cleanup on interval (default: true) */
  enableAutoCleanup?: boolean;
  /** Cleanup interval in milliseconds (default: 1 hour) */
  cleanupIntervalMs?: number;
}

// ============================================================
// URL Normalization
// ============================================================

/**
 * Normalize a URL for use as a cache key
 * This ensures consistent caching regardless of minor URL variations
 */
export function normalizeUrlForCache(url: string): string {
  try {
    const parsed = new URL(url);

    // Lowercase hostname
    parsed.hostname = parsed.hostname.toLowerCase();

    // Remove default ports
    if (
      (parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443')
    ) {
      parsed.port = '';
    }

    // Remove trailing slash from path (except for root)
    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    // Remove common tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'ref', 'source', 'fbclid', 'gclid', 'dclid',
    ];
    trackingParams.forEach(param => parsed.searchParams.delete(param));

    // Sort remaining search params for consistency
    parsed.searchParams.sort();

    // Remove fragment
    parsed.hash = '';

    return parsed.toString();
  } catch {
    // If URL parsing fails, use lowercase trimmed version
    return url.toLowerCase().trim();
  }
}

// ============================================================
// Import Cache Implementation
// ============================================================

/**
 * In-memory cache for import results
 * Uses normalized URLs as keys with automatic expiration
 */
export class ImportCache {
  private cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: ImportCacheOptions = {}) {
    this.ttlMs = options.ttlMs ?? 24 * 60 * 60 * 1000; // 24 hours default
    this.maxEntries = options.maxEntries ?? 1000;

    // Start auto-cleanup if enabled
    if (options.enableAutoCleanup !== false) {
      const cleanupInterval = options.cleanupIntervalMs ?? 60 * 60 * 1000; // 1 hour
      this.startAutoCleanup(cleanupInterval);
    }
  }

  /**
   * Get a cached import result by URL
   * Returns null if not found or expired
   */
  get(url: string): CachedImportResult | null {
    const key = normalizeUrlForCache(url);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      log.debug('Import cache entry expired', { url: key, module: 'import-cache' });
      return null;
    }

    log.debug('Import cache hit', { url: key, nodeId: entry.data.nodeId, module: 'import-cache' });
    return entry.data;
  }

  /**
   * Check if a URL is in the cache (and not expired)
   */
  has(url: string): boolean {
    return this.get(url) !== null;
  }

  /**
   * Store an import result in the cache
   */
  set(url: string, data: CachedImportResult): void {
    const key = normalizeUrlForCache(url);

    // Enforce max entries limit using LRU-style eviction
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      this.evictOldest();
    }

    const entry: CacheEntry = {
      data: {
        ...data,
        cachedAt: Date.now(),
      },
      expiresAt: Date.now() + this.ttlMs,
    };

    this.cache.set(key, entry);
    log.debug('Import result cached', { url: key, nodeId: data.nodeId, module: 'import-cache' });
  }

  /**
   * Invalidate (remove) a cached entry by URL
   */
  invalidate(url: string): boolean {
    const key = normalizeUrlForCache(url);
    const existed = this.cache.has(key);

    if (existed) {
      this.cache.delete(key);
      log.debug('Import cache entry invalidated', { url: key, module: 'import-cache' });
    }

    return existed;
  }

  /**
   * Invalidate cache entry by node ID
   * Useful when a node is deleted or modified
   */
  invalidateByNodeId(nodeId: string): number {
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.data.nodeId === nodeId) {
        this.cache.delete(key);
        count++;
      }
    }

    if (count > 0) {
      log.debug('Import cache entries invalidated by nodeId', { nodeId, count, module: 'import-cache' });
    }

    return count;
  }

  /**
   * Clear all expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      log.debug('Import cache cleanup completed', {
        expiredCount,
        remainingEntries: this.cache.size,
        module: 'import-cache',
      });
    }

    return expiredCount;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const previousSize = this.cache.size;
    this.cache.clear();
    log.info('Import cache cleared', { previousSize, module: 'import-cache' });
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxEntries: number;
    ttlMs: number;
    oldestEntryAge: number | null;
    newestEntryAge: number | null;
  } {
    let oldestTimestamp: number | null = null;
    let newestTimestamp: number | null = null;

    for (const entry of this.cache.values()) {
      if (oldestTimestamp === null || entry.data.cachedAt < oldestTimestamp) {
        oldestTimestamp = entry.data.cachedAt;
      }
      if (newestTimestamp === null || entry.data.cachedAt > newestTimestamp) {
        newestTimestamp = entry.data.cachedAt;
      }
    }

    const now = Date.now();
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      ttlMs: this.ttlMs,
      oldestEntryAge: oldestTimestamp ? now - oldestTimestamp : null,
      newestEntryAge: newestTimestamp ? now - newestTimestamp : null,
    };
  }

  /**
   * Stop the auto-cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Evict the oldest entry (used when at max capacity)
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.data.cachedAt < oldestTime) {
        oldestTime = entry.data.cachedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      log.debug('Import cache entry evicted (LRU)', { url: oldestKey, module: 'import-cache' });
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startAutoCleanup(intervalMs: number): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, intervalMs);

    // Don't keep the process alive just for cache cleanup
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }
}

// ============================================================
// Singleton Instance
// ============================================================

let cacheInstance: ImportCache | null = null;

/**
 * Get the singleton import cache instance
 */
export function getImportCache(options?: ImportCacheOptions): ImportCache {
  if (!cacheInstance) {
    cacheInstance = new ImportCache(options);
    log.info('Import cache initialized', {
      ttlMs: cacheInstance.getStats().ttlMs,
      maxEntries: cacheInstance.getStats().maxEntries,
      module: 'import-cache',
    });
  }
  return cacheInstance;
}

/**
 * Reset the import cache (useful for testing)
 */
export function resetImportCache(): void {
  if (cacheInstance) {
    cacheInstance.destroy();
    cacheInstance = null;
  }
}
