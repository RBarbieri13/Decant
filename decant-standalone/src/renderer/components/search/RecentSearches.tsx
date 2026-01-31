// ============================================================
// RecentSearches - Recent search history dropdown
// ============================================================

import React, { useEffect, useState } from 'react';

interface RecentSearchesProps {
  onSelectSearch: (query: string) => void;
  currentQuery: string;
}

const RECENT_SEARCHES_KEY = 'decant_recent_searches';
const MAX_RECENT_SEARCHES = 10;

/**
 * RecentSearches Component
 *
 * Manages and displays recent search history:
 * - Stores last 10 searches in localStorage
 * - Shows as dropdown when search field is focused
 * - Allows clearing history
 *
 * Usage:
 * - Call saveSearch() when a search is performed
 * - Display dropdown when input is focused and empty
 *
 * @example
 * <RecentSearches
 *   onSelectSearch={setQuery}
 *   currentQuery={query}
 * />
 */
export function RecentSearches({
  onSelectSearch,
  currentQuery,
}: RecentSearchesProps): React.ReactElement | null {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load recent searches from localStorage
  useEffect(() => {
    loadRecentSearches();
  }, []);

  const loadRecentSearches = () => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        const searches = JSON.parse(stored);
        setRecentSearches(Array.isArray(searches) ? searches : []);
      }
    } catch (error) {
      console.error('Failed to load recent searches:', error);
      setRecentSearches([]);
    }
  };

  const handleClearHistory = () => {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
    setRecentSearches([]);
  };

  if (recentSearches.length === 0) {
    return (
      <div className="recent-searches-empty">
        <p>No recent searches</p>
        <style>{`
          .recent-searches-empty {
            padding: var(--space-md);
            text-align: center;
            color: var(--gum-gray-600);
            font-size: var(--font-size-sm);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="recent-searches">
      <div className="recent-searches-header">
        <span className="recent-searches-title">Recent Searches</span>
        <button
          className="clear-history-btn"
          onClick={handleClearHistory}
          title="Clear search history"
        >
          Clear
        </button>
      </div>

      <div className="recent-searches-list">
        {recentSearches.map((search, index) => (
          <button
            key={index}
            className="recent-search-item"
            onClick={() => onSelectSearch(search)}
          >
            <span className="search-icon">🔍</span>
            <span className="search-text">{search}</span>
          </button>
        ))}
      </div>

      <style>{`
        .recent-searches {
          width: 100%;
        }

        .recent-searches-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-sm) var(--space-md);
          background: var(--gum-gray-100);
          border-bottom: 1px solid var(--gum-gray-300);
        }

        .recent-searches-title {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-bold);
          color: var(--gum-gray-700);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .clear-history-btn {
          background: none;
          border: none;
          color: var(--gum-pink);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          cursor: pointer;
          padding: var(--space-xs);
          border-radius: var(--border-radius);
          transition: background 0.2s ease;
        }

        .clear-history-btn:hover {
          background: var(--gum-gray-200);
        }

        .recent-searches-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .recent-search-item {
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

        .recent-search-item:last-child {
          border-bottom: none;
        }

        .recent-search-item:hover {
          background: var(--gum-yellow);
        }

        .search-icon {
          flex-shrink: 0;
          font-size: 14px;
          opacity: 0.6;
        }

        .search-text {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--gum-black);
        }
      `}</style>
    </div>
  );
}

/**
 * Utility function to save a search to recent history
 */
export function saveRecentSearch(query: string): void {
  if (!query.trim()) return;

  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    let searches: string[] = stored ? JSON.parse(stored) : [];

    // Remove duplicate if exists
    searches = searches.filter(s => s.toLowerCase() !== query.toLowerCase());

    // Add new search to beginning
    searches.unshift(query);

    // Keep only last MAX_RECENT_SEARCHES
    searches = searches.slice(0, MAX_RECENT_SEARCHES);

    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
  } catch (error) {
    console.error('Failed to save recent search:', error);
  }
}
