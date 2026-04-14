/**
 * BrutalistDataTable — brutalist-v2 design system table component.
 *
 * Usage:
 *   <BrutalistDataTable
 *     data={rows}
 *     groupedData={groups}
 *     selectedId={selectedId}
 *     onSelect={(id) => setSelectedId(id)}
 *     onToggleStar={(id) => handleStar(id)}
 *     columnFilters={filters}
 *     onColumnFilterChange={setFilters}
 *     pendingEnrichmentIds={pendingIds}
 *   />
 */

import React, { useState, useCallback, useMemo } from 'react';
import { TableRow, SortKey, SortDir, CONTENT_TYPE_LABELS } from '../types';
import { getClassBadge, getContextBadge, shortId } from '../helpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrutalistDataTableProps {
  data: TableRow[];
  groupedData?: { label: string; catCode: string; items: TableRow[]; segCode?: string }[] | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleStar: (id: string) => void;
  columnFilters?: Record<string, string>;
  onColumnFilterChange?: (filters: Record<string, string>) => void;
  pendingEnrichmentIds?: Set<string>;
  onCellEdit?: (rowId: string, field: string, value: string) => void;
}

type ActiveView = 'TABLE' | 'BOARD' | 'ANALYTICS' | 'CALENDAR';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SORTABLE_COLS: { key: SortKey; label: string }[] = [
  { key: 'title',         label: 'ASSET TITLE' },
  { key: 'type',          label: 'CLASS' },
  { key: 'segment',       label: 'CONTEXT' },
];

// Material icon name mapped from content-type code.
// Falls back to 'description' when code is unrecognised.
const TYPE_ICON_MAP: Record<string, { icon: string; color: string }> = {
  T: { icon: 'build',        color: '#9333ea' }, // Tool  — purple
  A: { icon: 'article',      color: '#3b82f6' }, // Article — blue
  V: { icon: 'play_circle',  color: '#ef4444' }, // Video — red
  R: { icon: 'dns',          color: '#22c55e' }, // Repo  — green
  S: { icon: 'cloud',        color: '#3b82f6' }, // Service — blue
  W: { icon: 'language',     color: '#475569' }, // Website — slate
  N: { icon: 'feed',         color: '#ef4444' }, // News — red
  C: { icon: 'school',       color: '#22c55e' }, // Course — green
  G: { icon: 'menu_book',    color: '#9333ea' }, // Guide — purple
  I: { icon: 'image',        color: '#9333ea' }, // Image — purple
  U: { icon: 'description',  color: '#9333ea' }, // Tutorial — purple
  P: { icon: 'description',  color: '#3b82f6' }, // Paper — blue
  K: { icon: 'description',  color: '#475569' }, // Knowledge
};

const DEFAULT_ICON: { icon: string; color: string } = { icon: 'description', color: '#9333ea' };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTypeIcon(typeCode: string): { icon: string; color: string } {
  const code = (typeCode || '').charAt(0).toUpperCase();
  return TYPE_ICON_MAP[code] ?? DEFAULT_ICON;
}

function compareRows(a: TableRow, b: TableRow, sortKey: SortKey | null, sortDir: SortDir): number {
  if (!sortKey) return 0;
  const aVal = String(a[sortKey] ?? '').toLowerCase();
  const bVal = String(b[sortKey] ?? '').toLowerCase();
  if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
  if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
  return a.id < b.id ? -1 : 1;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ClassBadgeProps {
  typeCode: string;
}

const ClassBadge: React.FC<ClassBadgeProps> = ({ typeCode }) => {
  const badge = getClassBadge(typeCode);
  return (
    <span
      style={{
        backgroundColor: badge.bg,
        color: badge.text,
        border: '1px solid #000',
        display: 'inline-block',
        padding: '0 4px',
        fontSize: '8px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        lineHeight: '16px',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {badge.label}
    </span>
  );
};

interface ContextBadgeProps {
  segmentCode: string;
}

const ContextBadge: React.FC<ContextBadgeProps> = ({ segmentCode }) => {
  const badge = getContextBadge(segmentCode);
  return (
    <span
      style={{
        backgroundColor: badge.bg,
        color: badge.text,
        display: 'inline-block',
        padding: '0 4px',
        fontSize: '8px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        lineHeight: '16px',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {badge.label}
    </span>
  );
};

interface SortArrowProps {
  col: SortKey;
  sortKey: SortKey | null;
  sortDir: SortDir;
}

const SortArrow: React.FC<SortArrowProps> = ({ col, sortKey, sortDir }) => {
  if (sortKey !== col) {
    return (
      <span style={{ opacity: 0.3, marginLeft: 2, fontSize: 9 }}>&#8597;</span>
    );
  }
  return (
    <span style={{ marginLeft: 2, fontSize: 9, color: '#1e40af' }}>
      {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Placeholder view
// ---------------------------------------------------------------------------

interface PlaceholderViewProps {
  label: string;
}

const PlaceholderView: React.FC<PlaceholderViewProps> = ({ label }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 160,
      border: '2px dashed #cbd5e1',
      color: '#94a3b8',
      fontFamily: 'monospace',
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
    }}
  >
    {label} — coming soon
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const BrutalistDataTable: React.FC<BrutalistDataTableProps> = ({
  data,
  groupedData,
  selectedId,
  onSelect,
  onToggleStar: _onToggleStar,
  columnFilters = {},
  onColumnFilterChange: _onColumnFilterChange,
  pendingEnrichmentIds,
  onCellEdit: _onCellEdit,
}) => {
  const [activeView, setActiveView] = useState<ActiveView>('TABLE');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // ---- Sorting ----

  const handleSort = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev === key) {
        setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        return key;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  const sortedFlatData = useMemo(
    () => [...data].sort((a, b) => compareRows(a, b, sortKey, sortDir)),
    [data, sortKey, sortDir],
  );

  // ---- Group collapse ----

  const toggleGroup = useCallback((catCode: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(catCode)) {
        next.delete(catCode);
      } else {
        next.add(catCode);
      }
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderViewTabs = () => {
    const tabs: { id: ActiveView; bg: string; text: string; activeBg: string; activeText: string }[] = [
      { id: 'TABLE',     bg: '#cbd5e1', text: '#1e293b', activeBg: '#fff',     activeText: '#000' },
      { id: 'BOARD',     bg: '#cbd5e1', text: '#1e293b', activeBg: '#cbd5e1',  activeText: '#1e293b' },
      { id: 'ANALYTICS', bg: '#cbd5e1', text: '#1e293b', activeBg: '#7c3aed',  activeText: '#fff' },
      { id: 'CALENDAR',  bg: '#cbd5e1', text: '#1e293b', activeBg: '#facc15',  activeText: '#000' },
    ];

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          borderBottom: '2px solid #000',
          background: '#cbd5e1',
        }}
      >
        {tabs.map(tab => {
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              style={{
                padding: '6px 16px',
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                background: isActive ? tab.activeBg : tab.bg,
                color: isActive ? tab.activeText : tab.text,
                border: 'none',
                borderRight: '2px solid #000',
                cursor: 'pointer',
                lineHeight: 1.4,
              }}
              aria-pressed={isActive}
            >
              {tab.id}
            </button>
          );
        })}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Grid / list toggle */}
        {(['list', 'grid'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            title={mode === 'list' ? 'List view' : 'Grid view'}
            aria-pressed={viewMode === mode}
            style={{
              padding: '6px 10px',
              background: viewMode === mode ? '#000' : '#cbd5e1',
              color: viewMode === mode ? '#fff' : '#475569',
              border: 'none',
              borderLeft: '2px solid #000',
              cursor: 'pointer',
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            {/* Material icon via ligature */}
            <span
              className="material-icons"
              style={{ fontSize: 14, verticalAlign: 'middle', fontFamily: 'Material Icons' }}
            >
              {mode === 'list' ? 'view_list' : 'grid_view'}
            </span>
          </button>
        ))}
      </div>
    );
  };

  const renderTh = (label: string, sortable?: SortKey) => (
    <th
      key={label}
      onClick={sortable ? () => handleSort(sortable) : undefined}
      style={{
        padding: '6px',
        fontWeight: 700,
        fontSize: 9,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        borderRight: '1px solid rgba(0,0,0,0.2)',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        cursor: sortable ? 'pointer' : 'default',
        textAlign: 'left',
      }}
    >
      {label}
      {sortable && <SortArrow col={sortable} sortKey={sortKey} sortDir={sortDir} />}
    </th>
  );

  const renderStickyHeader = () => (
    <thead>
      <tr
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: '#e2e8f0',
          borderBottom: '2px solid #000',
        }}
      >
        {/* Checkbox icon column */}
        <th style={{ padding: '6px', width: 28, borderRight: '1px solid rgba(0,0,0,0.2)' }}>
          <span
            className="material-icons"
            style={{ fontSize: 12, color: '#64748b', verticalAlign: 'middle', fontFamily: 'Material Icons' }}
          >
            check_box_outline_blank
          </span>
        </th>
        {renderTh('ASSET TITLE', 'title')}
        {renderTh('CLASS', 'type')}
        {renderTh('CONTEXT', 'segment')}
        {renderTh('ID')}
        {renderTh('SUMMARY PHRASE')}
      </tr>
    </thead>
  );

  const renderDataRow = (row: TableRow, isSubItem = false) => {
    const typeIcon = getTypeIcon(row.type);
    const isSelected = selectedId === row.id;
    const isPending = pendingEnrichmentIds?.has(row.id) ?? false;
    const summary = row.quickPhrase || row.shortDescription || '';

    return (
      <tr
        key={row.id}
        onClick={() => onSelect(row.id)}
        style={{
          background: isSelected
            ? '#eff6ff'
            : isSubItem
            ? '#f8fafc'
            : undefined,
          cursor: 'pointer',
          borderBottom: '1px solid rgba(0,0,0,0.1)',
          opacity: isPending ? 0.6 : 1,
        }}
        aria-selected={isSelected}
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(row.id);
          }
        }}
      >
        {/* Icon cell */}
        <td
          style={{
            padding: '5px 6px',
            width: 28,
            textAlign: 'center',
            borderRight: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          {isSubItem ? (
            <span
              className="material-icons"
              style={{
                fontSize: 12,
                color: typeIcon.color,
                opacity: 0.5,
                verticalAlign: 'middle',
                fontFamily: 'Material Icons',
              }}
            >
              subdirectory_arrow_right
            </span>
          ) : (
            <span
              className="material-icons"
              style={{
                fontSize: 13,
                color: typeIcon.color,
                verticalAlign: 'middle',
                fontFamily: 'Material Icons',
              }}
            >
              {typeIcon.icon}
            </span>
          )}
        </td>

        {/* Title */}
        <td
          style={{
            padding: '5px 6px',
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: 600,
            fontSize: 11,
            borderRight: '1px solid rgba(0,0,0,0.08)',
          }}
          title={row.title}
        >
          {row.title}
        </td>

        {/* Class badge */}
        <td
          style={{
            padding: '5px 6px',
            textAlign: 'center',
            borderRight: '1px solid rgba(0,0,0,0.08)',
            whiteSpace: 'nowrap',
          }}
        >
          <ClassBadge typeCode={row.type} />
        </td>

        {/* Context badge */}
        <td
          style={{
            padding: '5px 6px',
            textAlign: 'center',
            borderRight: '1px solid rgba(0,0,0,0.08)',
            whiteSpace: 'nowrap',
          }}
        >
          <ContextBadge segmentCode={row.segmentCode} />
        </td>

        {/* ID */}
        <td
          style={{
            padding: '5px 6px',
            fontFamily: 'monospace',
            fontSize: 9,
            textAlign: 'center',
            borderRight: '1px solid rgba(0,0,0,0.08)',
            whiteSpace: 'nowrap',
            color: '#475569',
          }}
        >
          {shortId(row.id)}
        </td>

        {/* Summary */}
        <td
          style={{
            padding: '5px 6px',
            color: '#475569',
            fontSize: 11,
            maxWidth: 300,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={summary}
        >
          {summary}
        </td>
      </tr>
    );
  };

  const renderGroupHeader = (label: string, catCode: string, count: number) => {
    const isCollapsed = collapsedGroups.has(catCode);
    return (
      <tr
        key={`group-header-${catCode}`}
        style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000' }}
      >
        <td
          colSpan={6}
          style={{
            background: '#cbd5e1',
            fontWeight: 800,
            fontSize: 10,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            padding: '4px 8px',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onClick={() => toggleGroup(catCode)}
          role="button"
          aria-expanded={!isCollapsed}
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleGroup(catCode);
            }
          }}
        >
          <span style={{ marginRight: 6, fontSize: 10, color: '#475569' }}>
            {isCollapsed ? '\u25B6' : '\u25BC'}
          </span>
          {label}
          <span
            style={{
              marginLeft: 8,
              background: '#475569',
              color: '#fff',
              fontSize: 8,
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: 2,
              verticalAlign: 'middle',
            }}
          >
            {count}
          </span>
        </td>
      </tr>
    );
  };

  const renderTableBody = () => {
    if (data.length === 0) {
      return (
        <tbody>
          <tr>
            <td
              colSpan={6}
              style={{
                padding: 32,
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              NO ITEMS FOUND
            </td>
          </tr>
        </tbody>
      );
    }

    if (groupedData && groupedData.length > 0) {
      return (
        <tbody>
          {groupedData.map(group => {
            const isCollapsed = collapsedGroups.has(group.catCode);
            const sortedItems = [...group.items].sort((a, b) =>
              compareRows(a, b, sortKey, sortDir),
            );

            return (
              <React.Fragment key={`grp-${group.catCode}`}>
                {renderGroupHeader(group.label, group.catCode, group.items.length)}
                {!isCollapsed &&
                  sortedItems.map((row, idx) => renderDataRow(row, idx > 0))}
              </React.Fragment>
            );
          })}
        </tbody>
      );
    }

    return (
      <tbody>
        {sortedFlatData.map(row => renderDataRow(row, false))}
      </tbody>
    );
  };

  const renderTableView = () => (
    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 120px)' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 11,
          tableLayout: 'auto',
        }}
        role="grid"
        aria-label="Asset data table"
      >
        {renderStickyHeader()}
        {renderTableBody()}
      </table>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      style={{
        border: '2px solid #000',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      }}
      role="region"
      aria-label="Brutalist data table"
    >
      {/* View mode tabs */}
      {renderViewTabs()}

      {/* Content area */}
      {activeView === 'TABLE' && renderTableView()}
      {activeView === 'BOARD' && <PlaceholderView label="Board" />}
      {activeView === 'ANALYTICS' && <PlaceholderView label="Analytics" />}
      {activeView === 'CALENDAR' && <PlaceholderView label="Calendar" />}
    </div>
  );
};

export default BrutalistDataTable;
