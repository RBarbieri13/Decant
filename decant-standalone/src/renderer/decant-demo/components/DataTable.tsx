import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { TableRow, ColumnFilters, ColumnWidths, SortKey, SortDir } from '../types';
import { DataTableRow } from './DataTableRow';
import { getSegmentColor } from '../../utils/metadataCodeColors';
import { getCategoryIcon } from '../../utils/hierarchyIcons';

interface DataTableProps {
  data: TableRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleStar: (id: string) => void;
  statusText?: string;
  totalCount?: number;
  categoryName?: string;
  groupedData?: { label: string; catCode: string; items: TableRow[] }[] | null;
  segmentCode?: string;
  onCategoryClick?: (segCode: string, catCode: string) => void;
  onTagClick?: (tag: string) => void;
  onSegmentClick?: (segCode: string) => void;
  pendingEnrichmentIds?: Set<string>;
  columnFilters?: ColumnFilters;
  onColumnFilterChange?: (filters: ColumnFilters) => void;
  onCellEdit?: (rowId: string, field: string, value: string) => void;
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
  { key: 'date',         label: 'Date' },
  { key: 'company',      label: 'Company' },
] as const;

export const DEFAULT_VISIBLE_COLUMNS = new Set(['title', 'type', 'category', 'quickPhrase', 'date']);
export const COLUMN_VISIBILITY_KEY = 'decant-column-visibility';
export const COLUMN_ORDER_KEY = 'decant-column-order';
export const DEFAULT_COLUMN_ORDER = TOGGLEABLE_COLUMNS.map(c => c.key);

export const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
  checkbox: 24, expand: 28, logo: 32, title: 280,
  segment: 90, type: 70, category: 120, subcategory: 130, quickPhrase: 300,
  description: 220, functionTags: 200,
  tags: 140, date: 90, company: 100, star: 32,
};
export const RESIZABLE_COLUMNS = ['title', 'segment', 'category', 'subcategory', 'quickPhrase', 'description', 'functionTags', 'tags', 'date', 'company'];
export const COLUMN_WIDTHS_KEY = 'decant-column-widths-v2';

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
}) => {
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
    return [`${w.checkbox}px`, `${w.expand}px`, ...dynamicWidths, `${w.star}px`].join(' ');
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
      {/* Column headers */}
      <div className="decant-table__header" style={{ gridTemplateColumns: gridTemplate }}>
        <div className="decant-table__header-cell" style={{ order: -3 }}></div>
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
        <div className="decant-table__header-cell" style={{ order: 100 }}></div>
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
          <div className="decant-table__filter-cell" style={{ order: 100 }} />
        </div>
      )}
      <div className="decant-table__body">
        {groupedData ? (
          // Render with subcategory group headers
          groupedData.map((group) => {
            const GroupIcon = segmentCode
              ? getCategoryIcon(segmentCode, group.catCode)
              : null;
            return (
              <React.Fragment key={`group-${group.catCode}`}>
                <div className={`decant-table__group-header ${segmentCode ? `decant-table__group-header--${getSegmentColor(segmentCode)}` : ''} ${collapsedGroups.has(group.catCode) ? 'decant-table__group-header--collapsed' : ''}`}>
                  <button
                    className="decant-table__group-collapse-btn"
                    onClick={(e) => handleToggleGroup(group.catCode, e)}
                    title={collapsedGroups.has(group.catCode) ? 'Expand' : 'Collapse'}
                  >
                    <i className={`bx ${collapsedGroups.has(group.catCode) ? 'bx-chevron-right' : 'bx-chevron-down'}`} />
                  </button>
                  <div
                    className="decant-table__group-header__inner"
                    onClick={() => segmentCode && onCategoryClick?.(segmentCode, group.catCode)}
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
          sortedData.map((row) => (
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
            />
          ))
        )}
      </div>
      {checkedIds.size > 0 && (
        <div className="decant-bulk-bar">
          <span className="decant-bulk-bar__count">
            {checkedIds.size} {checkedIds.size === 1 ? 'item' : 'items'} selected
          </span>
          <div className="decant-bulk-bar__actions">
            <button
              className="decant-bulk-bar__btn decant-bulk-bar__btn--star"
              onClick={() => {
                checkedIds.forEach(id => onToggleStar(id));
                setCheckedIds(new Set());
              }}
            >
              <i className="bx bxs-star" /> Star All
            </button>
            <button
              className="decant-bulk-bar__btn decant-bulk-bar__btn--clear"
              onClick={() => setCheckedIds(new Set())}
            >
              <i className="bx bx-x" /> Clear
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
