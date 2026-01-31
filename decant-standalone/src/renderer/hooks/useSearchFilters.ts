// ============================================================
// useSearchFilters Hook - Manage search filter state
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ContentTypeCode, SegmentCode } from '../../shared/types';

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

export interface ActiveFilter {
  type: 'segment' | 'category' | 'contentType' | 'dateRange' | 'metadata';
  label: string;
  value: string;
  onRemove: () => void;
}

export interface UseSearchFiltersResult {
  filters: SearchFilterState;
  activeFilters: ActiveFilter[];
  hasActiveFilters: boolean;
  setSegments: (segments: SegmentCode[]) => void;
  setCategories: (categories: string[]) => void;
  setContentTypes: (types: ContentTypeCode[]) => void;
  setDateRange: (range: { start: string; end: string } | null) => void;
  setHasCompleteMetadata: (value: boolean) => void;
  clearAllFilters: () => void;
  removeFilter: (type: string, value: string) => void;
}

const STORAGE_KEY = 'decant-search-filters';

const SEGMENT_LABELS: Record<SegmentCode, string> = {
  'A': 'AI & ML',
  'T': 'Technology',
  'F': 'Finance',
  'S': 'Sports',
  'H': 'Health',
  'B': 'Business',
  'E': 'Entertainment',
  'L': 'Lifestyle',
  'X': 'Science',
  'C': 'Creative',
};

const CONTENT_TYPE_LABELS: Record<ContentTypeCode, string> = {
  'T': 'Tool',
  'A': 'Article',
  'V': 'Video',
  'P': 'Podcast',
  'R': 'Research',
  'G': 'Repository',
  'S': 'Social',
  'C': 'Course',
  'I': 'Image',
  'N': 'Newsletter',
  'K': 'Book',
  'U': 'Audio',
};

const getInitialFilters = (): SearchFilterState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to load saved filters:', error);
  }

  return {
    segments: [],
    categories: [],
    contentTypes: [],
    dateRange: null,
    hasCompleteMetadata: false,
  };
};

/**
 * Hook to manage search filter state with URL params and localStorage persistence
 *
 * @example
 * const { filters, activeFilters, setSegments, clearAllFilters } = useSearchFilters();
 */
export function useSearchFilters(): UseSearchFiltersResult {
  const [filters, setFilters] = useState<SearchFilterState>(getInitialFilters);
  const [debouncedFilters, setDebouncedFilters] = useState<SearchFilterState>(filters);

  // Debounce filter changes (300ms)
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 300);

    return () => clearTimeout(timeout);
  }, [filters]);

  // Persist filters to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(debouncedFilters));
    } catch (error) {
      console.warn('Failed to save filters:', error);
    }
  }, [debouncedFilters]);

  // Update URL query params
  useEffect(() => {
    const params = new URLSearchParams();

    if (debouncedFilters.segments.length > 0) {
      params.set('segments', debouncedFilters.segments.join(','));
    }
    if (debouncedFilters.categories.length > 0) {
      params.set('categories', debouncedFilters.categories.join(','));
    }
    if (debouncedFilters.contentTypes.length > 0) {
      params.set('contentTypes', debouncedFilters.contentTypes.join(','));
    }
    if (debouncedFilters.dateRange) {
      params.set('dateStart', debouncedFilters.dateRange.start);
      params.set('dateEnd', debouncedFilters.dateRange.end);
    }
    if (debouncedFilters.hasCompleteMetadata) {
      params.set('completeMetadata', 'true');
    }

    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;

    window.history.replaceState({}, '', newUrl);
  }, [debouncedFilters]);

  // Load filters from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlFilters: Partial<SearchFilterState> = {};

    const segments = params.get('segments');
    if (segments) {
      urlFilters.segments = segments.split(',') as SegmentCode[];
    }

    const categories = params.get('categories');
    if (categories) {
      urlFilters.categories = categories.split(',');
    }

    const contentTypes = params.get('contentTypes');
    if (contentTypes) {
      urlFilters.contentTypes = contentTypes.split(',') as ContentTypeCode[];
    }

    const dateStart = params.get('dateStart');
    const dateEnd = params.get('dateEnd');
    if (dateStart && dateEnd) {
      urlFilters.dateRange = { start: dateStart, end: dateEnd };
    }

    const completeMetadata = params.get('completeMetadata');
    if (completeMetadata === 'true') {
      urlFilters.hasCompleteMetadata = true;
    }

    if (Object.keys(urlFilters).length > 0) {
      setFilters((prev) => ({ ...prev, ...urlFilters }));
    }
  }, []);

  const setSegments = useCallback((segments: SegmentCode[]) => {
    setFilters((prev) => ({ ...prev, segments }));
  }, []);

  const setCategories = useCallback((categories: string[]) => {
    setFilters((prev) => ({ ...prev, categories }));
  }, []);

  const setContentTypes = useCallback((types: ContentTypeCode[]) => {
    setFilters((prev) => ({ ...prev, contentTypes: types }));
  }, []);

  const setDateRange = useCallback((range: { start: string; end: string } | null) => {
    setFilters((prev) => ({ ...prev, dateRange: range }));
  }, []);

  const setHasCompleteMetadata = useCallback((value: boolean) => {
    setFilters((prev) => ({ ...prev, hasCompleteMetadata: value }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters({
      segments: [],
      categories: [],
      contentTypes: [],
      dateRange: null,
      hasCompleteMetadata: false,
    });
  }, []);

  const removeFilter = useCallback((type: string, value: string) => {
    setFilters((prev) => {
      switch (type) {
        case 'segment':
          return {
            ...prev,
            segments: prev.segments.filter((s) => s !== value),
          };
        case 'category':
          return {
            ...prev,
            categories: prev.categories.filter((c) => c !== value),
          };
        case 'contentType':
          return {
            ...prev,
            contentTypes: prev.contentTypes.filter((t) => t !== value),
          };
        case 'dateRange':
          return {
            ...prev,
            dateRange: null,
          };
        case 'metadata':
          return {
            ...prev,
            hasCompleteMetadata: false,
          };
        default:
          return prev;
      }
    });
  }, []);

  // Build active filters array for chip display
  const activeFilters = useMemo(() => {
    const active: ActiveFilter[] = [];

    filters.segments.forEach((segment) => {
      active.push({
        type: 'segment',
        label: `Segment: ${SEGMENT_LABELS[segment] || segment}`,
        value: segment,
        onRemove: () => removeFilter('segment', segment),
      });
    });

    filters.categories.forEach((category) => {
      active.push({
        type: 'category',
        label: `Category: ${category}`,
        value: category,
        onRemove: () => removeFilter('category', category),
      });
    });

    filters.contentTypes.forEach((type) => {
      active.push({
        type: 'contentType',
        label: `Type: ${CONTENT_TYPE_LABELS[type] || type}`,
        value: type,
        onRemove: () => removeFilter('contentType', type),
      });
    });

    if (filters.dateRange) {
      active.push({
        type: 'dateRange',
        label: `Date: ${filters.dateRange.start} to ${filters.dateRange.end}`,
        value: 'dateRange',
        onRemove: () => removeFilter('dateRange', 'dateRange'),
      });
    }

    if (filters.hasCompleteMetadata) {
      active.push({
        type: 'metadata',
        label: 'Has complete metadata',
        value: 'metadata',
        onRemove: () => removeFilter('metadata', 'metadata'),
      });
    }

    return active;
  }, [filters, removeFilter]);

  const hasActiveFilters = activeFilters.length > 0;

  return {
    filters: debouncedFilters,
    activeFilters,
    hasActiveFilters,
    setSegments,
    setCategories,
    setContentTypes,
    setDateRange,
    setHasCompleteMetadata,
    clearAllFilters,
    removeFilter,
  };
}
