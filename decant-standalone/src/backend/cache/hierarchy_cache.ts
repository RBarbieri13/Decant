// ============================================================
// Specialized Hierarchy Cache
// Smart cache for hierarchy trees with granular invalidation
// ============================================================

import { log } from '../logger/index.js';

/**
 * Represents a node in the hierarchy tree
 */
export interface TreeNode {
  id: string;
  title: string;
  function_hierarchy_code?: string;
  organization_hierarchy_code?: string;
  segment_code?: string;
  category_code?: string;
  content_type_code?: string;
  children: TreeNode[];
  [key: string]: any;
}

/**
 * Cache entry with expiration and metadata
 */
interface HierarchyCacheEntry {
  data: TreeNode[];
  expires: number;
  createdAt: number;
}

/**
 * Mutation record for tracking code changes
 */
export interface CodeMutation {
  oldCode: string;
  newCode: string;
}

// Default TTL: 10 minutes for hierarchy data (longer than general cache)
const DEFAULT_TTL = 10 * 60 * 1000;

// Cache storage organized by view type
const functionCache = new Map<string, HierarchyCacheEntry>();
const organizationCache = new Map<string, HierarchyCacheEntry>();

/**
 * Get the appropriate cache map for a view
 */
function getCacheMap(view: 'function' | 'organization'): Map<string, HierarchyCacheEntry> {
  return view === 'function' ? functionCache : organizationCache;
}

/**
 * Generate cache key for a path
 * @param path - Hierarchy path (e.g., 'A.LLM.T')
 * @returns Cache key
 */
function getCacheKey(path?: string): string {
  return path || '__root__';
}

/**
 * Get all ancestor paths for a given hierarchy path
 * For 'A.LLM.T.1' returns ['A.LLM.T.1', 'A.LLM.T', 'A.LLM', 'A', '__root__']
 */
function getAncestorPaths(path: string): string[] {
  const paths: string[] = [path];
  const parts = path.split('.');

  // Build ancestor paths by progressively removing segments
  while (parts.length > 1) {
    parts.pop();
    paths.push(parts.join('.'));
  }

  // Always include root
  paths.push('__root__');

  return paths;
}

/**
 * Get all descendant key patterns for a path
 * For 'A.LLM' matches any key starting with 'A.LLM.'
 */
function getDescendantPattern(path: string): RegExp {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}\\.`);
}

// ============================================================
// Public API
// ============================================================

/**
 * Get cached tree or subtree
 * @param view - 'function' or 'organization'
 * @param path - Optional path for subtree (e.g., 'A.LLM')
 * @returns Cached tree nodes or null if not cached/expired
 */
export function getTree(view: 'function' | 'organization', path?: string): TreeNode[] | null {
  const cache = getCacheMap(view);
  const key = getCacheKey(path);
  const entry = cache.get(key);

  if (!entry) {
    log.debug('Hierarchy cache miss', { view, path: path || 'root', module: 'hierarchy_cache' });
    return null;
  }

  // Check expiration
  if (Date.now() > entry.expires) {
    cache.delete(key);
    log.debug('Hierarchy cache expired', { view, path: path || 'root', module: 'hierarchy_cache' });
    return null;
  }

  log.debug('Hierarchy cache hit', { view, path: path || 'root', module: 'hierarchy_cache' });
  return entry.data;
}

/**
 * Set tree in cache
 * @param view - 'function' or 'organization'
 * @param tree - Tree nodes to cache
 * @param path - Optional path for subtree
 * @param ttl - Optional TTL in milliseconds
 */
export function setTree(
  view: 'function' | 'organization',
  tree: TreeNode[],
  path?: string,
  ttl: number = DEFAULT_TTL
): void {
  const cache = getCacheMap(view);
  const key = getCacheKey(path);
  const now = Date.now();

  cache.set(key, {
    data: tree,
    expires: now + ttl,
    createdAt: now,
  });

  log.debug('Hierarchy cache set', { view, path: path || 'root', ttl, module: 'hierarchy_cache' });
}

/**
 * Invalidate affected paths when hierarchy codes change
 * Smart invalidation that only clears affected subtrees
 *
 * @param mutations - Array of old/new code pairs
 */
export function invalidateForMutations(mutations: CodeMutation[]): void {
  if (mutations.length === 0) return;

  let invalidatedCount = 0;
  const affectedPaths = new Set<string>();

  for (const { oldCode, newCode } of mutations) {
    // Collect all affected paths from both old and new codes
    if (oldCode) {
      getAncestorPaths(oldCode).forEach(p => affectedPaths.add(p));
    }
    if (newCode) {
      getAncestorPaths(newCode).forEach(p => affectedPaths.add(p));
    }
  }

  // Convert Set to Array for iteration compatibility
  const affectedPathsArray = Array.from(affectedPaths);

  // Invalidate all affected paths in both views
  for (const view of ['function', 'organization'] as const) {
    const cache = getCacheMap(view);

    for (const path of affectedPathsArray) {
      if (cache.has(path)) {
        cache.delete(path);
        invalidatedCount++;
      }
    }

    // Also invalidate any cached subtrees that are descendants of affected paths
    const cacheEntries = Array.from(cache.entries());
    for (const [key] of cacheEntries) {
      for (const path of affectedPathsArray) {
        if (path !== '__root__' && key.startsWith(path + '.')) {
          cache.delete(key);
          invalidatedCount++;
          break;
        }
      }
    }
  }

  if (invalidatedCount > 0) {
    log.debug('Hierarchy cache invalidated for mutations', {
      mutationCount: mutations.length,
      invalidatedCount,
      module: 'hierarchy_cache',
    });
  }
}

/**
 * Invalidate a specific path and all its ancestors
 * Use this when a node at a specific path changes
 *
 * @param view - 'function' or 'organization'
 * @param path - Hierarchy path to invalidate
 */
export function invalidatePath(view: 'function' | 'organization', path: string): void {
  const cache = getCacheMap(view);
  const pathsToInvalidate = getAncestorPaths(path);
  let invalidatedCount = 0;

  for (const p of pathsToInvalidate) {
    if (cache.has(p)) {
      cache.delete(p);
      invalidatedCount++;
    }
  }

  // Also invalidate descendants
  const descendantPattern = getDescendantPattern(path);
  const cacheEntries = Array.from(cache.entries());
  for (const [key] of cacheEntries) {
    if (descendantPattern.test(key)) {
      cache.delete(key);
      invalidatedCount++;
    }
  }

  if (invalidatedCount > 0) {
    log.debug('Hierarchy cache path invalidated', {
      view,
      path,
      invalidatedCount,
      module: 'hierarchy_cache',
    });
  }
}

/**
 * Invalidate all entries for a specific view
 * @param view - 'function' or 'organization'
 */
export function invalidateView(view: 'function' | 'organization'): void {
  const cache = getCacheMap(view);
  const size = cache.size;
  cache.clear();

  if (size > 0) {
    log.debug('Hierarchy cache view cleared', { view, entriesCleared: size, module: 'hierarchy_cache' });
  }
}

/**
 * Clear all hierarchy caches
 */
export function clearAll(): void {
  const functionSize = functionCache.size;
  const organizationSize = organizationCache.size;

  functionCache.clear();
  organizationCache.clear();

  const total = functionSize + organizationSize;
  if (total > 0) {
    log.debug('Hierarchy cache cleared', {
      functionEntries: functionSize,
      organizationEntries: organizationSize,
      module: 'hierarchy_cache',
    });
  }
}

/**
 * Get cache statistics
 */
export function getStats(): {
  function: { size: number; keys: string[] };
  organization: { size: number; keys: string[] };
} {
  return {
    function: {
      size: functionCache.size,
      keys: Array.from(functionCache.keys()),
    },
    organization: {
      size: organizationCache.size,
      keys: Array.from(organizationCache.keys()),
    },
  };
}

/**
 * Clean up expired entries in both caches
 */
export function cleanup(): void {
  const now = Date.now();
  let cleaned = 0;

  const caches = [functionCache, organizationCache];
  for (const cache of caches) {
    const entries = Array.from(cache.entries());
    for (const [key, entry] of entries) {
      if (now > entry.expires) {
        cache.delete(key);
        cleaned++;
      }
    }
  }

  if (cleaned > 0) {
    log.debug('Hierarchy cache cleanup completed', { entriesRemoved: cleaned, module: 'hierarchy_cache' });
  }
}

// ============================================================
// Batch Operations for Efficiency
// ============================================================

/**
 * Warm up the cache by pre-computing common subtrees
 * Call this after bulk operations to pre-populate frequently accessed paths
 *
 * @param view - 'function' or 'organization'
 * @param paths - Array of paths to warm up
 * @param treeFetcher - Function to fetch tree for a path
 */
export async function warmupCache(
  view: 'function' | 'organization',
  paths: string[],
  treeFetcher: (view: 'function' | 'organization', path?: string) => TreeNode[]
): Promise<void> {
  for (const path of paths) {
    if (!getTree(view, path)) {
      try {
        const tree = treeFetcher(view, path);
        setTree(view, tree, path);
      } catch (error) {
        log.warn('Failed to warm up cache path', { view, path, error, module: 'hierarchy_cache' });
      }
    }
  }
}

/**
 * Batch invalidation with deduplication
 * More efficient when many nodes change at once
 *
 * @param paths - Array of paths (can include duplicates)
 */
export function batchInvalidatePaths(paths: Array<{ view: 'function' | 'organization'; path: string }>): void {
  // Deduplicate by view and path
  const seen = new Set<string>();
  const unique = paths.filter(({ view, path }) => {
    const key = `${view}:${path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  for (const { view, path } of unique) {
    invalidatePath(view, path);
  }
}

// ============================================================
// Integration Helpers
// ============================================================

/**
 * Create an invalidator function for use in database operations
 * Returns a function that can be called with the old and new hierarchy codes
 */
export function createMutationInvalidator(): (oldCode: string | null, newCode: string | null) => void {
  const mutations: CodeMutation[] = [];

  return (oldCode: string | null, newCode: string | null) => {
    if (oldCode || newCode) {
      mutations.push({
        oldCode: oldCode || '',
        newCode: newCode || '',
      });
      // Debounce invalidation - apply on next tick
      if (mutations.length === 1) {
        setImmediate(() => {
          invalidateForMutations(mutations);
          mutations.length = 0;
        });
      }
    }
  };
}

/**
 * Decorator for database operations that modify hierarchy
 * Automatically invalidates cache after the operation
 */
export function withHierarchyInvalidation<T>(
  operation: () => T,
  getAffectedCodes: (result: T) => Array<{ oldCode?: string; newCode?: string }>
): T {
  const result = operation();

  const mutations = getAffectedCodes(result)
    .filter(m => m.oldCode || m.newCode)
    .map(m => ({
      oldCode: m.oldCode || '',
      newCode: m.newCode || '',
    }));

  if (mutations.length > 0) {
    invalidateForMutations(mutations);
  }

  return result;
}
