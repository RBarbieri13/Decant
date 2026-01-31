// ============================================================
// Search Page Example - Complete integration example
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { SearchBar } from './SearchBar';
import { SearchFiltersPanel } from './SearchFiltersPanel';
import type { Node } from '../../../shared/types';
import type { SearchFilterState } from '../../hooks/useSearchFilters';

/**
 * Complete example of search page with filters integration
 *
 * This is a reference implementation showing how to integrate:
 * - SearchBar for query input
 * - SearchFiltersPanel for advanced filtering
 * - Result display with loading states
 * - Dynamic category fetching
 *
 * Usage: Copy this pattern to create your search page
 */
export function SearchPageExample(): React.ReactElement {
  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Node[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [currentFilters, setCurrentFilters] = useState<SearchFilterState | null>(null);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  // Load available categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      // Fetch categories from your backend
      // Example: const categories = await window.decantAPI.hierarchy.getCategories();
      // For now, using mock data
      setAvailableCategories([
        'Machine Learning',
        'LLMs & AI',
        'Computer Vision',
        'NLP',
        'Reinforcement Learning',
        'AI Tools',
        'AI Research',
      ]);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  // Perform search with current query and filters
  const performSearch = useCallback(async (searchQuery: string, filters?: SearchFilterState) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Convert filters to API format
      const apiFilters = filters ? {
        contentType: filters.contentTypes,
        segmentCode: filters.segments,
        tags: filters.categories,
        dateRange: filters.dateRange,
        hasCompleteMetadata: filters.hasCompleteMetadata,
      } : undefined;

      // Call search API (using the Electron IPC bridge)
      const searchResults = await window.decantAPI.search.query(searchQuery, apiFilters);

      // Extract nodes from search results
      const nodes = searchResults.map((result) => result.node);
      setResults(nodes);
    } catch (err) {
      console.error('Search failed:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle search query change from SearchBar
  const handleSearch = useCallback((searchQuery: string) => {
    setQuery(searchQuery);
    performSearch(searchQuery, currentFilters || undefined);
  }, [currentFilters, performSearch]);

  // Handle filter changes from SearchFiltersPanel
  const handleFiltersChange = useCallback((filters: SearchFilterState) => {
    setCurrentFilters(filters);
    if (query) {
      performSearch(query, filters);
    }
  }, [query, performSearch]);

  return (
    <div className="search-page-example">
      {/* Search Header */}
      <div className="search-header">
        <h1 className="search-title">Search Knowledge Base</h1>
        <SearchBar onSelectResult={(result) => {
          // Navigate to selected node or show details
          console.log('Selected:', result.node);
        }} />
      </div>

      {/* Main Content */}
      <div className="search-content">
        {/* Filters Sidebar */}
        <aside className="search-sidebar">
          <SearchFiltersPanel
            onFiltersChange={handleFiltersChange}
            resultCount={results.length}
            isLoading={isLoading}
            availableCategories={availableCategories}
          />
        </aside>

        {/* Results Panel */}
        <main className="search-results-panel">
          {/* Loading State */}
          {isLoading && (
            <div className="search-loading">
              <div className="search-spinner" />
              <p>Searching...</p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="search-error">
              <p>Error: {error}</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && results.length === 0 && query && (
            <div className="search-empty">
              <p>No results found for "{query}"</p>
              <p className="search-empty-hint">Try adjusting your filters or search terms</p>
            </div>
          )}

          {/* Results List */}
          {!isLoading && !error && results.length > 0 && (
            <div className="search-results-list">
              <div className="search-results-header">
                <h2>Results ({results.length})</h2>
              </div>
              {results.map((node) => (
                <div key={node.id} className="search-result-card">
                  {node.faviconPath && (
                    <img
                      src={`file://${node.faviconPath}`}
                      alt=""
                      className="result-favicon"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div className="result-content">
                    <h3 className="result-title">{node.title}</h3>
                    {node.sourceUrl && (
                      <a
                        href={node.sourceUrl}
                        className="result-url"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {node.sourceUrl}
                      </a>
                    )}
                    {node.aiSummary && (
                      <p className="result-summary">{node.aiSummary}</p>
                    )}
                    <div className="result-meta">
                      {node.contentTypeCode && (
                        <span className="result-badge">{node.contentTypeCode}</span>
                      )}
                      <span className="result-date">
                        {new Date(node.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Initial State */}
          {!isLoading && !query && (
            <div className="search-initial">
              <p>Start searching to see results</p>
              <p className="search-initial-hint">
                Use the search bar above or apply filters to narrow down results
              </p>
            </div>
          )}
        </main>
      </div>

      <style>{`
        .search-page-example {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: var(--decant-bg-primary);
        }

        .search-header {
          padding: var(--decant-space-4) var(--decant-space-6);
          background: var(--decant-bg-surface);
          border-bottom: 1px solid var(--decant-border-light);
        }

        .search-title {
          margin: 0 0 var(--decant-space-3);
          font-size: var(--decant-text-2xl);
          font-weight: var(--decant-font-bold);
          color: var(--decant-text-primary);
        }

        .search-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .search-sidebar {
          width: 320px;
          padding: var(--decant-space-4);
          overflow-y: auto;
          background: var(--decant-bg-secondary);
          border-right: 1px solid var(--decant-border-light);
        }

        .search-results-panel {
          flex: 1;
          padding: var(--decant-space-4);
          overflow-y: auto;
        }

        .search-loading,
        .search-error,
        .search-empty,
        .search-initial {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          text-align: center;
        }

        .search-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid var(--decant-gray-200);
          border-top-color: var(--decant-forest);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .search-error {
          color: var(--decant-error);
        }

        .search-empty-hint,
        .search-initial-hint {
          margin-top: var(--decant-space-2);
          font-size: var(--decant-text-sm);
          color: var(--decant-text-tertiary);
        }

        .search-results-list {
          display: flex;
          flex-direction: column;
          gap: var(--decant-space-4);
        }

        .search-results-header {
          padding-bottom: var(--decant-space-3);
          border-bottom: 1px solid var(--decant-border-light);
        }

        .search-results-header h2 {
          margin: 0;
          font-size: var(--decant-text-lg);
          font-weight: var(--decant-font-semibold);
          color: var(--decant-text-primary);
        }

        .search-result-card {
          display: flex;
          gap: var(--decant-space-3);
          padding: var(--decant-space-4);
          background: var(--decant-bg-surface);
          border: 1px solid var(--decant-border-light);
          border-radius: var(--decant-radius-lg);
          transition: all var(--decant-transition-fast);
        }

        .search-result-card:hover {
          border-color: var(--decant-forest);
          box-shadow: var(--decant-shadow-md);
        }

        .result-favicon {
          width: 48px;
          height: 48px;
          border-radius: var(--decant-radius-md);
          flex-shrink: 0;
        }

        .result-content {
          flex: 1;
          min-width: 0;
        }

        .result-title {
          margin: 0 0 var(--decant-space-1);
          font-size: var(--decant-text-md);
          font-weight: var(--decant-font-semibold);
          color: var(--decant-text-primary);
        }

        .result-url {
          display: block;
          margin-bottom: var(--decant-space-2);
          font-size: var(--decant-text-sm);
          color: var(--decant-text-link);
          text-decoration: none;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .result-url:hover {
          text-decoration: underline;
          color: var(--decant-text-link-hover);
        }

        .result-summary {
          margin: 0 0 var(--decant-space-2);
          font-size: var(--decant-text-sm);
          color: var(--decant-text-secondary);
          line-height: var(--decant-leading-normal);
        }

        .result-meta {
          display: flex;
          align-items: center;
          gap: var(--decant-space-3);
          font-size: var(--decant-text-xs);
          color: var(--decant-text-tertiary);
        }

        .result-badge {
          display: inline-flex;
          align-items: center;
          padding: var(--decant-space-1) var(--decant-space-2);
          background: var(--decant-tag-blue-bg);
          border: 1px solid var(--decant-tag-blue-border);
          border-radius: var(--decant-radius-full);
          font-weight: var(--decant-font-medium);
          color: var(--decant-tag-blue-text);
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .search-content {
            flex-direction: column;
          }

          .search-sidebar {
            width: 100%;
            border-right: none;
            border-bottom: 1px solid var(--decant-border-light);
          }

          .search-result-card {
            flex-direction: column;
          }

          .result-favicon {
            width: 64px;
            height: 64px;
          }
        }
      `}</style>
    </div>
  );
}
