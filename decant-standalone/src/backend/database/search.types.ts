// ============================================================
// Search Type Definitions
// Exported for use by frontend clients and API consumers
// ============================================================

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
 * Search query parameters for API request
 */
export interface SearchQueryParams {
  /** Search query string (required) */
  q: string;
  /** Filter by segment code */
  segment?: string;
  /** Filter by category code */
  category?: string;
  /** Filter by content type code */
  contentType?: string;
  /** Filter by organization name */
  organization?: string;
  /** Start date for date range filter (ISO date string) */
  dateStart?: string;
  /** End date for date range filter (ISO date string) */
  dateEnd?: string;
  /** Only show nodes with Phase 2 enrichment */
  hasMetadata?: boolean | string;
  /** Page number (default: 1) */
  page?: number | string;
  /** Results per page (default: 20, max: 100) */
  limit?: number | string;
}

/**
 * Matched field names that can appear in search results
 */
export type MatchedFieldName =
  | 'title'
  | 'source_domain'
  | 'company'
  | 'phrase_description'
  | 'short_description'
  | 'ai_summary';

/**
 * Segment codes
 */
export type SegmentCode = 'A' | 'E' | 'R' | 'S' | 'M' | 'T' | 'F' | 'H' | 'B' | 'L' | 'X' | 'C';

/**
 * Common category codes (extensible)
 */
export type CategoryCode =
  | 'LLM'  // Large Language Models
  | 'AGT'  // Agents
  | 'FND'  // Foundations
  | 'WEB'  // Web Development
  | 'INF'  // Infrastructure
  | 'SEC'  // Security
  | 'DAT'  // Data
  | 'MOB'  // Mobile
  | string; // Allow other codes

/**
 * Content type codes
 */
export type ContentTypeCode =
  | 'T'  // Text/Article
  | 'V'  // Video
  | 'D'  // Documentation
  | 'G'  // GitHub Repository
  | 'C'  // Course
  | 'A'  // Audio/Podcast
  | 'P'  // Paper
  | 'R'  // Research
  | 'S'  // Slides
  | 'I'  // Interactive
  | 'N'  // News
  | 'K'  // Book
  | 'U'; // Unknown

/**
 * Helper function to build search query URL
 */
export function buildSearchUrl(
  baseUrl: string,
  query: string,
  filters?: SearchFilters,
  page?: number,
  limit?: number
): string {
  const params = new URLSearchParams({ q: query });

  if (filters?.segment) params.append('segment', filters.segment);
  if (filters?.category) params.append('category', filters.category);
  if (filters?.contentType) params.append('contentType', filters.contentType);
  if (filters?.organization) params.append('organization', filters.organization);
  if (filters?.dateRange?.start) params.append('dateStart', filters.dateRange.start);
  if (filters?.dateRange?.end) params.append('dateEnd', filters.dateRange.end);
  if (filters?.hasMetadata !== undefined) {
    params.append('hasMetadata', filters.hasMetadata.toString());
  }
  if (page !== undefined) params.append('page', page.toString());
  if (limit !== undefined) params.append('limit', limit.toString());

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Helper function to parse search filters from URL query params
 */
export function parseFiltersFromUrl(searchParams: URLSearchParams): SearchFilters {
  const filters: SearchFilters = {};

  const segment = searchParams.get('segment');
  if (segment) filters.segment = segment;

  const category = searchParams.get('category');
  if (category) filters.category = category;

  const contentType = searchParams.get('contentType');
  if (contentType) filters.contentType = contentType;

  const organization = searchParams.get('organization');
  if (organization) filters.organization = organization;

  const dateStart = searchParams.get('dateStart');
  const dateEnd = searchParams.get('dateEnd');
  if (dateStart || dateEnd) {
    filters.dateRange = {};
    if (dateStart) filters.dateRange.start = dateStart;
    if (dateEnd) filters.dateRange.end = dateEnd;
  }

  const hasMetadata = searchParams.get('hasMetadata');
  if (hasMetadata !== null) {
    filters.hasMetadata = hasMetadata === 'true' || hasMetadata === '1';
  }

  return filters;
}

/**
 * Type guard to check if response is a valid SearchResponse
 */
export function isSearchResponse(value: unknown): value is SearchResponse {
  if (typeof value !== 'object' || value === null) return false;

  const response = value as any;

  return (
    Array.isArray(response.results) &&
    typeof response.facets === 'object' &&
    typeof response.total === 'number' &&
    typeof response.page === 'number' &&
    typeof response.pageSize === 'number'
  );
}

/**
 * Type guard to check if an object is a valid SearchResultItem
 */
export function isSearchResultItem(value: unknown): value is SearchResultItem {
  if (typeof value !== 'object' || value === null) return false;

  const item = value as any;

  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.url === 'string' &&
    Array.isArray(item.matchedFields)
  );
}
