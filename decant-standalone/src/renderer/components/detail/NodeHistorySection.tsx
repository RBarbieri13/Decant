// ============================================================
// Node History Section - Shows audit trail of hierarchy changes
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { auditAPI, type AuditChange, type HierarchyType, type ChangeType, type TriggeredBy } from '../../services/api';

interface Props {
  nodeId: string;
}

export function NodeHistorySection({ nodeId }: Props): React.ReactElement {
  const [changes, setChanges] = useState<AuditChange[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterHierarchy, setFilterHierarchy] = useState<HierarchyType | 'all'>('all');
  const [filterChangeType, setFilterChangeType] = useState<ChangeType | 'all'>('all');

  // Load history when component mounts or nodeId changes
  useEffect(() => {
    loadHistory();
  }, [nodeId]);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await auditAPI.getNodeHistory(nodeId, {
        hierarchyType: filterHierarchy === 'all' ? undefined : filterHierarchy,
        limit: 100,
      });
      setChanges(result.changes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setIsLoading(false);
    }
  }, [nodeId, filterHierarchy]);

  // Reload when filters change
  useEffect(() => {
    loadHistory();
  }, [filterHierarchy, loadHistory]);

  // Filter changes locally by change type
  const filteredChanges = filterChangeType === 'all'
    ? changes
    : changes.filter(c => c.changeType === filterChangeType);

  // Format date for display
  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    } catch {
      return dateStr;
    }
  };

  // Get badge color for change type
  const getChangeTypeBadge = (changeType: ChangeType): { label: string; className: string } => {
    const badges: Record<ChangeType, { label: string; className: string }> = {
      created: { label: 'Created', className: 'change-badge--green' },
      updated: { label: 'Updated', className: 'change-badge--blue' },
      moved: { label: 'Moved', className: 'change-badge--purple' },
      restructured: { label: 'Restructured', className: 'change-badge--orange' },
    };
    return badges[changeType] || { label: changeType, className: '' };
  };

  // Get icon for hierarchy type
  const getHierarchyIcon = (hierarchyType: HierarchyType): string => {
    return hierarchyType === 'function' ? '🔧' : '🏢';
  };

  // Get icon for triggered by
  const getTriggeredByIcon = (triggeredBy: TriggeredBy): string => {
    const icons: Record<TriggeredBy, string> = {
      import: '🤖',
      user_move: '👤',
      restructure: '🔄',
      merge: '🔗',
    };
    return icons[triggeredBy] || '❓';
  };

  // Get label for triggered by
  const getTriggeredByLabel = (triggeredBy: TriggeredBy): string => {
    const labels: Record<TriggeredBy, string> = {
      import: 'AI Import',
      user_move: 'Manual Move',
      restructure: 'Auto Restructure',
      merge: 'Node Merge',
    };
    return labels[triggeredBy] || triggeredBy;
  };

  return (
    <div className="node-history">
      {/* Filters */}
      <div className="history-filters">
        <div className="filter-group">
          <label className="filter-label">Hierarchy</label>
          <select
            className="gum-select filter-select"
            value={filterHierarchy}
            onChange={(e) => setFilterHierarchy(e.target.value as HierarchyType | 'all')}
          >
            <option value="all">All</option>
            <option value="function">Function</option>
            <option value="organization">Organization</option>
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Change Type</label>
          <select
            className="gum-select filter-select"
            value={filterChangeType}
            onChange={(e) => setFilterChangeType(e.target.value as ChangeType | 'all')}
          >
            <option value="all">All</option>
            <option value="created">Created</option>
            <option value="updated">Updated</option>
            <option value="moved">Moved</option>
            <option value="restructured">Restructured</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="history-content">
        {isLoading ? (
          <div className="history-loading">
            <div className="loading-spinner"></div>
            <p className="text-muted">Loading history...</p>
          </div>
        ) : error ? (
          <div className="history-error">
            <p className="error-message">{error}</p>
            <button className="gum-button gum-button--small" onClick={loadHistory}>
              Retry
            </button>
          </div>
        ) : filteredChanges.length === 0 ? (
          <div className="history-empty">
            <p className="text-muted">No history available</p>
          </div>
        ) : (
          <div className="history-timeline">
            {filteredChanges.map((change) => {
              const badge = getChangeTypeBadge(change.changeType);
              return (
                <div key={change.id} className="history-item">
                  {/* Timeline dot */}
                  <div className="timeline-dot"></div>

                  {/* Change card */}
                  <div className="history-card">
                    {/* Header with badges */}
                    <div className="history-header">
                      <div className="history-badges">
                        <span className={`change-badge ${badge.className}`}>
                          {badge.label}
                        </span>
                        <span className="hierarchy-badge" title={change.hierarchyType}>
                          {getHierarchyIcon(change.hierarchyType)}
                        </span>
                      </div>
                      <span className="history-date" title={new Date(change.changedAt).toLocaleString()}>
                        {formatDate(change.changedAt)}
                      </span>
                    </div>

                    {/* Code change */}
                    <div className="code-change">
                      {change.oldCode ? (
                        <>
                          <code className="code-old">{change.oldCode}</code>
                          <span className="code-arrow">→</span>
                          <code className="code-new">{change.newCode}</code>
                        </>
                      ) : (
                        <code className="code-new">{change.newCode}</code>
                      )}
                    </div>

                    {/* Reason */}
                    {change.reason && (
                      <div className="history-reason">
                        <span className="reason-icon">💬</span>
                        <span className="reason-text">{change.reason}</span>
                      </div>
                    )}

                    {/* Triggered by */}
                    <div className="history-trigger">
                      <span className="trigger-icon">{getTriggeredByIcon(change.triggeredBy)}</span>
                      <span className="trigger-text">{getTriggeredByLabel(change.triggeredBy)}</span>
                    </div>

                    {/* Related nodes */}
                    {change.relatedNodes && change.relatedNodes.length > 0 && (
                      <div className="history-related">
                        <div className="related-label">Related nodes:</div>
                        <ul className="related-list">
                          {change.relatedNodes.map((node) => (
                            <li key={node.id} className="related-item">
                              {node.title}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .node-history {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
          height: 100%;
        }

        /* Filters */
        .history-filters {
          display: flex;
          gap: var(--space-md);
          padding: var(--space-sm) 0;
          border-bottom: 1px solid var(--gum-gray-200);
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: var(--space-xs);
        }

        .filter-label {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          color: var(--gum-gray-600);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .filter-select {
          font-size: var(--font-size-sm);
          padding: var(--space-xs) var(--space-sm);
          border: 1px solid var(--gum-gray-300);
          border-radius: var(--border-radius);
          background: var(--gum-white);
        }

        /* Content States */
        .history-content {
          flex: 1;
          overflow-y: auto;
        }

        .history-loading,
        .history-error,
        .history-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--space-md);
          padding: var(--space-xl);
          text-align: center;
        }

        .loading-spinner {
          width: 24px;
          height: 24px;
          border: 3px solid var(--gum-gray-200);
          border-top-color: var(--gum-black);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-message {
          color: #dc2626;
          font-size: var(--font-size-sm);
        }

        /* Timeline */
        .history-timeline {
          position: relative;
          padding: var(--space-md) 0 var(--space-md) var(--space-lg);
        }

        .history-timeline::before {
          content: '';
          position: absolute;
          left: 11px;
          top: 0;
          bottom: 0;
          width: 2px;
          background: var(--gum-gray-200);
        }

        .history-item {
          position: relative;
          margin-bottom: var(--space-lg);
        }

        .history-item:last-child {
          margin-bottom: 0;
        }

        .timeline-dot {
          position: absolute;
          left: -21px;
          top: 8px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--gum-white);
          border: 2px solid var(--gum-black);
          z-index: 1;
        }

        /* History Card */
        .history-card {
          background: var(--gum-gray-50);
          border: 1px solid var(--gum-gray-200);
          border-radius: var(--border-radius);
          padding: var(--space-md);
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
        }

        .history-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-sm);
        }

        .history-badges {
          display: flex;
          gap: var(--space-xs);
          align-items: center;
        }

        .change-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: var(--border-radius);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .change-badge--green {
          background: #dcfce7;
          color: #166534;
        }

        .change-badge--blue {
          background: #dbeafe;
          color: #1e40af;
        }

        .change-badge--purple {
          background: #f3e8ff;
          color: #6b21a8;
        }

        .change-badge--orange {
          background: #ffedd5;
          color: #9a3412;
        }

        .hierarchy-badge {
          font-size: var(--font-size-md);
        }

        .history-date {
          font-size: var(--font-size-xs);
          color: var(--gum-gray-600);
          white-space: nowrap;
        }

        /* Code Change */
        .code-change {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          font-family: 'Courier New', monospace;
          font-size: var(--font-size-sm);
          flex-wrap: wrap;
        }

        .code-old {
          color: #dc2626;
          text-decoration: line-through;
          opacity: 0.7;
        }

        .code-new {
          color: #16a34a;
          font-weight: var(--font-weight-medium);
        }

        .code-arrow {
          color: var(--gum-gray-400);
          font-size: var(--font-size-lg);
        }

        /* Reason */
        .history-reason {
          display: flex;
          align-items: flex-start;
          gap: var(--space-xs);
          padding: var(--space-xs) var(--space-sm);
          background: var(--gum-white);
          border-radius: var(--border-radius);
          font-size: var(--font-size-sm);
          color: var(--gum-gray-700);
        }

        .reason-icon {
          flex-shrink: 0;
        }

        .reason-text {
          flex: 1;
          line-height: 1.5;
        }

        /* Trigger */
        .history-trigger {
          display: flex;
          align-items: center;
          gap: var(--space-xs);
          font-size: var(--font-size-xs);
          color: var(--gum-gray-600);
        }

        .trigger-icon {
          font-size: var(--font-size-sm);
        }

        /* Related Nodes */
        .history-related {
          padding-top: var(--space-sm);
          border-top: 1px solid var(--gum-gray-200);
        }

        .related-label {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          color: var(--gum-gray-600);
          margin-bottom: var(--space-xs);
        }

        .related-list {
          margin: 0;
          padding-left: var(--space-md);
          font-size: var(--font-size-sm);
        }

        .related-item {
          color: var(--gum-gray-700);
          margin-bottom: var(--space-xs);
        }

        .related-item:last-child {
          margin-bottom: 0;
        }
      `}</style>
    </div>
  );
}
