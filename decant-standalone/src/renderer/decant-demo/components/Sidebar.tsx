import React, { useState, useCallback, useMemo } from 'react';
import type { TreeNodeData } from '../types';
import { SEGMENT_HEX_MAP } from '../helpers';
import { getTreeNodeIcon, getIconProps } from '../../utils/hierarchyIcons';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';

// ============================================================================
// TREE NODE COMPONENT
// ============================================================================

interface TreeNodeProps {
  node: TreeNodeData;
  level: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string, node: TreeNodeData) => void;
  onToggle: (id: string) => void;
  itemCounts?: Map<string, number>;
  onDropItem?: (itemId: string, targetNodeId: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  level,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
  itemCounts,
  onDropItem,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;

  const NodeIcon = getTreeNodeIcon(node.id, node.iconType, node.iconHint);

  // Dynamic hierarchy: use node's own color or derive from level
  const iconColor = node.iconColor || SEGMENT_HEX_MAP[node.id.charAt(0)?.toUpperCase()] || '#6b7280';
  const iconProps = getIconProps({ size: 16, stroke: 1.5, color: iconColor });

  // For dynamic hierarchy, branches are identified by having children, not by ID prefix
  const isSegment = node.id.startsWith('seg-') || (level === 0 && hasChildren);
  const isBranch = hasChildren;
  const segmentColorClass = isSegment ? `decant-tree-node__row--seg-${node.id.charAt(0)?.toUpperCase() || 'A'}` : '';
  const levelClass = isBranch ? (level === 0 ? 'decant-tree-node__row--segment' : 'decant-tree-node__row--category') : 'decant-tree-node__row--item';

  return (
    <div className="decant-tree-node">
      <div
        className={`decant-tree-node__row ${levelClass} ${segmentColorClass} ${isSelected ? 'decant-tree-node__row--selected' : ''} ${isDragOver ? 'decant-tree-node__row--drop-target' : ''}`}
        style={{ paddingLeft: `${level * 20 + 12}px` }}
        onClick={() => onSelect(node.id, node)}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          try {
            const payload = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (payload.id) {
              onDropItem?.(payload.id, node.id);
            }
          } catch {}
        }}
      >
        {(isSegment || (level === 0 && hasChildren)) && <span className="decant-tree-node__accent" style={{ backgroundColor: iconColor }} />}
        {hasChildren ? (
          <button
            className="decant-tree-node__toggle"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
          >
            {isExpanded ? <IconChevronDown size={14} stroke={1.5} /> : <IconChevronRight size={14} stroke={1.5} />}
          </button>
        ) : (
          <span className="decant-tree-node__toggle-spacer" />
        )}
        <NodeIcon {...iconProps} className="decant-tree-node__icon" />
        <span className="decant-tree-node__label">{node.name}</span>
        {itemCounts?.get(node.id) != null && itemCounts.get(node.id)! > 0 && (
          <span className="decant-tree-node__count">{itemCounts.get(node.id)}</span>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div className="decant-tree-node__children">
          <span className="decant-tree-node__guide" style={{ left: `${level * 20 + 24}px` }} />
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
              itemCounts={itemCounts}
              onDropItem={onDropItem}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SIDEBAR COMPONENT
// ============================================================================

interface SidebarProps {
  data: TreeNodeData[];
  selectedId: string | null;
  onSelect: (id: string, node: TreeNodeData) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  totalCount: number;
  width: number;
  onResizeStart: () => void;
  itemCounts?: Map<string, number>;
  onDropItem?: (itemId: string, targetNodeId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  data,
  selectedId,
  onSelect,
  isCollapsed,
  onToggleCollapse,
  totalCount,
  width,
  onResizeStart,
  itemCounts,
  onDropItem,
}) => {
  // Auto-expand top-level branches on first render
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    for (const node of data) {
      ids.add(node.id);
    }
    return ids;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [allExpanded, setAllExpanded] = useState(false);

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  const collectAllIds = useCallback((nodes: TreeNodeData[]): string[] => {
    const ids: string[] = [];
    for (const node of nodes) {
      ids.push(node.id);
      if (node.children) ids.push(...collectAllIds(node.children));
    }
    return ids;
  }, []);

  const handleExpandAll = useCallback(() => {
    if (allExpanded) {
      setExpandedIds(new Set());
      setAllExpanded(false);
    } else {
      setExpandedIds(new Set(collectAllIds(data)));
      setAllExpanded(true);
    }
  }, [allExpanded, data, collectAllIds]);

  const filterTree = useCallback((nodes: TreeNodeData[], query: string): TreeNodeData[] => {
    if (!query) return nodes;
    return nodes.reduce<TreeNodeData[]>((acc, node) => {
      const matchesSearch = node.name.toLowerCase().includes(query.toLowerCase());
      const filteredChildren = node.children ? filterTree(node.children, query) : [];
      if (matchesSearch || filteredChildren.length > 0) {
        acc.push({
          ...node,
          children: filteredChildren.length > 0 ? filteredChildren : node.children,
        });
      }
      return acc;
    }, []);
  }, []);

  const filteredData = useMemo(() => filterTree(data, searchQuery), [data, searchQuery, filterTree]);

  return (
    <aside
      className={`decant-sidebar ${isCollapsed ? 'decant-sidebar--collapsed' : ''}`}
      style={!isCollapsed ? { width } : undefined}
    >
      <div className="decant-sidebar__search">
        <i className="bx bx-search" />
        <input
          type="text"
          placeholder="Search your tree..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button
          className="decant-sidebar__expand-all"
          onClick={handleExpandAll}
          title={allExpanded ? 'Collapse all' : 'Expand all'}
        >
          <i className={`bx ${allExpanded ? 'bx-collapse-alt' : 'bx-expand-alt'}`} />
        </button>
      </div>
      <div className="decant-sidebar__content">
        <div
          className={`decant-tree-node__root-row ${selectedId === 'all' || selectedId === null ? 'decant-tree-node__row--selected' : ''}`}
          onClick={() => onSelect('all', { id: 'all', name: 'All Items' } as TreeNodeData)}
          role="button"
          tabIndex={0}
        >
          <span className="decant-tree-node__toggle-spacer" />
          <svg className="decant-tree-node__root-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          <span className="decant-tree-node__root-label">All Items</span>
          <span className="decant-tree-node__root-count">{totalCount}</span>
        </div>
        {filteredData.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            level={0}
            selectedId={selectedId}
            expandedIds={expandedIds}
            onSelect={onSelect}
            onToggle={handleToggle}
            itemCounts={itemCounts}
            onDropItem={onDropItem}
          />
        ))}
      </div>
      <button className="decant-sidebar__toggle" onClick={onToggleCollapse}>
        <i className={`bx ${isCollapsed ? 'bx-chevron-right' : 'bx-chevron-left'}`} />
      </button>
      <div className="decant-sidebar__resize-handle" onMouseDown={onResizeStart} />
    </aside>
  );
};
