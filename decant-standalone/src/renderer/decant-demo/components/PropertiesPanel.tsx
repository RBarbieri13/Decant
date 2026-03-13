import React, { useState, useCallback, useRef } from 'react';
import { TableRow, PanelTab, TagColor } from '../types';
import { formatDate } from '../helpers';

const Tag: React.FC<{ label: string; color: TagColor }> = ({ label, color }) => (
  <span className={`decant-tag decant-tag--${color}`}>{label}</span>
);

// ============================================================================
// PROPERTIES PANEL COMPONENT
// ============================================================================

interface PropertiesPanelProps {
  item: TableRow | null;
  onClose: () => void;
  onToggle: () => void;
  isVisible: boolean;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ item, onClose, onToggle, isVisible }) => {
  const [activeTab, setActiveTab] = useState<PanelTab>('properties');
  const [panelWidth, setPanelWidth] = useState(320);
  const isResizing = useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX - ev.clientX;
      setPanelWidth(Math.max(240, Math.min(600, startWidth + delta)));
    };
    const onMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [panelWidth]);

  return (
    <div className="decant-panel__wrapper" style={isVisible ? { width: panelWidth } : undefined}>
      <button className="decant-panel__toggle" onClick={onToggle} title={isVisible ? 'Hide properties' : 'Show properties'}>
        <i className={`bx ${isVisible ? 'bx-chevron-right' : 'bx-chevron-left'}`} />
      </button>
      {isVisible && (
        <div className="decant-panel__resize-handle" onMouseDown={handleResizeStart} />
      )}
      {isVisible && !item && (
        <aside className="decant-panel decant-panel--empty">
          <div className="decant-panel__empty-state">
            <i className="bx bx-info-circle" />
            <p>Select an item to view its properties</p>
          </div>
        </aside>
      )}
      {isVisible && item && (
        <aside className="decant-panel">
          <div className="decant-panel__header">
            <button className="decant-panel__close" onClick={onClose}>
              <i className="bx bx-x" />
            </button>
            <img src={item.logo} alt={item.title} className="decant-panel__logo" />
            <h2 className="decant-panel__title">{item.title}</h2>
            <span className="decant-panel__badge">{item.type}</span>
            <div className="decant-panel__quick-stats">
              {item.stars && `★ ${item.stars}`}
              {item.forks && ` • 🍴 ${item.forks}`}
              {item.license && ` • ${item.license}`}
            </div>
          </div>

          <div className="decant-panel__tabs">
            <button
              className={`decant-panel__tab ${activeTab === 'properties' ? 'decant-panel__tab--active' : ''}`}
              onClick={() => setActiveTab('properties')}
            >
              Properties
            </button>
            <button
              className={`decant-panel__tab ${activeTab === 'related' ? 'decant-panel__tab--active' : ''}`}
              onClick={() => setActiveTab('related')}
            >
              Related
            </button>
            <button
              className={`decant-panel__tab ${activeTab === 'backlinks' ? 'decant-panel__tab--active' : ''}`}
              onClick={() => setActiveTab('backlinks')}
            >
              Backlinks
            </button>
          </div>

          <div className="decant-panel__content">
            {activeTab === 'properties' && (
              <>
                {(item.shortDescription || item.quickPhrase) && (
                  <div className="decant-card">
                    <h3 className="decant-card__title">Description</h3>
                    <p style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--decant-text-primary)', margin: 0 }}>
                      {item.shortDescription || item.quickPhrase}
                    </p>
                  </div>
                )}

                {item.aiSummary && (
                  <div className="decant-card">
                    <h3 className="decant-card__title">AI Summary</h3>
                    <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--decant-text-primary)', margin: 0, whiteSpace: 'pre-wrap' }}>
                      {item.aiSummary}
                    </p>
                  </div>
                )}

                <div className="decant-card">
                  <h3 className="decant-card__title">Source</h3>
                  {item.url && (
                    <div className="decant-card__row">
                      <span className="decant-card__label">URL</span>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="decant-card__value decant-card__value--link"
                        style={{ fontSize: '12px', wordBreak: 'break-all' }}
                      >
                        {item.sourceDomain || item.url}
                      </a>
                    </div>
                  )}
                  {item.company && item.company !== 'Unknown' && (
                    <div className="decant-card__row">
                      <span className="decant-card__label">Company</span>
                      <span className="decant-card__value">{item.company}</span>
                    </div>
                  )}
                  <div className="decant-card__row">
                    <span className="decant-card__label">Added</span>
                    <span className="decant-card__value">{formatDate(item.date)}</span>
                  </div>
                </div>

                <div className="decant-card">
                  <h3 className="decant-card__title">Classification</h3>
                  <div className="decant-card__row">
                    <span className="decant-card__label">Segment</span>
                    <span className="decant-card__value">{item.segment}</span>
                  </div>
                  <div className="decant-card__row">
                    <span className="decant-card__label">Category</span>
                    <span className="decant-card__value">{item.category}</span>
                  </div>
                  <div className="decant-card__row">
                    <span className="decant-card__label">Type</span>
                    <span className="decant-card__value">{item.typeSymbol} {item.type}</span>
                  </div>
                </div>

                {item.keyConcepts && item.keyConcepts.length > 0 && (
                  <div className="decant-card">
                    <h3 className="decant-card__title">Key Concepts</h3>
                    <div className="decant-panel__tags">
                      {item.keyConcepts.map((concept, i) => (
                        <Tag key={i} label={concept.replace(/_/g, ' ')} color="purple" />
                      ))}
                    </div>
                  </div>
                )}

                {item.tags.length > 0 && (
                  <div className="decant-card">
                    <h3 className="decant-card__title">Tags</h3>
                    <div className="decant-panel__tags">
                      {item.tags.map((tag, i) => (
                        <Tag key={i} label={tag.label} color={tag.color} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'related' && (
              <div className="decant-card">
                <h3 className="decant-card__title">Related Items</h3>
                <p style={{ fontSize: '13px', color: 'var(--decant-text-secondary)' }}>
                  Items related to {item.title} based on tags and category.
                </p>
                {item.usedBy && (
                  <div style={{ marginTop: '12px' }}>
                    <div className="decant-panel__tags">
                      {item.usedBy.map((company, i) => (
                        <Tag key={i} label={company} color="gray" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'backlinks' && (
              <div className="decant-card">
                <h3 className="decant-card__title">Backlinks</h3>
                <p style={{ fontSize: '13px', color: 'var(--decant-text-secondary)' }}>
                  Items that reference {item.title}.
                </p>
              </div>
            )}
          </div>

          <div className="decant-panel__actions">
            <button
              className="decant-panel__action-btn decant-panel__action-btn--primary"
              onClick={() => item.url && window.open(item.url, '_blank', 'noopener,noreferrer')}
              disabled={!item.url}
            >
              Open
            </button>
            <button className="decant-panel__action-btn">Edit</button>
            <button className="decant-panel__action-btn">Link</button>
            <button className="decant-panel__action-btn">Share</button>
          </div>
        </aside>
      )}
    </div>
  );
};
