// ============================================================
// Import Dialog - Enhanced URL Import with Progress & Real-Time Updates
// ============================================================

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { showImportSuccess, showImportError } from '../../utils/toasts';

interface ImportState {
  url: string;
  importId: string | null;
  canClose: boolean;
}

const PHASE_STEPS = [
  { phase: 'validating', label: 'Validating', icon: '🔍' },
  { phase: 'fetching', label: 'Fetching', icon: '⬇️' },
  { phase: 'classifying', label: 'Classifying', icon: '🤖' },
  { phase: 'saving', label: 'Saving', icon: '💾' },
  { phase: 'complete', label: 'Complete', icon: '✅' },
];

export function ImportDialog(): React.ReactElement | null {
  const { state, actions } = useApp();
  const toast = useToast();
  const { importDialogOpen, importProgress } = state;

  const [importState, setImportState] = useState<ImportState>({
    url: '',
    importId: null,
    canClose: true,
  });

  const inputRef = useRef<HTMLInputElement>(null);

  // Get current import progress if exists
  const currentProgress = importState.importId
    ? importProgress.get(importState.importId)
    : null;

  const isImporting = Boolean(
    currentProgress &&
    currentProgress.phase !== 'idle' &&
    currentProgress.phase !== 'complete' &&
    currentProgress.phase !== 'error'
  );

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setImportState((prev) => ({
      ...prev,
      url: e.target.value,
    }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const url = importState.url.trim();
      if (!url) {
        return;
      }

      // Basic URL validation
      try {
        new URL(url);
      } catch {
        return;
      }

      // Generate unique import ID
      const importId = `import_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      setImportState((prev) => ({
        ...prev,
        importId,
        canClose: false,
      }));

      // Start import
      const result = await actions.importUrl(url, importId);

      // Show toast notification based on result
      if (result.success && result.nodeId) {
        // Extract title from URL as fallback
        const urlObj = new URL(url);
        const title = urlObj.hostname || 'Content';
        showImportSuccess(toast, title, () => {
          actions.selectNode(result.nodeId!);
          handleClose();
        });
      } else if (!result.success) {
        showImportError(toast, result.error || 'Unknown error', () => {
          // Retry by re-submitting
          handleSubmit(e);
        });
      }

      // Allow closing after completion
      setImportState((prev) => ({
        ...prev,
        canClose: true,
      }));
    },
    [importState.url, actions, toast]
  );

  const handleClose = useCallback(() => {
    if (!importState.canClose || isImporting) {
      return;
    }

    setImportState({
      url: '',
      importId: null,
      canClose: true,
    });
    actions.closeImportDialog();
  }, [importState.canClose, isImporting, actions]);

  const handleViewNode = useCallback(() => {
    if (currentProgress?.nodeId) {
      actions.selectNode(currentProgress.nodeId);
      handleClose();
    }
  }, [currentProgress, actions, handleClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && importState.canClose && !isImporting) {
        handleClose();
      }
    },
    [handleClose, importState.canClose, isImporting]
  );

  // Auto-focus input when dialog opens
  useEffect(() => {
    if (importDialogOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [importDialogOpen]);

  if (!importDialogOpen) {
    return null;
  }

  const showProgress = currentProgress && currentProgress.phase !== 'idle';
  const showSuccess = currentProgress?.phase === 'complete';
  const showError = currentProgress?.phase === 'error';

  return (
    <div className="import-dialog-overlay" onClick={handleClose} onKeyDown={handleKeyDown}>
      <div
        className="import-dialog gum-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
      >
        <div className="import-dialog-header">
          <h2 id="import-dialog-title">Import URL</h2>
          <button
            className="import-dialog-close"
            onClick={handleClose}
            disabled={!importState.canClose || isImporting}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="import-dialog-form">
          <div className="import-dialog-field">
            <label htmlFor="import-url" className="import-dialog-label">
              Paste a URL to import
            </label>
            <input
              ref={inputRef}
              id="import-url"
              type="url"
              className="gum-input import-dialog-input"
              placeholder="https://example.com/article"
              value={importState.url}
              onChange={handleUrlChange}
              disabled={isImporting}
              autoFocus
            />
          </div>

          {/* Multi-step progress indicator */}
          {showProgress && !showError && (
            <div className="import-progress-container">
              <div className="import-progress-steps">
                {PHASE_STEPS.map((step, index) => {
                  const isActive = currentProgress?.phase === step.phase;
                  const isComplete = PHASE_STEPS.findIndex(s => s.phase === currentProgress?.phase) > index;
                  const isPending = PHASE_STEPS.findIndex(s => s.phase === currentProgress?.phase) < index;

                  return (
                    <div
                      key={step.phase}
                      className={`progress-step ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''} ${isPending ? 'pending' : ''}`}
                    >
                      <div className="step-icon">{step.icon}</div>
                      <div className="step-label">{step.label}</div>
                    </div>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div className="import-progress-bar">
                <div
                  className="import-progress-fill"
                  style={{ width: `${currentProgress?.percentage || 0}%` }}
                />
              </div>

              {/* Current message */}
              <div className="import-progress-message">
                {currentProgress?.message}
              </div>

              {/* Classification preview */}
              {currentProgress?.classification && (
                <div className="import-classification-preview">
                  <div className="classification-title">Classification Preview</div>
                  <div className="classification-tags">
                    <span className="classification-tag segment">
                      {currentProgress.classification.segment}
                    </span>
                    <span className="classification-tag category">
                      {currentProgress.classification.category}
                    </span>
                    <span className="classification-tag content-type">
                      {currentProgress.classification.contentType}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error state */}
          {showError && (
            <div className="import-dialog-error">
              <span className="error-icon">⚠️</span>
              <span>{currentProgress?.error || 'Import failed'}</span>
            </div>
          )}

          {/* Success state */}
          {showSuccess && (
            <div className="import-dialog-success">
              <div className="success-icon">✅</div>
              <div className="success-message">
                <div className="success-title">Import Complete!</div>
                <div className="success-subtitle">
                  Content has been classified and saved to your knowledge base.
                </div>
                {state.pendingEnrichments.has(currentProgress?.nodeId || '') && (
                  <div className="enrichment-status">
                    <span className="enrichment-icon">🔄</span>
                    <span className="enrichment-text">Enriching in background...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="import-dialog-actions">
            {showSuccess ? (
              <>
                <button
                  type="button"
                  className="gum-button"
                  onClick={handleClose}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="gum-button gum-button--pink"
                  onClick={handleViewNode}
                >
                  View Node
                </button>
              </>
            ) : showError ? (
              <>
                <button
                  type="button"
                  className="gum-button"
                  onClick={handleClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="gum-button gum-button--pink"
                  disabled={!importState.url.trim()}
                >
                  Retry
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="gum-button"
                  onClick={handleClose}
                  disabled={isImporting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="gum-button gum-button--pink"
                  disabled={isImporting || !importState.url.trim()}
                >
                  {isImporting ? 'Importing...' : 'Import'}
                </button>
              </>
            )}
          </div>
        </form>

        <div className="import-dialog-hint">
          <p className="text-muted text-small">
            AI will automatically classify and organize the content.
          </p>
        </div>
      </div>

      <style>{`
        .import-dialog-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .import-dialog {
          width: 100%;
          max-width: 600px;
          background: var(--gum-white);
          padding: var(--space-lg);
          max-height: 90vh;
          overflow-y: auto;
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .import-dialog-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-lg);
        }

        .import-dialog-header h2 {
          margin: 0;
          font-size: var(--font-size-lg);
        }

        .import-dialog-close {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          border-radius: var(--border-radius);
          transition: background var(--transition-fast);
        }

        .import-dialog-close:hover:not(:disabled) {
          background: var(--gum-gray-100);
        }

        .import-dialog-close:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .import-dialog-form {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
        }

        .import-dialog-field {
          display: flex;
          flex-direction: column;
          gap: var(--space-xs);
        }

        .import-dialog-label {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
        }

        .import-dialog-input {
          width: 100%;
          font-size: var(--font-size-base);
        }

        /* Progress Container */
        .import-progress-container {
          padding: var(--space-lg);
          background: var(--gum-gray-50);
          border-radius: var(--border-radius);
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
        }

        /* Progress Steps */
        .import-progress-steps {
          display: flex;
          justify-content: space-between;
          gap: var(--space-xs);
        }

        .progress-step {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-xs);
          opacity: 0.4;
          transition: all 0.3s ease;
        }

        .progress-step.active {
          opacity: 1;
        }

        .progress-step.complete {
          opacity: 0.8;
        }

        .progress-step.complete .step-icon {
          color: var(--gum-green);
        }

        .step-icon {
          font-size: 24px;
          transition: transform 0.3s ease;
        }

        .progress-step.active .step-icon {
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.2);
          }
        }

        .step-label {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          text-align: center;
        }

        /* Progress Bar */
        .import-progress-bar {
          height: 4px;
          background: var(--gum-gray-200);
          border-radius: 2px;
          overflow: hidden;
        }

        .import-progress-fill {
          height: 100%;
          background: var(--gum-pink);
          transition: width 0.3s ease;
        }

        /* Progress Message */
        .import-progress-message {
          text-align: center;
          font-size: var(--font-size-sm);
          color: var(--gum-gray-700);
        }

        /* Classification Preview */
        .import-classification-preview {
          padding: var(--space-md);
          background: var(--gum-white);
          border-radius: var(--border-radius);
          border: 1px solid var(--gum-gray-200);
        }

        .classification-title {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          color: var(--gum-gray-600);
          margin-bottom: var(--space-sm);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .classification-tags {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-xs);
        }

        .classification-tag {
          padding: var(--space-xs) var(--space-sm);
          border-radius: var(--border-radius-sm);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
        }

        .classification-tag.segment {
          background: #e3f2fd;
          color: #1976d2;
        }

        .classification-tag.category {
          background: #f3e5f5;
          color: #7b1fa2;
        }

        .classification-tag.content-type {
          background: #fff3e0;
          color: #f57c00;
        }

        /* Error State */
        .import-dialog-error {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          padding: var(--space-md);
          background: #fff0f0;
          border: 1px solid #ffcccc;
          border-radius: var(--border-radius);
          color: #cc0000;
          font-size: var(--font-size-sm);
        }

        /* Success State */
        .import-dialog-success {
          display: flex;
          align-items: flex-start;
          gap: var(--space-md);
          padding: var(--space-lg);
          background: #e8f5e9;
          border: 1px solid #c8e6c9;
          border-radius: var(--border-radius);
        }

        .success-icon {
          font-size: 32px;
        }

        .success-message {
          flex: 1;
        }

        .success-title {
          font-size: var(--font-size-base);
          font-weight: var(--font-weight-semibold);
          color: #2e7d32;
          margin-bottom: var(--space-xs);
        }

        .success-subtitle {
          font-size: var(--font-size-sm);
          color: #558b2f;
        }

        .enrichment-status {
          display: flex;
          align-items: center;
          gap: var(--space-xs);
          margin-top: var(--space-sm);
          padding: var(--space-xs) var(--space-sm);
          background: rgba(255, 255, 255, 0.5);
          border-radius: var(--border-radius-sm);
        }

        .enrichment-icon {
          font-size: var(--font-size-sm);
          animation: spin 2s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .enrichment-text {
          font-size: var(--font-size-xs);
          color: #558b2f;
          font-weight: var(--font-weight-medium);
        }

        /* Actions */
        .import-dialog-actions {
          display: flex;
          justify-content: flex-end;
          gap: var(--space-sm);
          margin-top: var(--space-sm);
        }

        /* Hint */
        .import-dialog-hint {
          margin-top: var(--space-md);
          padding-top: var(--space-md);
          border-top: 1px solid var(--gum-gray-200);
        }

        .import-dialog-hint p {
          margin: 0;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
