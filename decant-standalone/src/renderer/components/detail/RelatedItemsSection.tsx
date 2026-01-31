// ============================================================
// Related Items Section - Display similar/related nodes
// ============================================================

import React, { useEffect, useState } from 'react';
import { nodesAPI } from '../../services/api';
import type { Node, RelatedNode } from '../../services/api';

interface RelatedItemsSectionProps {
  node: Node;
  onNavigate: (nodeId: string) => void;
}

export function RelatedItemsSection({ node, onNavigate }: RelatedItemsSectionProps): React.ReactElement {
  const [relatedItems, setRelatedItems] = useState<RelatedNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRelatedItems = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch related nodes from the similarity API
        const response = await nodesAPI.getRelated(node.id, 5);
        setRelatedItems(response.related);
      } catch (err) {
        console.error('Failed to fetch related items:', err);
        setError('Failed to load related items');
      } finally {
        setLoading(false);
      }
    };

    fetchRelatedItems();
  }, [node.id]);

  const handleItemClick = (itemId: string) => {
    onNavigate(itemId);
  };

  if (loading) {
    return (
      <div className="related-items-section">
        <div className="related-items-loading">
          <span className="loading-spinner">⏳</span>
          <span>Loading related items...</span>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="related-items-section">
        <div className="related-items-error">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  if (relatedItems.length === 0) {
    return (
      <div className="related-items-section">
        <div className="related-items-empty">
          <span className="empty-icon">🔍</span>
          <p className="text-muted">No related items found</p>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="related-items-section">
      <div className="related-items-list">
        {relatedItems.map((item) => (
          <button
            key={item.node.id}
            className="related-item"
            onClick={() => handleItemClick(item.node.id)}
          >
            <div className="related-item-favicon">
              {item.node.logo_url ? (
                <img
                  src={item.node.logo_url}
                  alt=""
                  className="related-favicon-img"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="related-favicon-placeholder">📄</div>
              )}
            </div>
            <div className="related-item-content">
              <div className="related-item-header">
                <div className="related-item-title">{item.node.title}</div>
                <div className="related-item-similarity-badge">
                  {item.similarityScore}%
                </div>
              </div>
              {item.node.url && (
                <div className="related-item-domain">
                  {new URL(item.node.url).hostname}
                </div>
              )}
              {item.node.phrase_description && (
                <div className="related-item-description">{item.node.phrase_description}</div>
              )}
              {item.sharedAttributes.length > 0 && (
                <div className="related-item-tags">
                  {item.sharedAttributes.map((attr, idx) => (
                    <span key={idx} className="related-tag">{attr}</span>
                  ))}
                </div>
              )}
            </div>
            {item.node.contentType && (
              <div className="related-item-badge">
                {getContentTypeIcon(item.node.contentType)}
              </div>
            )}
          </button>
        ))}
      </div>
      <style>{styles}</style>
    </div>
  );
}

// Helper function to get content type icon
function getContentTypeIcon(code: string): string {
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
}

const styles = `
  .related-items-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .related-items-loading,
  .related-items-error,
  .related-items-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    padding: var(--space-lg);
    text-align: center;
    color: var(--gum-gray-600);
  }

  .loading-spinner,
  .error-icon,
  .empty-icon {
    font-size: 24px;
  }

  .related-items-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .related-item {
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

  .related-item:hover {
    border-color: var(--gum-black);
    background: var(--gum-gray-50);
    transform: translateX(2px);
  }

  .related-item:active {
    background: var(--gum-yellow);
  }

  .related-item-favicon {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--border-radius);
    border: 1px solid var(--gum-gray-200);
    overflow: hidden;
  }

  .related-favicon-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .related-favicon-placeholder {
    font-size: 16px;
  }

  .related-item-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .related-item-header {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    justify-content: space-between;
  }

  .related-item-title {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--gum-black);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .related-item-similarity-badge {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    color: var(--gum-white);
    background: var(--gum-black);
    padding: 2px 6px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .related-item-domain {
    font-size: var(--font-size-xs);
    color: var(--gum-gray-500);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .related-item-description {
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

  .related-item-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
  }

  .related-tag {
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

  .related-item-badge {
    font-size: 16px;
    flex-shrink: 0;
  }
`;
