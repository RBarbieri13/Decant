// ============================================================
// Search Integration Example
// ============================================================
//
// This file shows how to integrate the enhanced search components
// into your application. Copy the relevant parts to your AppShell
// or other components.
//
// ============================================================

import React, { useCallback } from 'react';
import { EnhancedSearchBar } from './EnhancedSearchBar';
import { SearchView } from './SearchView';
import { useApp } from '../../context/AppContext';
import type { SearchResult } from '../../../shared/types';

/**
 * Example 1: Simple integration in AppShell header
 *
 * Replace the existing SearchBar in AppShell with EnhancedSearchBar
 */
export function AppShellHeaderExample(): React.ReactElement {
  const { actions } = useApp();

  const handleSearchSelect = useCallback(
    (result: SearchResult) => {
      // Select the node in the tree and detail panel
      actions.selectNode(result.node.id);
    },
    [actions]
  );

  return (
    <header className="app-header">
      <div className="header-left">
        <h1 className="app-title">Decant</h1>
      </div>

      <div className="header-center">
        {/* View toggle buttons */}
      </div>

      <div className="header-right">
        {/* Replace SearchBar with EnhancedSearchBar */}
        <EnhancedSearchBar onSelectResult={handleSearchSelect} />

        <button className="gum-button gum-button--small gum-button--green">
          + Import
        </button>
      </div>
    </header>
  );
}

/**
 * Example 2: Full-page search view
 *
 * Create a dedicated search page with full SearchView
 */
export function SearchPageExample(): React.ReactElement {
  const { state, actions } = useApp();
  const { searchQuery, searchResults } = state;
  const [isSearching, setIsSearching] = React.useState(false);

  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        actions.clearSearch();
        return;
      }

      setIsSearching(true);
      try {
        await actions.search(query);
      } finally {
        setIsSearching(false);
      }
    },
    [actions]
  );

  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      actions.selectNode(result.node.id);
    },
    [actions]
  );

  return (
    <div className="search-page">
      {/* Search input */}
      <div className="search-page-header">
        <input
          type="text"
          className="gum-input search-page-input"
          placeholder="Search Decant..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* Full search view */}
      <SearchView
        query={searchQuery}
        results={searchResults}
        isLoading={isSearching}
        onSelectResult={handleSelectResult}
        onClearSearch={actions.clearSearch}
      />

      <style>{`
        .search-page {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: var(--gum-bg);
        }

        .search-page-header {
          padding: var(--space-lg);
          background: var(--gum-white);
          border-bottom: var(--border-width) solid var(--gum-black);
        }

        .search-page-input {
          width: 100%;
          max-width: 600px;
          font-size: var(--font-size-lg);
        }
      `}</style>
    </div>
  );
}

/**
 * Example 3: Search with filters integration
 *
 * Combine SearchView with SearchFiltersPanel
 */
export function SearchWithFiltersExample(): React.ReactElement {
  const { state, actions } = useApp();
  const [isSearching, setIsSearching] = React.useState(false);
  const [filters, setFilters] = React.useState({});

  const handleSearch = useCallback(
    async (query: string, searchFilters: any) => {
      setIsSearching(true);
      try {
        // Call search API with filters
        const results = await window.decantAPI.search.query(query, searchFilters);
        // Update state with results...
      } finally {
        setIsSearching(false);
      }
    },
    []
  );

  const handleFiltersChange = useCallback(
    (newFilters: any) => {
      setFilters(newFilters);
      if (state.searchQuery) {
        handleSearch(state.searchQuery, newFilters);
      }
    },
    [state.searchQuery, handleSearch]
  );

  return (
    <div className="search-with-filters">
      <aside className="filters-sidebar">
        {/* Import SearchFiltersPanel if needed */}
        <div className="filters-panel">
          {/* Filter controls here */}
        </div>
      </aside>

      <main className="search-results">
        <SearchView
          query={state.searchQuery}
          results={state.searchResults}
          isLoading={isSearching}
          onSelectResult={(result) => actions.selectNode(result.node.id)}
          onClearSearch={actions.clearSearch}
        />
      </main>

      <style>{`
        .search-with-filters {
          display: flex;
          height: 100vh;
        }

        .filters-sidebar {
          width: 280px;
          background: var(--gum-white);
          border-right: var(--border-width) solid var(--gum-black);
          overflow-y: auto;
        }

        .search-results {
          flex: 1;
          overflow: hidden;
        }

        @media (max-width: 768px) {
          .search-with-filters {
            flex-direction: column;
          }

          .filters-sidebar {
            width: 100%;
            max-height: 40vh;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Example 4: Using individual components
 *
 * Build custom search UI with individual components
 */
export function CustomSearchExample(): React.ReactElement {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [sortBy, setSortBy] = React.useState<'relevance' | 'date' | 'title'>('relevance');

  // Extract search terms for highlighting
  const searchTerms = query.split(/\s+/).filter(t => t.length > 0);

  // Sort results
  const sortedResults = React.useMemo(() => {
    const sorted = [...results];
    if (sortBy === 'relevance') {
      sorted.sort((a, b) => b.score - a.score);
    } else if (sortBy === 'date') {
      sorted.sort((a, b) =>
        new Date(b.node.updatedAt).getTime() - new Date(a.node.updatedAt).getTime()
      );
    } else {
      sorted.sort((a, b) => a.node.title.localeCompare(b.node.title));
    }
    return sorted;
  }, [results, sortBy]);

  // Paginate results
  const paginatedResults = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedResults.slice(start, start + pageSize);
  }, [sortedResults, page, pageSize]);

  const totalPages = Math.ceil(sortedResults.length / pageSize);

  return (
    <div className="custom-search">
      {/* Custom search header */}
      <div className="custom-search-header">
        <h2>{sortedResults.length} results for "{query}"</h2>
        <select
          className="gum-input gum-input--small"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
        >
          <option value="relevance">Relevance</option>
          <option value="date">Date</option>
          <option value="title">Title</option>
        </select>
      </div>

      {/* Custom results list using SearchResultCard */}
      <div className="custom-results-list">
        {paginatedResults.map((result) => (
          <div key={result.node.id} className="custom-result">
            {/* You can use SearchResultCard here or build your own */}
            <h3>{result.node.title}</h3>
            <p>Score: {Math.round(result.score * 100)}%</p>
          </div>
        ))}
      </div>

      {/* Custom pagination using SearchPagination */}
      {totalPages > 1 && (
        <div className="custom-pagination">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Example 5: Recent searches integration
 *
 * Show recent searches in a custom component
 */
export function RecentSearchesExample(): React.ReactElement {
  const [showRecent, setShowRecent] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const handleSelectRecentSearch = (recentQuery: string) => {
    setQuery(recentQuery);
    setShowRecent(false);
    // Perform search with recentQuery...
  };

  return (
    <div className="search-with-recent">
      <div className="search-input-wrapper">
        <input
          type="text"
          className="gum-input"
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => !query && setShowRecent(true)}
          onBlur={() => setTimeout(() => setShowRecent(false), 200)}
        />

        {showRecent && !query && (
          <div className="recent-searches-dropdown">
            {/* Use RecentSearches component */}
            <div className="recent-header">
              <span>Recent Searches</span>
            </div>
            {/* Recent searches list */}
          </div>
        )}
      </div>
    </div>
  );
}

// Export all examples
export default {
  AppShellHeaderExample,
  SearchPageExample,
  SearchWithFiltersExample,
  CustomSearchExample,
  RecentSearchesExample,
};
