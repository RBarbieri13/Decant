// ============================================================
// Filter Chips - Display active filter tags
// ============================================================

import React from 'react';
import type { ActiveFilter } from '../../hooks/useSearchFilters';

interface FilterChipsProps {
  activeFilters: ActiveFilter[];
  onClearAll: () => void;
  resultCount?: number;
}

/**
 * Display active search filters as dismissible chips
 *
 * @example
 * <FilterChips
 *   activeFilters={activeFilters}
 *   onClearAll={clearAllFilters}
 *   resultCount={42}
 * />
 */
export function FilterChips({
  activeFilters,
  onClearAll,
  resultCount,
}: FilterChipsProps): React.ReactElement | null {
  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div className="filter-chips-container">
      <div className="filter-chips-header">
        <span className="filter-chips-label">
          Active Filters
          {resultCount !== undefined && (
            <span className="filter-chips-count">({resultCount} results)</span>
          )}
        </span>
        <button className="filter-chips-clear-all" onClick={onClearAll}>
          Clear all
        </button>
      </div>

      <div className="filter-chips-list">
        {activeFilters.map((filter, index) => (
          <button
            key={`${filter.type}-${filter.value}-${index}`}
            className={`filter-chip filter-chip--${filter.type}`}
            onClick={filter.onRemove}
            title="Click to remove"
          >
            <span className="filter-chip-label">{filter.label}</span>
            <span className="filter-chip-remove">&times;</span>
          </button>
        ))}
      </div>

      <style>{`
        .filter-chips-container {
          display: flex;
          flex-direction: column;
          gap: var(--decant-space-2);
          padding: var(--decant-space-3);
          background: var(--decant-bg-tertiary);
          border: 1px solid var(--decant-border-light);
          border-radius: var(--decant-radius-md);
        }

        .filter-chips-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .filter-chips-label {
          font-size: var(--decant-text-sm);
          font-weight: var(--decant-font-medium);
          color: var(--decant-text-secondary);
        }

        .filter-chips-count {
          margin-left: var(--decant-space-2);
          color: var(--decant-text-tertiary);
          font-weight: var(--decant-font-normal);
        }

        .filter-chips-clear-all {
          background: none;
          border: none;
          color: var(--decant-forest);
          font-size: var(--decant-text-sm);
          font-weight: var(--decant-font-medium);
          cursor: pointer;
          padding: var(--decant-space-1) var(--decant-space-2);
          border-radius: var(--decant-radius-sm);
          transition: background var(--decant-transition-fast);
        }

        .filter-chips-clear-all:hover {
          background: var(--decant-bg-hover);
        }

        .filter-chips-list {
          display: flex;
          flex-wrap: wrap;
          gap: var(--decant-space-2);
        }

        .filter-chip {
          display: inline-flex;
          align-items: center;
          gap: var(--decant-space-2);
          padding: var(--decant-space-1) var(--decant-space-3);
          background: var(--decant-bg-surface);
          border: 1px solid var(--decant-border-medium);
          border-radius: var(--decant-radius-full);
          font-size: var(--decant-text-sm);
          cursor: pointer;
          transition: all var(--decant-transition-fast);
        }

        .filter-chip:hover {
          border-color: var(--decant-forest);
          box-shadow: var(--decant-shadow-sm);
        }

        .filter-chip--segment {
          background: var(--decant-tag-blue-bg);
          border-color: var(--decant-tag-blue-border);
        }

        .filter-chip--segment:hover {
          background: var(--decant-tag-blue-border);
        }

        .filter-chip--category {
          background: var(--decant-tag-green-bg);
          border-color: var(--decant-tag-green-border);
        }

        .filter-chip--category:hover {
          background: var(--decant-tag-green-border);
        }

        .filter-chip--contentType {
          background: var(--decant-tag-purple-bg);
          border-color: var(--decant-tag-purple-border);
        }

        .filter-chip--contentType:hover {
          background: var(--decant-tag-purple-border);
        }

        .filter-chip--dateRange {
          background: var(--decant-tag-orange-bg);
          border-color: var(--decant-tag-orange-border);
        }

        .filter-chip--dateRange:hover {
          background: var(--decant-tag-orange-border);
        }

        .filter-chip--metadata {
          background: var(--decant-tag-yellow-bg);
          border-color: var(--decant-tag-yellow-border);
        }

        .filter-chip--metadata:hover {
          background: var(--decant-tag-yellow-border);
        }

        .filter-chip-label {
          font-weight: var(--decant-font-medium);
          color: var(--decant-text-primary);
        }

        .filter-chip-remove {
          font-size: var(--decant-text-lg);
          line-height: 1;
          color: var(--decant-text-secondary);
          font-weight: var(--decant-font-bold);
        }

        .filter-chip:hover .filter-chip-remove {
          color: var(--decant-text-primary);
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .filter-chips-header {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--decant-space-2);
          }

          .filter-chip {
            font-size: var(--decant-text-xs);
            padding: var(--decant-space-1) var(--decant-space-2);
          }
        }
      `}</style>
    </div>
  );
}
