// ============================================================
// Search Operations
// ============================================================

import { getDatabase } from './connection.js';
import { batchLoadKeyConcepts } from './nodes.js';
import {
  PaginationParams,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  calculateOffset,
} from '../types/pagination.js';

/**
 * Search filter parameters for advanced search
 */
export interface SearchFilters {
  /** Filter by segment code (A, E, R, S, M, etc.) */
  segment?: string;
  /** Filter by category code (e.g., LLM, AGT, FND) */
  category?: string;
  /** Filter by content type code (T, V, D, G, C, etc.) */
  contentType?: string;
  /** Filter by organization/company name */
  organization?: string;
  /** Date range filter for created_at */
  dateRange?: {
    start?: string; // ISO date string
    end?: string;   // ISO date string
  };
  /** Only show nodes with complete Phase 2 enrichment */
  hasMetadata?: boolean;
}

/**
 * Facet aggregation results
 */
export interface SearchFacets {
  /** Count of results by segment code */
  segments: Record<string, number>;
  /** Count of results by category code */
  categories: Record<string, number>;
  /** Count of results by content type code */
  contentTypes: Record<string, number>;
  /** Top organizations with their counts */
  organizations: Array<{ name: string; count: number }>;
}

/**
 * Individual search result with match context
 */
export interface SearchResultItem {
  id: string;
  title: string;
  url: string;
  segment: string | null;
  category: string | null;
  contentType: string | null;
  company: string | null;
  source_domain: string;
  phrase_description: string | null;
  short_description: string | null;
  ai_summary: string | null;
  logo_url: string | null;
  matchedFields: string[];
  snippet?: string;
  extracted_fields?: Record<string, unknown>;
  metadata_tags?: string[];
  key_concepts?: string[];
}

/**
 * Complete search response with results and facets
 */
export interface SearchResponse {
  results: SearchResultItem[];
  facets: SearchFacets;
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Build WHERE clause conditions and parameters for search filters
 */
function buildFilterConditions(
  filters?: SearchFilters
): { conditions: string[]; params: unknown[] } {
  const conditions: string[] = ['is_deleted = 0'];
  const params: unknown[] = [];

  if (!filters) {
    return { conditions, params };
  }

  // Segment filter
  if (filters.segment) {
    conditions.push('segment_code = ?');
    params.push(filters.segment);
  }

  // Category filter
  if (filters.category) {
    conditions.push('category_code = ?');
    params.push(filters.category);
  }

  // Content type filter
  if (filters.contentType) {
    conditions.push('content_type_code = ?');
    params.push(filters.contentType);
  }

  // Organization filter (partial match on company field)
  if (filters.organization) {
    conditions.push('company LIKE ?');
    params.push(`%${filters.organization}%`);
  }

  // Date range filter
  if (filters.dateRange) {
    if (filters.dateRange.start) {
      conditions.push('date_added >= ?');
      params.push(filters.dateRange.start);
    }
    if (filters.dateRange.end) {
      conditions.push('date_added <= ?');
      params.push(filters.dateRange.end);
    }
  }

  // Has metadata filter (Phase 2 completed)
  if (filters.hasMetadata) {
    conditions.push("json_extract(extracted_fields, '$.phase2Completed') = 1");
  }

  return { conditions, params };
}

/**
 * Check if FTS5 table exists and has data
 */
function hasFTS5Support(): boolean {
  const db = getDatabase();
  try {
    const result = db.prepare(`
      SELECT COUNT(*) as count
      FROM sqlite_master
      WHERE type='table' AND name='nodes_fts'
    `).get() as { count: number };
    return result.count > 0;
  } catch {
    return false;
  }
}

/**
 * Search using FTS5 full-text search
 */
function searchWithFTS5(
  query: string,
  filters?: SearchFilters,
  pagination?: Partial<PaginationParams>
): { nodes: any[]; matchedFields: Map<string, string[]> } {
  const db = getDatabase();
  const page = pagination?.page ?? DEFAULT_PAGE;
  const limit = pagination?.limit ?? DEFAULT_LIMIT;
  const offset = calculateOffset(page, limit);

  const { conditions, params } = buildFilterConditions(filters);

  // Check if query contains phrase search (quoted text)
  const isPhraseSearch = query.includes('"');
  const ftsQuery = isPhraseSearch ? query : query.split(' ').join(' OR ');

  // Build the FTS5 query with JOIN to main nodes table for filtering
  const sql = `
    SELECT
      n.*,
      snippet(nodes_fts, 0, '<mark>', '</mark>', '...', 32) as title_snippet,
      snippet(nodes_fts, 1, '<mark>', '</mark>', '...', 32) as domain_snippet,
      snippet(nodes_fts, 2, '<mark>', '</mark>', '...', 32) as company_snippet,
      snippet(nodes_fts, 3, '<mark>', '</mark>', '...', 32) as phrase_snippet,
      snippet(nodes_fts, 4, '<mark>', '</mark>', '...', 32) as desc_snippet,
      snippet(nodes_fts, 5, '<mark>', '</mark>', '...', 32) as summary_snippet,
      nodes_fts.rank
    FROM nodes_fts
    INNER JOIN nodes n ON n.rowid = nodes_fts.rowid
    WHERE nodes_fts MATCH ?
      AND ${conditions.join(' AND ')}
    ORDER BY nodes_fts.rank
    LIMIT ? OFFSET ?
  `;

  const nodes = db.prepare(sql).all(ftsQuery, ...params, limit, offset) as any[];

  // Track which fields matched for each node
  const matchedFields = new Map<string, string[]>();

  for (const node of nodes) {
    const fields: string[] = [];
    if (node.title_snippet?.includes('<mark>')) fields.push('title');
    if (node.domain_snippet?.includes('<mark>')) fields.push('source_domain');
    if (node.company_snippet?.includes('<mark>')) fields.push('company');
    if (node.phrase_snippet?.includes('<mark>')) fields.push('phrase_description');
    if (node.desc_snippet?.includes('<mark>')) fields.push('short_description');
    if (node.summary_snippet?.includes('<mark>')) fields.push('ai_summary');

    matchedFields.set(node.id, fields);

    // Find best snippet (prioritize: short_description > phrase_description > ai_summary)
    if (node.desc_snippet?.includes('<mark>')) {
      node.snippet = node.desc_snippet;
    } else if (node.phrase_snippet?.includes('<mark>')) {
      node.snippet = node.phrase_snippet;
    } else if (node.summary_snippet?.includes('<mark>')) {
      node.snippet = node.summary_snippet;
    }

    // Clean up snippet fields from result
    delete node.title_snippet;
    delete node.domain_snippet;
    delete node.company_snippet;
    delete node.phrase_snippet;
    delete node.desc_snippet;
    delete node.summary_snippet;
    delete node.rank;
  }

  return { nodes, matchedFields };
}

/**
 * Search using LIKE fallback (when FTS5 is not available)
 */
function searchWithLike(
  query: string,
  filters?: SearchFilters,
  pagination?: Partial<PaginationParams>
): { nodes: any[]; matchedFields: Map<string, string[]> } {
  const db = getDatabase();
  const page = pagination?.page ?? DEFAULT_PAGE;
  const limit = pagination?.limit ?? DEFAULT_LIMIT;
  const offset = calculateOffset(page, limit);

  const { conditions, params } = buildFilterConditions(filters);

  // Simple text search across key fields
  const searchTerm = `%${query}%`;

  const searchCondition = `(
    title LIKE ? OR
    source_domain LIKE ? OR
    company LIKE ? OR
    short_description LIKE ? OR
    ai_summary LIKE ?
  )`;

  conditions.push(searchCondition);
  params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);

  const sql = `
    SELECT * FROM nodes
    WHERE ${conditions.join(' AND ')}
    ORDER BY date_added DESC
    LIMIT ? OFFSET ?
  `;

  const nodes = db.prepare(sql).all(...params, limit, offset) as any[];

  // Determine which fields matched for each node
  const matchedFields = new Map<string, string[]>();
  const lowerQuery = query.toLowerCase();

  for (const node of nodes) {
    const fields: string[] = [];
    if (node.title?.toLowerCase().includes(lowerQuery)) fields.push('title');
    if (node.source_domain?.toLowerCase().includes(lowerQuery)) fields.push('source_domain');
    if (node.company?.toLowerCase().includes(lowerQuery)) fields.push('company');
    if (node.short_description?.toLowerCase().includes(lowerQuery)) fields.push('short_description');
    if (node.ai_summary?.toLowerCase().includes(lowerQuery)) fields.push('ai_summary');

    matchedFields.set(node.id, fields);

    // Create simple snippet from best matching field
    if (node.short_description && fields.includes('short_description')) {
      node.snippet = node.short_description.slice(0, 150) + '...';
    } else if (node.ai_summary && fields.includes('ai_summary')) {
      node.snippet = node.ai_summary.slice(0, 150) + '...';
    }
  }

  return { nodes, matchedFields };
}

/**
 * Count total search results matching query and filters
 */
function countSearchWithFilters(query: string, filters?: SearchFilters): number {
  const db = getDatabase();
  const { conditions, params } = buildFilterConditions(filters);

  if (hasFTS5Support()) {
    // Use FTS5 for counting
    const isPhraseSearch = query.includes('"');
    const ftsQuery = isPhraseSearch ? query : query.split(' ').join(' OR ');

    const sql = `
      SELECT COUNT(*) as count
      FROM nodes_fts
      INNER JOIN nodes n ON n.rowid = nodes_fts.rowid
      WHERE nodes_fts MATCH ?
        AND ${conditions.join(' AND ')}
    `;

    const result = db.prepare(sql).get(ftsQuery, ...params) as { count: number };
    return result.count;
  } else {
    // Use LIKE fallback
    const searchTerm = `%${query}%`;
    const searchCondition = `(
      title LIKE ? OR
      source_domain LIKE ? OR
      company LIKE ? OR
      short_description LIKE ? OR
      ai_summary LIKE ?
    )`;

    conditions.push(searchCondition);
    params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);

    const sql = `
      SELECT COUNT(*) as count FROM nodes
      WHERE ${conditions.join(' AND ')}
    `;

    const result = db.prepare(sql).get(...params) as { count: number };
    return result.count;
  }
}

/**
 * Calculate facet aggregations for search results
 * Limited to first 10000 results for performance
 */
function calculateFacets(query: string, filters?: SearchFilters): SearchFacets {
  const db = getDatabase();
  const { conditions, params } = buildFilterConditions(filters);

  let baseWhereClause: string;
  let baseParams: unknown[];

  if (hasFTS5Support()) {
    const isPhraseSearch = query.includes('"');
    const ftsQuery = isPhraseSearch ? query : query.split(' ').join(' OR ');

    baseWhereClause = `
      n.rowid IN (
        SELECT nodes_fts.rowid
        FROM nodes_fts
        WHERE nodes_fts MATCH ?
        LIMIT 10000
      ) AND ${conditions.join(' AND ')}
    `;
    baseParams = [ftsQuery, ...params];
  } else {
    const searchTerm = `%${query}%`;
    const searchCondition = `(
      title LIKE ? OR
      source_domain LIKE ? OR
      company LIKE ? OR
      short_description LIKE ? OR
      ai_summary LIKE ?
    )`;

    conditions.push(searchCondition);
    params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);

    baseWhereClause = conditions.join(' AND ');
    baseParams = params;
  }

  // Segment facets
  const segmentRows = db.prepare(`
    SELECT segment_code, COUNT(*) as count
    FROM nodes n
    WHERE ${baseWhereClause}
      AND segment_code IS NOT NULL
    GROUP BY segment_code
  `).all(...baseParams) as Array<{ segment_code: string; count: number }>;

  const segments: Record<string, number> = {};
  for (const row of segmentRows) {
    segments[row.segment_code] = row.count;
  }

  // Category facets
  const categoryRows = db.prepare(`
    SELECT category_code, COUNT(*) as count
    FROM nodes n
    WHERE ${baseWhereClause}
      AND category_code IS NOT NULL
    GROUP BY category_code
  `).all(...baseParams) as Array<{ category_code: string; count: number }>;

  const categories: Record<string, number> = {};
  for (const row of categoryRows) {
    categories[row.category_code] = row.count;
  }

  // Content type facets
  const contentTypeRows = db.prepare(`
    SELECT content_type_code, COUNT(*) as count
    FROM nodes n
    WHERE ${baseWhereClause}
      AND content_type_code IS NOT NULL
    GROUP BY content_type_code
  `).all(...baseParams) as Array<{ content_type_code: string; count: number }>;

  const contentTypes: Record<string, number> = {};
  for (const row of contentTypeRows) {
    contentTypes[row.content_type_code] = row.count;
  }

  // Organization facets (top 20)
  const organizationRows = db.prepare(`
    SELECT company, COUNT(*) as count
    FROM nodes n
    WHERE ${baseWhereClause}
      AND company IS NOT NULL
      AND company != ''
    GROUP BY company
    ORDER BY count DESC
    LIMIT 20
  `).all(...baseParams) as Array<{ company: string; count: number }>;

  const organizations = organizationRows.map(row => ({
    name: row.company,
    count: row.count,
  }));

  return {
    segments,
    categories,
    contentTypes,
    organizations,
  };
}

/**
 * Search nodes with advanced filters and faceted results
 * @param query - Search query string
 * @param filters - Optional search filters
 * @param pagination - Optional pagination parameters
 * @returns SearchResponse with results, facets, and metadata
 */
export function searchNodesAdvanced(
  query: string,
  filters?: SearchFilters,
  pagination?: Partial<PaginationParams>
): SearchResponse {
  const page = pagination?.page ?? DEFAULT_PAGE;
  const pageSize = pagination?.limit ?? DEFAULT_LIMIT;

  // Execute search with appropriate method
  const useFTS = hasFTS5Support();
  const { nodes, matchedFields } = useFTS
    ? searchWithFTS5(query, filters, pagination)
    : searchWithLike(query, filters, pagination);

  // Batch load key concepts if we have results
  let conceptsMap = new Map<string, string[]>();
  if (nodes.length > 0) {
    const nodeIds = nodes.map(n => n.id);
    conceptsMap = batchLoadKeyConcepts(nodeIds);
  }

  // Transform results
  const results: SearchResultItem[] = nodes.map(node => ({
    id: node.id,
    title: node.title,
    url: node.url,
    segment: node.segment_code,
    category: node.category_code,
    contentType: node.content_type_code,
    company: node.company,
    source_domain: node.source_domain,
    phrase_description: node.phrase_description,
    short_description: node.short_description,
    ai_summary: node.ai_summary,
    logo_url: node.logo_url,
    matchedFields: matchedFields.get(node.id) || [],
    snippet: node.snippet,
    extracted_fields: JSON.parse(node.extracted_fields || '{}'),
    metadata_tags: JSON.parse(node.metadata_tags || '[]'),
    key_concepts: conceptsMap.get(node.id) || [],
  }));

  // Calculate facets
  const facets = calculateFacets(query, filters);

  // Get total count
  const total = countSearchWithFilters(query, filters);

  return {
    results,
    facets,
    total,
    page,
    pageSize,
  };
}

/**
 * Search nodes with optional pagination (backward compatible)
 * @param query - Search query string
 * @param filters - Optional filters (not yet implemented)
 * @param pagination - Optional pagination parameters
 * @returns Array of matching nodes
 */
export function searchNodes(
  query: string,
  filters?: any,
  pagination?: Partial<PaginationParams>
): any[] {
  const db = getDatabase();

  const page = pagination?.page ?? DEFAULT_PAGE;
  const limit = pagination?.limit ?? DEFAULT_LIMIT;
  const offset = calculateOffset(page, limit);

  // Simple text search across key fields
  const searchTerm = `%${query}%`;
  const nodes = db.prepare(`
    SELECT * FROM nodes
    WHERE is_deleted = 0 AND (
      title LIKE ? OR
      source_domain LIKE ? OR
      company LIKE ? OR
      short_description LIKE ? OR
      ai_summary LIKE ?
    )
    ORDER BY date_added DESC
    LIMIT ? OFFSET ?
  `).all(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, limit, offset) as any[];

  if (nodes.length === 0) return [];

  // Batch load key concepts to avoid N+1 queries
  const nodeIds = nodes.map(n => n.id);
  const conceptsMap = batchLoadKeyConcepts(nodeIds);

  return nodes.map(node => ({
    ...node,
    extracted_fields: JSON.parse(node.extracted_fields || '{}'),
    metadata_tags: JSON.parse(node.metadata_tags || '[]'),
    key_concepts: conceptsMap.get(node.id) || [],
  }));
}

/**
 * Count total search results matching a query
 * @param query - Search query string
 * @param filters - Optional filters (not yet implemented)
 * @returns Total count of matching nodes
 */
export function countSearchResults(query: string, filters?: any): number {
  const db = getDatabase();

  const searchTerm = `%${query}%`;
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM nodes
    WHERE is_deleted = 0 AND (
      title LIKE ? OR
      source_domain LIKE ? OR
      company LIKE ? OR
      short_description LIKE ? OR
      ai_summary LIKE ?
    )
  `).get(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm) as { count: number };

  return result.count;
}
