import React from 'react';
import type { BreadcrumbItem, ViewMode } from '../types';
import decantLogoLight from '../../assets/decant-logo-light.png';

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
}

export const TopBar: React.FC<TopBarProps> = React.memo(({
  searchQuery,
  onSearchChange,
  breadcrumbs,
  onBreadcrumbClick,
  onClearFilter,
  onBatchImportClick,
  onImessageImportClick,
  onQuickAddClick,
  onRefreshAllClick,
  onReclassifyClick,
  isReclassifying: isReclassifyingProp,
  reclassifyProgress,
  onSettingsClick,
  onUserClick,
  showStarredOnly,
  onToggleStarredFilter,
}) => {
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

        <button
          className="decant-topbar__batch-btn"
          onClick={onImessageImportClick}
          title="Browse iMessage links"
        >
          <i className="bx bx-message-square-dots" />
          iMessage
        </button>

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

        <button className="decant-topbar__user" onClick={onUserClick} data-tooltip="Account">
          <div className="decant-topbar__user-avatar decant-topbar__user-avatar--placeholder">
            <i className="bx bx-user" />
          </div>
        </button>
      </div>
    </header>
  );
});
