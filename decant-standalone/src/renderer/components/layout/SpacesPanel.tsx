// ============================================================
// Spaces Panel - Left sidebar with segments and spaces
// ============================================================

import React from 'react';
import { useApp } from '../../context/AppContext';

export function SpacesPanel(): React.ReactElement {
  const { state, dispatch, actions } = useApp();
  const {
    currentView,
    segments,
    organizations,
    selectedSegmentId,
    selectedOrganizationId,
  } = state;

  const isFunctionView = currentView === 'function';

  return (
    <aside className="panel spaces-panel">
      <div className="panel-header">
        <span>Spaces</span>
        <button
          className="gum-button gum-button--small gum-button--green"
          onClick={actions.openImportDialog}
          title="Import URL (Cmd+N)"
        >
          + Import
        </button>
      </div>
      <div className="panel-content">
        {/* View Toggle */}
        <div className="view-toggle-section">
          <button
            className={`view-toggle-btn ${isFunctionView ? 'active' : ''}`}
            onClick={() => {
              dispatch({ type: 'SET_VIEW', view: 'function' });
              localStorage.setItem('currentView', 'function');
              actions.loadTree();
            }}
          >
            <span className="view-icon">&#9632;</span>
            Function
          </button>
          <button
            className={`view-toggle-btn ${!isFunctionView ? 'active' : ''}`}
            onClick={() => {
              dispatch({ type: 'SET_VIEW', view: 'organization' });
              localStorage.setItem('currentView', 'organization');
              actions.loadTree();
            }}
          >
            <span className="view-icon">&#9650;</span>
            Organization
          </button>
        </div>

        {/* Segment/Organization List */}
        <div className="space-list">
          <div className="space-list-header">
            {isFunctionView ? 'Segments' : 'Organizations'}
          </div>

          {isFunctionView ? (
            // Function View: Show Segments
            <div className="segment-items">
              {segments.map((segment) => (
                <button
                  key={segment.id}
                  className={`space-item ${selectedSegmentId === segment.id ? 'active' : ''}`}
                  onClick={() => {
                    dispatch({ type: 'SELECT_SEGMENT', id: segment.id });
                    actions.loadTree();
                  }}
                  style={{
                    '--space-color': `var(--gum-${segment.color})`,
                  } as React.CSSProperties}
                >
                  <span className="space-indicator" />
                  <span className="space-code">{segment.segmentCode}</span>
                  <span className="space-name">{segment.segmentName}</span>
                </button>
              ))}
            </div>
          ) : (
            // Organization View: Show Organizations
            <div className="organization-items">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  className={`space-item ${selectedOrganizationId === org.id ? 'active' : ''}`}
                  onClick={() => {
                    dispatch({ type: 'SELECT_ORGANIZATION', id: org.id });
                    actions.loadTree();
                  }}
                >
                  <span className="space-indicator org-indicator" />
                  <span className="space-code">{org.orgCode}</span>
                  <span className="space-name">{org.orgName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Custom Spaces (Future) */}
        <div className="custom-spaces-section">
          <div className="space-list-header">
            Custom Spaces
            <button className="add-space-btn" title="Create custom space">
              +
            </button>
          </div>
          <div className="empty-hint">
            <span className="text-muted text-small">No custom spaces yet</span>
          </div>
        </div>
      </div>

      <style>{`
        .spaces-panel {
          width: var(--panel-spaces-width);
          display: flex;
          flex-direction: column;
        }

        .spaces-panel .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .view-toggle-section {
          display: flex;
          gap: var(--space-xs);
          margin-bottom: var(--space-md);
          padding: var(--space-xs);
          background: var(--gum-gray-100);
          border-radius: var(--border-radius);
        }

        .view-toggle-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-xs);
          padding: var(--space-sm);
          background: transparent;
          border: none;
          border-radius: var(--border-radius);
          font-family: var(--font-main);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .view-toggle-btn:hover {
          background: var(--gum-white);
        }

        .view-toggle-btn.active {
          background: var(--gum-white);
          border: var(--border-width) solid var(--gum-black);
          box-shadow: 2px 2px 0 var(--gum-black);
          font-weight: var(--font-weight-bold);
        }

        .view-icon {
          font-size: 8px;
        }

        .space-list {
          margin-bottom: var(--space-lg);
        }

        .space-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-xs) 0;
          margin-bottom: var(--space-xs);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-bold);
          text-transform: uppercase;
          color: var(--gum-gray-600);
          letter-spacing: 0.5px;
        }

        .add-space-btn {
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          background: transparent;
          border: 1px solid var(--gum-gray-300);
          border-radius: var(--border-radius);
          font-size: var(--font-size-sm);
          cursor: pointer;
          color: var(--gum-gray-500);
        }

        .add-space-btn:hover {
          background: var(--gum-gray-100);
          color: var(--gum-black);
        }

        .space-item {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          width: 100%;
          padding: var(--space-sm) var(--space-md);
          background: transparent;
          border: none;
          border-radius: var(--border-radius);
          cursor: pointer;
          transition: all var(--transition-fast);
          text-align: left;
          font-family: var(--font-main);
          font-size: var(--font-size-sm);
        }

        .space-item:hover {
          background: var(--gum-gray-100);
        }

        .space-item.active {
          background: var(--space-color, var(--gum-pink));
          font-weight: var(--font-weight-bold);
        }

        .space-indicator {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--space-color, var(--gum-pink));
          border: 1px solid var(--gum-black);
          flex-shrink: 0;
        }

        .org-indicator {
          background: var(--gum-blue);
        }

        .space-code {
          font-family: var(--font-mono);
          font-size: var(--font-size-xs);
          color: var(--gum-gray-600);
          min-width: 32px;
        }

        .space-item.active .space-code {
          color: var(--gum-black);
        }

        .space-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .custom-spaces-section {
          border-top: 1px solid var(--gum-gray-200);
          padding-top: var(--space-md);
        }

        .empty-hint {
          padding: var(--space-md);
          text-align: center;
        }
      `}</style>
    </aside>
  );
}
