// ============================================================
// ImessageLinkPicker — Browse & select iMessage links for import
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { imessageAPI, type ExtractedImessageUrl } from '../../services/api';

// ============================================================
// Types
// ============================================================

interface ImessageLinkPickerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with selected URLs when user confirms */
  onConfirm: (urls: string[]) => void;
}

interface LinkItem extends ExtractedImessageUrl {
  selected: boolean;
  duplicate?: { nodeId: string; title: string };
}

// ============================================================
// Helpers
// ============================================================

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function truncateUrl(url: string, maxLen = 70): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 1) + '\u2026';
}

function formatRelativeTime(isoDate: string | null): string {
  if (!isoDate) return '';
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString();
}

const PAGE_SIZE = 20;

// ============================================================
// Component
// ============================================================

export function ImessageLinkPicker({
  isOpen,
  onClose,
  onConfirm,
}: ImessageLinkPickerProps): React.ReactElement | null {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial links when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setLinks([]);
    setError(null);
    loadLinks(0, true);
  }, [isOpen]);

  const loadLinks = useCallback(async (offset: number, isInitial: boolean) => {
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      const result = await imessageAPI.extractUrls(PAGE_SIZE, offset);

      if (!result.success) {
        setError(result.error || 'Failed to extract iMessage URLs');
        return;
      }

      setHasMore(result.hasMore);

      // Check duplicates for this batch
      const urlStrings = result.urls.map(u => u.url);
      const dupResult = await imessageAPI.checkDuplicates(urlStrings);
      const duplicates = dupResult.success ? dupResult.duplicates : {};

      const newItems: LinkItem[] = result.urls.map(u => ({
        ...u,
        selected: !duplicates[u.url], // pre-select non-duplicates
        duplicate: duplicates[u.url] || undefined,
      }));

      setLinks(prev => isInitial ? newItems : [...prev, ...newItems]);

    } catch {
      setError('Failed to connect to iMessage service. Check Full Disk Access permissions.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const handleLoadMore = useCallback(() => {
    loadLinks(links.length, false);
  }, [links.length, loadLinks]);

  const toggleLink = useCallback((index: number) => {
    setLinks(prev => prev.map((item, i) =>
      i === index ? { ...item, selected: !item.selected } : item
    ));
  }, []);

  const selectedCount = links.filter(l => l.selected).length;
  const nonDuplicateCount = links.filter(l => !l.duplicate).length;

  const selectAll = useCallback(() => {
    setLinks(prev => prev.map(item => ({ ...item, selected: true })));
  }, []);

  const deselectAll = useCallback(() => {
    setLinks(prev => prev.map(item => ({ ...item, selected: false })));
  }, []);

  const selectAllNew = useCallback(() => {
    setLinks(prev => prev.map(item => ({ ...item, selected: !item.duplicate })));
  }, []);

  const handleConfirm = useCallback(() => {
    const selectedUrls = links.filter(l => l.selected).map(l => l.url);
    onConfirm(selectedUrls);
  }, [links, onConfirm]);

  if (!isOpen) return null;

  return (
    <div className="iml-overlay" onClick={onClose}>
      <div className="iml-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="iml-header">
          <div className="iml-header-left">
            <i className="bx bx-message-square-dots" style={{ fontSize: 20 }} />
            <h2 className="iml-title">iMessage Links</h2>
          </div>
          <button className="iml-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* Select controls */}
        {links.length > 0 && (
          <div className="iml-controls">
            <span className="iml-count">
              {selectedCount} of {links.length} selected
              {links.some(l => l.duplicate) && (
                <span className="iml-dup-summary">
                  {' '}· {links.filter(l => l.duplicate).length} already in Decant
                </span>
              )}
            </span>
            <div className="iml-control-buttons">
              <button className="iml-control-btn" onClick={selectAllNew}>Select new</button>
              <button className="iml-control-btn" onClick={selectAll}>Select all</button>
              <button className="iml-control-btn" onClick={deselectAll}>Deselect all</button>
            </div>
          </div>
        )}

        {/* Link list */}
        <div className="iml-list">
          {loading ? (
            <div className="iml-loading">
              <div className="iml-spinner" />
              <span>Reading iMessage database...</span>
            </div>
          ) : error ? (
            <div className="iml-error">
              <span className="iml-error-icon">⚠</span>
              <span>{error}</span>
            </div>
          ) : links.length === 0 ? (
            <div className="iml-empty">No links found in recent self-texts.</div>
          ) : (
            <>
              {links.map((item, i) => (
                <label
                  key={`${item.url}-${i}`}
                  className={`iml-row ${item.duplicate ? 'iml-row--duplicate' : ''} ${item.selected ? 'iml-row--selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={() => toggleLink(i)}
                    className="iml-checkbox"
                  />
                  <div className="iml-row-content">
                    <div className="iml-row-url">
                      <span className="iml-domain">{getDomain(item.url)}</span>
                      <span className="iml-path">{truncateUrl(item.url)}</span>
                    </div>
                    <div className="iml-row-meta">
                      {item.messageDate && (
                        <span className="iml-time">{formatRelativeTime(item.messageDate)}</span>
                      )}
                      {item.duplicate && (
                        <span className="iml-dup-pill" title={`Already imported as: ${item.duplicate.title}`}>
                          Already in Decant
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              ))}

              {hasMore && (
                <button
                  className="iml-load-more"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <>
                      <div className="iml-spinner iml-spinner--small" />
                      Loading...
                    </>
                  ) : (
                    `Load more links`
                  )}
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="iml-footer">
          <button className="iml-btn iml-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="iml-btn iml-btn--primary"
            onClick={handleConfirm}
            disabled={selectedCount === 0}
          >
            {selectedCount > 0
              ? `Import Selected (${selectedCount})`
              : 'Select links to import'}
          </button>
        </div>
      </div>

      <style>{pickerStyles}</style>
    </div>
  );
}

// ============================================================
// Styles
// ============================================================

const pickerStyles = `
  .iml-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: imlFadeIn 0.15s ease-out;
  }

  @keyframes imlFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .iml-modal {
    background: var(--gum-white);
    border: var(--border-width, 2px) solid var(--gum-black);
    border-radius: var(--border-radius-lg, 12px);
    box-shadow: var(--shadow-lg, 8px 8px 0 var(--gum-black));
    width: 90vw;
    max-width: 640px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    animation: imlSlideUp 0.15s ease-out;
  }

  @keyframes imlSlideUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Header */
  .iml-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-md, 16px) var(--space-lg, 24px);
    border-bottom: 1px solid var(--gum-gray-200);
  }

  .iml-header-left {
    display: flex;
    align-items: center;
    gap: var(--space-sm, 8px);
  }

  .iml-title {
    font-size: var(--font-size-lg, 18px);
    font-weight: var(--font-weight-bold, 700);
    margin: 0;
  }

  .iml-close {
    width: 32px;
    height: 32px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--gum-gray-500);
    border-radius: var(--border-radius, 6px);
    font-size: 24px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }

  .iml-close:hover {
    background: var(--gum-gray-100);
    color: var(--gum-black);
  }

  /* Controls */
  .iml-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm, 8px) var(--space-lg, 24px);
    border-bottom: 1px solid var(--gum-gray-200);
    background: var(--gum-gray-100, #F8F8F6);
  }

  .iml-count {
    font-size: var(--font-size-sm, 13px);
    color: var(--gum-gray-600);
    font-weight: 500;
  }

  .iml-dup-summary {
    color: var(--gum-blue);
  }

  .iml-control-buttons {
    display: flex;
    gap: var(--space-xs, 4px);
  }

  .iml-control-btn {
    padding: 4px 10px;
    font-size: var(--font-size-xs, 12px);
    background: var(--gum-white);
    border: 1px solid var(--gum-gray-300);
    border-radius: var(--border-radius, 6px);
    cursor: pointer;
    color: var(--gum-gray-600);
    transition: all 0.15s;
  }

  .iml-control-btn:hover {
    background: var(--gum-gray-200);
    color: var(--gum-black);
  }

  /* Link list */
  .iml-list {
    flex: 1;
    overflow-y: auto;
    min-height: 200px;
    max-height: 50vh;
  }

  .iml-loading,
  .iml-error,
  .iml-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm, 8px);
    padding: var(--space-lg, 24px);
    color: var(--gum-gray-500);
    font-size: var(--font-size-sm, 13px);
  }

  .iml-error {
    color: #C0392B;
  }

  .iml-error-icon {
    font-size: 18px;
  }

  /* Spinner */
  .iml-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--gum-gray-300);
    border-top-color: var(--gum-green);
    border-radius: 50%;
    animation: imlSpin 0.6s linear infinite;
  }

  .iml-spinner--small {
    width: 14px;
    height: 14px;
  }

  @keyframes imlSpin {
    to { transform: rotate(360deg); }
  }

  /* Link row */
  .iml-row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm, 8px);
    padding: 10px var(--space-lg, 24px);
    border-bottom: 1px solid var(--gum-gray-100);
    cursor: pointer;
    transition: background 0.1s;
  }

  .iml-row:hover {
    background: var(--gum-gray-100);
  }

  .iml-row--selected {
    background: rgba(35, 198, 107, 0.04);
  }

  .iml-row--selected:hover {
    background: rgba(35, 198, 107, 0.08);
  }

  .iml-row--duplicate {
    opacity: 0.55;
  }

  .iml-row--duplicate.iml-row--selected {
    opacity: 0.75;
  }

  .iml-checkbox {
    width: 16px;
    height: 16px;
    accent-color: var(--gum-green);
    cursor: pointer;
    margin-top: 2px;
    flex-shrink: 0;
  }

  .iml-row-content {
    flex: 1;
    min-width: 0;
  }

  .iml-row-url {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .iml-domain {
    font-size: var(--font-size-sm, 13px);
    font-weight: 600;
    color: var(--gum-black);
  }

  .iml-path {
    font-size: var(--font-size-xs, 12px);
    color: var(--gum-gray-500);
    word-break: break-all;
    line-height: 1.3;
  }

  .iml-row-meta {
    display: flex;
    align-items: center;
    gap: var(--space-sm, 8px);
    margin-top: 4px;
  }

  .iml-time {
    font-size: 11px;
    color: var(--gum-gray-500);
  }

  .iml-dup-pill {
    font-size: 11px;
    padding: 1px 8px;
    border-radius: 10px;
    background: var(--gum-blue);
    color: var(--gum-white);
    font-weight: 500;
    white-space: nowrap;
  }

  /* Load more */
  .iml-load-more {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm, 8px);
    width: 100%;
    padding: 12px;
    background: var(--gum-gray-100);
    border: none;
    border-top: 1px solid var(--gum-gray-200);
    cursor: pointer;
    font-size: var(--font-size-sm, 13px);
    color: var(--gum-gray-600);
    font-weight: 500;
    transition: all 0.15s;
  }

  .iml-load-more:hover:not(:disabled) {
    background: var(--gum-gray-200);
    color: var(--gum-black);
  }

  .iml-load-more:disabled {
    cursor: default;
  }

  /* Footer */
  .iml-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm, 8px);
    padding: var(--space-md, 16px) var(--space-lg, 24px);
    border-top: 1px solid var(--gum-gray-200);
  }

  .iml-btn {
    padding: var(--space-sm, 8px) var(--space-lg, 24px);
    font-size: var(--font-size-sm, 13px);
    font-weight: var(--font-weight-bold, 700);
    border-radius: var(--border-radius, 6px);
    cursor: pointer;
    transition: all 0.15s;
    border: var(--border-width, 2px) solid var(--gum-black);
  }

  .iml-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .iml-btn--secondary {
    background: var(--gum-white);
    color: var(--gum-black);
  }

  .iml-btn--secondary:hover:not(:disabled) {
    background: var(--gum-gray-100);
  }

  .iml-btn--primary {
    background: var(--gum-green);
    color: var(--gum-black);
  }

  .iml-btn--primary:hover:not(:disabled) {
    background: #1db85f;
  }

  @media (max-width: 640px) {
    .iml-modal {
      width: 95vw;
      max-height: 90vh;
    }

    .iml-controls {
      flex-direction: column;
      gap: var(--space-sm, 8px);
      align-items: flex-start;
    }
  }
`;
