/**
 * BrutalistShell — Main layout container for the Brutalist V2 theme.
 *
 * Replaces DecantDemo's inner layout with a Stitch-design-export aesthetic:
 * heavy black borders, navy header, slate sidebar/detail panes, white table area.
 *
 * Three-column layout:
 *   [Left sidebar 208px] | [Center table flex-1] | [Right detail 320px (conditional)]
 *
 * The component composes BrutalistTopBar and BrutalistStatusBar from this
 * directory. BrutalistSidebar, BrutalistDataTable, and BrutalistDetailPane
 * are placeholders — those sub-components are created by parallel agents and
 * imported from the same directory once ready.
 *
 * Usage:
 *   <BrutalistShell
 *     searchQuery={q}
 *     onSearchChange={setQ}
 *     treeData={tree}
 *     selectedTreeId={selectedId}
 *     onTreeNodeSelect={handleSelect}
 *     tableData={rows}
 *     selectedRowId={rowId}
 *     onRowSelect={setRowId}
 *     onToggleStar={handleStar}
 *     selectedItem={item}
 *     onDetailClose={handleClose}
 *     nodeCount={total}
 *     filteredCount={visible}
 *     onToggleUiMode={handleToggleUi}
 *   />
 */

import React from 'react';
import type { TableRow, TreeNodeData } from '../types';
import { BrutalistTopBar } from './BrutalistTopBar';
import { BrutalistStatusBar } from './BrutalistStatusBar';
import { BrutalistSidebar } from './BrutalistSidebar';
import { BrutalistDataTable } from './BrutalistDataTable';
import { BrutalistDetailPane } from './BrutalistDetailPane';

// ============================================================================
// TYPES
// ============================================================================

interface BrutalistShellProps {
  // Top bar
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onQuickAddClick?: () => void;
  onRefreshAllClick?: () => void;
  onReclassifyClick?: () => void;
  isReclassifying?: boolean;
  reclassifyProgress?: { completed: number; total: number; phase?: string } | null;
  onSettingsClick?: () => void;
  onToggleUiMode: () => void;

  // Sidebar
  treeData: TreeNodeData[];
  selectedTreeId: string | null;
  onTreeNodeSelect: (id: string, node: TreeNodeData) => void;
  itemCounts?: Map<string, number>;

  // Table
  tableData: TableRow[];
  groupedData?: { label: string; catCode: string; items: TableRow[]; segCode?: string }[] | null;
  selectedRowId: string | null;
  onRowSelect: (id: string) => void;
  onToggleStar: (id: string) => void;
  onCellEdit?: (rowId: string, field: string, value: string) => void;
  columnFilters?: Record<string, string>;
  onColumnFilterChange?: (filters: Record<string, string>) => void;
  pendingEnrichmentIds?: Set<string>;

  // Detail pane
  selectedItem: TableRow | null;
  onDetailClose: () => void;

  // Status bar
  nodeCount: number;
  filteredCount: number;
  pendingCount?: number;
}

// ============================================================================
// DIVIDER
// ============================================================================

const ColumnDivider: React.FC = () => (
  <div
    aria-hidden="true"
    style={{
      width: '2px',
      backgroundColor: '#000',
      flexShrink: 0,
      alignSelf: 'stretch',
    }}
  />
);

// MAIN COMPONENT
// ============================================================================

export const BrutalistShell: React.FC<BrutalistShellProps> = React.memo(({
  // Top bar
  searchQuery,
  onSearchChange,
  onQuickAddClick,
  onRefreshAllClick,
  onReclassifyClick,
  isReclassifying,
  reclassifyProgress,
  onSettingsClick,
  onToggleUiMode,
  // Sidebar
  treeData,
  selectedTreeId,
  onTreeNodeSelect,
  itemCounts,
  // Table
  tableData,
  groupedData,
  selectedRowId,
  onRowSelect,
  onToggleStar,
  onCellEdit,
  columnFilters,
  onColumnFilterChange,
  pendingEnrichmentIds,
  // Detail
  selectedItem,
  onDetailClose,
  // Status
  nodeCount,
  filteredCount,
  pendingCount,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
        backgroundColor: '#000',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      aria-label="Decant application"
    >
      {/* ---- Header (40px) ---- */}
      <BrutalistTopBar
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onQuickAddClick={onQuickAddClick}
        onRefreshAllClick={onRefreshAllClick}
        onReclassifyClick={onReclassifyClick}
        isReclassifying={isReclassifying}
        reclassifyProgress={reclassifyProgress}
        onSettingsClick={onSettingsClick}
        onToggleUiMode={onToggleUiMode}
      />

      {/* ---- Main content (flex-1) ---- */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          overflow: 'hidden',
          minHeight: 0,
        }}
        role="main"
      >
        {/* Sidebar */}
        <BrutalistSidebar
          data={treeData}
          selectedId={selectedTreeId}
          onSelect={onTreeNodeSelect}
          itemCounts={itemCounts}
        />

        <ColumnDivider />

        {/* Table */}
        <BrutalistDataTable
          data={tableData}
          groupedData={groupedData}
          selectedId={selectedRowId}
          onSelect={onRowSelect}
          onToggleStar={onToggleStar}
          onCellEdit={onCellEdit}
          columnFilters={columnFilters}
          onColumnFilterChange={onColumnFilterChange}
          pendingEnrichmentIds={pendingEnrichmentIds}
        />

        {/* Detail pane — conditional render, no layout shift when absent */}
        {selectedItem != null && (
          <>
            <ColumnDivider />
            <BrutalistDetailPane item={selectedItem} onClose={onDetailClose} />
          </>
        )}
      </div>

      {/* ---- Footer (24px) ---- */}
      <BrutalistStatusBar
        nodeCount={nodeCount}
        filteredCount={filteredCount}
        pendingCount={pendingCount}
      />
    </div>
  );
});

BrutalistShell.displayName = 'BrutalistShell';
