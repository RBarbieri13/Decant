// ============================================================
// Complete Usage Example - Context Menu + Detail Panel
// ============================================================
// This file demonstrates how to integrate the enhanced context menu
// and detail panel features in a tree view component.

import React, { useState, useCallback } from 'react';
import { ContextMenu, type ContextMenuOption } from './components/dialogs/ContextMenu';
import { DetailPanel } from './components/layout/DetailPanel';
import { useApp } from './context/AppContext';
import type { TreeNode } from './shared/types';

/**
 * TreeViewWithContextMenu Component
 *
 * Demonstrates:
 * 1. Right-click context menu on tree nodes
 * 2. Full context menu actions (Open, Edit, Move, Merge, Copy, Delete)
 * 3. Integration with DetailPanel for node details
 * 4. Clipboard operations
 */
export function TreeViewWithContextMenu(): React.ReactElement {
  const { state, actions } = useApp();
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    node: TreeNode | null;
  }>({ isOpen: false, position: { x: 0, y: 0 }, node: null });

  // ============================================================
  // Context Menu Handlers
  // ============================================================

  const handleContextMenu = useCallback((e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      node,
    });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({ isOpen: false, position: { x: 0, y: 0 }, node: null });
  }, []);

  // ============================================================
  // Action Handlers
  // ============================================================

  const handleOpenLink = useCallback((node: TreeNode) => {
    if (node.sourceUrl) {
      window.open(node.sourceUrl, '_blank');
    }
  }, []);

  const handleEdit = useCallback((node: TreeNode) => {
    actions.selectNode(node.id);
    // The DetailPanel will handle the edit UI
  }, [actions]);

  const handleMove = useCallback((node: TreeNode) => {
    // TODO: Implement move dialog
    console.log('Move dialog for node:', node.id);
    alert('Move functionality coming soon!');
  }, []);

  const handleMerge = useCallback((node: TreeNode) => {
    actions.openMergeDialog(node.id);
  }, [actions]);

  const handleDuplicate = useCallback(async (node: TreeNode) => {
    // TODO: Implement duplicate API endpoint
    console.log('Duplicate node:', node.id);
    alert('Duplicate functionality coming soon!');
  }, []);

  // ============================================================
  // Clipboard Handlers
  // ============================================================

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log(`${label} copied to clipboard`);
      // TODO: Show toast notification
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, []);

  const copyUrl = useCallback((node: TreeNode) => {
    if (node.sourceUrl) {
      copyToClipboard(node.sourceUrl, 'URL');
    }
  }, [copyToClipboard]);

  const copyTitle = useCallback((node: TreeNode) => {
    copyToClipboard(node.title, 'Title');
  }, [copyToClipboard]);

  const copyAsMarkdown = useCallback((node: TreeNode) => {
    if (node.sourceUrl) {
      const markdown = `[${node.title}](${node.sourceUrl})`;
      copyToClipboard(markdown, 'Markdown');
    }
  }, [copyToClipboard]);

  // ============================================================
  // Delete Handler
  // ============================================================

  const handleDelete = useCallback(async (node: TreeNode) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${node.title}"?\nThis action cannot be undone.`
    );

    if (confirmed) {
      try {
        await actions.deleteNode(node.id);
        console.log('Node deleted successfully');
      } catch (err) {
        console.error('Failed to delete node:', err);
        alert('Failed to delete node. Please try again.');
      }
    }
  }, [actions]);

  // ============================================================
  // Build Context Menu Options
  // ============================================================

  const getContextMenuOptions = useCallback((node: TreeNode): ContextMenuOption[] => {
    return [
      // Open link action
      {
        label: 'Open Link',
        icon: '↗',
        shortcut: '⌘O',
        action: () => handleOpenLink(node),
        disabled: !node.sourceUrl,
      },
      // Edit action
      {
        label: 'Edit',
        icon: '✏️',
        shortcut: '⌘E',
        action: () => handleEdit(node),
      },

      // Divider
      { divider: true },

      // Move action (with submenu indicator)
      {
        label: 'Move to...',
        icon: '📁',
        action: () => handleMove(node),
        hasSubmenu: true,
      },
      // Merge action
      {
        label: 'Merge with...',
        icon: '🔀',
        action: () => handleMerge(node),
      },
      // Duplicate action
      {
        label: 'Duplicate',
        icon: '📋',
        action: () => handleDuplicate(node),
      },

      // Divider
      { divider: true },

      // Copy URL action
      {
        label: 'Copy URL',
        icon: '🔗',
        action: () => copyUrl(node),
        disabled: !node.sourceUrl,
      },
      // Copy title action
      {
        label: 'Copy Title',
        icon: '📝',
        action: () => copyTitle(node),
      },
      // Copy as markdown action
      {
        label: 'Copy as Markdown',
        icon: '📄',
        action: () => copyAsMarkdown(node),
        disabled: !node.sourceUrl,
      },

      // Divider
      { divider: true },

      // Delete action (danger)
      {
        label: 'Delete',
        icon: '🗑️',
        shortcut: '⌘⌫',
        action: () => handleDelete(node),
        danger: true,
      },
    ];
  }, [
    handleOpenLink,
    handleEdit,
    handleMove,
    handleMerge,
    handleDuplicate,
    copyUrl,
    copyTitle,
    copyAsMarkdown,
    handleDelete,
  ]);

  // ============================================================
  // Render Tree Node (Example)
  // ============================================================

  const renderTreeNode = useCallback((node: TreeNode) => {
    const isSelected = state.selectedNodeId === node.id;

    return (
      <div
        key={node.id}
        className={`tree-node ${isSelected ? 'selected' : ''}`}
        onClick={() => actions.selectNode(node.id)}
        onContextMenu={(e) => handleContextMenu(e, node)}
      >
        {node.faviconPath && (
          <img
            src={`file://${node.faviconPath}`}
            alt=""
            className="tree-node-favicon"
          />
        )}
        <span className="tree-node-title">{node.title}</span>
        {node.contentTypeCode && (
          <span className="tree-node-badge">{node.contentTypeCode}</span>
        )}
      </div>
    );
  }, [state.selectedNodeId, actions, handleContextMenu]);

  // ============================================================
  // Render Layout
  // ============================================================

  return (
    <div className="app-layout">
      {/* Left Panel - Tree View */}
      <aside className="tree-panel">
        <div className="tree-header">
          <h2>Knowledge Tree</h2>
        </div>
        <div className="tree-content">
          {state.tree.map((node) => renderTreeNode(node))}
        </div>
      </aside>

      {/* Right Panel - Detail View */}
      <DetailPanel />

      {/* Context Menu */}
      {contextMenu.node && (
        <ContextMenu
          isOpen={contextMenu.isOpen}
          position={contextMenu.position}
          node={contextMenu.node}
          options={getContextMenuOptions(contextMenu.node)}
          onClose={handleCloseContextMenu}
        />
      )}

      {/* Styles */}
      <style>{`
        .app-layout {
          display: flex;
          height: 100vh;
          gap: var(--space-md);
          padding: var(--space-md);
        }

        .tree-panel {
          flex: 1;
          min-width: 300px;
          max-width: 400px;
          display: flex;
          flex-direction: column;
          background: var(--gum-white);
          border: 2px solid var(--gum-black);
          border-radius: var(--border-radius);
          overflow: hidden;
        }

        .tree-header {
          padding: var(--space-md);
          border-bottom: 2px solid var(--gum-black);
        }

        .tree-header h2 {
          margin: 0;
          font-size: var(--font-size-lg);
        }

        .tree-content {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-sm);
        }

        .tree-node {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          padding: var(--space-sm);
          border-radius: var(--border-radius);
          cursor: pointer;
          transition: background var(--transition-fast);
        }

        .tree-node:hover {
          background: var(--gum-gray-100);
        }

        .tree-node.selected {
          background: var(--gum-yellow);
          font-weight: var(--font-weight-bold);
        }

        .tree-node-favicon {
          width: 20px;
          height: 20px;
          border-radius: 3px;
        }

        .tree-node-title {
          flex: 1;
          font-size: var(--font-size-sm);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .tree-node-badge {
          font-size: var(--font-size-xs);
          background: var(--gum-gray-200);
          padding: 2px 6px;
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
}

/**
 * Usage Notes:
 *
 * 1. Right-click any tree node to open context menu
 * 2. Context menu includes all major actions with shortcuts
 * 3. DetailPanel automatically shows tabs when node selected
 * 4. Properties tab shows all metadata in organized sections
 * 5. Related tab discovers similar items automatically
 * 6. Backlinks tab shows placeholder (coming soon)
 *
 * Keyboard Shortcuts:
 * - Cmd+O: Open link
 * - Cmd+E: Edit node
 * - Cmd+Delete: Delete node
 * - Escape: Close context menu
 *
 * Features Demonstrated:
 * - Context menu integration
 * - All action handlers
 * - Clipboard operations
 * - Node selection
 * - Detail panel tabs
 * - Related items discovery
 * - Delete confirmation
 * - Danger states
 * - Submenu indicators
 * - Disabled states
 */
