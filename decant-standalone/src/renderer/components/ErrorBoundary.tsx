// ============================================================
// Error Boundary - Catches React rendering errors
// ============================================================

import React, { Component, ErrorInfo, ReactNode } from 'react';
import './ErrorBoundary.css';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 *
 * Catches errors anywhere in the React component tree and displays a fallback UI.
 * Logs errors to the backend and provides options to reload or go home.
 *
 * @example
 * <ErrorBoundary onError={(error, info) => logErrorToBackend(error, info)}>
 *   <App />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to backend or external service
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to backend
    this.logErrorToBackend(error, errorInfo);
  }

  private async logErrorToBackend(error: Error, errorInfo: ErrorInfo): Promise<void> {
    try {
      // In a real implementation, this would send to your backend
      const errorData = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      console.log('Error logged:', errorData);
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorData),
      // });
    } catch (err) {
      console.error('Failed to log error to backend:', err);
    }
  }

  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleGoHome = (): void => {
    window.location.href = '/';
  };

  private handleCopyError = async (): Promise<void> => {
    const { error, errorInfo } = this.state;
    if (!error) return;

    const errorText = [
      `Error: ${error.message}`,
      `\nStack Trace:`,
      error.stack,
      `\nComponent Stack:`,
      errorInfo?.componentStack,
    ].filter(Boolean).join('\n');

    try {
      await navigator.clipboard.writeText(errorText);
      alert('Error details copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy error:', err);
    }
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback(error, errorInfo!, this.handleReset);
      }

      // Default fallback UI
      return (
        <div className="decant-error-boundary">
          <div className="decant-error-boundary__container">
            <div className="decant-error-boundary__icon">
              <i className="bx bx-error-circle" />
            </div>
            <h1 className="decant-error-boundary__title">Something went wrong</h1>
            <p className="decant-error-boundary__message">
              We encountered an unexpected error. The error has been logged and we'll look into it.
            </p>

            {/* Error details (collapsible) */}
            <details className="decant-error-boundary__details">
              <summary className="decant-error-boundary__details-summary">
                View error details
              </summary>
              <div className="decant-error-boundary__details-content">
                <div className="decant-error-boundary__error-info">
                  <strong>Error:</strong> {error.message}
                </div>
                {error.stack && (
                  <div className="decant-error-boundary__stack">
                    <strong>Stack Trace:</strong>
                    <pre>{error.stack}</pre>
                  </div>
                )}
                {errorInfo?.componentStack && (
                  <div className="decant-error-boundary__stack">
                    <strong>Component Stack:</strong>
                    <pre>{errorInfo.componentStack}</pre>
                  </div>
                )}
              </div>
            </details>

            {/* Action buttons */}
            <div className="decant-error-boundary__actions">
              <button
                className="decant-error-boundary__button decant-error-boundary__button--primary"
                onClick={this.handleReload}
                type="button"
              >
                <i className="bx bx-refresh" />
                Reload Page
              </button>
              <button
                className="decant-error-boundary__button"
                onClick={this.handleGoHome}
                type="button"
              >
                <i className="bx bx-home" />
                Go Home
              </button>
              <button
                className="decant-error-boundary__button"
                onClick={this.handleCopyError}
                type="button"
              >
                <i className="bx bx-copy" />
                Copy Error
              </button>
            </div>

            {/* Debug info */}
            <div className="decant-error-boundary__debug">
              <p>
                If this problem persists, please contact support with the error details.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}
