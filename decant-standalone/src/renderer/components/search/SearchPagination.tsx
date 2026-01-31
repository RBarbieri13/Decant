// ============================================================
// SearchPagination - Pagination controls for search results
// ============================================================

import React from 'react';

interface SearchPaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalResults: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

/**
 * SearchPagination Component
 *
 * Provides pagination controls with:
 * - Previous/Next buttons
 * - Page number display
 * - Page size selector
 * - Results count display
 *
 * @example
 * <SearchPagination
 *   currentPage={1}
 *   totalPages={5}
 *   pageSize={10}
 *   totalResults={47}
 *   onPageChange={setPage}
 *   onPageSizeChange={setPageSize}
 * />
 */
export function SearchPagination({
  currentPage,
  totalPages,
  pageSize,
  totalResults,
  onPageChange,
  onPageSizeChange,
}: SearchPaginationProps): React.ReactElement | null {
  if (totalResults === 0) {
    return null;
  }

  const startResult = (currentPage - 1) * pageSize + 1;
  const endResult = Math.min(currentPage * pageSize, totalResults);

  // Generate page numbers to display (with ellipsis for large ranges)
  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const maxVisible = 7; // Show max 7 page numbers

    if (totalPages <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      // Show pages around current
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="search-pagination">
      {/* Results count */}
      <div className="pagination-info">
        Showing {startResult}-{endResult} of {totalResults} results
      </div>

      {/* Pagination controls */}
      <div className="pagination-controls">
        {/* Previous button */}
        <button
          className="gum-button gum-button--small"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          ← Previous
        </button>

        {/* Page numbers */}
        <div className="page-numbers">
          {pageNumbers.map((page, index) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${index}`} className="page-ellipsis">
                  ...
                </span>
              );
            }

            return (
              <button
                key={page}
                className={`page-number ${
                  page === currentPage ? 'active' : ''
                }`}
                onClick={() => onPageChange(page as number)}
              >
                {page}
              </button>
            );
          })}
        </div>

        {/* Next button */}
        <button
          className="gum-button gum-button--small"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next →
        </button>
      </div>

      {/* Page size selector */}
      <div className="page-size-selector">
        <label htmlFor="page-size">Per page:</label>
        <select
          id="page-size"
          className="gum-input gum-input--small"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </select>
      </div>

      <style>{`
        .search-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-md);
          padding: var(--space-md);
          border-top: var(--border-width) solid var(--gum-gray-300);
          background: var(--gum-white);
          flex-wrap: wrap;
        }

        .pagination-info {
          font-size: var(--font-size-sm);
          color: var(--gum-gray-700);
          font-weight: var(--font-weight-medium);
        }

        .pagination-controls {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
        }

        .gum-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .page-numbers {
          display: flex;
          gap: var(--space-xs);
        }

        .page-number {
          min-width: 32px;
          height: 32px;
          padding: var(--space-xs);
          background: var(--gum-white);
          border: var(--border-width) solid var(--gum-gray-300);
          border-radius: var(--border-radius);
          font-family: var(--font-main);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .page-number:hover {
          border-color: var(--gum-black);
          background: var(--gum-gray-50);
        }

        .page-number.active {
          background: var(--gum-pink);
          border-color: var(--gum-black);
          font-weight: var(--font-weight-bold);
        }

        .page-ellipsis {
          min-width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--gum-gray-600);
          font-size: var(--font-size-sm);
        }

        .page-size-selector {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          font-size: var(--font-size-sm);
        }

        .page-size-selector label {
          color: var(--gum-gray-700);
          font-weight: var(--font-weight-medium);
        }

        .page-size-selector select {
          width: 80px;
        }

        @media (max-width: 768px) {
          .search-pagination {
            flex-direction: column;
            align-items: stretch;
          }

          .pagination-info,
          .pagination-controls,
          .page-size-selector {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
