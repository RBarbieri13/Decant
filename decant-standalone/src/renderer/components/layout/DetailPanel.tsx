// ============================================================
// Detail Panel - Right panel showing node details with tabs
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { NodeMetadataSection } from '../detail/NodeMetadataSection';
import { RelatedItemsSection } from '../detail/RelatedItemsSection';
import { BacklinksSection } from '../detail/BacklinksSection';
import { NodeHistorySection } from '../detail/NodeHistorySection';

type TabType = 'overview' | 'properties' | 'related' | 'backlinks' | 'history';

interface EditState {
  title: string;
  ai_summary: string;
}

export function DetailPanel(): React.ReactElement {
  const { state, actions } = useApp();
  const { selectedNode } = state;

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editState, setEditState] = useState<EditState>({ title: '', ai_summary: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset edit state when selected node changes
  useEffect(() => {
    if (selectedNode) {
      setEditState({
        title: selectedNode.title,
        ai_summary: selectedNode.ai_summary || '',
      });
    }
    setIsEditing(false);
    setShowDeleteConfirm(false);
    setActiveTab('overview'); // Reset to overview tab
  }, [selectedNode?.id]);

  // Format date for display
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'Unknown';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Get content type label
  const getContentTypeLabel = (code: string | null): string => {
    if (!code) return 'Unknown';
    const labels: Record<string, string> = {
      T: 'Tool / Website',
      A: 'Article',
      V: 'Video',
      P: 'Podcast',
      R: 'Research Paper',
      G: 'Repository',
      S: 'Social Post',
      C: 'Course / Tutorial',
      I: 'Image / Graphic',
      N: 'Newsletter',
      K: 'Book / eBook',
    };
    return labels[code] || code;
  };

  // Get badge color for content type
  const getContentTypeBadgeClass = (code: string | null): string => {
    if (!code) return '';
    const colorMap: Record<string, string> = {
      T: 'gum-badge--pink',
      A: 'gum-badge--blue',
      V: 'gum-badge--green',
      G: 'gum-badge--yellow',
    };
    return colorMap[code] || '';
  };

  // Handle edit input changes
  const handleEditChange = useCallback(
    (field: keyof EditState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setEditState((prev) => ({ ...prev, [field]: e.target.value }));
    },
    []
  );

  // Start editing
  const handleStartEdit = useCallback(() => {
    if (selectedNode) {
      setEditState({
        title: selectedNode.title,
        ai_summary: selectedNode.ai_summary || '',
      });
      setIsEditing(true);
    }
  }, [selectedNode]);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    if (selectedNode) {
      setEditState({
        title: selectedNode.title,
        ai_summary: selectedNode.ai_summary || '',
      });
    }
    setIsEditing(false);
  }, [selectedNode]);

  // Save changes
  const handleSave = useCallback(async () => {
    if (!selectedNode) return;

    setIsSaving(true);
    try {
      await actions.updateNode(selectedNode.id, {
        title: editState.title,
        ai_summary: editState.ai_summary || null,
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setIsSaving(false);
    }
  }, [selectedNode, editState, actions]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!selectedNode) return;

    setIsDeleting(true);
    try {
      await actions.deleteNode(selectedNode.id);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Failed to delete:', err);
    } finally {
      setIsDeleting(false);
    }
  }, [selectedNode, actions]);

  // Copy to clipboard helper
  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // TODO: Show toast notification
      console.log(`${label} copied to clipboard`);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, []);

  // Navigate to related item
  const handleNavigateToRelated = useCallback((nodeId: string) => {
    actions.selectNode(nodeId);
  }, [actions]);

  return (
    <section className="panel detail-panel">
      <div className="panel-header">
        <span>Details</span>
        {isEditing && <span className="edit-indicator">Editing</span>}
      </div>

      <div className="panel-content">
        {!selectedNode ? (
          <div className="detail-empty">
            <div className="empty-icon">👆</div>
            <p className="text-muted">Select an item to view details</p>
          </div>
        ) : (
          <>
            {/* Header with favicon and title */}
            <div className="detail-header">
              {selectedNode.logo_url && (
                <img
                  src={selectedNode.logo_url}
                  alt=""
                  className="detail-favicon"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <div className="detail-header-text">
                {isEditing ? (
                  <input
                    type="text"
                    className="gum-input detail-title-input"
                    value={editState.title}
                    onChange={handleEditChange('title')}
                    placeholder="Title"
                    autoFocus
                  />
                ) : (
                  <h2 className="detail-title">{selectedNode.title}</h2>
                )}
                {selectedNode.extracted_fields?.contentType && (
                  <span className={`gum-badge ${getContentTypeBadgeClass(selectedNode.extracted_fields.contentType)}`}>
                    {getContentTypeLabel(selectedNode.extracted_fields.contentType)}
                  </span>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="detail-tabs">
              <button
                className={`detail-tab ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button
                className={`detail-tab ${activeTab === 'properties' ? 'active' : ''}`}
                onClick={() => setActiveTab('properties')}
              >
                Properties
              </button>
              <button
                className={`detail-tab ${activeTab === 'related' ? 'active' : ''}`}
                onClick={() => setActiveTab('related')}
              >
                Related
              </button>
              <button
                className={`detail-tab ${activeTab === 'backlinks' ? 'active' : ''}`}
                onClick={() => setActiveTab('backlinks')}
              >
                Backlinks
              </button>
              <button
                className={`detail-tab ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                History
              </button>
            </div>

            {/* Tab Content */}
            <div className="detail-tab-content">
              {activeTab === 'overview' && (
                <div className="detail-content">
                  {/* Source URL */}
                  {selectedNode.url && (
                    <div className="detail-section">
                      <div className="detail-label">Source</div>
                      <a
                        href={selectedNode.url}
                        className="detail-url"
                        onClick={(e) => {
                          e.preventDefault();
                          window.open(selectedNode.url!, '_blank');
                        }}
                      >
                        {new URL(selectedNode.url).hostname}
                        <span className="external-link-icon">↗</span>
                      </a>
                    </div>
                  )}

                  {/* Short Description */}
                  {selectedNode.short_description && (
                    <div className="detail-section">
                      <div className="detail-label">Description</div>
                      <p className="detail-summary">{selectedNode.short_description}</p>
                    </div>
                  )}

                  {/* AI Summary */}
                  <div className="detail-section">
                    <div className="detail-label">AI Summary</div>
                    {isEditing ? (
                      <textarea
                        className="gum-input detail-summary-input"
                        value={editState.ai_summary}
                        onChange={handleEditChange('ai_summary')}
                        placeholder="Enter a summary..."
                        rows={4}
                      />
                    ) : selectedNode.ai_summary ? (
                      <p className="detail-summary">{selectedNode.ai_summary}</p>
                    ) : (
                      <p className="detail-summary text-muted">No summary available</p>
                    )}
                  </div>

                  {/* Key Concepts */}
                  {selectedNode.key_concepts && selectedNode.key_concepts.length > 0 && (
                    <div className="detail-section">
                      <div className="detail-label">Key Concepts</div>
                      <ul className="detail-key-points">
                        {selectedNode.key_concepts.map((concept: string, index: number) => (
                          <li key={index}>{concept}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Metadata Tags */}
                  {selectedNode.metadata_tags && selectedNode.metadata_tags.length > 0 && (
                    <div className="detail-section">
                      <div className="detail-label">Tags</div>
                      <div className="detail-tags">
                        {selectedNode.metadata_tags.map((tag: string, index: number) => (
                          <span key={index} className="detail-tag">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="detail-section">
                    <div className="detail-label">Added</div>
                    <span className="detail-date">{formatDate(selectedNode.date_added)}</span>
                  </div>
                </div>
              )}

              {activeTab === 'properties' && (
                <div className="detail-tab-scroll">
                  <NodeMetadataSection node={selectedNode} />
                </div>
              )}

              {activeTab === 'related' && (
                <div className="detail-tab-scroll">
                  <RelatedItemsSection node={selectedNode} onNavigate={handleNavigateToRelated} />
                </div>
              )}

              {activeTab === 'backlinks' && (
                <div className="detail-tab-scroll">
                  <BacklinksSection nodeId={selectedNode.id} onNavigate={handleNavigateToRelated} />
                </div>
              )}

              {activeTab === 'history' && (
                <div className="detail-tab-scroll">
                  <NodeHistorySection nodeId={selectedNode.id} />
                </div>
              )}
            </div>

            {/* Actions (only show on overview tab) */}
            {activeTab === 'overview' && (
              <div className="detail-actions">
                {isEditing ? (
                  <>
                    <button
                      className="gum-button gum-button--small"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                    >
                      Cancel
                    </button>
                    <button
                      className="gum-button gum-button--small gum-button--green"
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </>
                ) : (
                  <>
                    {selectedNode.url && (
                      <button
                        className="gum-button gum-button--small gum-button--blue"
                        onClick={() => window.open(selectedNode.url!, '_blank')}
                        title="Open URL in browser"
                      >
                        Open
                      </button>
                    )}
                    <button
                      className="gum-button gum-button--small"
                      onClick={handleStartEdit}
                      title="Edit node details"
                    >
                      Edit
                    </button>
                    <button
                      className="gum-button gum-button--small"
                      onClick={() => copyToClipboard(selectedNode.url || '', 'URL')}
                      title="Copy URL to clipboard"
                    >
                      Copy URL
                    </button>
                    <button
                      className="gum-button gum-button--small delete-btn"
                      onClick={() => setShowDeleteConfirm(true)}
                      title="Delete this node"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && selectedNode && (
          <div className="delete-confirm-overlay" onClick={() => setShowDeleteConfirm(false)}>
            <div className="delete-confirm-dialog gum-card" onClick={(e) => e.stopPropagation()}>
              <h3>Delete Item?</h3>
              <p>
                Are you sure you want to delete <strong>{selectedNode.title}</strong>?
                This action cannot be undone.
              </p>
              <div className="delete-confirm-actions">
                <button
                  className="gum-button gum-button--small"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  className="gum-button gum-button--small delete-confirm-btn"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .detail-panel {
          flex: 1;
          min-width: var(--panel-detail-min-width);
          display: flex;
          flex-direction: column;
        }

        .edit-indicator {
          font-size: var(--font-size-xs);
          background: var(--gum-yellow);
          padding: 2px 8px;
          border-radius: var(--border-radius);
          font-weight: var(--font-weight-normal);
        }

        .detail-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: var(--space-md);
          text-align: center;
        }

        .empty-icon {
          font-size: 48px;
          opacity: 0.5;
        }

        .detail-header {
          display: flex;
          gap: var(--space-md);
          align-items: flex-start;
          padding-bottom: var(--space-md);
          border-bottom: 1px solid var(--gum-gray-200);
        }

        .detail-favicon {
          width: 48px;
          height: 48px;
          border-radius: var(--border-radius);
          border: 1px solid var(--gum-gray-200);
          flex-shrink: 0;
        }

        .detail-header-text {
          flex: 1;
          min-width: 0;
        }

        .detail-title {
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-bold);
          margin-bottom: var(--space-sm);
          word-wrap: break-word;
        }

        .detail-title-input {
          width: 100%;
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-bold);
          margin-bottom: var(--space-sm);
        }

        /* Tabs */
        .detail-tabs {
          display: flex;
          gap: var(--space-xs);
          border-bottom: 2px solid var(--gum-gray-200);
          margin-top: var(--space-md);
        }

        .detail-tab {
          padding: var(--space-sm) var(--space-md);
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--gum-gray-600);
          transition: all var(--transition-fast);
          margin-bottom: -2px;
        }

        .detail-tab:hover {
          color: var(--gum-black);
          background: var(--gum-gray-50);
        }

        .detail-tab.active {
          color: var(--gum-black);
          border-bottom-color: var(--gum-black);
          font-weight: var(--font-weight-bold);
        }

        /* Tab Content */
        .detail-tab-content {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .detail-tab-scroll {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-md) 0;
        }

        .detail-content {
          display: flex;
          flex-direction: column;
          gap: var(--space-lg);
          padding: var(--space-md) 0;
        }

        .detail-section {
          display: flex;
          flex-direction: column;
          gap: var(--space-xs);
        }

        .detail-label {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-bold);
          text-transform: uppercase;
          color: var(--gum-gray-600);
          letter-spacing: 0.5px;
        }

        .detail-url {
          display: inline-flex;
          align-items: center;
          gap: var(--space-xs);
          color: var(--gum-black);
          text-decoration: none;
          font-size: var(--font-size-sm);
        }

        .detail-url:hover {
          text-decoration: underline;
        }

        .external-link-icon {
          font-size: var(--font-size-xs);
          opacity: 0.5;
        }

        .detail-summary {
          font-size: var(--font-size-sm);
          line-height: 1.6;
          color: var(--gum-gray-800);
        }

        .detail-summary-input {
          width: 100%;
          font-size: var(--font-size-sm);
          line-height: 1.6;
          resize: vertical;
        }

        .detail-key-points {
          margin: 0;
          padding-left: var(--space-md);
          font-size: var(--font-size-sm);
        }

        .detail-key-points li {
          margin-bottom: var(--space-xs);
        }

        .detail-tags {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-xs);
        }

        .detail-tag {
          display: inline-block;
          background: var(--gum-gray-200);
          padding: var(--space-xs) var(--space-sm);
          border-radius: var(--border-radius);
          font-size: var(--font-size-xs);
          color: var(--gum-gray-800);
        }

        .detail-date {
          font-size: var(--font-size-sm);
          color: var(--gum-gray-600);
        }

        .detail-actions {
          display: flex;
          gap: var(--space-sm);
          padding-top: var(--space-md);
          border-top: 1px solid var(--gum-gray-200);
          flex-wrap: wrap;
        }

        .delete-btn {
          margin-left: auto;
          color: var(--gum-black);
        }

        .delete-btn:hover {
          background: #ff6b6b;
        }

        /* Delete Confirmation Dialog */
        .delete-confirm-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1001;
        }

        .delete-confirm-dialog {
          width: 100%;
          max-width: 400px;
          padding: var(--space-lg);
          background: var(--gum-white);
        }

        .delete-confirm-dialog h3 {
          margin: 0 0 var(--space-md);
          font-size: var(--font-size-lg);
        }

        .delete-confirm-dialog p {
          margin: 0 0 var(--space-lg);
          font-size: var(--font-size-sm);
          color: var(--gum-gray-600);
        }

        .delete-confirm-actions {
          display: flex;
          gap: var(--space-sm);
          justify-content: flex-end;
        }

        .delete-confirm-btn {
          background: #ff6b6b;
        }

        .delete-confirm-btn:hover {
          background: #ff4444;
        }
      `}</style>
    </section>
  );
}
