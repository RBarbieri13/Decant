import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TableRow, PanelTab, TagColor } from '../types';
import { summaryAPI, type NodeSummaryData, type NodeSummaryStat, type NodeSummaryEntity, type NodeSummaryTimelineItem } from '../../services/api';

const Tag: React.FC<{ label: string; color: TagColor }> = ({ label, color }) => (
  <span className={`decant-tag decant-tag--${color}`}>{label}</span>
);

// ============================================================================
// CATEGORY PILL
// ============================================================================

const CATEGORY_COLORS: Record<string, { bg: string; fg: string }> = {
  blue:   { bg: '#dbeafe', fg: '#1e40af' },
  teal:   { bg: '#ccfbf1', fg: '#115e59' },
  coral:  { bg: '#ffe4e6', fg: '#be123c' },
  pink:   { bg: '#fce7f3', fg: '#9d174d' },
  gray:   { bg: '#f3f4f6', fg: '#374151' },
  green:  { bg: '#dcfce7', fg: '#166534' },
  amber:  { bg: '#fef3c7', fg: '#92400e' },
  red:    { bg: '#fee2e2', fg: '#991b1b' },
  purple: { bg: '#f3e8ff', fg: '#6b21a8' },
};

const CategoryPill: React.FC<{ label: string; color: string }> = ({ label, color }) => {
  const c = CATEGORY_COLORS[color] ?? CATEGORY_COLORS.gray;
  return (
    <span className="ns-category-pill" style={{ background: c.bg, color: c.fg }}>
      {label}
    </span>
  );
};

// ============================================================================
// QUICK OUTLINE
// ============================================================================

const QuickOutline: React.FC<{ heading: string; bullets: string[] }> = ({ heading, bullets }) => (
  <div className="ns-outline">
    <h4 className="ns-outline__heading">{heading}</h4>
    <ul className="ns-outline__list">
      {bullets.map((b, i) => (
        <li key={i} className="ns-outline__item">{b}</li>
      ))}
    </ul>
  </div>
);

// ============================================================================
// STAT CARD GRID
// ============================================================================

const STAT_COLORS: Record<string, string> = {
  success: '#16a34a',
  danger: '#dc2626',
  warning: '#d97706',
  info: '#2563eb',
};

const StatCardGrid: React.FC<{ stats: NodeSummaryStat[] }> = ({ stats }) => (
  <div className="ns-stats">
    {stats.map((s, i) => (
      <div key={i} className="ns-stats__card">
        <span className="ns-stats__label">{s.label}</span>
        <span
          className="ns-stats__value"
          style={s.color ? { color: STAT_COLORS[s.color] } : undefined}
        >
          {s.value}
        </span>
      </div>
    ))}
  </div>
);

// ============================================================================
// ENTITY LIST
// ============================================================================

const EntityList: React.FC<{ entities: NodeSummaryEntity[] }> = ({ entities }) => (
  <div className="ns-entities">
    {entities.map((e, i) => {
      const c = CATEGORY_COLORS[e.color] ?? CATEGORY_COLORS.gray;
      return (
        <div key={i} className="ns-entity">
          <span className="ns-entity__avatar" style={{ background: c.bg, color: c.fg }}>
            {e.abbreviation}
          </span>
          <div className="ns-entity__info">
            <span className="ns-entity__name">{e.name}</span>
            <span className="ns-entity__role">{e.role}</span>
          </div>
        </div>
      );
    })}
  </div>
);

// ============================================================================
// RELATIONSHIP DIAGRAM (inline SVG)
// ============================================================================

const RelationshipDiagram: React.FC<{
  relationships: { from: string; to: string; label: string }[];
  entities: NodeSummaryEntity[];
}> = ({ relationships, entities }) => {
  if (relationships.length === 0) return null;

  const entityColorMap = new Map(entities.map(e => [e.name, e.color]));

  return (
    <div className="ns-relationships">
      {relationships.map((r, i) => {
        const fromColor = CATEGORY_COLORS[entityColorMap.get(r.from) ?? 'gray'];
        const toColor = CATEGORY_COLORS[entityColorMap.get(r.to) ?? 'gray'];
        return (
          <div key={i} className="ns-rel-row">
            <span className="ns-rel-box" style={{ background: fromColor.bg, color: fromColor.fg }}>
              {r.from}
            </span>
            <span className="ns-rel-arrow">
              <span className="ns-rel-label">{r.label}</span>
              <svg width="32" height="12" viewBox="0 0 32 12">
                <line x1="0" y1="6" x2="26" y2="6" stroke="#9ca3af" strokeWidth="1.5" />
                <polygon points="26,2 32,6 26,10" fill="#9ca3af" />
              </svg>
            </span>
            <span className="ns-rel-box" style={{ background: toColor.bg, color: toColor.fg }}>
              {r.to}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// VERTICAL TIMELINE
// ============================================================================

const TIMELINE_DOT_COLORS: Record<string, string> = {
  complete: '#16a34a',
  active: '#2563eb',
  upcoming: '#d1d5db',
};

const VerticalTimeline: React.FC<{ items: NodeSummaryTimelineItem[] }> = ({ items }) => {
  if (items.length === 0) return null;
  return (
    <div className="ns-timeline">
      {items.map((t, i) => (
        <div key={i} className={`ns-timeline__item ns-timeline__item--${t.status}`}>
          <div className="ns-timeline__track">
            <span
              className="ns-timeline__dot"
              style={{ background: TIMELINE_DOT_COLORS[t.status] }}
            />
            {i < items.length - 1 && <span className="ns-timeline__line" />}
          </div>
          <div className="ns-timeline__content">
            <span className="ns-timeline__date">{t.date}</span>
            <span className="ns-timeline__desc">{t.description}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// TAG CLOUD
// ============================================================================

const TagCloud: React.FC<{ tags: string[] }> = ({ tags }) => (
  <div className="ns-tags">
    {tags.map((t, i) => (
      <span key={i} className="ns-tag">{t}</span>
    ))}
  </div>
);

// ============================================================================
// SOURCE LINK
// ============================================================================

const SourceLink: React.FC<{ url: string; label: string | null }> = ({ url, label }) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    className="ns-source-link"
  >
    <span>{label || 'Visit source'}</span>
    <i className="bx bx-link-external" />
  </a>
);

// ============================================================================
// SUMMARY CONTENT — renders the full AI summary
// ============================================================================

const SummaryContent: React.FC<{ data: NodeSummaryData; url?: string }> = ({ data, url }) => (
  <div className="ns-content">
    {/* Category pill */}
    <CategoryPill label={data.category.label} color={data.category.color} />

    {/* Title */}
    <h2 className="ns-title">{data.title}</h2>

    {/* Summary */}
    <p className="ns-summary">{data.summary}</p>

    {/* Quick outline */}
    <QuickOutline heading={data.quick_outline.heading} bullets={data.quick_outline.bullets} />

    {/* Stat cards */}
    {data.stats.length > 0 && <StatCardGrid stats={data.stats} />}

    {/* Entities */}
    {data.entities.length > 0 && (
      <div className="ns-section">
        <h4 className="ns-section__label">Key Entities</h4>
        <EntityList entities={data.entities} />
      </div>
    )}

    {/* Relationships */}
    {data.relationships.length > 0 && (
      <div className="ns-section">
        <h4 className="ns-section__label">Relationships</h4>
        <RelationshipDiagram relationships={data.relationships} entities={data.entities} />
      </div>
    )}

    {/* Timeline */}
    {data.timeline.length > 0 && (
      <div className="ns-section">
        <h4 className="ns-section__label">Timeline</h4>
        <VerticalTimeline items={data.timeline} />
      </div>
    )}

    {/* Tags */}
    {data.tags.length > 0 && (
      <div className="ns-section">
        <h4 className="ns-section__label">Tags</h4>
        <TagCloud tags={data.tags} />
      </div>
    )}

    {/* Source link */}
    {url && <SourceLink url={url} label={data.link_label} />}
  </div>
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
  const [panelWidth, setPanelWidth] = useState(380);
  const isResizing = useRef(false);

  // Summary state
  const [summaryData, setSummaryData] = useState<NodeSummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [currentSummaryNodeId, setCurrentSummaryNodeId] = useState<string | null>(null);

  // Fetch summary when item changes
  useEffect(() => {
    if (!item || item.id === currentSummaryNodeId) return;

    setCurrentSummaryNodeId(item.id);
    setSummaryData(null);
    setSummaryError(null);

    // Fetch cached summary
    summaryAPI.get(item.id)
      .then((res) => {
        if (res.summary) {
          setSummaryData(res.summary);
        }
      })
      .catch(() => {
        // Silently fail — we'll show fallback content
      });
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate / refresh summary
  const handleGenerateSummary = useCallback(async (force: boolean = false) => {
    if (!item) return;
    setSummaryLoading(true);
    setSummaryError(null);

    try {
      const res = await summaryAPI.generate(item.id, force);
      if (res.summary) {
        setSummaryData(res.summary);
      } else {
        setSummaryError('No summary returned');
      }
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setSummaryLoading(false);
    }
  }, [item]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX - ev.clientX;
      setPanelWidth(Math.max(320, Math.min(650, startWidth + delta)));
    };
    const onMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [panelWidth]);

  const hasSummary = !!summaryData;

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
          {/* Compact header */}
          <div className="pp-hero">
            <div className="pp-hero__actions">
              <button
                className="pp-hero__refresh-btn"
                onClick={() => handleGenerateSummary(true)}
                disabled={summaryLoading}
                title="Regenerate AI summary"
              >
                <i className={`bx bx-refresh ${summaryLoading ? 'bx-spin' : ''}`} />
              </button>
              <button className="decant-panel__close" onClick={onClose}>
                <i className="bx bx-x" />
              </button>
            </div>
            <div className="pp-hero__top">
              <img src={item.logo} alt="" className="pp-hero__logo" />
              <div className="pp-hero__meta">
                <span className="pp-hero__type-badge">{item.typeSymbol} {item.type}</span>
                {item.sourceDomain && (
                  <span className="pp-hero__domain">{item.sourceDomain}</span>
                )}
              </div>
            </div>
            {/* Only show hero title/phrase when no summary (avoid duplication) */}
            {!hasSummary && (
              <>
                <h2 className="pp-hero__title">{item.title}</h2>
                {item.quickPhrase && (
                  <p className="pp-hero__phrase">{item.quickPhrase}</p>
                )}
              </>
            )}
            <div className="pp-hero__pills">
              {hasSummary && (
                <CategoryPill label={summaryData!.category.label} color={summaryData!.category.color} />
              )}
              {!hasSummary && (
                <>
                  <span className="pp-pill pp-pill--segment">{item.segment}</span>
                  <span className="pp-pill pp-pill--category">{item.category}</span>
                  {item.company && item.company !== 'Unknown' && (
                    <span className="pp-pill pp-pill--org">{item.company}</span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="decant-panel__tabs">
            <button
              className={`decant-panel__tab ${activeTab === 'properties' ? 'decant-panel__tab--active' : ''}`}
              onClick={() => setActiveTab('properties')}
            >
              Summary
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
              <div className="ns-tab-content">
                {/* AI-generated summary */}
                {summaryData && (
                  <div className={`ns-content-wrap ${summaryLoading ? 'ns-content-wrap--refreshing' : ''}`}>
                    <SummaryContent data={summaryData} url={item.url} />
                    {summaryLoading && (
                      <div className="ns-refresh-overlay">
                        <i className="bx bx-loader-alt bx-spin" />
                      </div>
                    )}
                  </div>
                )}

                {/* Loading state (initial, no existing summary) */}
                {summaryLoading && !summaryData && (
                  <div className="ns-loading">
                    <div className="ns-loading__spinner" />
                    <span>Generating summary...</span>
                    <span className="ns-loading__sub">This may take a few seconds</span>
                  </div>
                )}

                {/* Error state */}
                {summaryError && !summaryLoading && (
                  <div className="ns-error">
                    <div className="ns-error__icon">
                      <i className="bx bx-error-circle" />
                    </div>
                    <p className="ns-error__msg">{summaryError}</p>
                    <button className="ns-error__retry" onClick={() => handleGenerateSummary(true)}>
                      <i className="bx bx-refresh" />
                      Retry
                    </button>
                  </div>
                )}

                {/* Empty state — no summary yet */}
                {!summaryData && !summaryLoading && !summaryError && (
                  <div className="ns-empty">
                    <div className="ns-empty__icon">
                      <i className="bx bxs-magic-wand" />
                    </div>
                    <p className="ns-empty__title">No summary yet</p>
                    <p className="ns-empty__desc">
                      Generate an AI summary to see key points, entities, and timeline at a glance.
                    </p>
                    <button
                      className="ns-empty__btn"
                      onClick={() => handleGenerateSummary(false)}
                    >
                      <i className="bx bx-bulb" />
                      Generate Summary
                    </button>

                    {/* Fallback: show existing data */}
                    {(item.shortDescription || item.aiSummary) && (
                      <div className="ns-empty__fallback">
                        {item.shortDescription && (
                          <p className="ns-empty__fallback-text">{item.shortDescription}</p>
                        )}
                        {item.aiSummary && (
                          <div className="ns-empty__basic-summary">
                            <span className="ns-empty__basic-label">Basic Summary</span>
                            <p>{item.aiSummary}</p>
                          </div>
                        )}
                      </div>
                    )}
                    {item.keyConcepts && item.keyConcepts.length > 0 && (
                      <div className="ns-empty__concepts">
                        <div className="pp-chip-group">
                          {item.keyConcepts.map((concept, i) => (
                            <Tag key={i} label={concept.replace(/_/g, ' ')} color="purple" />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
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
// Panel-specific styles (scoped to pp- and ns- prefixes)
// ============================================================================

const panelStyles = `
  /* Hero header */
  .pp-hero {
    padding: 14px 16px 10px;
    border-bottom: 1px solid var(--gum-gray-200, #e5e7eb);
    position: relative;
  }

  .pp-hero__actions {
    position: absolute;
    top: 10px;
    right: 10px;
    display: flex;
    gap: 4px;
  }

  .pp-hero__refresh-btn {
    background: none;
    border: 1px solid var(--gum-gray-200, #e5e7eb);
    border-radius: 6px;
    padding: 4px 6px;
    cursor: pointer;
    color: var(--gum-gray-500, #6b7280);
    font-size: 16px;
    display: flex;
    align-items: center;
    transition: all 0.15s ease;
  }

  .pp-hero__refresh-btn:hover:not(:disabled) {
    background: var(--gum-gray-100, #f3f4f6);
    color: var(--gum-gray-700, #374151);
    border-color: var(--gum-gray-300, #d1d5db);
  }

  .pp-hero__refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .pp-hero__top {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }

  .pp-hero__logo {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    object-fit: cover;
    background: var(--gum-gray-100, #f3f4f6);
    flex-shrink: 0;
  }

  .pp-hero__meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .pp-hero__type-badge {
    font-size: 11px;
    font-weight: 600;
    color: var(--gum-gray-600, #4b5563);
    background: var(--gum-gray-100, #f3f4f6);
    padding: 2px 8px;
    border-radius: 4px;
    width: fit-content;
  }

  .pp-hero__domain {
    font-size: 11px;
    color: var(--gum-gray-500, #6b7280);
  }

  .pp-hero__title {
    font-size: 16px;
    font-weight: 700;
    line-height: 1.3;
    margin: 0 0 4px;
    color: var(--decant-text-primary, #1f2937);
    padding-right: 60px;
  }

  .pp-hero__phrase {
    font-size: 13px;
    line-height: 1.5;
    color: var(--gum-gray-600, #4b5563);
    margin: 0 0 8px;
  }

  .pp-hero__pills {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 4px;
  }

  .pp-pill {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 10px;
    white-space: nowrap;
  }

  .pp-pill--segment { background: #fce4ec; color: #c62828; }
  .pp-pill--category { background: #e3f2fd; color: #1565c0; }
  .pp-pill--org { background: #f3e5f5; color: #6a1b9a; }

  /* Shared section styles */
  .pp-section { padding: 12px 16px; }
  .pp-section__label {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.5px; color: var(--gum-gray-500, #6b7280); margin: 0 0 8px;
  }
  .pp-description {
    font-size: 13px; line-height: 1.6;
    color: var(--decant-text-primary, #1f2937); margin: 0;
  }
  .pp-chip-group { display: flex; flex-wrap: wrap; gap: 5px; }

  /* ====================== */
  /* NODE SUMMARY STYLES    */
  /* ====================== */

  .ns-tab-content {
    min-height: 120px;
  }

  .ns-content-wrap {
    position: relative;
    transition: opacity 0.2s ease;
  }

  .ns-content-wrap--refreshing {
    opacity: 0.45;
    pointer-events: none;
  }

  .ns-refresh-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
  }

  .ns-refresh-overlay i {
    font-size: 28px;
    color: #8b5cf6;
  }

  .ns-content {
    padding: 16px;
  }

  /* Category pill */
  .ns-category-pill {
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }

  /* Title */
  .ns-title {
    font-size: 16px;
    font-weight: 700;
    line-height: 1.35;
    margin: 0 0 6px;
    color: var(--decant-text-primary, #1f2937);
  }

  /* Summary paragraph */
  .ns-summary {
    font-size: 13px;
    line-height: 1.65;
    color: var(--gum-gray-600, #4b5563);
    margin: 0 0 16px;
  }

  /* Quick outline */
  .ns-outline {
    margin-bottom: 16px;
    padding: 10px 12px;
    background: var(--gum-gray-50, #f9fafb);
    border-radius: 8px;
    border: 1px solid var(--gum-gray-150, #eaecf0);
  }

  .ns-outline__heading {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--gum-gray-500, #6b7280);
    margin: 0 0 6px;
  }

  .ns-outline__list {
    margin: 0;
    padding-left: 14px;
    list-style: none;
  }

  .ns-outline__item {
    font-size: 12.5px;
    line-height: 1.55;
    color: var(--decant-text-primary, #1f2937);
    padding: 2px 0;
    position: relative;
  }

  .ns-outline__item::before {
    content: '';
    position: absolute;
    left: -11px;
    top: 9px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--gum-gray-400, #9ca3af);
  }

  /* Stat cards */
  .ns-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
    margin-bottom: 16px;
  }

  .ns-stats__card {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 8px 10px;
    background: var(--gum-gray-50, #f9fafb);
    border: 1px solid var(--gum-gray-150, #eaecf0);
    border-radius: 8px;
  }

  .ns-stats__label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: var(--gum-gray-500, #6b7280);
  }

  .ns-stats__value {
    font-size: 15px;
    font-weight: 700;
    color: var(--decant-text-primary, #1f2937);
  }

  /* Sections */
  .ns-section {
    margin-bottom: 16px;
  }

  .ns-section__label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--gum-gray-500, #6b7280);
    margin: 0 0 8px;
  }

  /* Entities */
  .ns-entities {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .ns-entity {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ns-entity__avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .ns-entity__info {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .ns-entity__name {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--decant-text-primary, #1f2937);
    line-height: 1.3;
  }

  .ns-entity__role {
    font-size: 10.5px;
    color: var(--gum-gray-500, #6b7280);
    line-height: 1.3;
  }

  /* Relationships */
  .ns-relationships {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ns-rel-row {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
  }

  .ns-rel-box {
    font-size: 10.5px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 5px;
    white-space: nowrap;
    max-width: 110px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ns-rel-arrow {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
  }

  .ns-rel-label {
    font-size: 9px;
    color: var(--gum-gray-500, #6b7280);
    font-style: italic;
  }

  /* Timeline */
  .ns-timeline {
    display: flex;
    flex-direction: column;
  }

  .ns-timeline__item {
    display: flex;
    gap: 10px;
    min-height: 32px;
  }

  .ns-timeline__track {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 12px;
    flex-shrink: 0;
  }

  .ns-timeline__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 4px;
  }

  .ns-timeline__item--active .ns-timeline__dot {
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
  }

  .ns-timeline__line {
    width: 1.5px;
    flex: 1;
    background: var(--gum-gray-200, #e5e7eb);
    margin: 2px 0;
  }

  .ns-timeline__content {
    display: flex;
    flex-direction: column;
    padding-bottom: 6px;
  }

  .ns-timeline__date {
    font-size: 10px;
    font-weight: 700;
    color: var(--gum-gray-500, #6b7280);
  }

  .ns-timeline__desc {
    font-size: 12.5px;
    color: var(--decant-text-primary, #1f2937);
    line-height: 1.4;
  }

  .ns-timeline__item--upcoming .ns-timeline__date,
  .ns-timeline__item--upcoming .ns-timeline__desc {
    opacity: 0.45;
  }

  /* Tags */
  .ns-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .ns-tag {
    font-size: 10.5px;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--gum-gray-100, #f3f4f6);
    color: var(--gum-gray-600, #4b5563);
    border: 1px solid var(--gum-gray-200, #e5e7eb);
  }

  /* Source link */
  .ns-source-link {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-top: 16px;
    padding: 6px 12px;
    background: var(--gum-gray-50, #f9fafb);
    border: 1px solid var(--gum-gray-200, #e5e7eb);
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    color: var(--gum-green, #22c55e);
    text-decoration: none;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .ns-source-link:hover {
    background: var(--gum-gray-100, #f3f4f6);
    border-color: var(--gum-gray-300, #d1d5db);
  }

  .ns-source-link i {
    font-size: 13px;
  }

  /* Loading state */
  .ns-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 56px 20px;
    color: var(--gum-gray-500, #6b7280);
  }

  .ns-loading__spinner {
    width: 28px;
    height: 28px;
    border: 3px solid var(--gum-gray-200, #e5e7eb);
    border-top-color: #8b5cf6;
    border-radius: 50%;
    animation: ns-spin 0.7s linear infinite;
  }

  @keyframes ns-spin {
    to { transform: rotate(360deg); }
  }

  .ns-loading span {
    font-size: 13px;
    font-weight: 500;
  }

  .ns-loading__sub {
    font-size: 11px !important;
    font-weight: 400 !important;
    color: var(--gum-gray-400, #9ca3af);
  }

  /* Error state */
  .ns-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 40px 24px;
    text-align: center;
  }

  .ns-error__icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #fef2f2;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ns-error__icon i {
    font-size: 20px;
    color: #dc2626;
  }

  .ns-error__msg {
    font-size: 13px;
    color: var(--gum-gray-600, #4b5563);
    margin: 0;
    line-height: 1.5;
    max-width: 260px;
  }

  .ns-error__retry {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 16px;
    border: 1px solid var(--gum-gray-200, #e5e7eb);
    border-radius: 6px;
    background: white;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    color: var(--gum-gray-700, #374151);
    transition: all 0.15s;
  }

  .ns-error__retry:hover {
    background: var(--gum-gray-50, #f9fafb);
    border-color: var(--gum-gray-300, #d1d5db);
  }

  .ns-error__retry i {
    font-size: 14px;
  }

  /* Empty state */
  .ns-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 36px 20px 24px;
    text-align: center;
  }

  .ns-empty__icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: linear-gradient(135deg, #ede9fe, #ddd6fe);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 4px;
  }

  .ns-empty__icon i {
    font-size: 22px;
    color: #7c3aed;
  }

  .ns-empty__title {
    font-size: 14px;
    font-weight: 600;
    color: var(--decant-text-primary, #1f2937);
    margin: 0;
  }

  .ns-empty__desc {
    font-size: 12.5px;
    color: var(--gum-gray-500, #6b7280);
    margin: 0 0 8px;
    max-width: 260px;
    line-height: 1.5;
  }

  .ns-empty__btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 20px;
    border: none;
    border-radius: 8px;
    background: linear-gradient(135deg, #8b5cf6, #6d28d9);
    color: white;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .ns-empty__btn:hover {
    background: linear-gradient(135deg, #7c3aed, #5b21b6);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
  }

  .ns-empty__btn i {
    font-size: 15px;
  }

  .ns-empty__fallback {
    width: 100%;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--gum-gray-150, #eaecf0);
    text-align: left;
  }

  .ns-empty__fallback-text {
    font-size: 13px;
    line-height: 1.6;
    color: var(--decant-text-primary, #1f2937);
    margin: 0 0 10px;
  }

  .ns-empty__basic-summary {
    padding: 10px 12px;
    background: linear-gradient(135deg, #fefce8, #fef9c3);
    border-radius: 8px;
    border-left: 3px solid #eab308;
  }

  .ns-empty__basic-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: #92400e;
    display: block;
    margin-bottom: 4px;
  }

  .ns-empty__basic-summary p {
    font-size: 12.5px;
    line-height: 1.6;
    color: #78350f;
    margin: 0;
    text-align: left;
  }

  .ns-empty__concepts {
    width: 100%;
    margin-top: 12px;
    text-align: left;
  }
`;
