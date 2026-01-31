// ============================================================
// SearchView - Comprehensive search results view
// ============================================================

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { SearchResultCard } from './SearchResultCard';
import { SearchPagination } from './SearchPagination';
import { RecentSearches, saveRecentSearch } from './RecentSearches';
import { SearchFiltersPanel } from './SearchFiltersPanel';
import type { SearchResult, SearchFilters } from '../../../shared/types';
import type { SearchFilterState } from '../../hooks/useSearchFilters';

interface SearchViewProps {
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  onSelectResult: (result: SearchResult) => void;
  onClearSearch?: () => void;
  onFiltersChange?: (filters: SearchFilters) => void;
  availableCategories?: string[];
}

type SortOption = 'relevance' | 'date' | 'title';

/**
 * Convert SearchFilterState from useSearchFilters to SearchFilters API format
 * The hook uses arrays for multiple selections, but API expects single values
 */
function convertFiltersToAPIFormat(filterState: SearchFilterState): SearchFilters {
  const apiFilters: SearchFilters = {};

  // Convert arrays to single values (take first item)
  if (filterState.segments.length > 0) {
    apiFilters.segmentCode = filterState.segments;
  }
  if (filterState.categories.length > 0) {
    apiFilters.tags = filterState.categories;
  }
  if (filterState.contentTypes.length > 0) {
    apiFilters.contentType = filterState.contentTypes;
  }
  if (filterState.dateRange) {
    apiFilters.dateRange = filterState.dateRange;
  }

  return apiFilters;
}

/**
 * SearchView Component
 *
 * Comprehensive search results display with:
 * - Advanced filter panel (segments, categories, content types, dates)
 * - Relevance scoring and sorting options
 * - Highlighted matched terms
 * - Enhanced result cards with context
 * - Pagination controls
 * - Recent searches
 * - No results state with suggestions
 *
 * @example
 * <SearchView
 *   query="ai tools"
 *   results={searchResults}
 *   isLoading={false}
 *   onSelectResult={handleSelect}
 *   onClearSearch={clearSearch}
 *   onFiltersChange={(filters) => performSearch(query, filters)}
 * />
 */
export function SearchView({
  query,
  results,
  isLoading,
  onSelectResult,
  onClearSearch,
  onFiltersChange,
  availableCategories = [],
}: SearchViewProps): React.ReactElement {
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showRecent, setShowRecent] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showFilters, setShowFilters] = useState(true);

  // Extract search terms from query
  const searchTerms = useMemo(() => {
    return query
      .split(/\s+/)
      .filter(term => term.length > 0)
      .map(term => term.trim());
  }, [query]);

  // Sort results based on selected option
  const sortedResults = useMemo(() => {
    const sorted = [...results];

    switch (sortBy) {
      case 'relevance':
        sorted.sort((a, b) => b.score - a.score);
        break;
      case 'date':
        sorted.sort(
          (a, b) =>
            new Date(b.node.updatedAt).getTime() -
            new Date(a.node.updatedAt).getTime()
        );
        break;
      case 'title':
        sorted.sort((a, b) =>
          a.node.title.localeCompare(b.node.title, undefined, {
            sensitivity: 'base',
          })
        );
        break;
    }

    return sorted;
  }, [results, sortBy]);

  // Paginate results
  const paginatedResults = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedResults.slice(startIndex, startIndex + pageSize);
  }, [sortedResults, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedResults.length / pageSize);

  // Reset page when query changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIndex(-1);
  }, [query, sortBy]);

  // Save search when results are loaded
  useEffect(() => {
    if (query && results.length > 0 && !isLoading) {
      saveRecentSearch(query);
    }
  }, [query, results.length, isLoading]);

  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      onSelectResult(result);
      setShowRecent(false);
    },
    [onSelectResult]
  );

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  const handleRecentSearchSelect = useCallback((recentQuery: string) => {
    setShowRecent(false);
    // This would need to trigger a new search in the parent component
    // For now, we just close the recent searches
  }, []);

  // Handle filter changes from SearchFiltersPanel
  const handleInternalFiltersChange = useCallback((filterState: SearchFilterState) => {
    // Convert filter state to API format and notify parent
    if (onFiltersChange) {
      const apiFilters = convertFiltersToAPIFormat(filterState);
      onFiltersChange(apiFilters);
    }
  }, [onFiltersChange]);

  // Show recent searches when query is empty and not loading
  const shouldShowRecent = !query && !isLoading && showRecent;

  // Loading state
  if (isLoading) {
    return (
      <div className="search-view">
        <div className="search-loading">
          <div className="loading-spinner">⏳</div>
          <p>Searching...</p>
        </div>
        <style>{searchViewStyles}</style>
      </div>
    );
  }

  // No query state - show recent searches
  if (!query) {
    return (
      <div className="search-view">
        <div className="search-prompt">
          <div className="prompt-icon">🔍</div>
          <h3>Search Decant</h3>
          <p>
            Enter a search term to find bookmarks, articles, tools, and more.
          </p>
          <button
            className="gum-button gum-button--small gum-button--pink"
            onClick={() => setShowRecent(!showRecent)}
          >
            {showRecent ? 'Hide' : 'Show'} Recent Searches
          </button>
          {shouldShowRecent && (
            <div className="recent-searches-container">
              <RecentSearches
                onSelectSearch={handleRecentSearchSelect}
                currentQuery={query}
              />
            </div>
          )}
        </div>
        <style>{searchViewStyles}</style>
      </div>
    );
  }

  // No results state
  if (results.length === 0) {
    return (
      <div className="search-view">
        <div className="search-no-results">
          <div className="no-results-icon">🔍</div>
          <h3>No results found for "{query}"</h3>
          <div className="no-results-suggestions">
            <p>Suggestions:</p>
            <ul>
              <li>Check your spelling</li>
              <li>Try more general keywords</li>
              <li>Try different keywords</li>
              <li>Remove filters if applied</li>
            </ul>
          </div>
          <div className="no-results-actions">
            {onClearSearch && (
              <button
                className="gum-button gum-button--small"
                onClick={onClearSearch}
              >
                Clear Search
              </button>
            )}
            <button
              className="gum-button gum-button--small gum-button--green"
              onClick={() => {
                // This would open the import dialog
                // You'd need to wire this up to your AppContext
              }}
            >
              + Import New Item
            </button>
          </div>
        </div>
        <style>{searchViewStyles}</style>
      </div>
    );
  }

  // Results view with filters
  return (
    <div className="search-view">
      {/* Search Header */}
      <div className="search-header">
        <div className="search-info">
          <h3>
            {sortedResults.length} result{sortedResults.length !== 1 ? 's' : ''}{' '}
            for "{query}"
          </h3>
        </div>

        {/* Sort Controls */}
        <div className="search-controls">
          <button
            className="gum-button gum-button--small"
            onClick={() => setShowFilters(!showFilters)}
            title={showFilters ? 'Hide Filters' : 'Show Filters'}
          >
            {showFilters ? '◀ Hide' : '▶ Show'} Filters
          </button>
          <label htmlFor="sort-by">Sort by:</label>
          <select
            id="sort-by"
            className="gum-input gum-input--small"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
          >
            <option value="relevance">Relevance</option>
            <option value="date">Date</option>
            <option value="title">Title</option>
          </select>
        </div>
      </div>

      {/* Main Content Area with Filters */}
      <div className="search-content">
        {/* Filters Panel */}
        {showFilters && (
          <div className="search-filters-sidebar">
            <SearchFiltersPanel
              onFiltersChange={handleInternalFiltersChange}
              resultCount={sortedResults.length}
              isLoading={isLoading}
              availableCategories={availableCategories}
            />
          </div>
        )}

        {/* Results Container */}
        <div className="search-results-container">
          {/* Results List */}
          <div className="search-results-list">
            {paginatedResults.map((result, index) => (
              <SearchResultCard
                key={result.node.id}
                result={result}
                searchTerms={searchTerms}
                onClick={() => handleSelectResult(result)}
                isSelected={index === selectedIndex}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <SearchPagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalResults={sortedResults.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </div>
      </div>

      <style>{searchViewStyles}</style>
    </div>
  );
}

// Styles for SearchView
const searchViewStyles = `
  .search-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--gum-bg);
  }

  /* Loading State */
  .search-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--gum-gray-600);
  }

  .loading-spinner {
    font-size: 48px;
    animation: spin 1s linear infinite;
    margin-bottom: var(--space-md);
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Main Content Layout */
  .search-content {
    display: flex;
    flex: 1;
    overflow: hidden;
    gap: var(--space-md);
    padding: var(--space-md);
  }

  .search-filters-sidebar {
    width: 320px;
    flex-shrink: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .search-filters-sidebar::-webkit-scrollbar {
    width: 8px;
  }

  .search-filters-sidebar::-webkit-scrollbar-track {
    background: var(--gum-gray-100);
  }

  .search-filters-sidebar::-webkit-scrollbar-thumb {
    background: var(--gum-gray-300);
    border-radius: 4px;
  }

  .search-filters-sidebar::-webkit-scrollbar-thumb:hover {
    background: var(--gum-gray-600);
  }

  .search-results-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Search Prompt */
  .search-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    padding: var(--space-xl);
    color: var(--gum-gray-700);
  }

  .prompt-icon {
    font-size: 64px;
    margin-bottom: var(--space-md);
    opacity: 0.5;
  }

  .search-prompt h3 {
    font-size: var(--font-size-xl);
    margin-bottom: var(--space-sm);
    color: var(--gum-black);
  }

  .search-prompt p {
    font-size: var(--font-size-base);
    margin-bottom: var(--space-lg);
    max-width: 500px;
  }

  .recent-searches-container {
    margin-top: var(--space-lg);
    width: 100%;
    max-width: 500px;
    background: var(--gum-white);
    border: var(--border-width) solid var(--gum-black);
    border-radius: var(--border-radius);
    overflow: hidden;
  }

  /* No Results State */
  .search-no-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    padding: var(--space-xl);
  }

  .no-results-icon {
    font-size: 64px;
    margin-bottom: var(--space-md);
    opacity: 0.5;
  }

  .search-no-results h3 {
    font-size: var(--font-size-xl);
    margin-bottom: var(--space-lg);
    color: var(--gum-black);
  }

  .no-results-suggestions {
    background: var(--gum-white);
    padding: var(--space-lg);
    border-radius: var(--border-radius);
    border: var(--border-width) solid var(--gum-gray-300);
    margin-bottom: var(--space-lg);
    max-width: 400px;
  }

  .no-results-suggestions p {
    font-weight: var(--font-weight-bold);
    margin-bottom: var(--space-sm);
    color: var(--gum-black);
  }

  .no-results-suggestions ul {
    list-style: none;
    padding: 0;
    margin: 0;
    text-align: left;
  }

  .no-results-suggestions li {
    padding: var(--space-xs) 0;
    color: var(--gum-gray-700);
  }

  .no-results-suggestions li:before {
    content: "• ";
    color: var(--gum-pink);
    font-weight: bold;
    margin-right: var(--space-xs);
  }

  .no-results-actions {
    display: flex;
    gap: var(--space-sm);
    flex-wrap: wrap;
    justify-content: center;
  }

  /* Search Header */
  .search-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md);
    background: var(--gum-white);
    border-bottom: var(--border-width) solid var(--gum-gray-300);
    flex-shrink: 0;
  }

  .search-info h3 {
    font-size: var(--font-size-lg);
    margin: 0;
    color: var(--gum-black);
  }

  .search-controls {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: var(--font-size-sm);
  }

  .search-controls label {
    color: var(--gum-gray-700);
    font-weight: var(--font-weight-medium);
  }

  .search-controls select {
    min-width: 120px;
  }

  /* Results List */
  .search-results-list {
    flex: 1;
    overflow-y: auto;
    padding: 0;
  }

  .search-results-list::-webkit-scrollbar {
    width: 8px;
  }

  .search-results-list::-webkit-scrollbar-track {
    background: var(--gum-gray-100);
  }

  .search-results-list::-webkit-scrollbar-thumb {
    background: var(--gum-gray-300);
    border-radius: 4px;
  }

  .search-results-list::-webkit-scrollbar-thumb:hover {
    background: var(--gum-gray-600);
  }

  /* Responsive Design */
  @media (max-width: 1024px) {
    .search-content {
      flex-direction: column;
    }

    .search-filters-sidebar {
      width: 100%;
      max-height: 400px;
    }

    .search-results-container {
      min-height: 400px;
    }
  }

  @media (max-width: 768px) {
    .search-header {
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-sm);
    }

    .search-controls {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-sm);
    }

    .search-content {
      padding: var(--space-sm);
    }
  }
`;
