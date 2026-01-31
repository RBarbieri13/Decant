// ============================================================
// App Shell - Main Three-Panel Layout
// ============================================================

import React, { useCallback, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { SpacesPanel } from './SpacesPanel';
import { TreePanel } from './TreePanel';
import { DetailPanel } from './DetailPanel';
import { ImportDialog } from '../import/ImportDialog';
import { BatchImportModal } from '../import/BatchImportModal';
import { SearchBar } from '../search/SearchBar';
import { SettingsDialog } from '../settings/SettingsDialog';
import { MergeDialog } from '../dialogs/MergeDialog';
import { createIntegratedSSEClient } from '../../services/realtimeService';
import { showEnrichmentComplete, showEnrichmentFailed } from '../../utils/toasts';
import type { SearchResult } from '../../../shared/types';

export function AppShell(): React.ReactElement {
  const { state, actions } = useApp();
  const toast = useToast();
  const { treeLoading, error, currentView, mergeDialogOpen, mergeSourceNodeId, selectedNode, settingsDialogOpen, batchImportDialogOpen } = state;

  // Get primary node for merge dialog
  const mergePrimaryNode = useMemo(() => {
    if (!mergeSourceNodeId || !selectedNode) return null;
    return mergeSourceNodeId === selectedNode.id ? selectedNode : null;
  }, [mergeSourceNodeId, selectedNode]);

  // Handle search result selection
  const handleSearchSelect = useCallback(
    (result: SearchResult) => {
      actions.selectNode(result.node.id);
    },
    [actions]
  );

  // Initialize SSE client for real-time enrichment updates
  useEffect(() => {
    const sseClient = createIntegratedSSEClient(
      // On node refresh (enrichment complete)
      (nodeId: string) => {
        // Refresh the node if it's currently selected
        if (state.selectedNodeId === nodeId) {
          actions.selectNode(nodeId);
        }
        actions.refreshTree();
      },
      // On enrichment complete event (for toasts)
      (event) => {
        if (event.success) {
          // Get node title from state if available
          const nodeTitle = state.selectedNode?.title || 'Node';
          showEnrichmentComplete(toast, nodeTitle, () => {
            actions.selectNode(event.nodeId);
          });
        } else {
          showEnrichmentFailed(toast, 'Node', event.errorMessage);
        }
        // Mark enrichment as complete in app state
        actions.enrichmentComplete(event.nodeId);
      },
      // On connection state change
      (connectionState) => {
        console.log('SSE connection state:', connectionState);
      }
    );

    // Cleanup on unmount
    return () => {
      sseClient.disconnect();
    };
  }, [state.selectedNodeId, state.selectedNode, actions, toast]);

  // Loading state
  if (treeLoading) {
    return (
      <div className="app-loading">
        <div className="loading-content">
          <h1>Decant</h1>
          <p className="text-muted">Initializing...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="app-error">
        <div className="error-content gum-card">
          <h2>Error</h2>
          <p>{error}</p>
          <button
            className="gum-button gum-button--pink"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">Decant</h1>
        </div>
        <div className="header-center">
          <button
            className={`view-toggle gum-button gum-button--small ${
              currentView === 'function' ? 'gum-button--pink' : ''
            }`}
            onClick={() =>
              currentView !== 'function' && actions.toggleView()
            }
          >
            Function
          </button>
          <button
            className={`view-toggle gum-button gum-button--small ${
              currentView === 'organization' ? 'gum-button--blue' : ''
            }`}
            onClick={() =>
              currentView !== 'organization' && actions.toggleView()
            }
          >
            Organization
          </button>
        </div>
        <div className="header-right">
          <SearchBar onSelectResult={handleSearchSelect} />
          <button
            className="gum-button gum-button--small gum-button--green"
            onClick={actions.openImportDialog}
            title="Import URL (Cmd+N)"
          >
            + Import
          </button>
          <button
            className="gum-button gum-button--small gum-button--blue"
            onClick={actions.openBatchImportDialog}
            title="Batch Import URLs"
          >
            Batch
          </button>
          <button
            className="gum-button gum-button--small settings-btn"
            onClick={actions.openSettingsDialog}
            title="Settings (Cmd+,)"
          >
            &#9881;
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        <SpacesPanel />
        <TreePanel />
        <DetailPanel />
      </main>

      {/* Import Dialog */}
      <ImportDialog />

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={settingsDialogOpen}
        onClose={actions.closeSettingsDialog}
      />

      {/* Merge Dialog */}
      <MergeDialog
        isOpen={mergeDialogOpen}
        primaryNode={mergePrimaryNode}
        onClose={actions.closeMergeDialog}
        onMerge={actions.mergeNodes}
      />

      {/* Batch Import Modal */}
      <BatchImportModal
        isOpen={batchImportDialogOpen}
        onClose={actions.closeBatchImportDialog}
        onImportComplete={(nodeIds) => {
          // Refresh tree after batch import
          actions.refreshTree();
          // Optionally select the first imported node
          if (nodeIds.length > 0) {
            actions.selectNode(nodeIds[0]);
          }
        }}
      />

      <style>{`
        .app-loading,
        .app-error {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .loading-content,
        .error-content {
          text-align: center;
        }

        .loading-content h1 {
          font-size: var(--font-size-xxl);
          margin-bottom: var(--space-md);
        }

        .error-content {
          padding: var(--space-xl);
        }

        .error-content h2 {
          margin-bottom: var(--space-md);
          color: #cc0000;
        }

        .app-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: var(--gum-bg);
        }

        .app-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-md);
          background: var(--gum-white);
          border-bottom: var(--border-width) solid var(--gum-black);
          flex-shrink: 0;
        }

        .app-title {
          font-size: var(--font-size-xl);
          margin: 0;
          font-weight: var(--font-weight-bold);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: var(--space-md);
        }

        .header-center {
          display: flex;
          gap: var(--space-sm);
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
        }

        .search-input {
          width: 250px;
        }

        .app-main {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        /* Panel base styles */
        .panel {
          display: flex;
          flex-direction: column;
          background: var(--gum-white);
          border-right: var(--border-width) solid var(--gum-black);
          overflow: hidden;
        }

        .panel:last-child {
          border-right: none;
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-sm) var(--space-md);
          background: var(--gum-gray-100);
          border-bottom: var(--border-width) solid var(--gum-black);
          font-weight: var(--font-weight-bold);
          font-size: var(--font-size-sm);
          flex-shrink: 0;
        }

        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-md);
        }

        /* Scrollbar styling */
        .panel-content::-webkit-scrollbar {
          width: 8px;
        }

        .panel-content::-webkit-scrollbar-track {
          background: var(--gum-gray-100);
        }

        .panel-content::-webkit-scrollbar-thumb {
          background: var(--gum-gray-300);
          border-radius: 4px;
        }

        .panel-content::-webkit-scrollbar-thumb:hover {
          background: var(--gum-gray-600);
        }

        /* Keyboard shortcut hint */
        .keyboard-hint {
          font-size: var(--font-size-xs);
          color: var(--gum-gray-600);
          background: var(--gum-gray-100);
          padding: 2px 6px;
          border-radius: 3px;
          margin-left: var(--space-xs);
        }

        /* Settings button */
        .settings-btn {
          font-size: 16px;
          padding: var(--space-xs) var(--space-sm);
        }
      `}</style>
    </div>
  );
}
