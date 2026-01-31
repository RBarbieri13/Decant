# Context Menu Integration Guide

This document shows how to integrate the enhanced context menu with tree nodes in the Decant application.

## Overview

The enhanced context menu provides the following actions:
- Open URL in browser
- Edit node details
- Move to another location
- Merge with another node
- Duplicate node
- Copy URL/Title/Markdown
- Delete node

## Usage Example

```typescript
import { ContextMenu, type ContextMenuOption } from '../dialogs/ContextMenu';
import { useApp } from '../../context/AppContext';

function TreeNodeComponent({ node }: { node: TreeNode }) {
  const { actions } = useApp();
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
  }>({ isOpen: false, position: { x: 0, y: 0 } });

  // Handle right-click on tree node
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
    });
  }, []);

  // Close context menu
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({ isOpen: false, position: { x: 0, y: 0 } });
  }, []);

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log(`${label} copied to clipboard`);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Copy as Markdown
  const copyAsMarkdown = () => {
    if (!node.sourceUrl) return;
    const markdown = `[${node.title}](${node.sourceUrl})`;
    copyToClipboard(markdown, 'Markdown');
  };

  // Build context menu options
  const contextMenuOptions: ContextMenuOption[] = [
    {
      label: 'Open Link',
      icon: '↗',
      shortcut: '⌘O',
      action: () => {
        if (node.sourceUrl) {
          window.open(node.sourceUrl, '_blank');
        }
      },
      disabled: !node.sourceUrl,
    },
    {
      label: 'Edit',
      icon: '✏️',
      shortcut: '⌘E',
      action: () => {
        actions.selectNode(node.id);
        // TODO: Trigger edit mode in detail panel
      },
    },
    { divider: true },
    {
      label: 'Move to...',
      icon: '📁',
      action: () => {
        // TODO: Open move dialog
        console.log('Move dialog coming soon');
      },
      hasSubmenu: true,
    },
    {
      label: 'Merge with...',
      icon: '🔀',
      action: () => {
        actions.openMergeDialog(node.id);
      },
    },
    {
      label: 'Duplicate',
      icon: '📋',
      action: async () => {
        // TODO: Implement duplicate API endpoint
        console.log('Duplicate coming soon');
      },
    },
    { divider: true },
    {
      label: 'Copy URL',
      icon: '🔗',
      action: () => {
        if (node.sourceUrl) {
          copyToClipboard(node.sourceUrl, 'URL');
        }
      },
      disabled: !node.sourceUrl,
    },
    {
      label: 'Copy Title',
      icon: '📝',
      action: () => {
        copyToClipboard(node.title, 'Title');
      },
    },
    {
      label: 'Copy as Markdown',
      icon: '📄',
      action: copyAsMarkdown,
      disabled: !node.sourceUrl,
    },
    { divider: true },
    {
      label: 'Delete',
      icon: '🗑️',
      shortcut: '⌘⌫',
      action: async () => {
        const confirmed = window.confirm(
          `Are you sure you want to delete "${node.title}"?`
        );
        if (confirmed) {
          await actions.deleteNode(node.id);
        }
      },
      danger: true,
    },
  ];

  return (
    <>
      <div
        className="tree-node"
        onContextMenu={handleContextMenu}
      >
        {node.title}
      </div>

      <ContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        node={node}
        options={contextMenuOptions}
        onClose={handleCloseContextMenu}
      />
    </>
  );
}
```

## Enhanced Features

### Danger State
Mark destructive actions with the `danger` prop:

```typescript
{
  label: 'Delete',
  action: handleDelete,
  danger: true, // Displays in red
}
```

### Submenu Indicator
Show a submenu indicator for nested options:

```typescript
{
  label: 'Move to...',
  action: handleMove,
  hasSubmenu: true, // Displays "▸" indicator
}
```

### Keyboard Shortcuts
Display keyboard shortcuts for quick access:

```typescript
{
  label: 'Open Link',
  shortcut: '⌘O',
  action: handleOpen,
}
```

## Styling

The context menu includes:
- Smooth appearance animation
- Hover states with visual feedback
- Active state on click (yellow highlight)
- Danger state for destructive actions (red text, red hover)
- Dividers for visual grouping
- Support for icons and shortcuts

## Accessibility

- Keyboard navigation (Escape to close)
- Click outside to dismiss
- Clear visual hierarchy
- Disabled state handling
