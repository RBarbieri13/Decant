// ============================================================
// Merge Dialog - Merge duplicate items
// ============================================================

import React, { useState, useCallback, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import type { Node } from '../../../shared/types';

interface MergeDialogProps {
  isOpen: boolean;
  primaryNode: Node | null;
  onClose: () => void;
  onMerge: (primaryId: string, secondaryId: string, options: { keepMetadata: boolean; appendSummary: boolean }) => Promise<void>;
}

export function MergeDialog({
  isOpen,
  primaryNode,
  onClose,
  onMerge,
}: MergeDialogProps): React.ReactElement {
  const { state, actions } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [secondaryNodeId, setSecondaryNodeId] = useState<string | null>(null);
  const [keepMetadata, setKeepMetadata] = useState(false);
  const [appendSummary, setAppendSummary] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Find secondary node in search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !primaryNode) return [];
    return state.tree
      .flatMap(flattenTree)
      .filter(
        (node) =>
          node.id !== primaryNode.id &&
          node.nodeType === 'item' &&
          node.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .slice(0, 10);
  }, [searchQuery, primaryNode, state.tree]);

  const secondaryNode = useMemo(() => {
    if (!secondaryNodeId) return null;
    return state.tree
      .flatMap(flattenTree)
      .find((n) => n.id === secondaryNodeId && n.nodeType === 'item');
  }, [secondaryNodeId, state.tree]);

  const handleMerge = useCallback(async () => {
    if (!primaryNode || !secondaryNodeId) return;

    setIsLoading(true);
    setError(null);

    try {
      await onMerge(primaryNode.id, secondaryNodeId, {
        keepMetadata,
        appendSummary,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge items');
    } finally {
      setIsLoading(false);
    }
  }, [primaryNode, secondaryNodeId, keepMetadata, appendSummary, onMerge, onClose]);

  if (!isOpen || !primaryNode) return <></>;

  return (
    <>
      {/* Modal Overlay */}
      <div className="merge-dialog-overlay" onClick={onClose} />

      {/* Modal Content */}
      <div className="merge-dialog">
        <div className="merge-dialog-header">
          <h2 className="merge-dialog-title">Merge Items</h2>
          <button
            className="merge-dialog-close"
            onClick={onClose}
            disabled={isLoading}
          >
            ×
          </button>
        </div>

        <div className="merge-dialog-content">
          {/* Primary Item Section */}
          <div className="merge-section">
            <label className="merge-section-label">Primary Item (keep):</label>
            <div className="merge-item-preview">
              {primaryNode.faviconPath && (
                <img
                  src={`file://${primaryNode.faviconPath}`}
                  alt=""
                  className="merge-item-favicon"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <div className="merge-item-content">
                <div className="merge-item-title">{primaryNode.title}</div>
                <div className="merge-item-url">{primaryNode.sourceUrl}</div>
                <div className="merge-item-summary">{primaryNode.aiSummary}</div>
              </div>
            </div>
          </div>

          {/* Secondary Item Search Section */}
          <div className="merge-section">
            <label className="merge-section-label">
              Secondary Item (merge into primary):
            </label>

            {/* Search Input */}
            <input
              type="text"
              className="merge-search-input"
              placeholder="Search for item to merge..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSecondaryNodeId(null);
              }}
              disabled={isLoading}
            />

            {/* Search Results Dropdown */}
            {searchQuery && searchResults.length > 0 && (
              <div className="merge-search-results">
                {searchResults.map((node) => (
                  <button
                    key={node.id}
                    className={`merge-search-result ${secondaryNodeId === node.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSecondaryNodeId(node.id);
                      setSearchQuery('');
                    }}
                    disabled={isLoading}
                  >
                    {node.faviconPath && (
                      <img
                        src={`file://${node.faviconPath}`}
                        alt=""
                        className="merge-result-favicon"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <span className="merge-result-title">{node.title}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Secondary Item Preview */}
            {secondaryNode && (
              <div className="merge-item-preview merge-item-preview--secondary">
                {secondaryNode.faviconPath && (
                  <img
                    src={`file://${secondaryNode.faviconPath}`}
                    alt=""
                    className="merge-item-favicon"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <div className="merge-item-content">
                  <div className="merge-item-title">{secondaryNode.title}</div>
                  <div className="merge-item-url">{secondaryNode.sourceUrl}</div>
                  <div className="merge-item-summary">{secondaryNode.aiSummary}</div>
                </div>
                <button
                  className="merge-remove-secondary"
                  onClick={() => setSecondaryNodeId(null)}
                  disabled={isLoading}
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Merge Options */}
          <div className="merge-section merge-section--options">
            <div className="merge-checkbox">
              <input
                type="checkbox"
                id="keep-metadata"
                checked={keepMetadata}
                onChange={(e) => setKeepMetadata(e.target.checked)}
                disabled={isLoading}
              />
              <label htmlFor="keep-metadata">
                Keep metadata from secondary item
              </label>
            </div>

            <div className="merge-checkbox">
              <input
                type="checkbox"
                id="append-summary"
                checked={appendSummary}
                onChange={(e) => setAppendSummary(e.target.checked)}
                disabled={isLoading}
              />
              <label htmlFor="append-summary">
                Append AI summary from secondary
              </label>
            </div>
          </div>

          {/* Error Message */}
          {error && <div className="merge-error">{error}</div>}
        </div>

        {/* Dialog Footer */}
        <div className="merge-dialog-footer">
          <button
            className="gum-button gum-button--gray"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            className="gum-button gum-button--blue"
            onClick={handleMerge}
            disabled={!secondaryNode || isLoading}
          >
            {isLoading ? 'Merging...' : 'Merge Items'}
          </button>
        </div>

        <style>{`
          .merge-dialog-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.3);
            z-index: 999;
          }

          .merge-dialog {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 90%;
            max-width: 600px;
            max-height: 90vh;
            background: var(--gum-white);
            border: 2px solid var(--gum-black);
            border-radius: var(--border-radius);
            z-index: 1000;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          .merge-dialog-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: var(--space-md);
            border-bottom: 2px solid var(--gum-gray-200);
          }

          .merge-dialog-title {
            margin: 0;
            font-size: var(--font-size-lg);
            font-weight: var(--font-weight-bold);
          }

          .merge-dialog-close {
            width: 32px;
            height: 32px;
            border: 2px solid var(--gum-black);
            background: transparent;
            border-radius: var(--border-radius);
            font-size: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .merge-dialog-close:hover:not(:disabled) {
            background: var(--gum-gray-100);
          }

          .merge-dialog-content {
            flex: 1;
            overflow-y: auto;
            padding: var(--space-md);
            display: flex;
            flex-direction: column;
            gap: var(--space-md);
          }

          .merge-section {
            display: flex;
            flex-direction: column;
            gap: var(--space-sm);
          }

          .merge-section-label {
            font-weight: var(--font-weight-medium);
            font-size: var(--font-size-sm);
          }

          .merge-item-preview {
            display: flex;
            gap: var(--space-sm);
            padding: var(--space-sm);
            border: 2px solid var(--gum-gray-200);
            border-radius: var(--border-radius);
            background: var(--gum-gray-50);
          }

          .merge-item-preview--secondary {
            position: relative;
          }

          .merge-item-favicon {
            width: 48px;
            height: 48px;
            border-radius: 4px;
            flex-shrink: 0;
          }

          .merge-item-content {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .merge-item-title {
            font-weight: var(--font-weight-medium);
            font-size: var(--font-size-sm);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .merge-item-url {
            font-size: var(--font-size-xs);
            color: var(--gum-gray-600);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .merge-item-summary {
            font-size: var(--font-size-xs);
            color: var(--gum-gray-700);
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }

          .merge-search-input {
            width: 100%;
            padding: var(--space-sm);
            border: 2px solid var(--gum-gray-300);
            border-radius: var(--border-radius);
            font-size: var(--font-size-sm);
          }

          .merge-search-input:focus {
            outline: none;
            border-color: var(--gum-black);
            box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
          }

          .merge-search-results {
            max-height: 200px;
            overflow-y: auto;
            border: 2px solid var(--gum-gray-200);
            border-radius: var(--border-radius);
            background: var(--gum-white);
          }

          .merge-search-result {
            width: 100%;
            display: flex;
            align-items: center;
            gap: var(--space-sm);
            padding: var(--space-sm);
            border: none;
            background: transparent;
            cursor: pointer;
            text-align: left;
            transition: background var(--transition-fast);
            border-bottom: 1px solid var(--gum-gray-100);
          }

          .merge-search-result:last-child {
            border-bottom: none;
          }

          .merge-search-result:hover:not(:disabled) {
            background: var(--gum-gray-100);
          }

          .merge-search-result.selected {
            background: var(--gum-yellow);
          }

          .merge-result-favicon {
            width: 32px;
            height: 32px;
            border-radius: 4px;
            flex-shrink: 0;
          }

          .merge-result-title {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: var(--font-size-sm);
          }

          .merge-remove-secondary {
            width: 28px;
            height: 28px;
            border: 2px solid var(--gum-black);
            background: transparent;
            border-radius: var(--border-radius);
            cursor: pointer;
            font-size: 16px;
            flex-shrink: 0;
          }

          .merge-remove-secondary:hover:not(:disabled) {
            background: var(--gum-pink);
          }

          .merge-section--options {
            gap: var(--space-md);
            padding: var(--space-md);
            background: var(--gum-gray-50);
            border-radius: var(--border-radius);
          }

          .merge-checkbox {
            display: flex;
            align-items: center;
            gap: var(--space-sm);
          }

          .merge-checkbox input[type="checkbox"] {
            width: 20px;
            height: 20px;
            cursor: pointer;
          }

          .merge-checkbox label {
            cursor: pointer;
            font-size: var(--font-size-sm);
          }

          .merge-error {
            padding: var(--space-sm);
            background: var(--gum-pink);
            border: 2px solid var(--gum-black);
            border-radius: var(--border-radius);
            font-size: var(--font-size-sm);
            color: var(--gum-black);
          }

          .merge-dialog-footer {
            display: flex;
            gap: var(--space-sm);
            padding: var(--space-md);
            border-top: 2px solid var(--gum-gray-200);
            justify-content: flex-end;
          }

          .gum-button {
            padding: var(--space-sm) var(--space-md);
            border: 2px solid var(--gum-black);
            border-radius: var(--border-radius);
            font-weight: var(--font-weight-medium);
            cursor: pointer;
            transition: background var(--transition-fast);
          }

          .gum-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .gum-button--gray {
            background: var(--gum-gray-200);
          }

          .gum-button--gray:hover:not(:disabled) {
            background: var(--gum-gray-300);
          }

          .gum-button--blue {
            background: var(--gum-blue);
          }

          .gum-button--blue:hover:not(:disabled) {
            background: var(--gum-blue);
            transform: scale(1.02);
          }
        `}</style>
      </div>
    </>
  );
}

// Helper function to flatten tree
function flattenTree(node: any): any[] {
  const result = [node];
  if (node.children) {
    result.push(...node.children.flatMap(flattenTree));
  }
  return result;
}
