// ============================================================
// BatchImportModal Component
// Main modal for batch URL import with split-view layout
// ============================================================

import React, { useCallback } from 'react';
import { useBatchImport } from '../../hooks/useBatchImport';
import { BatchUrlInput } from './BatchUrlInput';
import { BatchImportResults } from './BatchImportResults';

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (importedNodeIds: string[]) => void;
}

export function BatchImportModal({
  isOpen,
  onClose,
  onImportComplete,
}: BatchImportModalProps): React.ReactElement | null {
  const {
    state,
    urlText,
    parsedUrls,
    options,
    showDetails,
    isActive,
    isComplete,
    setUrlText,
    setOptions,
    toggleDetails,
    startImport,
    cancelImport,
    reset,
    stats,
    progressPercent,
    validUrlCount,
  } = useBatchImport();

  // Handle modal close
  const handleClose = useCallback(() => {
    if (isActive) {
      // Confirm before closing during import
      if (!window.confirm('Import is in progress. Are you sure you want to close?')) {
        return;
      }
      cancelImport();
    }
    reset();
    onClose();
  }, [isActive, cancelImport, reset, onClose]);

  // Handle import start
  const handleStartImport = useCallback(async () => {
    await startImport();
  }, [startImport]);

  // Handle import complete - collect imported node IDs
  const handleDone = useCallback(() => {
    if (state?.items && onImportComplete) {
      const importedNodeIds = state.items
        .filter((item) => item.status === 'imported' && item.nodeId)
        .map((item) => item.nodeId!);
      onImportComplete(importedNodeIds);
    }
    reset();
    onClose();
  }, [state?.items, onImportComplete, reset, onClose]);

  // Handle cancel
  const handleCancel = useCallback(async () => {
    await cancelImport();
  }, [cancelImport]);

  if (!isOpen) return null;

  const hasStarted = state !== null;
  const canStart = validUrlCount > 0 && !isActive;

  return (
    <div className="batch-import-overlay" onClick={handleClose}>
      <div className="batch-import-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="batch-import-header">
          <div className="batch-import-header-left">
            <h2 className="batch-import-title">Batch Import</h2>
            <span className="batch-import-subtitle">
              Import multiple URLs at once
            </span>
          </div>
          <button
            type="button"
            className="batch-import-close"
            onClick={handleClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Main Content - Split View */}
        <div className="batch-import-content">
          {/* Left Panel - URL Input */}
          <div className="batch-import-left">
            <BatchUrlInput
              urlText={urlText}
              onUrlTextChange={setUrlText}
              validUrlCount={validUrlCount}
              disabled={isActive}
            />
          </div>

          {/* Divider with Toggle */}
          <div className="batch-import-divider">
            <button
              type="button"
              className={`batch-import-toggle ${showDetails ? 'expanded' : 'collapsed'}`}
              onClick={toggleDetails}
              title={showDetails ? 'Hide details' : 'Show details'}
            >
              <ChevronIcon direction={showDetails ? 'right' : 'left'} />
            </button>
          </div>

          {/* Right Panel - Results (collapsible) */}
          {showDetails && (
            <div className="batch-import-right">
              <BatchImportResults
                items={state?.items || []}
                hasStarted={hasStarted}
              />
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {hasStarted && (
          <div className="batch-import-progress-section">
            <div className="batch-import-progress-bar">
              <div
                className="batch-import-progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="batch-import-stats">
              <span className="batch-import-stat batch-import-stat--imported">
                {stats.imported} imported
              </span>
              <span className="batch-import-stat-separator">•</span>
              <span className="batch-import-stat batch-import-stat--processing">
                {stats.processing} processing
              </span>
              <span className="batch-import-stat-separator">•</span>
              <span className="batch-import-stat batch-import-stat--queued">
                {stats.queued} queued
              </span>
              <span className="batch-import-stat-separator">•</span>
              <span className="batch-import-stat batch-import-stat--failed">
                {stats.failed} failed
              </span>
              {stats.duplicates > 0 && (
                <>
                  <span className="batch-import-stat-separator">•</span>
                  <span className="batch-import-stat batch-import-stat--duplicates">
                    {stats.duplicates} duplicates
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Options */}
        <div className="batch-import-options">
          <label className="batch-import-option">
            <input
              type="checkbox"
              checked={options.autoClassify}
              onChange={(e) => setOptions({ autoClassify: e.target.checked })}
              disabled={isActive}
            />
            <span>Auto-classify with AI</span>
          </label>
          <label className="batch-import-option">
            <input
              type="checkbox"
              checked={options.skipDuplicates}
              onChange={(e) => setOptions({ skipDuplicates: e.target.checked })}
              disabled={isActive}
            />
            <span>Skip duplicates</span>
          </label>
          <label className="batch-import-option">
            <input
              type="checkbox"
              checked={options.showInTreeWhenDone}
              onChange={(e) => setOptions({ showInTreeWhenDone: e.target.checked })}
              disabled={isActive}
            />
            <span>Show in tree when done</span>
          </label>
        </div>

        {/* Footer Actions */}
        <div className="batch-import-footer">
          <button
            type="button"
            className="batch-import-btn batch-import-btn--secondary"
            onClick={handleClose}
          >
            {isComplete ? 'Close' : 'Cancel'}
          </button>

          {isActive ? (
            <button
              type="button"
              className="batch-import-btn batch-import-btn--danger"
              onClick={handleCancel}
            >
              Stop Import
            </button>
          ) : isComplete ? (
            <button
              type="button"
              className="batch-import-btn batch-import-btn--primary"
              onClick={handleDone}
            >
              Done
            </button>
          ) : (
            <button
              type="button"
              className="batch-import-btn batch-import-btn--primary"
              onClick={handleStartImport}
              disabled={!canStart}
            >
              Import {validUrlCount > 0 ? `${validUrlCount} URL${validUrlCount !== 1 ? 's' : ''}` : ''}
            </button>
          )}
        </div>
      </div>

      <style>{modalStyles}</style>
    </div>
  );
}

// ============================================================
// Icons
// ============================================================

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ transform: direction === 'left' ? 'rotate(180deg)' : 'none' }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ============================================================
// Styles
// ============================================================

const modalStyles = `
  .batch-import-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .batch-import-modal {
    background: var(--gum-white);
    border: var(--border-width) solid var(--gum-black);
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-lg);
    width: 90vw;
    max-width: 900px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.2s ease-out;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Header */
  .batch-import-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: var(--space-md) var(--space-lg);
    border-bottom: 1px solid var(--gum-gray-200);
  }

  .batch-import-header-left {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .batch-import-title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    margin: 0;
  }

  .batch-import-subtitle {
    font-size: var(--font-size-sm);
    color: var(--gum-gray-500);
  }

  .batch-import-close {
    padding: var(--space-xs);
    background: none;
    border: none;
    cursor: pointer;
    color: var(--gum-gray-500);
    border-radius: var(--border-radius);
    transition: all var(--transition-fast);
  }

  .batch-import-close:hover {
    background: var(--gum-gray-100);
    color: var(--gum-black);
  }

  /* Content - Split View */
  .batch-import-content {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .batch-import-left {
    flex: 1;
    padding: var(--space-md) var(--space-lg);
    min-width: 300px;
    display: flex;
    flex-direction: column;
  }

  .batch-import-divider {
    width: 1px;
    background: var(--gum-gray-200);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .batch-import-toggle {
    position: absolute;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--gum-white);
    border: 1px solid var(--gum-gray-300);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--gum-gray-500);
    transition: all var(--transition-fast);
    z-index: 1;
  }

  .batch-import-toggle:hover {
    background: var(--gum-gray-100);
    color: var(--gum-black);
  }

  .batch-import-right {
    flex: 1;
    min-width: 300px;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Progress Section */
  .batch-import-progress-section {
    padding: var(--space-sm) var(--space-lg);
    border-top: 1px solid var(--gum-gray-200);
  }

  .batch-import-progress-bar {
    height: 4px;
    background: var(--gum-gray-200);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: var(--space-sm);
  }

  .batch-import-progress-fill {
    height: 100%;
    background: var(--gum-green);
    border-radius: 2px;
    transition: width 0.3s ease-out;
  }

  .batch-import-stats {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: var(--font-size-xs);
    color: var(--gum-gray-600);
    flex-wrap: wrap;
  }

  .batch-import-stat {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .batch-import-stat--imported {
    color: var(--gum-green);
  }

  .batch-import-stat--processing {
    color: #d4a800;
  }

  .batch-import-stat--queued {
    color: var(--gum-gray-500);
  }

  .batch-import-stat--failed {
    color: #E74C3C;
  }

  .batch-import-stat--duplicates {
    color: var(--gum-blue);
  }

  .batch-import-stat-separator {
    color: var(--gum-gray-300);
  }

  /* Options */
  .batch-import-options {
    display: flex;
    gap: var(--space-lg);
    padding: var(--space-md) var(--space-lg);
    border-top: 1px solid var(--gum-gray-200);
    background: var(--gum-gray-50);
  }

  .batch-import-option {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-size: var(--font-size-sm);
    cursor: pointer;
  }

  .batch-import-option input {
    width: 16px;
    height: 16px;
    accent-color: var(--gum-green);
    cursor: pointer;
  }

  .batch-import-option input:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .batch-import-option input:disabled + span {
    opacity: 0.5;
  }

  /* Footer */
  .batch-import-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-lg);
    border-top: 1px solid var(--gum-gray-200);
  }

  .batch-import-btn {
    padding: var(--space-sm) var(--space-lg);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-bold);
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: all var(--transition-fast);
    border: var(--border-width) solid var(--gum-black);
  }

  .batch-import-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .batch-import-btn--secondary {
    background: var(--gum-white);
    color: var(--gum-black);
  }

  .batch-import-btn--secondary:hover:not(:disabled) {
    background: var(--gum-gray-100);
  }

  .batch-import-btn--primary {
    background: var(--gum-green);
    color: var(--gum-black);
  }

  .batch-import-btn--primary:hover:not(:disabled) {
    background: #1db85f;
  }

  .batch-import-btn--danger {
    background: #E74C3C;
    color: white;
    border-color: #c0392b;
  }

  .batch-import-btn--danger:hover:not(:disabled) {
    background: #c0392b;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .batch-import-modal {
      width: 95vw;
      max-height: 90vh;
    }

    .batch-import-content {
      flex-direction: column;
    }

    .batch-import-left,
    .batch-import-right {
      min-width: unset;
      max-width: unset;
    }

    .batch-import-divider {
      width: 100%;
      height: 1px;
    }

    .batch-import-toggle {
      top: -12px;
      transform: rotate(90deg);
    }

    .batch-import-options {
      flex-wrap: wrap;
      gap: var(--space-sm);
    }
  }
`;

export default BatchImportModal;
