import React, { useState, useEffect } from 'react';
import { TableRow, PanelTab, TagColor } from '../types';
import { formatDate } from '../helpers';

const Tag: React.FC<{ label: string; color: TagColor }> = ({ label, color }) => (
  <span className={`decant-tag decant-tag--${color}`}>{label}</span>
);

// ============================================================================
// HYBRID DETAIL CARD MODAL COMPONENT
// ============================================================================

interface HybridDetailCardProps {
  item: TableRow | null;
  isOpen: boolean;
  onClose: () => void;
}

export const HybridDetailCard: React.FC<HybridDetailCardProps> = ({ item, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<PanelTab>('properties');
  const [isDependenciesExpanded, setIsDependenciesExpanded] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  // Backdrop click handler
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="decant-modal-backdrop" onClick={handleBackdropClick}>
      <div className="decant-hybrid-card" onClick={(e) => e.stopPropagation()}>
        {/* Header Section */}
        <div className="decant-hybrid-card__header">
          <button className="decant-hybrid-card__close" onClick={onClose} aria-label="Close">
            <i className="bx bx-x" />
          </button>

          <img src={item.logo} alt={item.title} className="decant-hybrid-card__logo" />
          <h2 className="decant-hybrid-card__title">{item.title}</h2>
          <span className="decant-hybrid-card__type-badge">{item.type}</span>

          <div className="decant-hybrid-card__quick-stats">
            {item.stars && <span>★ {item.stars}</span>}
            {item.forks && <span>🍴 {item.forks}</span>}
            {item.license && <span>{item.license}</span>}
          </div>
        </div>

        {/* Tabs Section */}
        <div className="decant-hybrid-card__tabs">
          <button
            className={`decant-hybrid-card__tab ${activeTab === 'properties' ? 'decant-hybrid-card__tab--active' : ''}`}
            onClick={() => setActiveTab('properties')}
          >
            Properties
          </button>
          <button
            className={`decant-hybrid-card__tab ${activeTab === 'related' ? 'decant-hybrid-card__tab--active' : ''}`}
            onClick={() => setActiveTab('related')}
          >
            Related Items
          </button>
          <button
            className={`decant-hybrid-card__tab ${activeTab === 'backlinks' ? 'decant-hybrid-card__tab--active' : ''}`}
            onClick={() => setActiveTab('backlinks')}
          >
            Backlinks
          </button>
        </div>

        {/* Content Section */}
        <div className="decant-hybrid-card__content">
          {activeTab === 'properties' && (
            <div className="decant-hybrid-card__properties">
              {/* General Card */}
              <div className="decant-hybrid-card__section">
                <h3 className="decant-hybrid-card__section-title">General</h3>
                {item.version && (
                  <div className="decant-hybrid-card__row">
                    <span className="decant-hybrid-card__label">Version</span>
                    <span className="decant-hybrid-card__value">{item.version}</span>
                  </div>
                )}
                {item.license && (
                  <div className="decant-hybrid-card__row">
                    <span className="decant-hybrid-card__label">License</span>
                    <span className="decant-hybrid-card__value">{item.license}</span>
                  </div>
                )}
                {item.author && (
                  <div className="decant-hybrid-card__row">
                    <span className="decant-hybrid-card__label">Author</span>
                    <span className="decant-hybrid-card__value">{item.author}</span>
                  </div>
                )}
                {item.repository && (
                  <div className="decant-hybrid-card__row">
                    <span className="decant-hybrid-card__label">Repository</span>
                    <span className="decant-hybrid-card__value decant-hybrid-card__value--link">
                      {item.repository}
                    </span>
                  </div>
                )}
              </div>

              {/* Statistics Card */}
              <div className="decant-hybrid-card__section">
                <h3 className="decant-hybrid-card__section-title">Statistics</h3>
                {item.stars && (
                  <div className="decant-hybrid-card__row">
                    <span className="decant-hybrid-card__label">Stars</span>
                    <span className="decant-hybrid-card__value">★ {item.stars}</span>
                  </div>
                )}
                {item.forks && (
                  <div className="decant-hybrid-card__row">
                    <span className="decant-hybrid-card__label">Forks</span>
                    <span className="decant-hybrid-card__value">🍴 {item.forks}</span>
                  </div>
                )}
                {item.downloads && (
                  <div className="decant-hybrid-card__row">
                    <span className="decant-hybrid-card__label">Downloads</span>
                    <span className="decant-hybrid-card__value">{item.downloads}</span>
                  </div>
                )}
                {item.lastUpdated && (
                  <div className="decant-hybrid-card__row">
                    <span className="decant-hybrid-card__label">Last Updated</span>
                    <span className="decant-hybrid-card__value">{item.lastUpdated}</span>
                  </div>
                )}
              </div>

              {/* Dependencies Card */}
              <div className="decant-hybrid-card__section">
                <div className="decant-hybrid-card__section-header">
                  <h3 className="decant-hybrid-card__section-title">
                    Dependencies
                    <span className="decant-hybrid-card__count-badge">2</span>
                  </h3>
                  <button
                    className="decant-hybrid-card__collapse-btn"
                    onClick={() => setIsDependenciesExpanded(!isDependenciesExpanded)}
                    aria-label={isDependenciesExpanded ? 'Collapse' : 'Expand'}
                  >
                    <i className={`bx ${isDependenciesExpanded ? 'bx-chevron-up' : 'bx-chevron-down'}`} />
                  </button>
                </div>
                {isDependenciesExpanded && (
                  <div className="decant-hybrid-card__dependencies">
                    <div className="decant-hybrid-card__dependency">loose-envify</div>
                    <div className="decant-hybrid-card__dependency">scheduler</div>
                  </div>
                )}
              </div>

              {/* Metadata Card */}
              <div className="decant-hybrid-card__section">
                <h3 className="decant-hybrid-card__section-title">Metadata</h3>
                <div className="decant-hybrid-card__row">
                  <span className="decant-hybrid-card__label">Brand</span>
                  <span className="decant-hybrid-card__value">{item.company}</span>
                </div>
                <div className="decant-hybrid-card__row">
                  <span className="decant-hybrid-card__label">Category</span>
                  <span className="decant-hybrid-card__value">{item.category}</span>
                </div>
                <div className="decant-hybrid-card__row">
                  <span className="decant-hybrid-card__label">Created</span>
                  <span className="decant-hybrid-card__value">{formatDate(item.date)}</span>
                </div>
                <div className="decant-hybrid-card__row">
                  <span className="decant-hybrid-card__label">Language</span>
                  <span className="decant-hybrid-card__value">JavaScript</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'related' && (
            <div className="decant-hybrid-card__tab-content">
              <div className="decant-hybrid-card__section">
                <h3 className="decant-hybrid-card__section-title">Related Items</h3>
                <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
                  Items related to {item.title} based on tags and category.
                </p>
                {item.usedBy && item.usedBy.length > 0 && (
                  <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {item.usedBy.map((company, i) => (
                      <Tag key={i} label={company} color="gray" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'backlinks' && (
            <div className="decant-hybrid-card__tab-content">
              <div className="decant-hybrid-card__section">
                <h3 className="decant-hybrid-card__section-title">Backlinks</h3>
                <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
                  Items that reference {item.title}.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions Section */}
        <div className="decant-hybrid-card__footer">
          <button className="decant-hybrid-card__action decant-hybrid-card__action--primary">
            <i className="bx bx-folder-open" />
            Open
          </button>
          <button className="decant-hybrid-card__action">
            <i className="bx bx-edit" />
            Edit
          </button>
          <button className="decant-hybrid-card__action">
            <i className="bx bx-link" />
            Link
          </button>
          <button className="decant-hybrid-card__action">
            <i className="bx bx-share-alt" />
            Share
          </button>
        </div>
      </div>
    </div>
  );
};
