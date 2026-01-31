// ============================================================
// Notification Demo - Example usage of all notification components
// ============================================================

import React, { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { ErrorModal, ErrorDetails } from '../dialogs/ErrorModal';
import { FailedJobsPanel } from '../admin/FailedJobsPanel';

/**
 * Notification Demo Component
 *
 * Demonstrates all notification types and error handling components.
 * Use this as a reference for implementing notifications in your app.
 */
export function NotificationDemo(): React.ReactElement {
  const { showSuccess, showError, showWarning, showInfo, showToast, dismissAll } = useToast();
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [showFailedJobs, setShowFailedJobs] = useState(false);

  // Toast Examples
  const handleShowSuccess = () => {
    showSuccess('Success!', 'Your changes have been saved successfully');
  };

  const handleShowError = () => {
    showError(
      'Error Occurred',
      'Failed to save changes. Please try again.',
      {
        label: 'Retry',
        onClick: () => {
          console.log('Retrying...');
          setTimeout(() => showSuccess('Retry Successful'), 1000);
        }
      }
    );
  };

  const handleShowWarning = () => {
    showWarning('Warning', 'You have unsaved changes. Please save before leaving.');
  };

  const handleShowInfo = () => {
    showInfo('Information', 'New features are available in this version!');
  };

  const handleShowCustomToast = () => {
    showToast({
      type: 'info',
      title: 'Custom Toast',
      message: 'This toast has a custom duration of 10 seconds',
      duration: 10000,
      action: {
        label: 'Learn More',
        onClick: () => window.open('https://docs.example.com', '_blank')
      }
    });
  };

  const handleShowNoAutoDismiss = () => {
    showToast({
      type: 'warning',
      title: 'Manual Dismiss',
      message: 'This toast will not auto-dismiss. Click X to close.',
      duration: 0
    });
  };

  // Error Modal Examples
  const handleShowSimpleError = () => {
    setErrorDetails({
      title: 'Simple Error',
      message: 'Something went wrong with your request.',
      error: new Error('Request failed'),
      retryable: false
    });
    setErrorModalOpen(true);
  };

  const handleShowRetryableError = () => {
    setErrorDetails({
      title: 'Network Error',
      message: 'Failed to connect to the server. Please check your internet connection.',
      error: new Error('ECONNREFUSED'),
      stackTrace: 'Error: ECONNREFUSED\n    at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1146:16)',
      context: {
        url: 'https://api.example.com/data',
        method: 'POST',
        timestamp: new Date().toISOString()
      },
      retryable: true,
      onRetry: async () => {
        console.log('Retrying request...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        showSuccess('Retry Successful', 'Request completed successfully');
        setErrorModalOpen(false);
      }
    });
    setErrorModalOpen(true);
  };

  const handleShowComplexError = () => {
    const error = new Error('Failed to process data');
    error.stack = `Error: Failed to process data
    at processData (processor.ts:42:15)
    at async importHandler (import.ts:128:7)
    at async handleImport (ImportDialog.tsx:89:5)`;

    setErrorDetails({
      title: 'Import Processing Error',
      message: 'An error occurred while processing the imported data. The file may be corrupted or in an unsupported format.',
      error,
      stackTrace: error.stack,
      context: {
        fileName: 'data.json',
        fileSize: '2.4 MB',
        importedRows: 1543,
        failedRow: 1544,
        errorCode: 'PARSE_ERROR'
      },
      retryable: true,
      onRetry: async () => {
        console.log('Retrying with validation...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        showSuccess('Import Complete', 'Data imported successfully after validation');
        setErrorModalOpen(false);
      }
    });
    setErrorModalOpen(true);
  };

  // Failed Jobs Panel
  const handleRetryJob = async (jobId: string) => {
    console.log('Retrying job:', jobId);
    await new Promise(resolve => setTimeout(resolve, 1500));
  };

  const handleRetrySelected = async (jobIds: string[]) => {
    console.log('Retrying jobs:', jobIds);
    await new Promise(resolve => setTimeout(resolve, 2000));
  };

  const handleClearJob = (jobId: string) => {
    console.log('Clearing job:', jobId);
  };

  const handleClearAll = () => {
    console.log('Clearing all jobs');
  };

  const handleRefresh = async () => {
    console.log('Refreshing jobs');
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  // Simulate Error
  const handleTriggerError = () => {
    throw new Error('This is a test error that will be caught by ErrorBoundary');
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '24px' }}>Notification System Demo</h1>

      {/* Toast Notifications */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ marginBottom: '16px' }}>Toast Notifications</h2>
        <p style={{ marginBottom: '16px', color: '#57534e' }}>
          Non-intrusive notifications that appear in the bottom-right corner.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={handleShowSuccess}
            style={{
              padding: '10px 20px',
              backgroundColor: '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Show Success
          </button>
          <button
            onClick={handleShowError}
            style={{
              padding: '10px 20px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Show Error
          </button>
          <button
            onClick={handleShowWarning}
            style={{
              padding: '10px 20px',
              backgroundColor: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Show Warning
          </button>
          <button
            onClick={handleShowInfo}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Show Info
          </button>
          <button
            onClick={handleShowCustomToast}
            style={{
              padding: '10px 20px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Custom Toast
          </button>
          <button
            onClick={handleShowNoAutoDismiss}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            No Auto-Dismiss
          </button>
          <button
            onClick={dismissAll}
            style={{
              padding: '10px 20px',
              backgroundColor: '#1c1917',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Dismiss All
          </button>
        </div>
      </section>

      {/* Error Modals */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ marginBottom: '16px' }}>Error Modals</h2>
        <p style={{ marginBottom: '16px', color: '#57534e' }}>
          Detailed error dialogs with stack traces and recovery options.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={handleShowSimpleError}
            style={{
              padding: '10px 20px',
              backgroundColor: '#2d5b47',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Simple Error
          </button>
          <button
            onClick={handleShowRetryableError}
            style={{
              padding: '10px 20px',
              backgroundColor: '#2d5b47',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Retryable Error
          </button>
          <button
            onClick={handleShowComplexError}
            style={{
              padding: '10px 20px',
              backgroundColor: '#2d5b47',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Complex Error
          </button>
        </div>
      </section>

      {/* Failed Jobs Panel */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ marginBottom: '16px' }}>Failed Jobs Dashboard</h2>
        <p style={{ marginBottom: '16px', color: '#57534e' }}>
          Admin panel for managing failed enrichment jobs.
        </p>
        <button
          onClick={() => setShowFailedJobs(!showFailedJobs)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2d5b47',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '500',
            marginBottom: '16px'
          }}
        >
          {showFailedJobs ? 'Hide' : 'Show'} Failed Jobs Panel
        </button>
        {showFailedJobs && (
          <div style={{
            border: '1px solid #e7e5e4',
            borderRadius: '8px',
            overflow: 'hidden',
            height: '600px'
          }}>
            <FailedJobsPanel
              onRetryJob={handleRetryJob}
              onRetrySelected={handleRetrySelected}
              onClearJob={handleClearJob}
              onClearAll={handleClearAll}
              onRefresh={handleRefresh}
            />
          </div>
        )}
      </section>

      {/* Error Boundary Test */}
      <section>
        <h2 style={{ marginBottom: '16px' }}>Error Boundary</h2>
        <p style={{ marginBottom: '16px', color: '#57534e' }}>
          Global error catching for React rendering errors. Click the button below to trigger an error.
        </p>
        <button
          onClick={handleTriggerError}
          style={{
            padding: '10px 20px',
            backgroundColor: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '500'
          }}
        >
          Trigger Error (Caught by ErrorBoundary)
        </button>
      </section>

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModalOpen}
        error={errorDetails}
        onClose={() => setErrorModalOpen(false)}
      />
    </div>
  );
}
