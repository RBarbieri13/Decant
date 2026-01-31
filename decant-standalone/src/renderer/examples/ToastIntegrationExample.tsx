// ============================================================
// Toast Integration Example
// Demonstrates all toast notification patterns in Decant
// ============================================================

import React from 'react';
import { useToast } from '../context/ToastContext';
import {
  showImportSuccess,
  showImportError,
  showNodeSaved,
  showNodeDeleted,
  showSettingsSaved,
  showApiKeyConfigured,
  showEnrichmentComplete,
  showEnrichmentFailed,
  showConnectionError,
  showExportSuccess,
  showImportDataSuccess,
  showGenericError,
  showNetworkOffline,
  showNetworkOnline,
  showValidationError,
  showCopySuccess,
} from '../utils/toasts';

/**
 * Example component showing all toast notification types
 * Used for testing and documentation
 */
export function ToastIntegrationExample(): React.ReactElement {
  const toast = useToast();

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}>
      <h1>Toast Notification Examples</h1>
      <p>Click the buttons below to see different toast notifications:</p>

      <section>
        <h2>Import Operations</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="gum-button gum-button--green"
            onClick={() => showImportSuccess(toast, 'React Component Library', () => console.log('View clicked'))}
          >
            Import Success
          </button>
          <button
            className="gum-button"
            onClick={() => showImportError(toast, new Error('Network timeout'), () => console.log('Retry clicked'))}
          >
            Import Error
          </button>
        </div>
      </section>

      <section>
        <h2>Node Operations</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="gum-button gum-button--green"
            onClick={() => showNodeSaved(toast, 'My Note')}
          >
            Node Saved
          </button>
          <button
            className="gum-button"
            onClick={() => showNodeDeleted(toast, 'Old Document', () => console.log('Undo clicked'))}
          >
            Node Deleted (with Undo)
          </button>
        </div>
      </section>

      <section>
        <h2>Settings Operations</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="gum-button gum-button--green"
            onClick={() => showSettingsSaved(toast)}
          >
            Settings Saved
          </button>
          <button
            className="gum-button gum-button--green"
            onClick={() => showApiKeyConfigured(toast)}
          >
            API Key Configured
          </button>
        </div>
      </section>

      <section>
        <h2>Enrichment (Phase 2)</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="gum-button gum-button--green"
            onClick={() => showEnrichmentComplete(toast, 'Web Article', () => console.log('View clicked'))}
          >
            Enrichment Complete
          </button>
          <button
            className="gum-button"
            onClick={() => showEnrichmentFailed(toast, 'API Documentation', 'Rate limit exceeded')}
          >
            Enrichment Failed
          </button>
        </div>
      </section>

      <section>
        <h2>Data Operations</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="gum-button gum-button--blue"
            onClick={() => showExportSuccess(toast, 42)}
          >
            Export Success
          </button>
          <button
            className="gum-button gum-button--pink"
            onClick={() => showImportDataSuccess(toast, 15)}
          >
            Import Data Success
          </button>
          <button
            className="gum-button gum-button--green"
            onClick={() => showCopySuccess(toast, 'Text copied')}
          >
            Copy Success
          </button>
        </div>
      </section>

      <section>
        <h2>Error States</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="gum-button"
            onClick={() => showConnectionError(toast, () => console.log('Retry clicked'))}
          >
            Connection Error
          </button>
          <button
            className="gum-button"
            onClick={() => showGenericError(toast, 'Something went wrong')}
          >
            Generic Error
          </button>
          <button
            className="gum-button"
            onClick={() => showValidationError(toast, 'Email')}
          >
            Validation Error
          </button>
        </div>
      </section>

      <section>
        <h2>Network Status</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="gum-button"
            onClick={() => showNetworkOffline(toast)}
          >
            Network Offline
          </button>
          <button
            className="gum-button gum-button--green"
            onClick={() => showNetworkOnline(toast)}
          >
            Network Online
          </button>
        </div>
      </section>

      <section>
        <h2>Toast Context Methods</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="gum-button gum-button--green"
            onClick={() => toast.showSuccess('Success!', 'Operation completed successfully')}
          >
            Success Toast
          </button>
          <button
            className="gum-button"
            onClick={() => toast.showError('Error!', 'Something went wrong', { label: 'Retry', onClick: () => console.log('Retry') })}
          >
            Error Toast
          </button>
          <button
            className="gum-button"
            onClick={() => toast.showWarning('Warning!', 'Please check your input')}
          >
            Warning Toast
          </button>
          <button
            className="gum-button"
            onClick={() => toast.showInfo('Info', 'Did you know?')}
          >
            Info Toast
          </button>
          <button
            className="gum-button"
            onClick={() => toast.dismissAll()}
          >
            Dismiss All
          </button>
        </div>
      </section>

      <section>
        <h2>Multiple Toasts</h2>
        <button
          className="gum-button gum-button--pink"
          onClick={() => {
            toast.showSuccess('First', 'This is the first toast');
            setTimeout(() => toast.showInfo('Second', 'This is the second toast'), 500);
            setTimeout(() => toast.showWarning('Third', 'This is the third toast'), 1000);
          }}
        >
          Show Multiple Toasts
        </button>
      </section>

      <section>
        <h2>Real-World Scenarios</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="gum-button gum-button--green"
            onClick={() => {
              // Simulate import workflow
              toast.showInfo('Import Started', 'Importing URL...');
              setTimeout(() => {
                showImportSuccess(toast, 'Tutorial: React Hooks', () => console.log('View'));
                setTimeout(() => {
                  showEnrichmentComplete(toast, 'Tutorial: React Hooks', () => console.log('View enriched'));
                }, 3000);
              }, 2000);
            }}
          >
            Simulate Import Workflow
          </button>
          <button
            className="gum-button gum-button--blue"
            onClick={() => {
              // Simulate settings save
              toast.showInfo('Saving Settings', 'Updating configuration...');
              setTimeout(() => {
                showSettingsSaved(toast, 'Theme changed to dark mode');
              }, 1000);
            }}
          >
            Simulate Settings Save
          </button>
        </div>
      </section>

      <style>{`
        section {
          padding: 16px;
          border: 1px solid var(--gum-gray-200, #e7e5e4);
          border-radius: 8px;
          background: var(--gum-gray-50, #fafaf9);
        }

        section h2 {
          margin-top: 0;
          margin-bottom: 12px;
          font-size: 16px;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

/**
 * Integration Guide
 *
 * 1. BASIC USAGE
 *    Import the useToast hook and toast utility functions:
 *    ```tsx
 *    import { useToast } from '../context/ToastContext';
 *    import { showImportSuccess, showImportError } from '../utils/toasts';
 *    ```
 *
 * 2. IN YOUR COMPONENT
 *    Get the toast context:
 *    ```tsx
 *    const toast = useToast();
 *    ```
 *
 * 3. SHOW TOASTS
 *    Use utility functions for common patterns:
 *    ```tsx
 *    showImportSuccess(toast, 'Article Title', () => viewNode());
 *    showImportError(toast, error, () => retryImport());
 *    ```
 *
 *    Or use toast methods directly:
 *    ```tsx
 *    toast.showSuccess('Success!', 'Operation completed');
 *    toast.showError('Error!', 'Something went wrong', {
 *      label: 'Retry',
 *      onClick: () => retry()
 *    });
 *    ```
 *
 * 4. SSE INTEGRATION
 *    Connect to server-sent events for real-time updates:
 *    ```tsx
 *    useEffect(() => {
 *      const sseClient = createIntegratedSSEClient(
 *        (nodeId) => refreshNode(nodeId),
 *        (event) => {
 *          if (event.success) {
 *            showEnrichmentComplete(toast, nodeTitle);
 *          } else {
 *            showEnrichmentFailed(toast, nodeTitle, event.errorMessage);
 *          }
 *        }
 *      );
 *      return () => sseClient.disconnect();
 *    }, []);
 *    ```
 *
 * 5. TOAST POSITIONING
 *    Configured in App.tsx:
 *    ```tsx
 *    <ToastContainer
 *      toasts={toasts}
 *      position="bottom-right"
 *      maxToasts={5}
 *    />
 *    ```
 *
 * 6. CUSTOMIZATION
 *    All toasts support:
 *    - Custom durations (in milliseconds)
 *    - Action buttons (with onClick handlers)
 *    - Auto-dismiss
 *    - Manual dismiss
 *    - Progress indicators
 */
