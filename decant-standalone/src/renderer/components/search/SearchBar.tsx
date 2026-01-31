// ============================================================
// Search Bar - Global Search Component
// ============================================================

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import type { SearchResult } from '../../../shared/types';

interface SearchBarProps {
  onSelectResult?: (result: SearchResult) => void;
}

export function SearchBar({ onSelectResult }: SearchBarProps): React.ReactElement {
  const { actions } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowResults(false);
      actions.clearSearch();
      return;
    }

    setIsSearching(true);
    try {
      const searchResults = await window.decantAPI.search.query(searchQuery);
      setResults(searchResults);
      setShowResults(true);
      setSelectedIndex(-1);

      // Update AppContext with search results for tree highlighting
      const resultIds = new Set(searchResults.map(r => r.node.id));
      actions.setSearchQuery(searchQuery, resultIds);
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
      if (!showResults || results.length === 0) {
        if (e.key === 'Escape') {
          setShowResults(false);
          inputRef.current?.blur();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, -1));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && results[selectedIndex]) {
            handleSelectResult(results[selectedIndex]);
          }
          break;
        case 'Escape':
          setShowResults(false);
          inputRef.current?.blur();
          break;
      }
    },
    [showResults, results, selectedIndex]
  );

  // Handle result selection
  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      setQuery('');
      setResults([]);
      setShowResults(false);
      actions.clearSearch();
      onSelectResult?.(result);
    },
    [onSelectResult, actions]
  );

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(e.target as Node) &&
        resultsRef.current &&
        !resultsRef.current.contains(e.target as Node)
      ) {
        setShowResults(false);
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

  return (
    <div className="search-bar-container">
      <input
        ref={inputRef}
        type="text"
        className="gum-input search-input"
        placeholder="Search..."
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => query && results.length > 0 && setShowResults(true)}
      />
      {isSearching && <span className="search-spinner">⏳</span>}

      {showResults && results.length > 0 && (
        <div ref={resultsRef} className="search-results">
          {results.map((result, index) => (
            <button
              key={result.node.id}
              className={`search-result-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => handleSelectResult(result)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              {result.node.faviconPath && (
                <img
                  src={`file://${result.node.faviconPath}`}
                  alt=""
                  className="search-result-favicon"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <div className="search-result-content">
                <span className="search-result-title">{result.node.title}</span>
                {result.node.contentTypeCode && (
                  <span className="search-result-type gum-badge gum-badge--small">
                    {result.node.contentTypeCode}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {showResults && query && results.length === 0 && !isSearching && (
        <div ref={resultsRef} className="search-results">
          <div className="search-no-results">No results found</div>
        </div>
      )}

      <style>{`
        .search-bar-container {
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

        .search-results {
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

        .search-result-item {
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
        }

        .search-result-item:last-child {
          border-bottom: none;
        }

        .search-result-item:hover,
        .search-result-item.selected {
          background: var(--gum-yellow);
        }

        .search-result-favicon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }

        .search-result-content {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: var(--space-sm);
        }

        .search-result-title {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .search-result-type {
          flex-shrink: 0;
        }

        .search-no-results {
          padding: var(--space-md);
          text-align: center;
          color: var(--gum-gray-600);
          font-size: var(--font-size-sm);
        }
      `}</style>
    </div>
  );
}
