// ============================================================
// Tree Panel - Center panel with hierarchy tree
// ============================================================

import React, { useMemo, useState, useCallback, memo } from 'react';
import { useApp } from '../../context/AppContext';
import { ContextMenu } from '../dialogs/ContextMenu';
import { DraggableTreeNode } from '../tree/DraggableTreeNode';
import { useDragAndDrop, DropPosition } from '../../hooks/useDragAndDrop';
import type { TreeNode } from '../../../shared/types';
import type { ContextMenuOption } from '../dialogs/ContextMenu';

// ============================================================
// Tree Node Wrapper Component
// ============================================================

interface TreeNodeWrapperProps {
  node: TreeNode;
  level: number;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onContextMenu: (nodeId: string, x: number, y: number) => void;
  selectedId: string | null;
  expandedIds: Set<string>;
  searchHighlightIds: Set<string>;
  dragState: {
    draggedNodeId: string | null;
    dragOverNodeId: string | null;
    dropPosition: DropPosition | null;
  };
  dragHandlers: {
    onDragStart: (nodeId: string) => (e: React.DragEvent) => void;
    onDragOver: (nodeId: string) => (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (nodeId: string) => (e: React.DragEvent) => void;
    onDragEnd: () => void;
  };
}

const TreeNodeWrapper = memo(function TreeNodeWrapper({
  node,
  level,
  onSelect,
  onToggle,
  onContextMenu,
  selectedId,
  expandedIds,
  searchHighlightIds,
  dragState,
  dragHandlers,
}: TreeNodeWrapperProps): React.ReactElement {
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const hasChildren = node.children && node.children.length > 0;
  const isDragging = dragState.draggedNodeId === node.id;
  const isDragOver = dragState.dragOverNodeId === node.id;
  const searchHighlighted = searchHighlightIds.has(node.id);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(node.id);
    onContextMenu(node.id, e.clientX, e.clientY);
  }, [node.id, onSelect, onContextMenu]);

  return (
    <DraggableTreeNode
      node={node}
      level={level}
      isSelected={isSelected}
      isExpanded={isExpanded}
      isDragging={isDragging}
      isDragOver={isDragOver}
      dropPosition={dragState.dropPosition}
      searchHighlighted={searchHighlighted}
      onSelect={() => onSelect(node.id)}
      onToggle={() => onToggle(node.id)}
      onContextMenu={handleContextMenu}
      onDragStart={dragHandlers.onDragStart(node.id)}
      onDragEnd={dragHandlers.onDragEnd}
      onDragOver={dragHandlers.onDragOver(node.id)}
      onDragLeave={dragHandlers.onDragLeave}
      onDrop={dragHandlers.onDrop(node.id)}
    >
      {/* Render children */}
      {hasChildren && node.children.map((child) => (
        <TreeNodeWrapper
          key={child.id}
          node={child}
          level={level + 1}
          onSelect={onSelect}
          onToggle={onToggle}
          onContextMenu={onContextMenu}
          selectedId={selectedId}
          expandedIds={expandedIds}
          searchHighlightIds={searchHighlightIds}
          dragState={dragState}
          dragHandlers={dragHandlers}
        />
      ))}
    </DraggableTreeNode>
  );
});

// ============================================================
// Tree Panel Component
// ============================================================

export function TreePanel(): React.ReactElement {
  const { state, dispatch, actions } = useApp();
  const {
    currentView,
    segments,
    organizations,
    selectedSegmentId,
    selectedOrganizationId,
    tree,
    selectedNodeId,
    expandedNodeIds,
    treeLoading,
    searchResultIds,
  } = state;

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuNodeId, setContextMenuNodeId] = useState<string | null>(null);

  // Get current panel title
  const panelTitle = useMemo(() => {
    if (currentView === 'function') {
      const segment = segments.find((s) => s.id === selectedSegmentId);
      return segment?.segmentName || 'Select a space';
    } else {
      const org = organizations.find((o) => o.id === selectedOrganizationId);
      return org?.orgName || 'Select an organization';
    }
  }, [currentView, segments, organizations, selectedSegmentId, selectedOrganizationId]);

  // Helper function to check if a node is a descendant of another
  const isDescendant = useCallback((nodeId: string, potentialAncestorId: string, nodes: TreeNode[]): boolean => {
    for (const node of nodes) {
      if (node.id === potentialAncestorId && node.children) {
        if (node.children.some(child => child.id === nodeId)) return true;
        if (isDescendant(nodeId, potentialAncestorId, node.children)) return true;
      }
      if (node.children && isDescendant(nodeId, potentialAncestorId, node.children)) {
        return true;
      }
    }
    return false;
  }, []);

  // Helper function to find a node by ID in the tree
  const findNodeInTree = useCallback((nodeId: string, nodes: TreeNode[]): TreeNode | null => {
    for (const node of nodes) {
      if (node.id === nodeId) return node;
      if (node.children) {
        const found = findNodeInTree(nodeId, node.children);
        if (found) return found;
      }
    }
    return null;
  }, []);

  // Handle node drop
  const handleNodeDrop = useCallback(async (sourceId: string, targetId: string, position: DropPosition) => {
    try {
      // Prevent dropping a node into its own descendant
      if (isDescendant(targetId, sourceId, tree)) {
        setToast({ message: "Can't move parent into its own child", type: 'error' });
        setTimeout(() => setToast(null), 3000);
        return;
      }

      // For 'inside' position, just use the target as parent
      // For 'before'/'after', we'd need the target's parent (simplified for now)
      if (position === 'inside') {
        // Auto-expand the target if it's a container
        if (!expandedNodeIds.has(targetId)) {
          dispatch({ type: 'EXPAND_NODE', id: targetId });
        }

        await actions.moveNode(sourceId, targetId);
        setToast({ message: 'Item moved successfully', type: 'success' });
        setTimeout(() => setToast(null), 2000);
      } else {
        // For before/after, we need to implement sibling reordering
        // For now, just show a message
        setToast({ message: 'Sibling reordering coming soon', type: 'error' });
        setTimeout(() => setToast(null), 2000);
      }
    } catch (err) {
      console.error('Failed to move node:', err);
      setToast({
        message: err instanceof Error ? err.message : 'Failed to move item',
        type: 'error'
      });
      setTimeout(() => setToast(null), 3000);
    }
  }, [actions, tree, expandedNodeIds, dispatch, isDescendant]);

  // Can drop validation
  const canDrop = useCallback((sourceId: string, targetId: string, position: DropPosition): boolean => {
    // Can't drop on self
    if (sourceId === targetId) return false;

    // Can't drop parent into descendant
    if (isDescendant(targetId, sourceId, tree)) return false;

    // Can only drop 'inside' containers
    const targetNode = findNodeInTree(targetId, tree);
    if (!targetNode) return false;

    if (position === 'inside') {
      // Only containers can accept inside drops
      return targetNode.nodeType !== 'item';
    }

    // For before/after, would need more logic (not supported yet)
    return false;
  }, [tree, isDescendant, findNodeInTree]);

  // Auto-expand on drag over
  const handleDragOverNode = useCallback((nodeId: string) => {
    if (!expandedNodeIds.has(nodeId)) {
      dispatch({ type: 'EXPAND_NODE', id: nodeId });
    }
  }, [expandedNodeIds, dispatch]);

  // Setup drag and drop
  const { state: dragDropState, handlers: dragHandlers } = useDragAndDrop({
    onDrop: handleNodeDrop,
    canDrop,
    onDragOverNode: handleDragOverNode,
  });

  // Handlers
  const handleSelectNode = useCallback((id: string) => {
    actions.selectNode(id);
  }, [actions]);

  const handleToggleNode = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_NODE_EXPANDED', id });
  }, [dispatch]);

  // Context menu
  const contextMenuNode = contextMenuNodeId ? findNodeInTree(contextMenuNodeId, tree) : null;

  const contextMenuOptions: ContextMenuOption[] = contextMenuNode ? [
    {
      label: 'Open Link',
      icon: '🔗',
      shortcut: '⌘O',
      action: () => {
        if (contextMenuNode.sourceUrl) {
          window.open(contextMenuNode.sourceUrl, '_blank');
        }
      },
      disabled: !contextMenuNode.sourceUrl,
    },
    {
      label: 'Edit',
      icon: '✏️',
      shortcut: '⌘E',
      action: () => {
        handleSelectNode(contextMenuNode.id);
      },
    },
    { divider: true },
    {
      label: 'Merge with...',
      icon: '🔀',
      action: () => {
        if (contextMenuNode.nodeType === 'item') {
          actions.openMergeDialog(contextMenuNode.id);
        }
      },
      disabled: contextMenuNode.nodeType !== 'item',
    },
    { divider: true },
    {
      label: 'Copy URL',
      icon: '📋',
      action: () => {
        if (contextMenuNode.sourceUrl) {
          navigator.clipboard.writeText(contextMenuNode.sourceUrl);
          setToast({ message: 'URL copied to clipboard', type: 'success' });
          setTimeout(() => setToast(null), 2000);
        }
      },
      disabled: !contextMenuNode.sourceUrl,
    },
    {
      label: 'Copy Title',
      icon: '📄',
      action: () => {
        navigator.clipboard.writeText(contextMenuNode.title);
        setToast({ message: 'Title copied to clipboard', type: 'success' });
        setTimeout(() => setToast(null), 2000);
      },
    },
    { divider: true },
    {
      label: 'Delete',
      icon: '🗑️',
      shortcut: '⌘⌫',
      action: () => {
        const confirmed = window.confirm(`Delete "${contextMenuNode.title}"?`);
        if (confirmed) {
          actions.deleteNode(contextMenuNode.id);
        }
      },
    },
  ] : [];

  const handleContextMenu = useCallback((nodeId: string, x: number, y: number) => {
    setContextMenuNodeId(nodeId);
    setContextMenuPosition({ x, y });
    setContextMenuOpen(true);
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenuOpen(false);
    setContextMenuNodeId(null);
  }, []);

  return (
    <section className="panel tree-panel">
      <div className="panel-header">
        <div className="tree-header-content">
          <span className="tree-panel-title">{panelTitle}</span>
          <span className="tree-item-count">
            {tree.length > 0 && `${countNodes(tree)} items`}
          </span>
        </div>
        <button
          className="tree-refresh-btn"
          onClick={actions.refreshTree}
          title="Refresh"
        >
          ↻
        </button>
      </div>

      <div className="panel-content">
        {treeLoading ? (
          <div className="tree-loading">
            <span className="loading-spinner">⏳</span>
            <span>Loading...</span>
          </div>
        ) : tree.length === 0 ? (
          <div className="tree-empty">
            <div className="empty-icon">📥</div>
            <p className="text-muted">No items yet</p>
            <p className="text-small text-muted">Import a URL to get started</p>
            <button
              className="gum-button gum-button--pink gum-button--small"
              onClick={actions.openImportDialog}
            >
              Import URL
            </button>
          </div>
        ) : (
          <div className="tree-container">
            {tree.map((node) => (
              <TreeNodeWrapper
                key={node.id}
                node={node}
                level={0}
                onSelect={handleSelectNode}
                onToggle={handleToggleNode}
                onContextMenu={handleContextMenu}
                selectedId={selectedNodeId}
                expandedIds={expandedNodeIds}
                searchHighlightIds={searchResultIds}
                dragState={dragDropState}
                dragHandlers={dragHandlers}
              />
            ))}
          </div>
        )}

        {/* Toast Notification */}
        {toast && (
          <div className={`tree-toast tree-toast--${toast.type}`}>
            {toast.type === 'success' ? '✓' : '✕'} {toast.message}
          </div>
        )}

        {/* Context Menu */}
        <ContextMenu
          isOpen={contextMenuOpen}
          position={contextMenuPosition}
          node={contextMenuNode}
          options={contextMenuOptions}
          onClose={handleCloseContextMenu}
        />
      </div>

      <style>{`
        .tree-panel {
          width: var(--panel-tree-width);
          display: flex;
          flex-direction: column;
        }

        .tree-panel .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .tree-header-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .tree-panel-title {
          font-weight: var(--font-weight-bold);
        }

        .tree-item-count {
          font-size: var(--font-size-xs);
          color: var(--gum-gray-500);
        }

        .tree-refresh-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          border-radius: var(--border-radius);
          cursor: pointer;
          font-size: var(--font-size-lg);
          transition: transform var(--transition-fast);
        }

        .tree-refresh-btn:hover {
          background: var(--gum-gray-100);
          transform: rotate(90deg);
        }

        .tree-loading,
        .tree-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: var(--space-md);
          text-align: center;
        }

        .loading-spinner {
          font-size: 24px;
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .empty-icon {
          font-size: 48px;
          opacity: 0.5;
        }

        .tree-container {
          font-size: var(--font-size-sm);
        }

        .tree-toast {
          position: absolute;
          bottom: 12px;
          left: 12px;
          right: 12px;
          padding: var(--space-sm);
          border-radius: var(--border-radius);
          font-size: var(--font-size-sm);
          animation: slideUp 0.3s ease-out;
          display: flex;
          align-items: center;
          gap: var(--space-xs);
          z-index: 1000;
        }

        .tree-toast--success {
          background: var(--gum-green);
          color: var(--gum-black);
          border: 2px solid var(--gum-black);
        }

        .tree-toast--error {
          background: var(--gum-pink);
          color: var(--gum-black);
          border: 2px solid var(--gum-black);
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
}

// ============================================================
// Helper Functions
// ============================================================

function countNodes(nodes: TreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count++;
    if (node.children) {
      count += countNodes(node.children);
    }
  }
  return count;
}
