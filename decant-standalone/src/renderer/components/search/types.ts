// ============================================================
// Search Component Types
// ============================================================

import type { ContentTypeCode, SegmentCode, Node } from '../../../shared/types';

/**
 * Search filter state structure
 */
export interface SearchFilterState {
  segments: SegmentCode[];
  categories: string[];
  contentTypes: ContentTypeCode[];
  dateRange: {
    start: string;
    end: string;
  } | null;
  hasCompleteMetadata: boolean;
}

/**
 * Active filter display model
 */
export interface ActiveFilter {
  type: 'segment' | 'category' | 'contentType' | 'dateRange' | 'metadata';
  label: string;
  value: string;
  onRemove: () => void;
}

/**
 * Search result with highlighting
 */
export interface SearchResultHighlight {
  node: Node;
  matchedField: string;
  matchedText: string;
  score: number;
  highlights?: {
    field: string;
    snippets: string[];
  }[];
}

/**
 * Search facets/aggregations for dynamic filtering
 */
export interface SearchFacets {
  segments: {
    code: SegmentCode;
    label: string;
    count: number;
  }[];
  categories: {
    name: string;
    count: number;
  }[];
  contentTypes: {
    code: ContentTypeCode;
    label: string;
    count: number;
  }[];
  organizations: {
    name: string;
    count: number;
  }[];
}

/**
 * Search request payload
 */
export interface SearchRequest {
  query: string;
  filters?: Partial<SearchFilterState>;
  pagination?: {
    page: number;
    limit: number;
  };
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
}

/**
 * Search response with pagination and facets
 */
export interface SearchResponse {
  results: SearchResultHighlight[];
  facets?: SearchFacets;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  query: string;
  appliedFilters: Partial<SearchFilterState>;
}

/**
 * Filter option for dropdowns
 */
export interface FilterOption<T = string> {
  value: T;
  label: string;
  count?: number;
  disabled?: boolean;
}

/**
 * Search suggestions/autocomplete
 */
export interface SearchSuggestion {
  type: 'query' | 'node' | 'category' | 'tag';
  text: string;
  highlight?: string;
  metadata?: Record<string, any>;
}

/**
 * Saved search preset
 */
export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SearchFilterState;
  createdAt: string;
  updatedAt: string;
}

/**
 * Search history entry
 */
export interface SearchHistoryEntry {
  query: string;
  filters: Partial<SearchFilterState>;
  timestamp: string;
  resultCount: number;
}
