// ============================================================
// Quick Add Modal — Compact single-source URL import
// ============================================================

import React, { useCallback, useEffect, useRef } from 'react';
import { useQuickAdd } from '../../hooks/useQuickAdd';
import { QuickAddPreviewCard } from './QuickAddPreviewCard';
import './QuickAddModal.css';

// ============================================
// TYPES
// ============================================

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported?: (nodeId: string) => void;
  onSwitchToBatch?: () => void;
}

// ============================================
// COMPONENT
// ============================================

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  onImported,
  onSwitchToBatch,
}) => {
  const { state, setUrl, pasteFromClipboard, submitImport, reset } = useQuickAdd();
  const inputRef = useRef<HTMLInputElement>(null);

  // ----------------------------------------
  // Focus input on open
  // ----------------------------------------
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // ----------------------------------------
  // Keyboard shortcuts
  // ----------------------------------------
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        if (state.status === 'ready' || state.isValidUrl) {
          e.preventDefault();
          handleSubmit();
          return;
        }
      }

      // Cmd/Ctrl+V auto-focuses input
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        if (document.activeElement !== inputRef.current) {
          inputRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, state.status, state.isValidUrl]);

  // ----------------------------------------
  // Auto-close on success after brief delay
  // ----------------------------------------
  useEffect(() => {
    if (state.status === 'success') {
      const timer = setTimeout(() => {
        handleClose();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [state.status]);

  // ----------------------------------------
  // Handlers
  // ----------------------------------------

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleSubmit = useCallback(async () => {
    const nodeId = await submitImport();
    if (nodeId && onImported) {
      onImported(nodeId);
    }
  }, [submitImport, onImported]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose]
  );

  const handleBatchClick = useCallback(() => {
    handleClose();
    if (onSwitchToBatch) {
      onSwitchToBatch();
    }
  }, [handleClose, onSwitchToBatch]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setUrl(e.target.value);
    },
    [setUrl]
  );

  // ----------------------------------------
  // Render
  // ----------------------------------------

  if (!isOpen) return null;

  const showPreview =
    state.metadata !== null &&
    (state.status === 'ready' ||
      state.status === 'importing' ||
      state.status === 'success');

  const isSubmitting = state.status === 'importing';
  const isSuccess = state.status === 'success';

  const canSubmit =
    state.isValidUrl &&
    !isSubmitting &&
    !isSuccess &&
    (state.status === 'ready' || state.status === 'error');

  // Determine button label
  let buttonLabel = 'Add to Decant';
  if (isSubmitting) buttonLabel = 'Adding...';
  if (isSuccess) buttonLabel = '\u2713 Added';

  return (
    <div className="quick-add-overlay" onClick={handleOverlayClick}>
      <div
        className={`quick-add-modal ${isSuccess ? 'quick-add-modal--success' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-title"
      >
        {/* ====== HEADER ====== */}
        <div className="quick-add-header">
          <div className="quick-add-header-left">
            <span className="quick-add-header-icon">+</span>
            <h2 id="quick-add-title" className="quick-add-header-title">
              Quick Add
            </h2>
          </div>
          <button
            className="quick-add-close"
            onClick={handleClose}
            aria-label="Close"
            tabIndex={0}
          >
            &times;
          </button>
        </div>

        {/* ====== SEPARATOR ====== */}
        <div className="quick-add-separator" />

        {/* ====== BODY ====== */}
        <div className="quick-add-body">
          {/* URL Input */}
          <div
            className={`quick-add-input-wrapper ${
              state.isValidUrl
                ? 'quick-add-input-wrapper--valid'
                : state.url.length > 0 && state.status !== 'typing'
                ? 'quick-add-input-wrapper--invalid'
                : ''
            }`}
          >
            <input
              ref={inputRef}
              type="url"
              className="quick-add-input"
              value={state.url}
              onChange={handleInputChange}
              placeholder="Paste URL here..."
              disabled={isSubmitting || isSuccess}
              autoComplete="off"
              spellCheck={false}
              aria-label="URL to import"
            />

            {/* Right side icon */}
            <div className="quick-add-input-icon">
              {state.isValidUrl ? (
                <span className="quick-add-input-check" aria-label="Valid URL">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="#27AE60"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path
                      d="M9 12l2 2 4-4"
                      stroke="white"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              ) : state.url.length === 0 ? (
                <button
                  className="quick-add-paste-button"
                  onClick={pasteFromClipboard}
                  title="Paste from clipboard"
                  aria-label="Paste from clipboard"
                  tabIndex={0}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  </svg>
                </button>
              ) : null}
            </div>
          </div>

          {/* Preview Card */}
          {showPreview && state.metadata && (
            <QuickAddPreviewCard
              metadata={state.metadata}
              classification={state.classification}
              isClassifying={state.status === 'importing' && !state.classification}
            />
          )}

          {/* Error State */}
          {state.status === 'error' && state.error && (
            <div className="quick-add-error">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="#E74C3C"
              >
                <circle cx="12" cy="12" r="10" />
                <path
                  d="M15 9l-6 6M9 9l6 6"
                  stroke="white"
                  strokeWidth="2"
                />
              </svg>
              <span>{state.error}</span>
            </div>
          )}
        </div>

        {/* ====== FOOTER ====== */}
        <div className="quick-add-footer">
          <div className="quick-add-footer-left">
            <button
              className="quick-add-batch-link"
              onClick={handleBatchClick}
              tabIndex={0}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              <span>Batch import</span>
            </button>
          </div>

          <div className="quick-add-footer-right">
            <button
              className={`quick-add-submit ${
                isSuccess ? 'quick-add-submit--success' : ''
              }`}
              onClick={handleSubmit}
              disabled={!canSubmit}
              tabIndex={0}
            >
              {isSubmitting && (
                <span className="quick-add-submit-spinner" />
              )}
              {buttonLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickAddModal;
