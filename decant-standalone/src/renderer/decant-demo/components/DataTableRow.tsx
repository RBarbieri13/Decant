import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TableRow, TagColor } from '../types';
import type { UserTag } from '../../services/api';
import { getTypeBadgeClass, formatRelativeDate, SEGMENT_COLOR_HEX } from '../helpers';
import { getSegmentColor, getMetadataCodeColor, formatMetadataCodesForDisplay, parseRawTag } from '../../utils/metadataCodeColors';
import { getCategoryIcon } from '../../utils/hierarchyIcons';

// ============================================================================
// DATA TABLE ROW COMPONENT
// ============================================================================

interface DataTableRowProps {
  data: TableRow;
  isSelected: boolean;
  isExpanded: boolean;
  isChecked: boolean;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onToggleStar: (id: string) => void;
  onToggleCheck: (id: string) => void;
  gridTemplate: string;
  onTagClick?: (tag: string) => void;
  onSegmentClick?: (segCode: string) => void;
  onCategoryClick?: (segCode: string, catCode: string) => void;
  isEnriching?: boolean;
  isColVisible: (col: string) => boolean;
  getColOrder: (col: string) => number;
  onCellEdit?: (rowId: string, field: string, value: string) => void;
  onOpenUrl?: (url: string) => void;
  onReclassify?: (id: string) => void;
  onDelete?: (id: string) => void;
  allUserTags?: UserTag[];
  onUserTagChange?: (nodeId: string, tagIds: string[]) => void;
  onManageUserTags?: () => void;
}

/** Maps frontend TableRow fields to backend API fields */
export const FIELD_TO_API: Record<string, string> = {
  title: 'title',
  subcategoryLabel: 'subcategory_label',
  quickPhrase: 'phrase_description',
  shortDescription: 'short_description',
  functionTags: 'function_tags',
  company: 'company',
};

const EDITABLE_FIELDS = new Set(Object.keys(FIELD_TO_API));

export const DataTableRow: React.FC<DataTableRowProps> = ({
  data,
  isSelected,
  isExpanded,
  isChecked,
  onSelect,
  onToggleExpand,
  onToggleStar,
  onToggleCheck,
  gridTemplate,
  onTagClick,
  onSegmentClick,
  onCategoryClick,
  isEnriching,
  isColVisible,
  getColOrder,
  onCellEdit,
  onOpenUrl,
  onReclassify,
  onDelete,
  allUserTags,
  onUserTagChange,
  onManageUserTags,
}) => {
  const rowColorClass = data.rowColor ? `decant-table__row--${data.rowColor}` : '';
  const [faviconError, setFaviconError] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showTagPicker, setShowTagPicker] = useState(false);
  const tagPickerRef = useRef<HTMLDivElement>(null);

  // Close tag picker on outside click
  useEffect(() => {
    if (!showTagPicker) return;
    const handler = (e: MouseEvent) => {
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target as Node)) {
        setShowTagPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTagPicker]);

  const handleStartEdit = useCallback((field: string, currentValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!EDITABLE_FIELDS.has(field)) return;
    setEditingField(field);
    setEditValue(currentValue);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingField && onCellEdit) {
      const currentVal = (data as unknown as Record<string, unknown>)[editingField] as string || '';
      if (editValue !== currentVal) {
        onCellEdit(data.id, editingField, editValue);
      }
    }
    setEditingField(null);
  }, [editingField, editValue, onCellEdit, data]);

  const handleCancelEdit = useCallback(() => {
    setEditingField(null);
  }, []);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSaveEdit(); }
    if (e.key === 'Escape') { e.preventDefault(); handleCancelEdit(); }
  }, [handleSaveEdit, handleCancelEdit]);

  const editInput = (field: string) => (
    <input
      className="decant-inline-edit"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={handleSaveEdit}
      onKeyDown={handleEditKeyDown}
      autoFocus
      onClick={(e) => e.stopPropagation()}
    />
  );

  // Get segment badge class
  const getSegmentClass = (segment: string) => {
    const color = getSegmentColor(segment.charAt(0).toUpperCase());
    if (color) return `decant-segment-badge--${color}`;
    return '';
  };

  // Map segment color names to hex for CSS variable
  const segmentColorHex: Record<string, string> = {
    pink: '#ec4899', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
  };
  const rowSegmentColor = segmentColorHex[getSegmentColor(data.segmentCode?.charAt(0).toUpperCase() ?? '')] ?? '#6b7280';

  return (
    <>
      <div
        className={`decant-table__row ${rowColorClass} ${isSelected ? 'decant-table__row--selected' : ''}`}
        style={{ gridTemplateColumns: gridTemplate, '--row-segment-color': rowSegmentColor } as React.CSSProperties}
        onClick={() => onSelect(data.id)}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', JSON.stringify({ id: data.id, title: data.title }));
          e.dataTransfer.effectAllowed = 'move';
          const el = e.currentTarget;
          el.classList.add('decant-table__row--dragging');
        }}
        onDragEnd={(e) => {
          e.currentTarget.classList.remove('decant-table__row--dragging');
        }}
      >
        {/* Checkbox */}
        <div className="decant-table__cell decant-table__cell--center" style={{ order: -3 }}>
          <div
            className={`decant-checkbox ${isChecked ? 'decant-checkbox--checked' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleCheck(data.id);
            }}
          />
        </div>
        {/* Expand button */}
        <div className="decant-table__cell decant-table__cell--center" style={{ order: -2 }}>
          <button
            className={`decant-table__expand-btn ${isExpanded ? 'decant-table__expand-btn--expanded' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(data.id);
            }}
          >
            <i className="bx bx-chevron-right" />
          </button>
        </div>
        {/* Title — favicon now inline */}
        {isColVisible('title') && <div
          className="decant-table__cell decant-table__cell--title"
          style={{ order: getColOrder('title') }}
          onDoubleClick={(e) => handleStartEdit('title', data.title, e)}
        >
          {editingField === 'title' ? editInput('title') : (
            <>
              <img src={data.logo} alt="" className="decant-title-favicon" />
              <span className="decant-table__title-text">{data.title}</span>
              {isEnriching && (
                <span className="decant-enriching-badge" title="AI enrichment in progress">
                  <i className="bx bx-loader-circle bx-spin" />
                  <span>Enriching</span>
                </span>
              )}
              {data.url && (
                <a
                  className="decant-table__title-link"
                  href={data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Open URL"
                >
                  <i className="bx bx-link-external" />
                </a>
              )}
            </>
          )}
        </div>}
        {/* Segment with badge (not editable — use reclassify) */}
        {isColVisible('segment') && <div className="decant-table__cell" style={{ order: getColOrder('segment') }}>
          <span
            className={`decant-segment-badge ${getSegmentClass(data.segment)} decant-segment-badge--clickable`}
            onClick={(e) => { e.stopPropagation(); onSegmentClick?.(data.segmentCode); }}
            title={`Filter by ${data.segment}`}
          >
            {data.segment}
          </span>
        </div>}
        {/* Type badge (not editable) */}
        {isColVisible('type') && <div className="decant-table__cell decant-table__cell--center" style={{ order: getColOrder('type') }}>
          <span className={`decant-type-badge decant-type-badge--${getTypeBadgeClass(data.type)}`}>
            {data.type}
          </span>
        </div>}
        {/* Category (not editable — use reclassify) */}
        {isColVisible('category') && <div
          className="decant-table__cell decant-table__cell--category decant-table__cell--category-clickable"
          style={{ order: getColOrder('category') }}
          onClick={(e) => { e.stopPropagation(); onCategoryClick?.(data.segmentCode, data.categoryCode); }}
          title={`Filter by ${data.category}`}
        >
          {data.category ? (
            <span
              className="decant-category-pill"
              style={(() => {
                const m: Record<string, string> = {
                  A: '#ec4899', H: '#ec4899', C: '#ec4899',
                  T: '#3b82f6', B: '#3b82f6', X: '#3b82f6',
                  F: '#22c55e', L: '#22c55e',
                  S: '#eab308', E: '#eab308',
                };
                const color = m[data.segmentCode?.charAt(0).toUpperCase() ?? ''] ?? '#6b7280';
                return { color, backgroundColor: color + '18', borderColor: color + '50' };
              })()}
            >
              {data.category}
            </span>
          ) : <span className="decant-table__cell--secondary">—</span>}
        </div>}
        {/* Subcategory */}
        {isColVisible('subcategory') && <div
          className="decant-table__cell decant-table__cell--secondary"
          style={{ order: getColOrder('subcategory') }}
          onDoubleClick={(e) => handleStartEdit('subcategoryLabel', data.subcategoryLabel, e)}
        >
          {editingField === 'subcategoryLabel' ? editInput('subcategoryLabel') : (data.subcategoryLabel || '—')}
        </div>}
        {/* Quick Phrase */}
        {isColVisible('quickPhrase') && <div
          className="decant-table__cell decant-table__cell--quick-phrase"
          style={{ order: getColOrder('quickPhrase') }}
          title={data.quickPhrase}
          onDoubleClick={(e) => handleStartEdit('quickPhrase', data.quickPhrase, e)}
        >
          {editingField === 'quickPhrase' ? editInput('quickPhrase') : data.quickPhrase}
        </div>}
        {/* Description */}
        {isColVisible('description') && <div
          className="decant-table__cell decant-table__cell--description"
          style={{ order: getColOrder('description') }}
          title={data.shortDescription}
          onDoubleClick={(e) => handleStartEdit('shortDescription', data.shortDescription, e)}
        >
          {editingField === 'shortDescription' ? editInput('shortDescription') : data.shortDescription}
        </div>}
        {/* Function */}
        {isColVisible('functionTags') && <div
          className="decant-table__cell decant-table__cell--function-tags"
          style={{ order: getColOrder('functionTags') }}
          title={data.functionTags}
          onDoubleClick={(e) => handleStartEdit('functionTags', data.functionTags, e)}
        >
          {editingField === 'functionTags' ? editInput('functionTags') : data.functionTags}
        </div>}
        {/* Tags (not editable inline) */}
        {isColVisible('tags') && <div className="decant-table__cell decant-table__cell--tags" style={{ order: getColOrder('tags') }}>
          {data.tags.slice(0, 3).map((tag, i) => (
            <span
              key={i}
              className={`decant-tag decant-tag--${tag.color} decant-tag--clickable`}
              onClick={(e) => { e.stopPropagation(); onTagClick?.(tag.label); }}
            >
              {tag.label}
            </span>
          ))}
          {data.tags.length > 3 && (
            <span className="decant-tag decant-tag--overflow">+{data.tags.length - 3}</span>
          )}
        </div>}
        {/* Date (not editable) */}
        {isColVisible('date') && (() => {
          const { display, full } = formatRelativeDate(data.date);
          return (
            <div className="decant-table__cell decant-table__cell--secondary" style={{ order: getColOrder('date') }} title={full}>
              {display}
            </div>
          );
        })()}
        {/* Company */}
        {isColVisible('company') && <div
          className="decant-table__cell decant-table__cell--company"
          style={{ order: getColOrder('company') }}
          onDoubleClick={(e) => handleStartEdit('company', data.company, e)}
        >
          {editingField === 'company' ? editInput('company') : (
            <>
              {data.sourceDomain && (
                faviconError ? (
                  <span className="decant-favicon-placeholder">
                    {data.company?.charAt(0).toUpperCase() || '?'}
                  </span>
                ) : (
                  <img
                    className="decant-company-favicon"
                    src={`https://www.google.com/s2/favicons?domain=${data.sourceDomain}&sz=16`}
                    alt=""
                    width={16}
                    height={16}
                    onError={() => setFaviconError(true)}
                  />
                )
              )}
              <span>{data.company}</span>
            </>
          )}
        </div>}
        {/* User Tags */}
        {isColVisible('userTags') && (
          <div
            className="decant-table__cell decant-table__cell--user-tags"
            style={{ order: getColOrder('userTags') }}
            ref={tagPickerRef}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="decant-user-tags">
              {(data.userTags || []).map((tag) => (
                <span
                  key={tag.id}
                  className="decant-user-tag decant-user-tag--vibrant"
                  style={{
                    backgroundColor: tag.color + '20',
                    color: tag.color,
                    borderColor: tag.color + '40',
                  }}
                >
                  <span className="decant-user-tag__name">{tag.name}</span>
                  <button
                    className="decant-user-tag__remove"
                    title="Remove tag"
                    onClick={() => {
                      if (!onUserTagChange) return;
                      const newIds = (data.userTags || []).filter(t => t.id !== tag.id).map(t => t.id);
                      onUserTagChange(data.id, newIds);
                    }}
                  >
                    <i className="bx bx-x" />
                  </button>
                </span>
              ))}
              {/* Add tag button */}
              <button
                className="decant-user-tags__add-btn"
                title="Add tag"
                onClick={() => setShowTagPicker(prev => !prev)}
              >
                <i className="bx bx-plus" />
              </button>
            </div>
            {/* Tag picker dropdown */}
            {showTagPicker && allUserTags && (
              <div className="decant-tag-picker">
                <div className="decant-tag-picker__header">Add Tag</div>
                {allUserTags.length === 0 ? (
                  <div className="decant-tag-picker__empty">
                    No tags created yet.
                    {onManageUserTags && (
                      <button className="decant-tag-picker__manage-link" onClick={() => { onManageUserTags(); setShowTagPicker(false); }}>
                        Create your first tag
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {allUserTags.map((tag) => {
                      const isAssigned = (data.userTags || []).some(t => t.id === tag.id);
                      return (
                        <button
                          key={tag.id}
                          className={`decant-tag-picker__option ${isAssigned ? 'decant-tag-picker__option--active' : ''}`}
                          onClick={() => {
                            if (!onUserTagChange) return;
                            const currentIds = (data.userTags || []).map(t => t.id);
                            const newIds = isAssigned
                              ? currentIds.filter(id => id !== tag.id)
                              : [...currentIds, tag.id];
                            onUserTagChange(data.id, newIds);
                          }}
                        >
                          <span className="decant-tag-picker__color-dot" style={{ backgroundColor: tag.color }} />
                          <span className="decant-tag-picker__label">{tag.name}</span>
                          {isAssigned && <i className="bx bx-check decant-tag-picker__check" />}
                        </button>
                      );
                    })}
                    {onManageUserTags && (
                      <>
                        <div className="decant-tag-picker__divider" />
                        <button
                          className="decant-tag-picker__manage"
                          onClick={() => { onManageUserTags(); setShowTagPicker(false); }}
                        >
                          <i className="bx bx-cog" /> Manage tags
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
        {/* Quick Actions - visible on hover */}
        <div className="decant-row-actions" onClick={(e) => e.stopPropagation()}>
          {data.url && (
            <button
              className="decant-row-actions__btn"
              title="Open URL"
              onClick={() => onOpenUrl?.(data.url!) ?? window.open(data.url, '_blank')}
            >
              <i className="bx bx-link-external" />
            </button>
          )}
          <button
            className="decant-row-actions__btn"
            title={data.starred ? 'Unstar' : 'Star'}
            onClick={() => onToggleStar(data.id)}
          >
            <i className={`bx ${data.starred ? 'bxs-star' : 'bx-star'}`} />
          </button>
          <button
            className="decant-row-actions__btn"
            title="Reclassify"
            onClick={() => onReclassify?.(data.id)}
          >
            <i className="bx bx-refresh" />
          </button>
          <button
            className="decant-row-actions__btn decant-row-actions__btn--danger"
            title="Delete"
            onClick={() => onDelete?.(data.id)}
          >
            <i className="bx bx-trash" />
          </button>
        </div>
      </div>

      {/* Expanded Row Content - Matching Screenshot */}
      {isExpanded && (
        <div className="decant-expanded-row decant-fade-in">
          <div className="decant-expanded-row__content">
            <div className="decant-expanded-row__logo-wrapper">
              <img src={data.logo} alt={data.title} className="decant-expanded-row__logo" />
            </div>
            <div className="decant-expanded-row__details">
              <h3 className="decant-expanded-row__title">
                {data.title}
                <span className="decant-expanded-row__type-badge">{data.type}</span>
              </h3>
              <div className="decant-expanded-row__meta-grid">
                <div className="decant-expanded-row__meta-item">
                  <span className="decant-expanded-row__meta-label">Created by:</span>
                  <span className="decant-expanded-row__meta-value">{data.author || data.company}</span>
                </div>
                <div className="decant-expanded-row__meta-item">
                  <span className="decant-expanded-row__meta-label">Initial release:</span>
                  <span className="decant-expanded-row__meta-value">2013</span>
                </div>
                <div className="decant-expanded-row__meta-item">
                  <span className="decant-expanded-row__meta-label">Version:</span>
                  <span className="decant-expanded-row__meta-value">{data.version || '1.0.0'}</span>
                </div>
              </div>
              <div className="decant-expanded-row__stats">
                <span className="decant-expanded-row__stat">
                  <strong>Repository:</strong> <i className="bx bx-git-repo-forked" /> {data.stars || '210k'}
                </span>
                <span className="decant-expanded-row__stat">
                  <i className="bx bx-git-branch" /> {data.forks || '45k'}
                </span>
                <span className="decant-expanded-row__stat">
                  <strong>Used by:</strong> {data.usedBy?.join(', ') || 'Facebook, Netflix, Airbnb'}
                </span>
              </div>
              {/* Visual Intelligence Card */}
              {(data.shortDescription || data.aiSummary || data.quickPhrase || (data.keyConcepts && data.keyConcepts.length > 0)) && (
                <div className="decant-visual-card">
                  <div className="decant-visual-card__header">
                    <i className="bx bx-analyse" />
                    <span>Visual Summary</span>
                  </div>
                  <div className="decant-visual-card__body">
                    {/* Zone A: Type glyph */}
                    <div
                      className="decant-visual-card__glyph"
                      style={{
                        backgroundColor: (() => {
                          const m: Record<string, string> = {
                            A: 'rgba(236,72,153,0.1)', H: 'rgba(236,72,153,0.1)', C: 'rgba(236,72,153,0.1)',
                            T: 'rgba(59,130,246,0.1)', B: 'rgba(59,130,246,0.1)', X: 'rgba(59,130,246,0.1)',
                            F: 'rgba(34,197,94,0.1)', L: 'rgba(34,197,94,0.1)',
                            S: 'rgba(234,179,8,0.1)', E: 'rgba(234,179,8,0.1)',
                          };
                          return m[data.segmentCode?.charAt(0).toUpperCase() ?? ''] ?? 'rgba(107,114,128,0.1)';
                        })()
                      }}
                    >
                      <span className="decant-visual-card__glyph-emoji">{data.typeSymbol}</span>
                      <div className="decant-visual-card__glyph-crumb">
                        <span>{data.segment}</span>
                        <span className="decant-visual-card__glyph-sep">›</span>
                        <span>{data.category}</span>
                      </div>
                    </div>
                    {/* Zone B: Summary text + concepts */}
                    <div className="decant-visual-card__summary">
                      {(data.shortDescription || data.aiSummary || data.quickPhrase) && (
                        <p className="decant-visual-card__summary-text">
                          {(data.shortDescription || data.aiSummary || data.quickPhrase || '').slice(0, 160)}
                          {(data.shortDescription || data.aiSummary || data.quickPhrase || '').length > 160 ? '…' : ''}
                        </p>
                      )}
                      {data.keyConcepts && data.keyConcepts.length > 0 && (
                        <div className="decant-visual-card__concepts">
                          {data.keyConcepts.slice(0, 5).map((c, i) => (
                            <span key={i} className="decant-visual-card__concept">{c.replace(/_/g, ' ')}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Zone C: Popularity bar */}
                  {(data.stars || data.forks || data.downloads) && (
                    <div className="decant-visual-card__popularity">
                      <div className="decant-visual-card__signal-bars">
                        {(() => {
                          const val = parseInt((data.stars || '0').replace(/[^0-9]/g, ''));
                          const bars = val >= 100000 ? 4 : val >= 10000 ? 3 : val >= 1000 ? 2 : 1;
                          return [1,2,3,4].map(b => (
                            <span key={b} className={`decant-visual-card__bar ${b <= bars ? 'decant-visual-card__bar--filled' : ''}`} />
                          ));
                        })()}
                        <span className="decant-visual-card__pop-label">Popularity</span>
                      </div>
                      <div className="decant-visual-card__metrics">
                        {data.stars && <span className="decant-visual-card__metric"><i className="bx bx-star" />{data.stars}</span>}
                        {data.forks && <span className="decant-visual-card__metric"><i className="bx bx-git-branch" />{data.forks}</span>}
                        {data.downloads && <span className="decant-visual-card__metric"><i className="bx bx-download" />{data.downloads}</span>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="decant-expanded-row__actions">
              <button className="decant-expanded-row__btn decant-expanded-row__btn--primary">
                <i className="bx bx-folder-open" /> Open
              </button>
              <button className="decant-expanded-row__btn">
                <i className="bx bx-edit" /> Edit
              </button>
              <button className="decant-expanded-row__btn">
                <i className="bx bx-link" /> Link
              </button>
              <button className="decant-expanded-row__btn">
                <i className="bx bx-share-alt" /> Share
              </button>
              <button className="decant-expanded-row__btn">
                <i className="bx bx-book-open" /> Learn More
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
