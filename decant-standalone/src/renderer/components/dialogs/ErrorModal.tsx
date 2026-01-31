// ============================================================
// Error Modal - Detailed error display with recovery options
// ============================================================

import React, { useState } from 'react';
import './ErrorModal.css';

export interface ErrorDetails {
  title: string;
  message: string;
  error?: Error;
  stackTrace?: string;
  context?: Record<string, any>;
  retryable?: boolean;
  onRetry?: () => void | Promise<void>;
}

export interface ErrorModalProps {
  isOpen: boolean;
  error: ErrorDetails | null;
  onClose: () => void;
}

/**
 * Error Modal Component
 *
 * Displays detailed error information with options to retry, report, or copy details.
 * Stack traces are collapsible and can be copied to clipboard.
 *
 * @example
 * <ErrorModal
 *   isOpen={hasError}
 *   error={{
 *     title: 'Import Failed',
 *     message: 'Failed to fetch content from URL',
 *     error: new Error('Network timeout'),
 *     retryable: true,
 *     onRetry: () => retryImport()
 *   }}
 *   onClose={() => setHasError(false)}
 * />
 */
export function ErrorModal({ isOpen, error, onClose }: ErrorModalProps): React.ReactElement | null {
  const [showStackTrace, setShowStackTrace] = useState(false);
  const [copying, setCopying] = useState(false);
  const [retrying, setRetrying] = useState(false);

  if (!isOpen || !error) {
    return null;
  }

  const handleCopyDetails = async () => {
    const details = [
      `Error: ${error.title}`,
      `Message: ${error.message}`,
      error.error ? `Type: ${error.error.name}` : '',
      error.stackTrace ? `\nStack Trace:\n${error.stackTrace}` : '',
      error.context ? `\nContext:\n${JSON.stringify(error.context, null, 2)}` : '',
    ].filter(Boolean).join('\n');

    try {
      await navigator.clipboard.writeText(details);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleRetry = async () => {
    if (error.onRetry) {
      setRetrying(true);
      try {
        await error.onRetry();
        onClose();
      } catch (err) {
        console.error('Retry failed:', err);
      } finally {
        setRetrying(false);
      }
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleReportIssue = () => {
    const issueBody = encodeURIComponent(
      `**Error Title:** ${error.title}\n\n` +
      `**Message:** ${error.message}\n\n` +
      `**Error Type:** ${error.error?.name || 'Unknown'}\n\n` +
      `**Stack Trace:**\n\`\`\`\n${error.stackTrace || 'N/A'}\n\`\`\`\n\n` +
      `**Context:**\n\`\`\`json\n${JSON.stringify(error.context, null, 2) || 'N/A'}\n\`\`\``
    );
    const issueUrl = `https://github.com/your-repo/decant/issues/new?title=${encodeURIComponent(error.title)}&body=${issueBody}`;
    window.open(issueUrl, '_blank');
  };

  return (
    <div className="decant-modal-backdrop" onClick={handleBackdropClick}>
      <div className="decant-error-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="decant-error-modal__header">
          <div className="decant-error-modal__icon decant-error-modal__icon--error">
            <i className="bx bx-error-circle" />
          </div>
          <h2 className="decant-error-modal__title">{error.title}</h2>
          <button
            className="decant-error-modal__close"
            onClick={onClose}
            aria-label="Close error dialog"
            type="button"
          >
            <i className="bx bx-x" />
          </button>
        </div>

        {/* Content */}
        <div className="decant-error-modal__content">
          <p className="decant-error-modal__message">{error.message}</p>

          {/* Error details */}
          {error.error && (
            <div className="decant-error-modal__detail">
              <strong>Error Type:</strong> {error.error.name}
            </div>
          )}

          {/* Context information */}
          {error.context && Object.keys(error.context).length > 0 && (
            <div className="decant-error-modal__section">
              <div className="decant-error-modal__section-title">Additional Information</div>
              <div className="decant-error-modal__context">
                {Object.entries(error.context).map(([key, value]) => (
                  <div key={key} className="decant-error-modal__context-item">
                    <span className="decant-error-modal__context-key">{key}:</span>
                    <span className="decant-error-modal__context-value">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stack trace (collapsible) */}
          {error.stackTrace && (
            <div className="decant-error-modal__section">
              <button
                className="decant-error-modal__section-toggle"
                onClick={() => setShowStackTrace(!showStackTrace)}
                type="button"
              >
                <i className={`bx ${showStackTrace ? 'bx-chevron-down' : 'bx-chevron-right'}`} />
                Stack Trace
              </button>
              {showStackTrace && (
                <pre className="decant-error-modal__stack-trace">
                  {error.stackTrace}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="decant-error-modal__footer">
          <div className="decant-error-modal__actions">
            {error.retryable && error.onRetry && (
              <button
                className="decant-error-modal__button decant-error-modal__button--primary"
                onClick={handleRetry}
                disabled={retrying}
                type="button"
              >
                <i className={`bx ${retrying ? 'bx-loader-alt bx-spin' : 'bx-refresh'}`} />
                {retrying ? 'Retrying...' : 'Retry'}
              </button>
            )}
            <button
              className="decant-error-modal__button"
              onClick={handleCopyDetails}
              type="button"
            >
              <i className={`bx ${copying ? 'bx-check' : 'bx-copy'}`} />
              {copying ? 'Copied!' : 'Copy Details'}
            </button>
            <button
              className="decant-error-modal__button"
              onClick={handleReportIssue}
              type="button"
            >
              <i className="bx bx-bug" />
              Report Issue
            </button>
          </div>
          <button
            className="decant-error-modal__button"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
