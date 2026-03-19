import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { TableRow, ColumnFilters, ColumnWidths, SortKey, SortDir } from '../types';
import { DataTableRow } from './DataTableRow';
import { getSegmentColor } from '../../utils/metadataCodeColors';
import { getCategoryIcon } from '../../utils/hierarchyIcons';
import type { UserTag } from '../../services/api';

interface DataTableProps {
  data: TableRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleStar: (id: string) => void;
  statusText?: string;
  totalCount?: number;
  categoryName?: string;
  groupedData?: { label: string; catCode: string; items: TableRow[]; segCode?: string }[] | null;
  segmentCode?: string;
  onCategoryClick?: (segCode: string, catCode: string) => void;
  onTagClick?: (tag: string) => void;
  onSegmentClick?: (segCode: string) => void;
  pendingEnrichmentIds?: Set<string>;
  columnFilters?: ColumnFilters;
  onColumnFilterChange?: (filters: ColumnFilters) => void;
  onCellEdit?: (rowId: string, field: string, value: string) => void;
  onBatchDelete?: (ids: string[]) => void;
  onBatchReclassify?: (ids: string[]) => void;
  onBatchExport?: (ids: string[]) => void;
  showStarredOnly?: boolean;
  onToggleStarredFilter?: () => void;
  allUserTags?: UserTag[];
  onUserTagChange?: (nodeId: string, tagIds: string[]) => void;
  onManageUserTags?: () => void;
}

/** Columns that the user can toggle on/off */
export const TOGGLEABLE_COLUMNS = [
  { key: 'title',        label: 'Title' },
  { key: 'segment',      label: 'Segment' },
  { key: 'type',         label: 'Type' },
  { key: 'category',     label: 'Category' },
  { key: 'subcategory',  label: 'Subcategory' },
  { key: 'quickPhrase',  label: 'Quick Phrase' },
  { key: 'description',  label: 'Description' },
  { key: 'functionTags', label: 'Function' },
  { key: 'tags',         label: 'Tags' },
  { key: 'date',         label: 'Date Added' },
  { key: 'company',      label: 'Company' },
  { key: 'userTags',     label: 'User Tags' },
] as const;

export const DEFAULT_VISIBLE_COLUMNS = new Set(['title', 'type', 'category', 'quickPhrase', 'functionTags', 'tags', 'date', 'userTags']);
export const COLUMN_VISIBILITY_KEY = 'decant-column-visibility-v2';
export const COLUMN_ORDER_KEY = 'decant-column-order-v2';
export const DEFAULT_COLUMN_ORDER = TOGGLEABLE_COLUMNS.map(c => c.key);

export const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
  checkbox: 24, expand: 28, logo: 32, title: 280,
  segment: 90, type: 70, category: 120, subcategory: 130, quickPhrase: 300,
  description: 220, functionTags: 200,
  tags: 140, date: 130, company: 100, userTags: 160,
};
export const RESIZABLE_COLUMNS = ['title', 'segment', 'category', 'subcategory', 'quickPhrase', 'description', 'functionTags', 'tags', 'date', 'company', 'userTags'];
export const COLUMN_WIDTHS_KEY = 'decant-column-widths-v3';

export const DataTable: React.FC<DataTableProps> = ({
  data,
  selectedId,
  onSelect,
  onToggleStar,
  statusText,
  totalCount = 5433,
  categoryName = 'All Items',
  groupedData,
  segmentCode,
  onCategoryClick,
  onTagClick,
  onSegmentClick,
  pendingEnrichmentIds,
  columnFilters = {},
  onColumnFilterChange,
  onCellEdit,
  onBatchDelete,
  onBatchReclassify,
  onBatchExport,
  showStarredOnly,
  onToggleStarredFilter,
  allUserTags,
  onUserTagChange,
  onManageUserTags,
}) => {
  const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null);
  const [savedViews, setSavedViews] = useState<Array<{ name: string; filters: Record<string, string> }>>(() => {
    try {
      const saved = localStorage.getItem('decant-saved-views');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['tailwind-css']));
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey | null>(
    () => (localStorage.getItem('decant-sort-key') as SortKey | null) ?? null
  );
  const [sortDir, setSortDir] = useState<SortDir>(
    () => (localStorage.getItem('decant-sort-dir') as SortDir) ?? 'asc'
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(COLUMN_VISIBILITY_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set(DEFAULT_VISIBLE_COLUMNS);
    } catch { return new Set(DEFAULT_VISIBLE_COLUMNS); }
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  const toggleColumnVisibility = useCallback((col: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(col)) { next.delete(col); } else { next.add(col); }
      localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  // Close column menu on outside click
  useEffect(() => {
    if (!showColumnMenu) return;
    const handler = (e: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setShowColumnMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColumnMenu]);

  const isColVisible = useCallback((col: string) => visibleColumns.has(col), [visibleColumns]);

  // Column ordering (drag-and-drop reorder)
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(COLUMN_ORDER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        const missing = DEFAULT_COLUMN_ORDER.filter(c => !parsed.includes(c));
        return [...parsed, ...missing];
      }
      return [...DEFAULT_COLUMN_ORDER];
    } catch { return [...DEFAULT_COLUMN_ORDER]; }
  });
  const [dragCol, setDragCol] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const getColOrder = useCallback((col: string) => columnOrder.indexOf(col), [columnOrder]);

  const handleColumnDragStart = useCallback((e: React.DragEvent, col: string) => {
    setDragCol(col);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleColumnDragOver = useCallback((e: React.DragEvent, col: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(col);
  }, []);

  const handleColumnDrop = useCallback((col: string) => {
    if (!dragCol || dragCol === col) { setDragCol(null); setDragOverCol(null); return; }
    setColumnOrder(prev => {
      const next = [...prev];
      const fromIdx = next.indexOf(dragCol);
      const toIdx = next.indexOf(col);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, dragCol);
      localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(next));
      return next;
    });
    setDragCol(null);
    setDragOverCol(null);
  }, [dragCol]);

  const handleColumnDragEnd = useCallback(() => {
    setDragCol(null);
    setDragOverCol(null);
  }, []);

  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() => {
    try {
      const saved = localStorage.getItem(COLUMN_WIDTHS_KEY);
      return saved ? { ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(saved) } : DEFAULT_COLUMN_WIDTHS;
    } catch { return DEFAULT_COLUMN_WIDTHS; }
  });

  const handleColumnResize = useCallback((col: string, width: number) => {
    setColumnWidths(prev => {
      const next = { ...prev, [col]: Math.max(50, width) };
      localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent, col: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidths[col];
    const onMove = (ev: MouseEvent) => {
      handleColumnResize(col, startWidth + (ev.clientX - startX));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [columnWidths, handleColumnResize]);

  const gridTemplate = useMemo(() => {
    const w = columnWidths;
    const orderedVisible = columnOrder.filter(col => visibleColumns.has(col));
    const dynamicWidths = orderedVisible.map(col => `${w[col] || 100}px`);
    return [`${w.checkbox}px`, `${w.expand}px`, ...dynamicWidths, '0px'].join(' ');
  }, [columnWidths, columnOrder, visibleColumns]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleCheck = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleGroup = useCallback((catCode: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(catCode)) next.delete(catCode); else next.add(catCode);
      return next;
    });
  }, []);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      const newDir = prev === key ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
      setSortDir(newDir);
      localStorage.setItem('decant-sort-key', key);
      localStorage.setItem('decant-sort-dir', newDir);
      return key;
    });
  }, [sortDir]);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = (a[sortKey] ?? '').toLowerCase();
      const bVal = (b[sortKey] ?? '').toLowerCase();
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir]);

  const quickFilteredData = useMemo(() => {
    let result = sortedData;
    if (activeQuickFilter === 'recent') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      result = result.filter(item => new Date(item.date) >= sevenDaysAgo);
    } else if (activeQuickFilter === 'unclassified') {
      result = result.filter(item => !item.segmentCode || !item.categoryCode || item.segment === 'Uncategorized');
    }
    return result;
  }, [sortedData, activeQuickFilter]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <i className="bx bx-sort-alt-2 decant-table__sort-icon" />;
    return <i className={`bx ${sortDir === 'asc' ? 'bx-sort-up' : 'bx-sort-down'} decant-table__sort-icon decant-table__sort-icon--active`} />;
  };

  return (
    <div className="decant-table">
      {/* Title bar with view toggles */}
      <div className="decant-table__title-bar">
        <h2 className="decant-table__title">{categoryName}</h2>
        <div className="decant-table__title-actions">
          <button className="decant-table__view-btn decant-table__view-btn--active" title="Table view">
            <i className="bx bx-table" />
          </button>
          <button className="decant-table__view-btn" title="Grid view">
            <i className="bx bx-grid-alt" />
          </button>
          <button className="decant-table__view-btn" title="Compact view">
            <i className="bx bxs-grid" />
          </button>
          <button className="decant-table__view-btn" title="List view">
            <i className="bx bx-list-ul" />
          </button>
          <div className="decant-column-toggle" ref={columnMenuRef}>
            <button
              className={`decant-table__view-btn ${showColumnMenu ? 'decant-table__view-btn--active' : ''}`}
              title="Show/hide columns"
              onClick={() => setShowColumnMenu(prev => !prev)}
            >
              <i className="bx bx-columns" />
            </button>
            {showColumnMenu && (
              <div className="decant-column-toggle__menu">
                <div className="decant-column-toggle__title">Columns</div>
                {TOGGLEABLE_COLUMNS.map(col => (
                  <label key={col.key} className="decant-column-toggle__item">
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(col.key)}
                      onChange={() => toggleColumnVisibility(col.key)}
                    />
                    <span>{col.label}</span>
                  </label>
                ))}
                <div className="decant-column-toggle__divider" />
                <button
                  className="decant-column-toggle__reset"
                  onClick={() => {
                    setVisibleColumns(new Set(DEFAULT_VISIBLE_COLUMNS));
                    localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify([...DEFAULT_VISIBLE_COLUMNS]));
                    setColumnWidths(DEFAULT_COLUMN_WIDTHS);
                    localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(DEFAULT_COLUMN_WIDTHS));
                  }}
                >
                  Reset to defaults
                </button>
                <button
                  className="decant-column-toggle__reset"
                  onClick={() => {
                    const allCols = new Set(TOGGLEABLE_COLUMNS.map(c => c.key));
                    setVisibleColumns(allCols);
                    localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify([...allCols]));
                  }}
                >
                  Show all columns
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Quick Filters */}
      <div className="decant-quick-filters">
        <div className="decant-quick-filters__chips">
          <button
            className={`decant-quick-filter ${!activeQuickFilter && !showStarredOnly ? 'decant-quick-filter--active' : ''}`}
            onClick={() => {
              setActiveQuickFilter(null);
              if (showStarredOnly) onToggleStarredFilter?.();
            }}
          >
            All
          </button>
          <button
            className={`decant-quick-filter ${activeQuickFilter === 'recent' ? 'decant-quick-filter--active' : ''}`}
            onClick={() => setActiveQuickFilter(activeQuickFilter === 'recent' ? null : 'recent')}
          >
            <i className="bx bx-time-five" /> Recent
          </button>
          <button
            className={`decant-quick-filter ${showStarredOnly ? 'decant-quick-filter--active' : ''}`}
            onClick={() => {
              onToggleStarredFilter?.();
              setActiveQuickFilter(null);
            }}
          >
            <i className="bx bxs-star" /> Starred
          </button>
          <button
            className={`decant-quick-filter ${activeQuickFilter === 'unclassified' ? 'decant-quick-filter--active' : ''}`}
            onClick={() => setActiveQuickFilter(activeQuickFilter === 'unclassified' ? null : 'unclassified')}
          >
            <i className="bx bx-question-mark" /> Unclassified
          </button>
          {savedViews.map((view, idx) => (
            <button
              key={idx}
              className={`decant-quick-filter decant-quick-filter--saved ${activeQuickFilter === `saved-${idx}` ? 'decant-quick-filter--active' : ''}`}
              onClick={() => {
                if (activeQuickFilter === `saved-${idx}`) {
                  setActiveQuickFilter(null);
                } else {
                  setActiveQuickFilter(`saved-${idx}`);
                  if (onColumnFilterChange) onColumnFilterChange(view.filters);
                }
              }}
            >
              <i className="bx bx-bookmark" /> {view.name}
              <span
                className="decant-quick-filter__remove"
                onClick={(e) => {
                  e.stopPropagation();
                  setSavedViews(prev => {
                    const next = prev.filter((_, i) => i !== idx);
                    localStorage.setItem('decant-saved-views', JSON.stringify(next));
                    return next;
                  });
                  if (activeQuickFilter === `saved-${idx}`) setActiveQuickFilter(null);
                }}
              >
                <i className="bx bx-x" />
              </span>
            </button>
          ))}
        </div>
        {/* Save current filter as view */}
        {Object.values(columnFilters).some(v => v.trim()) && (
          <button
            className="decant-quick-filter decant-quick-filter--save"
            onClick={() => {
              const name = prompt('Name this view:');
              if (name) {
                setSavedViews(prev => {
                  const next = [...prev, { name, filters: { ...columnFilters } }];
                  localStorage.setItem('decant-saved-views', JSON.stringify(next));
                  return next;
                });
              }
            }}
          >
            <i className="bx bx-save" /> Save view
          </button>
        )}
      </div>
      {/* Column headers */}
      <div className="decant-table__header" style={{ gridTemplateColumns: gridTemplate }}>
        <div className="decant-table__header-cell" style={{ order: -3 }}>
          <div
            className={`decant-checkbox ${checkedIds.size > 0 && checkedIds.size === data.length ? 'decant-checkbox--checked' : checkedIds.size > 0 ? 'decant-checkbox--indeterminate' : ''}`}
            onClick={() => {
              if (checkedIds.size === data.length) {
                setCheckedIds(new Set());
              } else {
                setCheckedIds(new Set(data.map(r => r.id)));
              }
            }}
          />
        </div>
        <div className="decant-table__header-cell" style={{ order: -2 }}></div>
        {columnOrder.filter(col => visibleColumns.has(col)).map(col => {
          const colDef = TOGGLEABLE_COLUMNS.find(c => c.key === col)!;
          const sortKeyMap: Record<string, SortKey> = {
            title: 'title', segment: 'segment', category: 'category',
            subcategory: 'subcategoryLabel', quickPhrase: 'quickPhrase',
            description: 'shortDescription', functionTags: 'functionTags',
            date: 'date', company: 'company',
          };
          const sk = sortKeyMap[col];
          const resizable = RESIZABLE_COLUMNS.includes(col);
          const isDragTarget = dragOverCol === col && dragCol !== col;

          return (
            <div
              key={col}
              className={`decant-table__header-cell ${sk ? 'decant-table__header-cell--sortable' : ''} ${isDragTarget ? 'decant-table__header-cell--drag-over' : ''} ${dragCol === col ? 'decant-table__header-cell--dragging' : ''}`}
              style={{ order: getColOrder(col) }}
              onClick={sk ? () => handleSort(sk) : undefined}
              draggable
              onDragStart={(e) => handleColumnDragStart(e, col)}
              onDragOver={(e) => handleColumnDragOver(e, col)}
              onDrop={() => handleColumnDrop(col)}
              onDragEnd={handleColumnDragEnd}
            >
              {colDef.label} {sk && <SortIcon col={sk} />}
              {resizable && <div className="decant-col-resize-handle" onMouseDown={(e) => handleResizeStart(e, col)} />}
            </div>
          );
        })}
      </div>
      {/* Per-column filter row */}
      {onColumnFilterChange && (
        <div className="decant-table__filter-row" style={{ gridTemplateColumns: gridTemplate }}>
          <div className="decant-table__filter-cell" style={{ order: -3 }} />
          <div className="decant-table__filter-cell" style={{ order: -2 }} />
          {columnOrder.filter(col => visibleColumns.has(col)).map(col => {
            const filterKeyMap: Record<string, string> = {
              title: 'title', segment: 'segment', type: 'type', category: 'category',
              subcategory: 'subcategoryLabel', quickPhrase: 'quickPhrase',
              description: 'shortDescription', functionTags: 'functionTags',
              tags: 'tags', date: 'date', company: 'company',
            };
            const filterKey = filterKeyMap[col] || col;
            const colDef = TOGGLEABLE_COLUMNS.find(c => c.key === col)!;
            return (
              <div key={col} className="decant-table__filter-cell" style={{ order: getColOrder(col) }}>
                <input
                  type="text"
                  placeholder={`Filter ${colDef.label.toLowerCase()}...`}
                  value={columnFilters[filterKey] || ''}
                  onChange={e => onColumnFilterChange({ ...columnFilters, [filterKey]: e.target.value })}
                  className="decant-table__filter-input"
                />
              </div>
            );
          })}
        </div>
      )}
      <div className="decant-table__body">
        {data.length === 0 ? (
          <div className="decant-empty-state">
            <div className="decant-empty-state__icon">
              <i className="bx bx-search-alt" />
            </div>
            <div className="decant-empty-state__title">No items found</div>
            <div className="decant-empty-state__description">
              Try adjusting your search or filters, or import new content to get started.
            </div>
          </div>
        ) : groupedData ? (
          // Render with group headers (segment-level for All Items, category-level within a segment)
          groupedData.map((group) => {
            const effectiveSegCode = group.segCode || segmentCode;
            const GroupIcon = effectiveSegCode
              ? getCategoryIcon(effectiveSegCode, group.catCode)
              : null;
            return (
              <React.Fragment key={`group-${group.segCode ? `seg-${group.segCode}` : group.catCode}`}>
                <div className={`decant-table__group-header ${effectiveSegCode ? `decant-table__group-header--${getSegmentColor(effectiveSegCode)}` : ''} ${collapsedGroups.has(group.catCode) ? 'decant-table__group-header--collapsed' : ''}`}>
                  <button
                    className="decant-table__group-collapse-btn"
                    onClick={(e) => handleToggleGroup(group.catCode, e)}
                    title={collapsedGroups.has(group.catCode) ? 'Expand' : 'Collapse'}
                  >
                    <i className={`bx ${collapsedGroups.has(group.catCode) ? 'bx-chevron-right' : 'bx-chevron-down'}`} />
                  </button>
                  <div
                    className="decant-table__group-header__inner"
                    onClick={() => {
                      if (group.segCode) {
                        onSegmentClick?.(group.segCode);
                      } else if (segmentCode) {
                        onCategoryClick?.(segmentCode, group.catCode);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    {GroupIcon && <GroupIcon size={14} stroke={1.5} className="decant-table__group-icon" />}
                    <span className="decant-table__group-label">{group.label}</span>
                    <span className={`decant-table__group-count ${collapsedGroups.has(group.catCode) ? 'decant-table__group-count--collapsed' : ''}`}>
                      {group.items.length}
                    </span>
                  </div>
                </div>
                {!collapsedGroups.has(group.catCode) && (() => {
                  // Pre-compute subcategory counts to only show dividers for groups with 3+ items
                  const subcatCounts = new Map<string, number>();
                  for (const item of group.items) {
                    if (item.subcategoryLabel) {
                      subcatCounts.set(item.subcategoryLabel, (subcatCounts.get(item.subcategoryLabel) || 0) + 1);
                    }
                  }
                  return group.items.map((row, idx) => {
                  const prevSubcat = idx > 0 ? group.items[idx - 1].subcategoryLabel : null;
                  const showDivider = idx > 0 && row.subcategoryLabel && row.subcategoryLabel !== prevSubcat && (subcatCounts.get(row.subcategoryLabel) || 0) >= 3;
                  return (
                    <React.Fragment key={row.id}>
                      {showDivider && (
                        <div className="decant-table__subcat-divider">
                          <span className="decant-table__subcat-divider__label">{row.subcategoryLabel}</span>
                          <span className="decant-table__subcat-divider__line" />
                        </div>
                      )}
                      <DataTableRow
                        data={row}
                        isSelected={selectedId === row.id}
                        isExpanded={expandedIds.has(row.id)}
                        isChecked={checkedIds.has(row.id)}
                        onSelect={onSelect}
                        onToggleExpand={handleToggleExpand}
                        onToggleStar={onToggleStar}
                        onToggleCheck={handleToggleCheck}
                        gridTemplate={gridTemplate}
                        onTagClick={onTagClick}
                        onSegmentClick={onSegmentClick}
                        onCategoryClick={onCategoryClick}
                        isEnriching={pendingEnrichmentIds?.has(row.id)}
                        isColVisible={isColVisible}
                        getColOrder={getColOrder}
                        onCellEdit={onCellEdit}
                        allUserTags={allUserTags}
                        onUserTagChange={onUserTagChange}
                        onManageUserTags={onManageUserTags}
                      />
                    </React.Fragment>
                  );
                });
                })()}
              </React.Fragment>
            );
          })
        ) : (
          // Render flat list
          quickFilteredData.map((row) => (
            <DataTableRow
              key={row.id}
              data={row}
              isSelected={selectedId === row.id}
              isExpanded={expandedIds.has(row.id)}
              isChecked={checkedIds.has(row.id)}
              onSelect={onSelect}
              onToggleExpand={handleToggleExpand}
              onToggleStar={onToggleStar}
              onToggleCheck={handleToggleCheck}
              gridTemplate={gridTemplate}
              onTagClick={onTagClick}
              onSegmentClick={onSegmentClick}
              onCategoryClick={onCategoryClick}
              isEnriching={pendingEnrichmentIds?.has(row.id)}
              isColVisible={isColVisible}
              getColOrder={getColOrder}
              onCellEdit={onCellEdit}
              allUserTags={allUserTags}
              onUserTagChange={onUserTagChange}
              onManageUserTags={onManageUserTags}
            />
          ))
        )}
      </div>
      {checkedIds.size > 0 && (
        <div className="decant-batch-bar">
          <div className="decant-batch-bar__left">
            <span className="decant-batch-bar__count">
              {checkedIds.size} {checkedIds.size === 1 ? 'item' : 'items'} selected
            </span>
            <button
              className="decant-batch-bar__select-all"
              onClick={() => {
                const allIds = new Set(data.map(r => r.id));
                setCheckedIds(allIds);
              }}
            >
              Select all {data.length}
            </button>
          </div>
          <div className="decant-batch-bar__actions">
            <button
              className="decant-batch-bar__btn"
              onClick={() => {
                checkedIds.forEach(id => onToggleStar(id));
                setCheckedIds(new Set());
              }}
              title="Star selected"
            >
              <i className="bx bxs-star" />
              <span>Star</span>
            </button>
            <button
              className="decant-batch-bar__btn"
              onClick={() => {
                onBatchReclassify?.([...checkedIds]);
                setCheckedIds(new Set());
              }}
              title="Reclassify selected"
            >
              <i className="bx bx-refresh" />
              <span>Reclassify</span>
            </button>
            <button
              className="decant-batch-bar__btn"
              onClick={() => {
                onBatchExport?.([...checkedIds]);
                setCheckedIds(new Set());
              }}
              title="Export selected"
            >
              <i className="bx bx-export" />
              <span>Export</span>
            </button>
            <div className="decant-batch-bar__divider" />
            <button
              className="decant-batch-bar__btn decant-batch-bar__btn--danger"
              onClick={() => {
                if (confirm(`Delete ${checkedIds.size} items?`)) {
                  onBatchDelete?.([...checkedIds]);
                  setCheckedIds(new Set());
                }
              }}
              title="Delete selected"
            >
              <i className="bx bx-trash" />
              <span>Delete</span>
            </button>
            <button
              className="decant-batch-bar__btn decant-batch-bar__btn--clear"
              onClick={() => setCheckedIds(new Set())}
            >
              <i className="bx bx-x" />
            </button>
          </div>
        </div>
      )}
      <div className="decant-table__status">
        {statusText || `Showing ${data.length} items in "${categoryName}" | ${data.length} total in category | ${totalCount.toLocaleString()} total in database`}
      </div>
    </div>
  );
};
