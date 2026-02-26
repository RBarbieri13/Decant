// ============================================================
// TabListItem — Individual row in the tab checklist
// ============================================================

import { BrowserTab } from '../types/index.js';

interface TabListItemProps {
  tab: BrowserTab;
  onToggle: (tabId: number) => void;
  disabled: boolean;
}

export function TabListItem({ tab, onToggle, disabled }: TabListItemProps) {
  const isImportable = tab.status !== 'filtered' && tab.status !== 'duplicate';
  const isChecked = tab.selected && isImportable;

  const handleClick = () => {
    if (!disabled && isImportable) {
      onToggle(tab.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={`ext-tab-item${!isImportable ? ' ext-tab-item--filtered' : ''}${tab.status === 'success' ? ' ext-tab-item--success' : ''}${tab.status === 'failed' ? ' ext-tab-item--failed' : ''}${tab.status === 'importing' ? ' ext-tab-item--importing' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="checkbox"
      aria-checked={isChecked}
      aria-disabled={disabled || !isImportable}
      tabIndex={isImportable ? 0 : -1}
    >
      {/* Checkbox area */}
      <div className="ext-tab-checkbox">
        {tab.status === 'success' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#27AE60">
            <circle cx="12" cy="12" r="10" />
            <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : tab.status === 'failed' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#E74C3C">
            <circle cx="12" cy="12" r="10" />
            <path d="M15 9l-6 6M9 9l6 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : tab.status === 'importing' ? (
          <span className="ext-tab-spinner" />
        ) : tab.status === 'duplicate' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
            <circle cx="12" cy="12" r="9" strokeDasharray="4 2" />
          </svg>
        ) : (
          <span className={`ext-tab-check${isChecked ? ' ext-tab-check--checked' : ''}`} />
        )}
      </div>

      {/* Favicon */}
      <div className="ext-tab-favicon">
        {tab.favIconUrl ? (
          <img
            src={tab.favIconUrl}
            alt=""
            width="16"
            height="16"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <span className="ext-tab-favicon-fallback">
            {tab.domain.charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* Title + domain */}
      <div className="ext-tab-content">
        <span className="ext-tab-title">{tab.title || tab.domain}</span>
        <span className="ext-tab-domain">{tab.domain}</span>
      </div>

      {/* Duplicate badge */}
      {tab.status === 'duplicate' && (
        <span className="ext-tab-badge ext-tab-badge--duplicate">exists</span>
      )}
    </div>
  );
}
