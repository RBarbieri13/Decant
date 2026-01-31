// ============================================================
// Enhanced Search Bar - Improved global search with view modes
// ============================================================

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { SearchView } from './SearchView';
import { RecentSearches, saveRecentSearch } from './RecentSearches';
import type { SearchResult } from '../../../shared/types';

interface EnhancedSearchBarProps {
  onSelectResult?: (result: SearchResult) => void;
}

/**
 * EnhancedSearchBar Component
 *
 * Provides both dropdown quick-search and full-page search view modes.
 * Features:
 * - Dropdown for quick results (first 5)
 * - "View all X results" to open full search view
 * - Recent searches when focused and empty
 * - Keyboard navigation
 * - Integration with AppContext for tree highlighting
 *
 * @example
 * <EnhancedSearchBar onSelectResult={(result) => selectNode(result.node.id)} />
 */
export function EnhancedSearchBar({ onSelectResult }: EnhancedSearchBarProps): React.ReactElement {
  const { actions } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFullView, setShowFullView] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowDropdown(false);
      actions.clearSearch();
      return;
    }

    setIsSearching(true);
    try {
      const searchResults = await window.decantAPI.search.query(searchQuery);
      setResults(searchResults);
      setShowDropdown(true);
      setSelectedIndex(-1);

      // Update AppContext with search results for tree highlighting
      const resultIds = new Set(searchResults.map(r => r.node.id));
      actions.setSearchQuery(searchQuery, resultIds);

      // Save to recent searches
      if (searchResults.length > 0) {
        saveRecentSearch(searchQuery);
      }
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
      actions.clearSearch();
    } finally {
      setIsSearching(false);
    }
  }, [actions]);

  // Handle input change with debouncing
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);

      // Clear existing timeout
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }

      // Debounce search
      searchTimeout.current = setTimeout(() => {
        performSearch(value);
      }, 300);
    },
    [performSearch]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown || results.length === 0) {
        if (e.key === 'Escape') {
          setShowDropdown(false);
          inputRef.current?.blur();
        }
        return;
      }

      const maxIndex = Math.min(results.length - 1, 4); // Only navigate through preview results

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, maxIndex));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, -1));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && results[selectedIndex]) {
            handleSelectResult(results[selectedIndex]);
          } else if (results.length > 0) {
            // Open full view if Enter pressed without selection
            handleViewAll();
          }
          break;
        case 'Escape':
          setShowDropdown(false);
          inputRef.current?.blur();
          break;
      }
    },
    [showDropdown, results, selectedIndex]
  );

  // Handle result selection
  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      setQuery('');
      setResults([]);
      setShowDropdown(false);
      setShowFullView(false);
      actions.clearSearch();
      onSelectResult?.(result);
    },
    [onSelectResult, actions]
  );

  // Open full search view
  const handleViewAll = useCallback(() => {
    setShowDropdown(false);
    setShowFullView(true);
  }, []);

  // Close full view
  const handleCloseFullView = useCallback(() => {
    setShowFullView(false);
    setQuery('');
    setResults([]);
    actions.clearSearch();
  }, [actions]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, []);

  // Handle recent search selection
  const handleRecentSearchSelect = useCallback((recentQuery: string) => {
    setQuery(recentQuery);
    performSearch(recentQuery);
  }, [performSearch]);

  // Limit preview results to 5
  const previewResults = results.slice(0, 5);
  const hasMoreResults = results.length > 5;

  return (
    <>
      <div className="enhanced-search-bar">
        <input
          ref={inputRef}
          type="text"
          className="gum-input search-input"
          placeholder="Search..."
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query && results.length > 0) {
              setShowDropdown(true);
            } else if (!query) {
              setShowDropdown(true);
            }
          }}
        />
        {isSearching && <span className="search-spinner">⏳</span>}

        {/* Dropdown for quick results or recent searches */}
        {showDropdown && (
          <div ref={dropdownRef} className="search-dropdown">
            {!query ? (
              // Show recent searches when no query
              <RecentSearches
                onSelectSearch={handleRecentSearchSelect}
                currentQuery={query}
              />
            ) : results.length > 0 ? (
              // Show preview results
              <>
                <div className="dropdown-results">
                  {previewResults.map((result, index) => (
                    <button
                      key={result.node.id}
                      className={`dropdown-result-item ${
                        index === selectedIndex ? 'selected' : ''
                      }`}
                      onClick={() => handleSelectResult(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      {result.node.faviconPath && (
                        <img
                          src={`file://${result.node.faviconPath}`}
                          alt=""
                          className="result-favicon"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <div className="result-content">
                        <span className="result-title">{result.node.title}</span>
                        {result.node.contentTypeCode && (
                          <span className="result-badge gum-badge gum-badge--small">
                            {result.node.contentTypeCode}
                          </span>
                        )}
                      </div>
                      <span className="result-score">
                        {Math.round(result.score * 100)}%
                      </span>
                    </button>
                  ))}
                </div>

                {/* View all button */}
                {hasMoreResults && (
                  <button className="view-all-btn" onClick={handleViewAll}>
                    View all {results.length} results →
                  </button>
                )}
              </>
            ) : (
              // No results
              <div className="dropdown-no-results">No results found</div>
            )}
          </div>
        )}

        <style>{enhancedSearchBarStyles}</style>
      </div>

      {/* Full Search View Modal */}
      {showFullView && (
        <div className="search-modal-overlay" onClick={handleCloseFullView}>
          <div className="search-modal" onClick={(e) => e.stopPropagation()}>
            <div className="search-modal-header">
              <h2>Search Results</h2>
              <button
                className="close-btn"
                onClick={handleCloseFullView}
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>
            <div className="search-modal-body">
              <SearchView
                query={query}
                results={results}
                isLoading={isSearching}
                onSelectResult={handleSelectResult}
                onClearSearch={handleCloseFullView}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Styles
const enhancedSearchBarStyles = `
  .enhanced-search-bar {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-input {
    width: 250px;
    padding-right: var(--space-xl);
  }

  .search-spinner {
    position: absolute;
    right: var(--space-sm);
    font-size: var(--font-size-sm);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .search-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: var(--space-xs);
    background: var(--gum-white);
    border: var(--border-width) solid var(--gum-black);
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-default);
    max-height: 400px;
    overflow-y: auto;
    z-index: 1000;
  }

  .dropdown-results {
    border-bottom: 1px solid var(--gum-gray-300);
  }

  .dropdown-result-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    background: none;
    border: none;
    border-bottom: 1px solid var(--gum-gray-200);
    text-align: left;
    cursor: pointer;
    font-family: var(--font-main);
    font-size: var(--font-size-sm);
    transition: background 0.2s ease;
  }

  .dropdown-result-item:last-child {
    border-bottom: none;
  }

  .dropdown-result-item:hover,
  .dropdown-result-item.selected {
    background: var(--gum-yellow);
  }

  .result-favicon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    border-radius: 2px;
  }

  .result-content {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .result-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .result-badge {
    flex-shrink: 0;
  }

  .result-score {
    flex-shrink: 0;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    color: var(--gum-gray-600);
  }

  .view-all-btn {
    display: block;
    width: 100%;
    padding: var(--space-md);
    background: var(--gum-pink);
    border: none;
    font-family: var(--font-main);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-bold);
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .view-all-btn:hover {
    background: var(--gum-yellow);
  }

  .dropdown-no-results {
    padding: var(--space-md);
    text-align: center;
    color: var(--gum-gray-600);
    font-size: var(--font-size-sm);
  }

  /* Search Modal */
  .search-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: var(--space-lg);
  }

  .search-modal {
    background: var(--gum-white);
    border: var(--border-width) solid var(--gum-black);
    border-radius: var(--border-radius);
    width: 100%;
    max-width: 1000px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-default);
  }

  .search-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md) var(--space-lg);
    border-bottom: var(--border-width) solid var(--gum-black);
    background: var(--gum-gray-100);
  }

  .search-modal-header h2 {
    margin: 0;
    font-size: var(--font-size-xl);
  }

  .close-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--gum-white);
    border: var(--border-width) solid var(--gum-black);
    border-radius: var(--border-radius);
    font-size: var(--font-size-lg);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: var(--gum-pink);
  }

  .search-modal-body {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
`;
