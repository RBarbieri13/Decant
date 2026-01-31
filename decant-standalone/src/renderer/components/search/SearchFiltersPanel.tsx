// ============================================================
// Search Filters Panel - Advanced search filtering UI
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { FilterChips } from './FilterChips';
import { useSearchFilters } from '../../hooks/useSearchFilters';
import type { ContentTypeCode, SegmentCode } from '../../../shared/types';

interface SearchFiltersPanelProps {
  onFiltersChange?: (filters: any) => void;
  resultCount?: number;
  isLoading?: boolean;
  availableCategories?: string[];
}

// Segment options
const SEGMENT_OPTIONS: { code: SegmentCode; label: string }[] = [
  { code: 'A', label: 'AI & ML' },
  { code: 'T', label: 'Technology' },
  { code: 'F', label: 'Finance' },
  { code: 'S', label: 'Sports' },
  { code: 'H', label: 'Health' },
  { code: 'B', label: 'Business' },
  { code: 'E', label: 'Entertainment' },
  { code: 'L', label: 'Lifestyle' },
  { code: 'X', label: 'Science' },
  { code: 'C', label: 'Creative' },
];

// Content Type options
const CONTENT_TYPE_OPTIONS: { code: ContentTypeCode; label: string }[] = [
  { code: 'T', label: 'Tool' },
  { code: 'A', label: 'Article' },
  { code: 'V', label: 'Video' },
  { code: 'P', label: 'Podcast' },
  { code: 'R', label: 'Research' },
  { code: 'G', label: 'Repository' },
  { code: 'C', label: 'Course' },
  { code: 'S', label: 'Social' },
  { code: 'I', label: 'Image' },
  { code: 'N', label: 'Newsletter' },
  { code: 'K', label: 'Book' },
  { code: 'U', label: 'Audio' },
];

/**
 * Search Filters Panel with collapsible UI
 *
 * Features:
 * - Segment dropdown (AI, Tech, Finance, etc.)
 * - Category dropdown (dynamic from facets)
 * - Content Type checkboxes (Tool, Video, Article, etc.)
 * - Date range picker
 * - "Has complete metadata" toggle
 * - Active filter chips
 * - URL params for shareable searches
 *
 * @example
 * <SearchFiltersPanel
 *   onFiltersChange={(filters) => performSearch(query, filters)}
 *   resultCount={42}
 *   isLoading={false}
 * />
 */
export function SearchFiltersPanel({
  onFiltersChange,
  resultCount,
  isLoading = false,
  availableCategories = [],
}: SearchFiltersPanelProps): React.ReactElement {
  const {
    filters,
    activeFilters,
    hasActiveFilters,
    setSegments,
    setCategories,
    setContentTypes,
    setDateRange,
    setHasCompleteMetadata,
    clearAllFilters,
  } = useSearchFilters();

  const [isExpanded, setIsExpanded] = useState(true);
  const [dateStart, setDateStart] = useState(filters.dateRange?.start || '');
  const [dateEnd, setDateEnd] = useState(filters.dateRange?.end || '');

  // Notify parent of filter changes
  useEffect(() => {
    if (onFiltersChange) {
      onFiltersChange(filters);
    }
  }, [filters, onFiltersChange]);

  // Handle segment change
  const handleSegmentChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      if (value === '') {
        setSegments([]);
      } else {
        setSegments([value as SegmentCode]);
      }
    },
    [setSegments]
  );

  // Handle category change
  const handleCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      if (value === '') {
        setCategories([]);
      } else {
        setCategories([value]);
      }
    },
    [setCategories]
  );

  // Handle content type checkbox toggle
  const handleContentTypeToggle = useCallback(
    (code: ContentTypeCode) => {
      const current = filters.contentTypes;
      if (current.includes(code)) {
        setContentTypes(current.filter((c) => c !== code));
      } else {
        setContentTypes([...current, code]);
      }
    },
    [filters.contentTypes, setContentTypes]
  );

  // Handle date range application
  const handleApplyDateRange = useCallback(() => {
    if (dateStart && dateEnd) {
      setDateRange({ start: dateStart, end: dateEnd });
    } else {
      setDateRange(null);
    }
  }, [dateStart, dateEnd, setDateRange]);

  // Handle clear date range
  const handleClearDateRange = useCallback(() => {
    setDateStart('');
    setDateEnd('');
    setDateRange(null);
  }, [setDateRange]);

  return (
    <div className="search-filters-panel">
      {/* Collapsible Header */}
      <div className="filters-header">
        <button
          className="filters-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={isLoading}
        >
          <span className="filters-toggle-icon">{isExpanded ? '▼' : '▶'}</span>
          <span className="filters-toggle-label">Search Filters</span>
          {hasActiveFilters && (
            <span className="filters-active-badge">{activeFilters.length}</span>
          )}
        </button>
      </div>

      {/* Active Filters Chips */}
      {hasActiveFilters && (
        <FilterChips
          activeFilters={activeFilters}
          onClearAll={clearAllFilters}
          resultCount={resultCount}
        />
      )}

      {/* Filter Controls */}
      {isExpanded && (
        <div className="filters-content">
          {/* Segment Filter */}
          <div className="filter-group">
            <label className="filter-label" htmlFor="segment-select">
              Segment
            </label>
            <select
              id="segment-select"
              className="filter-select"
              value={filters.segments[0] || ''}
              onChange={handleSegmentChange}
              disabled={isLoading}
            >
              <option value="">All Segments</option>
              {SEGMENT_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="filter-group">
            <label className="filter-label" htmlFor="category-select">
              Category
            </label>
            <select
              id="category-select"
              className="filter-select"
              value={filters.categories[0] || ''}
              onChange={handleCategoryChange}
              disabled={isLoading || availableCategories.length === 0}
            >
              <option value="">All Categories</option>
              {availableCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            {availableCategories.length === 0 && (
              <span className="filter-hint">No categories available</span>
            )}
          </div>

          {/* Content Type Filter */}
          <div className="filter-group">
            <label className="filter-label">Content Type</label>
            <div className="filter-checkboxes">
              {CONTENT_TYPE_OPTIONS.map((option) => (
                <label
                  key={option.code}
                  className="filter-checkbox"
                  title={option.label}
                >
                  <input
                    type="checkbox"
                    checked={filters.contentTypes.includes(option.code)}
                    onChange={() => handleContentTypeToggle(option.code)}
                    disabled={isLoading}
                  />
                  <span className="filter-checkbox-label">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="filter-group">
            <label className="filter-label">Date Range</label>
            <div className="filter-date-range">
              <input
                type="date"
                className="filter-date-input"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                disabled={isLoading}
                placeholder="Start date"
              />
              <span className="filter-date-separator">to</span>
              <input
                type="date"
                className="filter-date-input"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                disabled={isLoading}
                placeholder="End date"
              />
            </div>
            <div className="filter-date-actions">
              <button
                className="filter-date-apply"
                onClick={handleApplyDateRange}
                disabled={isLoading || !dateStart || !dateEnd}
              >
                Apply
              </button>
              <button
                className="filter-date-clear"
                onClick={handleClearDateRange}
                disabled={isLoading || (!dateStart && !dateEnd)}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Metadata Toggle */}
          <div className="filter-group">
            <label className="filter-checkbox filter-checkbox--toggle">
              <input
                type="checkbox"
                checked={filters.hasCompleteMetadata}
                onChange={(e) => setHasCompleteMetadata(e.target.checked)}
                disabled={isLoading}
              />
              <span className="filter-checkbox-label">Has complete metadata</span>
            </label>
            <span className="filter-hint">
              Only show items with all metadata fields populated
            </span>
          </div>
        </div>
      )}

      <style>{`
        .search-filters-panel {
          display: flex;
          flex-direction: column;
          gap: var(--decant-space-3);
          padding: var(--decant-space-4);
          background: var(--decant-bg-secondary);
          border: 1px solid var(--decant-border-light);
          border-radius: var(--decant-radius-lg);
        }

        .filters-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .filters-toggle {
          display: flex;
          align-items: center;
          gap: var(--decant-space-2);
          background: none;
          border: none;
          padding: var(--decant-space-2);
          cursor: pointer;
          font-size: var(--decant-text-md);
          font-weight: var(--decant-font-semibold);
          color: var(--decant-text-primary);
          border-radius: var(--decant-radius-sm);
          transition: background var(--decant-transition-fast);
        }

        .filters-toggle:hover:not(:disabled) {
          background: var(--decant-bg-hover);
        }

        .filters-toggle:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .filters-toggle-icon {
          font-size: var(--decant-text-xs);
          transition: transform var(--decant-transition-fast);
        }

        .filters-active-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          padding: 0 var(--decant-space-1);
          background: var(--decant-forest);
          color: var(--decant-text-inverse);
          border-radius: var(--decant-radius-full);
          font-size: var(--decant-text-xs);
          font-weight: var(--decant-font-bold);
        }

        .filters-content {
          display: flex;
          flex-direction: column;
          gap: var(--decant-space-4);
          padding-top: var(--decant-space-3);
          border-top: 1px solid var(--decant-border-light);
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: var(--decant-space-2);
        }

        .filter-label {
          font-size: var(--decant-text-sm);
          font-weight: var(--decant-font-medium);
          color: var(--decant-text-secondary);
        }

        .filter-select {
          padding: var(--decant-space-2) var(--decant-space-3);
          background: var(--decant-bg-surface);
          border: 1px solid var(--decant-border-medium);
          border-radius: var(--decant-radius-md);
          font-size: var(--decant-text-sm);
          color: var(--decant-text-primary);
          cursor: pointer;
          transition: border-color var(--decant-transition-fast);
        }

        .filter-select:hover:not(:disabled) {
          border-color: var(--decant-forest);
        }

        .filter-select:focus {
          outline: none;
          border-color: var(--decant-forest);
          box-shadow: 0 0 0 3px var(--decant-forest-100);
        }

        .filter-select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background: var(--decant-gray-100);
        }

        .filter-checkboxes {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: var(--decant-space-2);
        }

        .filter-checkbox {
          display: flex;
          align-items: center;
          gap: var(--decant-space-2);
          cursor: pointer;
          padding: var(--decant-space-2);
          border-radius: var(--decant-radius-sm);
          transition: background var(--decant-transition-fast);
        }

        .filter-checkbox:hover {
          background: var(--decant-bg-hover);
        }

        .filter-checkbox--toggle {
          padding: var(--decant-space-3);
          background: var(--decant-bg-surface);
          border: 1px solid var(--decant-border-light);
          border-radius: var(--decant-radius-md);
        }

        .filter-checkbox input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
          accent-color: var(--decant-forest);
        }

        .filter-checkbox-label {
          font-size: var(--decant-text-sm);
          color: var(--decant-text-primary);
          user-select: none;
        }

        .filter-date-range {
          display: flex;
          align-items: center;
          gap: var(--decant-space-2);
        }

        .filter-date-input {
          flex: 1;
          padding: var(--decant-space-2) var(--decant-space-3);
          background: var(--decant-bg-surface);
          border: 1px solid var(--decant-border-medium);
          border-radius: var(--decant-radius-md);
          font-size: var(--decant-text-sm);
          color: var(--decant-text-primary);
          transition: border-color var(--decant-transition-fast);
        }

        .filter-date-input:hover:not(:disabled) {
          border-color: var(--decant-forest);
        }

        .filter-date-input:focus {
          outline: none;
          border-color: var(--decant-forest);
          box-shadow: 0 0 0 3px var(--decant-forest-100);
        }

        .filter-date-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background: var(--decant-gray-100);
        }

        .filter-date-separator {
          font-size: var(--decant-text-sm);
          color: var(--decant-text-tertiary);
        }

        .filter-date-actions {
          display: flex;
          gap: var(--decant-space-2);
        }

        .filter-date-apply,
        .filter-date-clear {
          padding: var(--decant-space-2) var(--decant-space-4);
          border: 1px solid var(--decant-border-medium);
          border-radius: var(--decant-radius-md);
          font-size: var(--decant-text-sm);
          font-weight: var(--decant-font-medium);
          cursor: pointer;
          transition: all var(--decant-transition-fast);
        }

        .filter-date-apply {
          background: var(--decant-forest);
          color: var(--decant-text-inverse);
          border-color: var(--decant-forest);
        }

        .filter-date-apply:hover:not(:disabled) {
          background: var(--decant-forest-800);
          border-color: var(--decant-forest-800);
        }

        .filter-date-apply:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .filter-date-clear {
          background: var(--decant-bg-surface);
          color: var(--decant-text-primary);
        }

        .filter-date-clear:hover:not(:disabled) {
          background: var(--decant-gray-100);
        }

        .filter-date-clear:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .filter-hint {
          font-size: var(--decant-text-xs);
          color: var(--decant-text-tertiary);
          font-style: italic;
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .search-filters-panel {
            padding: var(--decant-space-3);
          }

          .filter-checkboxes {
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          }

          .filter-date-range {
            flex-direction: column;
            align-items: stretch;
          }

          .filter-date-separator {
            text-align: center;
          }

          .filter-date-actions {
            flex-direction: column;
          }

          .filter-date-apply,
          .filter-date-clear {
            width: 100%;
          }
        }

        /* Loading state */
        .search-filters-panel:has([disabled]) {
          opacity: 0.7;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
