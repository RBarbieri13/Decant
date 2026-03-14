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
  const [panelWidth, setPanelWidth] = useState(360);
  const isResizing = useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX - ev.clientX;
      setPanelWidth(Math.max(300, Math.min(650, startWidth + delta)));
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
          {/* Hero header with logo, title, and quick meta */}
          <div className="pp-hero">
            <button className="decant-panel__close" onClick={onClose}>
              <i className="bx bx-x" />
            </button>
            <div className="pp-hero__top">
              <img src={item.logo} alt="" className="pp-hero__logo" />
              <div className="pp-hero__meta">
                <span className="pp-hero__type-badge">{item.typeSymbol} {item.type}</span>
                {item.sourceDomain && (
                  <span className="pp-hero__domain">{item.sourceDomain}</span>
                )}
              </div>
            </div>
            <h2 className="pp-hero__title">{item.title}</h2>
            {item.quickPhrase && (
              <p className="pp-hero__phrase">{item.quickPhrase}</p>
            )}
            {/* Classification pills */}
            <div className="pp-hero__pills">
              <span className="pp-pill pp-pill--segment">{item.segment}</span>
              <span className="pp-pill pp-pill--category">{item.category}</span>
              {item.company && item.company !== 'Unknown' && (
                <span className="pp-pill pp-pill--org">{item.company}</span>
              )}
            </div>
          </div>

          {/* Tabs */}
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

          {/* Content */}
          <div className="decant-panel__content">
            {activeTab === 'properties' && (
              <>
                {/* Description — concise, readable */}
                {item.shortDescription && (
                  <div className="pp-section">
                    <p className="pp-description">{item.shortDescription}</p>
                  </div>
                )}

                {/* AI Summary — visual callout */}
                {item.aiSummary && (
                  <div className="pp-summary-card">
                    <div className="pp-summary-card__header">
                      <i className="bx bx-bulb" />
                      <span>AI Summary</span>
                    </div>
                    <p className="pp-summary-card__text">{item.aiSummary}</p>
                  </div>
                )}

                {/* Quick info grid */}
                <div className="pp-info-grid">
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pp-info-grid__link"
                    >
                      <i className="bx bx-link-external" />
                      <span>Visit Source</span>
                    </a>
                  )}
                  <div className="pp-info-grid__item">
                    <i className="bx bx-calendar" />
                    <span>{formatDate(item.date)}</span>
                  </div>
                  {item.stars && (
                    <div className="pp-info-grid__item">
                      <i className="bx bxs-star" style={{ color: '#f59e0b' }} />
                      <span>{item.stars}</span>
                    </div>
                  )}
                  {item.forks && (
                    <div className="pp-info-grid__item">
                      <i className="bx bx-git-repo-forked" />
                      <span>{item.forks}</span>
                    </div>
                  )}
                  {item.license && (
                    <div className="pp-info-grid__item">
                      <i className="bx bx-shield" />
                      <span>{item.license}</span>
                    </div>
                  )}
                </div>

                {/* Key Concepts — visual chips */}
                {item.keyConcepts && item.keyConcepts.length > 0 && (
                  <div className="pp-section">
                    <h4 className="pp-section__label">Key Concepts</h4>
                    <div className="pp-chip-group">
                      {item.keyConcepts.map((concept, i) => (
                        <Tag key={i} label={concept.replace(/_/g, ' ')} color="purple" />
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {item.tags.length > 0 && (
                  <div className="pp-section">
                    <h4 className="pp-section__label">Tags</h4>
                    <div className="pp-chip-group">
                      {item.tags.map((tag, i) => (
                        <Tag key={i} label={tag.label} color={tag.color} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'related' && (
              <div className="pp-section">
                <p className="pp-description" style={{ color: 'var(--decant-text-secondary)' }}>
                  Items related to <strong>{item.title}</strong> based on tags and category.
                </p>
                {item.usedBy && (
                  <div className="pp-chip-group" style={{ marginTop: '12px' }}>
                    {item.usedBy.map((company, i) => (
                      <Tag key={i} label={company} color="gray" />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'backlinks' && (
              <div className="pp-section">
                <p className="pp-description" style={{ color: 'var(--decant-text-secondary)' }}>
                  Items that reference <strong>{item.title}</strong>.
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
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

          <style>{panelStyles}</style>
        </aside>
      )}
    </div>
  );
};

// ============================================================================
// Panel-specific styles (scoped to pp- prefix)
// ============================================================================

const panelStyles = `
  /* Hero header */
  .pp-hero {
    padding: 16px 16px 12px;
    border-bottom: 1px solid var(--gum-gray-200, #e5e7eb);
    position: relative;
  }

  .pp-hero__top {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
  }

  .pp-hero__logo {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    object-fit: cover;
    background: var(--gum-gray-100, #f3f4f6);
    flex-shrink: 0;
  }

  .pp-hero__meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .pp-hero__type-badge {
    font-size: 12px;
    font-weight: 600;
    color: var(--gum-gray-600, #4b5563);
    background: var(--gum-gray-100, #f3f4f6);
    padding: 2px 8px;
    border-radius: 4px;
    width: fit-content;
  }

  .pp-hero__domain {
    font-size: 12px;
    color: var(--gum-gray-500, #6b7280);
  }

  .pp-hero__title {
    font-size: 18px;
    font-weight: 700;
    line-height: 1.3;
    margin: 0 0 6px;
    color: var(--decant-text-primary, #1f2937);
  }

  .pp-hero__phrase {
    font-size: 14px;
    line-height: 1.5;
    color: var(--gum-gray-600, #4b5563);
    margin: 0 0 10px;
  }

  .pp-hero__pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .pp-pill {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 12px;
    white-space: nowrap;
  }

  .pp-pill--segment {
    background: #fce4ec;
    color: #c62828;
  }

  .pp-pill--category {
    background: #e3f2fd;
    color: #1565c0;
  }

  .pp-pill--org {
    background: #f3e5f5;
    color: #6a1b9a;
  }

  /* Content sections */
  .pp-section {
    padding: 12px 16px;
  }

  .pp-section__label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--gum-gray-500, #6b7280);
    margin: 0 0 8px;
  }

  .pp-description {
    font-size: 14.5px;
    line-height: 1.6;
    color: var(--decant-text-primary, #1f2937);
    margin: 0;
  }

  /* AI Summary callout */
  .pp-summary-card {
    margin: 4px 16px 8px;
    padding: 12px 14px;
    background: linear-gradient(135deg, #fefce8, #fef9c3);
    border-radius: 10px;
    border-left: 3px solid #eab308;
  }

  .pp-summary-card__header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
    color: #92400e;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .pp-summary-card__header i {
    font-size: 16px;
    color: #d97706;
  }

  .pp-summary-card__text {
    font-size: 13.5px;
    line-height: 1.6;
    color: #78350f;
    margin: 0;
    white-space: pre-wrap;
  }

  /* Quick info grid */
  .pp-info-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 16px 12px;
    border-bottom: 1px solid var(--gum-gray-100, #f3f4f6);
  }

  .pp-info-grid__item,
  .pp-info-grid__link {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 13px;
    color: var(--gum-gray-600, #4b5563);
    padding: 4px 10px;
    background: var(--gum-gray-50, #f9fafb);
    border-radius: 6px;
    border: 1px solid var(--gum-gray-200, #e5e7eb);
  }

  .pp-info-grid__item i,
  .pp-info-grid__link i {
    font-size: 14px;
    color: var(--gum-gray-400, #9ca3af);
  }

  .pp-info-grid__link {
    text-decoration: none;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .pp-info-grid__link:hover {
    background: var(--gum-gray-100, #f3f4f6);
    color: var(--gum-green, #22c55e);
  }

  .pp-info-grid__link i {
    color: var(--gum-green, #22c55e);
  }

  /* Chip groups */
  .pp-chip-group {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
`;
