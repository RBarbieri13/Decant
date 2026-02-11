// ============================================================
// BatchImportResults Component
// Right panel showing import progress and results
// ============================================================

import React from 'react';
import type { BatchImportItem, BatchImportItemStatus } from '../../../shared/types';

interface BatchImportResultsProps {
  items: BatchImportItem[];
  hasStarted: boolean;
}

export function BatchImportResults({
  items,
  hasStarted,
}: BatchImportResultsProps): React.ReactElement {
  if (!hasStarted) {
    return (
      <div className="batch-results batch-results--empty">
        <div className="batch-results-placeholder">
          <ImportIcon />
          <p>Import Progress</p>
          <span>Results will appear here when you start importing</span>
        </div>

        <style>{resultStyles}</style>
      </div>
    );
  }

  const completedCount = items.filter(
    (i) => i.status === 'imported' || i.status === 'duplicate'
  ).length;

  return (
    <div className="batch-results">
      <div className="batch-results-header">
        <span className="batch-results-title">Import Progress</span>
        <span className="batch-results-subtitle">
          {completedCount} of {items.length} complete
        </span>
      </div>

      <div className="batch-results-list">
        {items.map((item, index) => (
          <BatchResultItem key={item.id} item={item} index={index + 1} />
        ))}
      </div>

      <style>{resultStyles}</style>
    </div>
  );
}

// ============================================================
// Individual Result Item
// ============================================================

interface BatchResultItemProps {
  item: BatchImportItem;
  index: number;
}

function BatchResultItem({ item, index }: BatchResultItemProps): React.ReactElement {
  const [showErrorDetails, setShowErrorDetails] = React.useState(false);
  const statusConfig = getStatusConfig(item.status);
  const domain = extractDomain(item.url);
  const hasError = item.status === 'failed' && item.error;

  return (
    <div className={`batch-result-item batch-result-item--${item.status}`}>
      {/* Index number */}
      <div className="batch-result-index">{index}</div>

      {/* Favicon */}
      <div className="batch-result-favicon">
        {item.favicon ? (
          <img src={item.favicon} alt="" onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }} />
        ) : (
          <div className="batch-result-favicon-placeholder">
            {domain.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="batch-result-content">
        <div className="batch-result-title">
          {item.title || domain}
        </div>
        <div className="batch-result-url">{domain}</div>

        {/* Classification Tags */}
        {item.classification && item.status === 'imported' && (
          <div className="batch-result-tags">
            {item.classification.segment && (
              <span className="batch-result-tag batch-result-tag--segment">
                {item.classification.segment}
              </span>
            )}
            {item.classification.category && (
              <span className="batch-result-tag batch-result-tag--category">
                {item.classification.category}
              </span>
            )}
            {item.classification.contentType && (
              <span className="batch-result-tag batch-result-tag--content">
                {item.classification.contentType}
              </span>
            )}
          </div>
        )}

        {/* Error Message */}
        {hasError && (
          <div className="batch-result-error">
            <button
              type="button"
              className="batch-result-error-toggle"
              onClick={() => setShowErrorDetails(!showErrorDetails)}
            >
              <span className="error-toggle-icon">{showErrorDetails ? '▼' : '▶'}</span>
              <span className="error-toggle-text">
                {showErrorDetails ? 'Hide' : 'Show'} error details
              </span>
            </button>
            {showErrorDetails && (
              <div className="batch-result-error-details">
                {item.error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Badge */}
      <div className={`batch-result-status batch-result-status--${item.status}`}>
        {statusConfig.icon}
        <span>{statusConfig.label}</span>
      </div>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function getStatusConfig(status: BatchImportItemStatus): { label: string; icon: React.ReactNode } {
  switch (status) {
    case 'imported':
      return { label: 'Imported', icon: <CheckIcon /> };
    case 'duplicate':
      return { label: 'Exists', icon: <CheckIcon /> };
    case 'failed':
      return { label: 'Failed', icon: <ErrorIcon /> };
    case 'validating':
    case 'fetching':
    case 'classifying':
    case 'saving':
      return { label: 'Processing...', icon: <SpinnerIcon /> };
    case 'queued':
    default:
      return { label: 'Queued', icon: <QueueIcon /> };
  }
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// ============================================================
// Icons
// ============================================================

function ImportIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spinner">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function QueueIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

// ============================================================
// Styles
// ============================================================

const resultStyles = `
  .batch-results {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 300px;
    border-left: 1px solid var(--gum-gray-200);
    background: var(--gum-gray-50);
  }

  .batch-results--empty {
    justify-content: center;
    align-items: center;
  }

  .batch-results-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
    text-align: center;
    color: var(--gum-gray-500);
  }

  .batch-results-placeholder p {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    margin: 0;
  }

  .batch-results-placeholder span {
    font-size: var(--font-size-sm);
  }

  .batch-results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-md);
    border-bottom: 1px solid var(--gum-gray-200);
    background: var(--gum-white);
  }

  .batch-results-title {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-bold);
  }

  .batch-results-subtitle {
    font-size: var(--font-size-xs);
    color: var(--gum-gray-500);
  }

  .batch-results-list {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-sm);
  }

  .batch-result-item {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: 10px;
    margin-bottom: var(--space-xs);
    background: var(--gum-white);
    border: 1px solid var(--gum-gray-200);
    border-radius: 6px;
    transition: all var(--transition-fast);
  }

  .batch-result-item:hover {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    border-color: var(--gum-gray-300);
  }

  .batch-result-item--imported {
    border-color: #D4F4E6;
    background: #F9FDFC;
  }

  .batch-result-item--imported:hover {
    border-color: var(--gum-green);
  }

  .batch-result-item--duplicate {
    border-color: #E0E8F8;
    background: #F9FBFE;
  }

  .batch-result-item--duplicate:hover {
    border-color: var(--gum-blue);
  }

  .batch-result-item--failed {
    border-color: #F8D7DA;
    background: #FEF5F5;
  }

  .batch-result-item--failed:hover {
    border-color: #E74C3C;
  }

  .batch-result-index {
    width: 20px;
    font-size: var(--font-size-xs);
    color: var(--gum-gray-400);
    text-align: center;
  }

  .batch-result-favicon {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  .batch-result-favicon img {
    width: 100%;
    height: 100%;
    border-radius: 4px;
    object-fit: contain;
  }

  .batch-result-favicon-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--gum-gray-200);
    border-radius: 4px;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    color: var(--gum-gray-600);
  }

  .batch-result-content {
    flex: 1;
    min-width: 0;
  }

  .batch-result-title {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .batch-result-url {
    font-size: var(--font-size-xs);
    color: var(--gum-gray-500);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .batch-result-tags {
    display: flex;
    gap: var(--space-xs);
    margin-top: var(--space-xs);
  }

  .batch-result-tag {
    padding: 3px 8px;
    font-size: 10px;
    font-weight: var(--font-weight-bold);
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .batch-result-tag--segment {
    background: #FF6B9D;
    color: white;
  }

  .batch-result-tag--category {
    background: var(--gum-blue);
    color: white;
  }

  .batch-result-tag--content {
    background: var(--gum-gray-300);
    color: var(--gum-gray-700);
  }

  .batch-result-error {
    margin-top: var(--space-sm);
    padding: var(--space-xs) 0;
  }

  .batch-result-error-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-sm);
    background: #FFF0F0;
    border: 1px solid #FFCCCC;
    border-radius: 4px;
    cursor: pointer;
    font-size: var(--font-size-xs);
    color: #C0392B;
    transition: all var(--transition-fast);
  }

  .batch-result-error-toggle:hover {
    background: #FFE5E5;
  }

  .error-toggle-icon {
    font-size: 10px;
    line-height: 1;
  }

  .error-toggle-text {
    font-weight: var(--font-weight-medium);
  }

  .batch-result-error-details {
    margin-top: var(--space-xs);
    padding: var(--space-sm);
    background: #FFF5F5;
    border: 1px solid #FFDDDD;
    border-radius: 4px;
    font-size: var(--font-size-xs);
    color: #A93226;
    line-height: 1.5;
    word-break: break-word;
  }

  .batch-result-status {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    font-size: 11px;
    font-weight: var(--font-weight-medium);
    border-radius: 12px;
    white-space: nowrap;
  }

  .batch-result-status--imported {
    background: #E8F8F0;
    color: #1B8C57;
  }

  .batch-result-status--duplicate {
    background: #E8EFFC;
    color: #4A6FA5;
  }

  .batch-result-status--failed {
    background: #FDEEEE;
    color: #C0392B;
  }

  .batch-result-status--validating,
  .batch-result-status--fetching,
  .batch-result-status--classifying,
  .batch-result-status--saving {
    background: #FFF7E6;
    color: #D4A800;
  }

  .batch-result-status--queued {
    background: var(--gum-gray-100);
    color: var(--gum-gray-600);
  }

  .spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

export default BatchImportResults;
