import React, { useEffect, useRef, useState } from 'react';
import type { BreadcrumbItem, ViewMode, DateAddedFilter } from '../types';
import { DATE_ADDED_FILTER_LABELS } from '../types';
import decantLogoLight from '../../assets/decant-logo-light.png';

const DATE_ADDED_FILTER_OPTIONS: DateAddedFilter[] = ['all', 'today', '2d', '3d', '7d', '30d'];

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  breadcrumbs: BreadcrumbItem[];
  onBreadcrumbClick?: (item: BreadcrumbItem, index: number) => void;
  onClearFilter?: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onBatchImportClick?: () => void;
  onImessageImportClick?: () => void;
  showImessageButton?: boolean;
  onQuickAddClick?: () => void;
  onRefreshAllClick?: () => void;
  onReclassifyClick?: () => void;
  isReclassifying?: boolean;
  reclassifyProgress?: { completed: number; total: number; phase?: string } | null;
  onSettingsClick?: () => void;
  onUserClick?: () => void;
  userName?: string;
  showStarredOnly?: boolean;
  onToggleStarredFilter?: () => void;
  dateAddedFilter?: DateAddedFilter;
  onDateAddedFilterChange?: (value: DateAddedFilter) => void;
  onToggleUiMode?: () => void;
}

export const TopBar: React.FC<TopBarProps> = React.memo(({
  searchQuery,
  onSearchChange,
  breadcrumbs,
  onBreadcrumbClick,
  onClearFilter,
  onBatchImportClick,
  onImessageImportClick,
  showImessageButton = true,
  onQuickAddClick,
  onRefreshAllClick,
  onReclassifyClick,
  isReclassifying: isReclassifyingProp,
  reclassifyProgress,
  onSettingsClick,
  onUserClick,
  showStarredOnly,
  onToggleStarredFilter,
  dateAddedFilter = 'all',
  onDateAddedFilterChange,
  onToggleUiMode,
}) => {
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const dateMenuRef = useRef<HTMLDivElement | null>(null);

  // Close the date-filter menu when clicking outside or pressing Escape.
  useEffect(() => {
    if (!isDateMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (dateMenuRef.current && !dateMenuRef.current.contains(e.target as Node)) {
        setIsDateMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDateMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDateMenuOpen]);

  const isDateFilterActive = dateAddedFilter !== 'all';

  return (
    <header className="decant-topbar decant-topbar--light">
      <div className="decant-topbar__left">
        <div className="decant-topbar__brand">
          <img src={decantLogoLight} alt="Decant" className="decant-topbar__logo" />
          <span className="decant-topbar__brand-name">Decant</span>
        </div>

        <div className="decant-topbar__search">
          <i className="bx bx-search decant-topbar__search-icon" />
          <input
            type="text"
            className="decant-topbar__search-input"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search all items..."
          />
          {searchQuery && (
            <button
              className="decant-topbar__clear-btn"
              onClick={() => onSearchChange('')}
            >
              <i className="bx bx-x" />
            </button>
          )}
        </div>

        {breadcrumbs && breadcrumbs.length > 1 && (
          <div className="decant-filter-breadcrumb">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.id}>
                {index > 0 && <span className="decant-filter-breadcrumb__sep">›</span>}
                <button
                  className={`decant-filter-breadcrumb__crumb ${index === breadcrumbs.length - 1 ? 'decant-filter-breadcrumb__crumb--active' : ''}`}
                  onClick={() => onBreadcrumbClick?.(crumb, index)}
                >
                  {crumb.label}
                </button>
              </React.Fragment>
            ))}
            <button
              className="decant-filter-breadcrumb__clear"
              onClick={onClearFilter}
              title="Clear filter"
            >
              ×
            </button>
          </div>
        )}
      </div>

      <div className="decant-topbar__spacer" />

      <div className="decant-topbar__actions">
        {/* Date-added quick filter */}
        <div
          ref={dateMenuRef}
          className="decant-topbar__date-filter"
          style={{ position: 'relative' }}
        >
          <button
            type="button"
            className={`decant-topbar__icon-btn decant-topbar__date-filter-btn ${isDateFilterActive ? 'decant-topbar__date-filter-btn--active' : ''}`}
            onClick={() => setIsDateMenuOpen((open) => !open)}
            data-tooltip={
              isDateFilterActive
                ? `Date added: ${DATE_ADDED_FILTER_LABELS[dateAddedFilter]}`
                : 'Filter by date added'
            }
            aria-haspopup="menu"
            aria-expanded={isDateMenuOpen}
            aria-label="Filter by date added"
          >
            <i className="bx bx-calendar" />
          </button>
          {isDateMenuOpen && (
            <div
              role="menu"
              className="decant-topbar__date-filter-menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                minWidth: '160px',
                background: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                padding: '4px',
                zIndex: 50,
              }}
            >
              {DATE_ADDED_FILTER_OPTIONS.map((option) => {
                const selected = option === dateAddedFilter;
                return (
                  <button
                    key={option}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => {
                      onDateAddedFilterChange?.(option);
                      setIsDateMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '6px 10px',
                      background: selected ? '#eff6ff' : 'transparent',
                      color: selected ? '#1d4ed8' : '#111827',
                      fontWeight: selected ? 600 : 500,
                      fontSize: '13px',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      if (!selected) (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6';
                    }}
                    onMouseLeave={(e) => {
                      if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
                  >
                    <span>{DATE_ADDED_FILTER_LABELS[option]}</span>
                    {selected && <i className="bx bx-check" style={{ fontSize: '16px' }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          className={`decant-topbar__icon-btn decant-topbar__star-filter ${showStarredOnly ? 'decant-topbar__star-filter--active' : ''}`}
          onClick={onToggleStarredFilter}
          data-tooltip={showStarredOnly ? 'Show all' : 'Starred only'}
        >
          <i className={`bx ${showStarredOnly ? 'bxs-star' : 'bx-star'}`} />
        </button>

        <div className="decant-topbar__separator" />

        <button
          className="decant-topbar__add-btn"
          onClick={onQuickAddClick}
          title="Quick Add (⌘N)"
        >
          <i className="bx bx-plus" />
          Import
        </button>

        <button
          className="decant-topbar__batch-btn"
          onClick={onBatchImportClick}
          title="Batch Import URLs"
        >
          <i className="bx bx-cloud-upload" />
          Batch
        </button>

        {showImessageButton && (
          <button
            className="decant-topbar__batch-btn"
            onClick={onImessageImportClick}
            title="Browse iMessage links"
          >
            <i className="bx bx-message-square-dots" />
            iMessage
          </button>
        )}

        <div className="decant-topbar__separator" />

        <div className="decant-reclassify-wrapper">
          <button
            className="decant-topbar__reclassify-btn"
            onClick={onReclassifyClick}
            disabled={isReclassifyingProp}
            title="Reclassify all nodes with AI"
          >
            <i className="bx bx-analyse" />
            {isReclassifyingProp
              ? reclassifyProgress && reclassifyProgress.total > 0
                ? ['Classifying...', 'Applying...', 'Building...', 'Done'][reclassifyProgress.completed] || `${reclassifyProgress.completed}/${reclassifyProgress.total}`
                : 'Starting...'
              : 'Reclassify'}
          </button>
          {isReclassifyingProp && (
            <div className="decant-reclassify-progress">
              <div className="decant-reclassify-progress__bar">
                <div
                  className="decant-reclassify-progress__fill"
                  style={{ width: `${reclassifyProgress ? (reclassifyProgress.completed / reclassifyProgress.total) * 100 : 0}%` }}
                />
              </div>
              <span className="decant-reclassify-progress__label">
                {reclassifyProgress?.phase || 'Initializing...'}
              </span>
            </div>
          )}
        </div>

        <div className="decant-topbar__separator" />

        <button
          className="decant-topbar__icon-btn"
          onClick={onRefreshAllClick}
          data-tooltip="Refresh"
        >
          <i className="bx bx-refresh" />
        </button>

        <button className="decant-topbar__icon-btn" onClick={onSettingsClick} data-tooltip="Settings">
          <i className="bx bx-cog" />
        </button>

        {onToggleUiMode && (
          <button className="decant-topbar__icon-btn" onClick={onToggleUiMode} data-tooltip="Switch UI theme">
            <i className="bx bx-palette" />
          </button>
        )}

        <button className="decant-topbar__user" onClick={onUserClick} data-tooltip="Account">
          <div className="decant-topbar__user-avatar decant-topbar__user-avatar--placeholder">
            <i className="bx bx-user" />
          </div>
        </button>
      </div>
    </header>
  );
});
