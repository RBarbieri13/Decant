// ============================================================
// Backlinks Section - Display nodes linking to current node
// ============================================================

import React, { useEffect, useState } from 'react';
import { nodesAPI } from '../../services/api';
import type { Backlink, BacklinksResponse } from '../../services/api';

interface BacklinksSectionProps {
  nodeId: string;
  onNavigate?: (nodeId: string) => void;
}

export function BacklinksSection({ nodeId, onNavigate }: BacklinksSectionProps): React.ReactElement {
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [grouped, setGrouped] = useState<Record<string, Backlink[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('grouped');

  useEffect(() => {
    const fetchBacklinks = async () => {
      setLoading(true);
      setError(null);

      try {
        const response: BacklinksResponse = await nodesAPI.getBacklinks(nodeId, 10);
        setBacklinks(response.backlinks);
        setGrouped(response.grouped);
      } catch (err) {
        console.error('Failed to fetch backlinks:', err);
        setError('Failed to load backlinks');
      } finally {
        setLoading(false);
      }
    };

    fetchBacklinks();
  }, [nodeId]);

  const handleItemClick = (itemId: string) => {
    if (onNavigate) {
      onNavigate(itemId);
    }
  };

  const getReferenceTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      similar: 'Similar Items',
      sibling: 'Sibling Items',
      related: 'Related Items',
      manual: 'Manual Links',
    };
    return labels[type] || type;
  };

  const getReferenceTypeIcon = (type: string): string => {
    const icons: Record<string, string> = {
      similar: '🔗',
      sibling: '👥',
      related: '📌',
      manual: '✏️',
    };
    return icons[type] || '🔗';
  };

  const getStrengthColor = (strength: number): string => {
    if (strength >= 80) return 'var(--gum-green)';
    if (strength >= 60) return 'var(--gum-yellow)';
    if (strength >= 40) return 'var(--gum-pink)';
    return 'var(--gum-gray-400)';
  };

  const getContentTypeIcon = (code: string): string => {
    const icons: Record<string, string> = {
      T: '🔧',
      A: '📄',
      V: '🎥',
      P: '🎧',
      R: '📚',
      G: '💻',
      S: '💬',
      C: '🎓',
      I: '🖼️',
      N: '📧',
      K: '📖',
    };
    return icons[code] || '📄';
  };

  if (loading) {
    return (
      <div className="backlinks-section">
        <div className="backlinks-loading">
          <div className="loading-spinner-container">
            <div className="loading-spinner"></div>
          </div>
          <span>Loading backlinks...</span>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="backlinks-section">
        <div className="backlinks-error">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  if (backlinks.length === 0) {
    return (
      <div className="backlinks-section">
        <div className="backlinks-empty">
          <span className="empty-icon">🔗</span>
          <p className="text-muted">No backlinks found</p>
          <p className="empty-hint">
            Backlinks appear when other items are similar to or reference this one.
          </p>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="backlinks-section">
      {/* View Toggle */}
      <div className="backlinks-header">
        <div className="backlinks-count">
          {backlinks.length} {backlinks.length === 1 ? 'backlink' : 'backlinks'}
        </div>
        <div className="view-toggle">
          <button
            className={`view-toggle-btn ${viewMode === 'grouped' ? 'active' : ''}`}
            onClick={() => setViewMode('grouped')}
            title="Group by type"
          >
            📊
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="Show as list"
          >
            📋
          </button>
        </div>
      </div>

      {/* Grouped View */}
      {viewMode === 'grouped' && (
        <div className="backlinks-grouped">
          {Object.entries(grouped).map(([type, items]) => (
            <div key={type} className="backlinks-group">
              <div className="group-header">
                <span className="group-icon">{getReferenceTypeIcon(type)}</span>
                <span className="group-title">{getReferenceTypeLabel(type)}</span>
                <span className="group-count">{items.length}</span>
              </div>
              <div className="group-items">
                {items.map((backlink) => (
                  <BacklinkItem
                    key={backlink.node.id}
                    backlink={backlink}
                    onClick={handleItemClick}
                    getStrengthColor={getStrengthColor}
                    getContentTypeIcon={getContentTypeIcon}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="backlinks-list">
          {backlinks.map((backlink) => (
            <BacklinkItem
              key={backlink.node.id}
              backlink={backlink}
              onClick={handleItemClick}
              getStrengthColor={getStrengthColor}
              getContentTypeIcon={getContentTypeIcon}
              showType
            />
          ))}
        </div>
      )}

      <style>{styles}</style>
    </div>
  );
}

// ============================================================
// Backlink Item Component
// ============================================================

interface BacklinkItemProps {
  backlink: Backlink;
  onClick: (nodeId: string) => void;
  getStrengthColor: (strength: number) => string;
  getContentTypeIcon: (code: string) => string;
  showType?: boolean;
}

function BacklinkItem({
  backlink,
  onClick,
  getStrengthColor,
  getContentTypeIcon,
  showType = false,
}: BacklinkItemProps): React.ReactElement {
  return (
    <button
      className="backlink-item"
      onClick={() => onClick(backlink.node.id)}
    >
      {/* Favicon */}
      <div className="backlink-favicon">
        {backlink.node.logo_url ? (
          <img
            src={backlink.node.logo_url}
            alt=""
            className="favicon-img"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="favicon-placeholder">📄</div>
        )}
      </div>

      {/* Content */}
      <div className="backlink-content">
        <div className="backlink-header">
          <div className="backlink-title">{backlink.node.title}</div>
          <div
            className="backlink-strength"
            style={{ backgroundColor: getStrengthColor(backlink.strength) }}
          >
            {backlink.strength}%
          </div>
        </div>

        {/* Metadata */}
        {(backlink.node.segment || backlink.node.category) && (
          <div className="backlink-metadata">
            {backlink.node.segment && (
              <span className="metadata-item">{backlink.node.segment}</span>
            )}
            {backlink.node.category && (
              <span className="metadata-item">{backlink.node.category}</span>
            )}
          </div>
        )}

        {/* Description */}
        {backlink.node.phrase_description && (
          <div className="backlink-description">{backlink.node.phrase_description}</div>
        )}

        {/* Shared Attributes */}
        {backlink.sharedAttributes.length > 0 && (
          <div className="backlink-tags">
            {backlink.sharedAttributes.slice(0, 3).map((attr, idx) => (
              <span key={idx} className="backlink-tag">{attr}</span>
            ))}
            {backlink.sharedAttributes.length > 3 && (
              <span className="backlink-tag-more">
                +{backlink.sharedAttributes.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Reference Type (only in list view) */}
        {showType && (
          <div className="backlink-type">
            <span className="type-badge">{backlink.referenceType}</span>
          </div>
        )}
      </div>

      {/* Content Type Icon */}
      {backlink.node.contentType && (
        <div className="backlink-badge">
          {getContentTypeIcon(backlink.node.contentType)}
        </div>
      )}
    </button>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = `
  .backlinks-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    padding: var(--space-sm) 0;
  }

  .backlinks-loading,
  .backlinks-error,
  .backlinks-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    padding: var(--space-xl);
    text-align: center;
    color: var(--gum-gray-600);
  }

  .loading-spinner-container {
    width: 32px;
    height: 32px;
  }

  .loading-spinner {
    width: 100%;
    height: 100%;
    border: 3px solid var(--gum-gray-200);
    border-top-color: var(--gum-black);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-icon,
  .empty-icon {
    font-size: 32px;
    opacity: 0.5;
  }

  .empty-hint {
    font-size: var(--font-size-xs);
    color: var(--gum-gray-500);
    max-width: 300px;
    margin: 0;
  }

  /* Header */
  .backlinks-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-sm);
    background: var(--gum-gray-50);
    border-radius: var(--border-radius);
  }

  .backlinks-count {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--gum-gray-700);
  }

  .view-toggle {
    display: flex;
    gap: var(--space-xs);
  }

  .view-toggle-btn {
    padding: 4px 8px;
    background: var(--gum-white);
    border: 2px solid var(--gum-gray-200);
    border-radius: var(--border-radius);
    cursor: pointer;
    font-size: 16px;
    transition: all var(--transition-fast);
  }

  .view-toggle-btn:hover {
    border-color: var(--gum-gray-400);
  }

  .view-toggle-btn.active {
    border-color: var(--gum-black);
    background: var(--gum-yellow);
  }

  /* Grouped View */
  .backlinks-grouped {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .backlinks-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-sm);
    background: var(--gum-gray-100);
    border-radius: var(--border-radius);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
  }

  .group-icon {
    font-size: 16px;
  }

  .group-title {
    flex: 1;
    color: var(--gum-gray-700);
  }

  .group-count {
    font-size: var(--font-size-xs);
    background: var(--gum-white);
    padding: 2px 6px;
    border-radius: 3px;
    color: var(--gum-gray-600);
  }

  .group-items {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  /* List View */
  .backlinks-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  /* Backlink Item */
  .backlink-item {
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm);
    padding: var(--space-sm);
    background: var(--gum-white);
    border: 2px solid var(--gum-gray-200);
    border-radius: var(--border-radius);
    cursor: pointer;
    text-align: left;
    transition: all var(--transition-fast);
    width: 100%;
  }

  .backlink-item:hover {
    border-color: var(--gum-black);
    background: var(--gum-gray-50);
    transform: translateX(2px);
  }

  .backlink-item:active {
    background: var(--gum-yellow);
  }

  .backlink-favicon {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--border-radius);
    border: 1px solid var(--gum-gray-200);
    overflow: hidden;
    background: var(--gum-white);
  }

  .favicon-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .favicon-placeholder {
    font-size: 16px;
  }

  .backlink-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .backlink-header {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    justify-content: space-between;
  }

  .backlink-title {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--gum-black);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .backlink-strength {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    color: var(--gum-white);
    padding: 2px 6px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .backlink-metadata {
    display: flex;
    gap: var(--space-xs);
    flex-wrap: wrap;
  }

  .metadata-item {
    font-size: var(--font-size-xs);
    color: var(--gum-gray-600);
    background: var(--gum-gray-100);
    padding: 2px 6px;
    border-radius: 3px;
  }

  .backlink-description {
    font-size: var(--font-size-xs);
    color: var(--gum-gray-600);
    font-style: italic;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: 1.4;
  }

  .backlink-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
  }

  .backlink-tag {
    display: inline-block;
    background: var(--gum-gray-200);
    color: var(--gum-gray-700);
    font-size: 10px;
    font-weight: var(--font-weight-medium);
    padding: 2px 6px;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .backlink-tag-more {
    display: inline-block;
    color: var(--gum-gray-500);
    font-size: 10px;
    font-weight: var(--font-weight-medium);
    padding: 2px 4px;
  }

  .backlink-type {
    margin-top: 2px;
  }

  .type-badge {
    display: inline-block;
    background: var(--gum-yellow);
    color: var(--gum-black);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-medium);
    padding: 2px 8px;
    border-radius: 3px;
    text-transform: capitalize;
  }

  .backlink-badge {
    font-size: 16px;
    flex-shrink: 0;
  }
`;
