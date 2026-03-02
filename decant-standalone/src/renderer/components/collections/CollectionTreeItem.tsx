// ============================================================
// CollectionTreeItem
// Single folder row in the collection tree
// ============================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import { IconChevronRight, IconChevronDown, IconDots } from '@tabler/icons-react';
import { CollectionTreeNode } from '../../services/api';

interface CollectionTreeItemProps {
  node: CollectionTreeNode;
  level: number;
  expandedIds: Set<string>;
  renamingId: string | null;
  selectedId: string | null;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onCancelRename: () => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

export function CollectionTreeItem({
  node,
  level,
  expandedIds,
  renamingId,
  selectedId,
  onToggleExpand,
  onSelect,
  onRename,
  onCancelRename,
  onContextMenu,
}: CollectionTreeItemProps) {
  const [renameValue, setRenameValue] = useState(node.name);
  const renameRef = useRef<HTMLInputElement>(null);
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isRenaming = renamingId === node.id;
  const isSelected = selectedId === node.id;

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (isRenaming) {
      setRenameValue(node.name);
      setTimeout(() => {
        renameRef.current?.focus();
        renameRef.current?.select();
      }, 10);
    }
  }, [isRenaming, node.name]);

  const handleRenameSubmit = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed.length > 0 && trimmed !== node.name) {
      onRename(node.id, trimmed);
    } else {
      onCancelRename();
    }
  }, [renameValue, node.name, node.id, onRename, onCancelRename]);

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameSubmit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancelRename();
    }
  };

  return (
    <>
      <div
        className={`collection-tree-item ${isSelected ? 'collection-tree-item--selected' : ''}`}
        style={{ paddingLeft: `${12 + level * 16}px` }}
        onClick={() => onSelect(node.id)}
        onContextMenu={(e) => onContextMenu(e, node.id)}
        data-collection-id={node.id}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={isSelected}
        tabIndex={0}
      >
        {/* Expand/Collapse Chevron */}
        <span
          className={`collection-tree-chevron ${hasChildren ? '' : 'collection-tree-chevron--hidden'}`}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggleExpand(node.id);
          }}
        >
          {hasChildren && (
            isExpanded
              ? <IconChevronDown size={14} />
              : <IconChevronRight size={14} />
          )}
        </span>

        {/* Icon */}
        <span
          className="collection-item__icon"
          style={{
            backgroundColor: node.color + '20',
            color: node.color,
          }}
        >
          {node.icon}
        </span>

        {/* Name or Rename Input */}
        {isRenaming ? (
          <input
            ref={renameRef}
            className="collection-rename-field"
            type="text"
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameSubmit}
            maxLength={100}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="collection-tree-item__name">{node.name}</span>
        )}

        {/* Count Badge */}
        {!isRenaming && node.nodeCount > 0 && (
          <span className="collection-tree-item__count">{node.nodeCount}</span>
        )}

        {/* Context Menu Trigger */}
        {!isRenaming && (
          <button
            className="collection-tree-item__menu"
            onClick={(e) => {
              e.stopPropagation();
              onContextMenu(e, node.id);
            }}
            aria-label="Collection options"
          >
            <IconDots size={14} />
          </button>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="collection-tree-children" role="group">
          {node.children.map(child => (
            <CollectionTreeItem
              key={child.id}
              node={child}
              level={level + 1}
              expandedIds={expandedIds}
              renamingId={renamingId}
              selectedId={selectedId}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onRename={onRename}
              onCancelRename={onCancelRename}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </>
  );
}
