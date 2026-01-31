// ============================================================
// Notification Integration Example
// Shows how to integrate notifications with existing AppContext
// ============================================================

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../hooks/useToast';
import { ErrorModal, ErrorDetails } from '../components/dialogs/ErrorModal';

/**
 * Example: Import Dialog with Notifications
 *
 * Shows how to integrate toast notifications and error modals
 * with the existing import functionality.
 */
export function ImportWithNotifications(): React.ReactElement {
  const { actions, state } = useApp();
  const { showSuccess, showError, showInfo, dismissToast } = useToast();
  const [errorModal, setErrorModal] = useState<ErrorDetails | null>(null);
  const [importUrl, setImportUrl] = useState('');

  const handleImport = async () => {
    if (!importUrl.trim()) {
      showError('Invalid URL', 'Please enter a valid URL');
      return;
    }

    const importId = `import-${Date.now()}`;

    // Show progress toast
    const progressToastId = showInfo(
      'Importing...',
      'Fetching content from URL',
      0 // No auto-dismiss
    );

    try {
      const result = await actions.importUrl(importUrl, importId);

      // Dismiss progress toast
      dismissToast(progressToastId);

      if (result.success) {
        // Show success toast
        showSuccess(
          'Import Successful',
          'Content has been imported and classified',
          5000
        );

        // Show Phase 2 info if queued
        if (result.phase2?.queued) {
          showInfo(
            'Enrichment Queued',
            'Advanced metadata will be added in the background',
            8000
          );
        }

        // Clear input
        setImportUrl('');
      } else {
        // Show error toast with retry option
        showError(
          'Import Failed',
          result.error || 'Unknown error occurred',
          {
            label: 'Retry',
            onClick: () => handleImport()
          },
          10000
        );
      }
    } catch (error: any) {
      // Dismiss progress toast
      dismissToast(progressToastId);

      // For critical errors, show error modal
      setErrorModal({
        title: 'Import Error',
        message: 'An unexpected error occurred during import',
        error: error,
        stackTrace: error.stack,
        context: {
          url: importUrl,
          timestamp: new Date().toISOString(),
          importId
        },
        retryable: true,
        onRetry: async () => {
          setErrorModal(null);
          await handleImport();
        }
      });
    }
  };

  return (
    <>
      <div style={{ padding: '24px' }}>
        <h2>Import URL</h2>
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <input
            type="text"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            placeholder="Enter URL to import..."
            style={{
              flex: 1,
              padding: '10px',
              border: '1px solid #d6d3d1',
              borderRadius: '6px'
            }}
          />
          <button
            onClick={handleImport}
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
            Import
          </button>
        </div>

        {/* Show pending enrichments */}
        {state.pendingEnrichments.size > 0 && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#eff6ff',
            border: '1px solid #93c5fd',
            borderRadius: '6px'
          }}>
            <strong>Pending Enrichments: {state.pendingEnrichments.size}</strong>
            <p style={{ fontSize: '14px', marginTop: '4px' }}>
              Advanced metadata is being processed in the background
            </p>
          </div>
        )}
      </div>

      <ErrorModal
        isOpen={!!errorModal}
        error={errorModal}
        onClose={() => setErrorModal(null)}
      />
    </>
  );
}

/**
 * Example: Node Update with Notifications
 *
 * Shows how to handle node updates with proper error handling
 */
export function NodeUpdateWithNotifications(): React.ReactElement {
  const { actions, state } = useApp();
  const { showSuccess, showError, showWarning } = useToast();
  const [errorModal, setErrorModal] = useState<ErrorDetails | null>(null);

  const handleUpdateNode = async (nodeId: string, data: any) => {
    try {
      // Validate before update
      if (!data.title?.trim()) {
        showWarning('Validation Error', 'Title cannot be empty');
        return;
      }

      await actions.updateNode(nodeId, data);
      showSuccess('Updated', 'Node has been updated successfully');
    } catch (error: any) {
      // Check error type
      if (error.code === 'VALIDATION_ERROR') {
        showError('Invalid Data', error.message, undefined, 8000);
      } else if (error.code === 'NETWORK_ERROR') {
        showError(
          'Network Error',
          'Failed to save changes. Please check your connection.',
          {
            label: 'Retry',
            onClick: () => handleUpdateNode(nodeId, data)
          }
        );
      } else {
        // Show error modal for unexpected errors
        setErrorModal({
          title: 'Update Failed',
          message: 'An unexpected error occurred while updating the node',
          error: error,
          stackTrace: error.stack,
          context: {
            nodeId,
            operation: 'update',
            data
          },
          retryable: true,
          onRetry: async () => {
            setErrorModal(null);
            await handleUpdateNode(nodeId, data);
          }
        });
      }
    }
  };

  return (
    <>
      <div style={{ padding: '24px' }}>
        <h2>Update Node</h2>
        {state.selectedNode ? (
          <div>
            <p>Selected: {state.selectedNode.title}</p>
            <button
              onClick={() => handleUpdateNode(state.selectedNode.id, {
                ...state.selectedNode,
                title: 'Updated Title'
              })}
              style={{
                marginTop: '12px',
                padding: '10px 20px',
                backgroundColor: '#2d5b47',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Update Node
            </button>
          </div>
        ) : (
          <p>No node selected</p>
        )}
      </div>

      <ErrorModal
        isOpen={!!errorModal}
        error={errorModal}
        onClose={() => setErrorModal(null)}
      />
    </>
  );
}

/**
 * Example: Merge with Notifications
 *
 * Shows how to handle merge operations with notifications
 */
export function MergeWithNotifications(): React.ReactElement {
  const { actions, state } = useApp();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const [errorModal, setErrorModal] = useState<ErrorDetails | null>(null);

  const handleMerge = async (primaryId: string, secondaryId: string) => {
    // Show warning for confirmation
    showWarning(
      'Merge Confirmation',
      'This action cannot be undone. Please confirm in the dialog.',
      8000
    );

    try {
      await actions.mergeNodes(primaryId, secondaryId, {
        keepMetadata: true,
        appendSummary: true
      });

      showSuccess(
        'Merge Complete',
        'Nodes have been successfully merged',
        5000
      );
    } catch (error: any) {
      setErrorModal({
        title: 'Merge Failed',
        message: 'An error occurred while merging the nodes',
        error: error,
        stackTrace: error.stack,
        context: {
          primaryId,
          secondaryId,
          operation: 'merge'
        },
        retryable: true,
        onRetry: async () => {
          setErrorModal(null);
          await handleMerge(primaryId, secondaryId);
        }
      });
    }
  };

  return (
    <>
      <div style={{ padding: '24px' }}>
        <h2>Merge Nodes</h2>
        <p style={{ marginTop: '8px', color: '#57534e' }}>
          Select two nodes and merge them together
        </p>
      </div>

      <ErrorModal
        isOpen={!!errorModal}
        error={errorModal}
        onClose={() => setErrorModal(null)}
      />
    </>
  );
}

/**
 * Example: Search with Notifications
 *
 * Shows how to handle search with proper feedback
 */
export function SearchWithNotifications(): React.ReactElement {
  const { actions } = useApp();
  const { showSuccess, showError, showInfo } = useToast();
  const [query, setQuery] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) {
      showError('Invalid Query', 'Please enter a search term');
      return;
    }

    try {
      const results = await actions.search(query);

      if (results.length === 0) {
        showInfo('No Results', `No items found for "${query}"`);
      } else {
        showSuccess(
          'Search Complete',
          `Found ${results.length} result${results.length === 1 ? '' : 's'}`,
          3000
        );
      }
    } catch (error: any) {
      showError(
        'Search Failed',
        error.message || 'An error occurred while searching',
        {
          label: 'Retry',
          onClick: () => handleSearch()
        }
      );
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <h2>Search</h2>
      <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          style={{
            flex: 1,
            padding: '10px',
            border: '1px solid #d6d3d1',
            borderRadius: '6px'
          }}
        />
        <button
          onClick={handleSearch}
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
          Search
        </button>
      </div>
    </div>
  );
}

/**
 * Complete Integration Example
 *
 * Shows all notification types in a single component
 */
export function CompleteNotificationExample(): React.ReactElement {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ padding: '24px 24px 0' }}>Notification Integration Examples</h1>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '24px',
        padding: '24px'
      }}>
        <div style={{
          border: '1px solid #e7e5e4',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <ImportWithNotifications />
        </div>

        <div style={{
          border: '1px solid #e7e5e4',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <NodeUpdateWithNotifications />
        </div>

        <div style={{
          border: '1px solid #e7e5e4',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <SearchWithNotifications />
        </div>

        <div style={{
          border: '1px solid #e7e5e4',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <MergeWithNotifications />
        </div>
      </div>
    </div>
  );
}
