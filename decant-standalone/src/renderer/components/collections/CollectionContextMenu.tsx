// ============================================================
// CollectionContextMenu
// Right-click / three-dot context menu for a collection
// ============================================================

import { useEffect, useRef } from 'react';
import {
  IconPencil,
  IconMoodSmile,
  IconFolderPlus,
  IconCopy,
  IconTrash,
} from '@tabler/icons-react';

interface CollectionContextMenuProps {
  x: number;
  y: number;
  collectionName: string;
  hasChildren: boolean;
  onRename: () => void;
  onChangeIcon: () => void;
  onAddSubfolder: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function CollectionContextMenu({
  x,
  y,
  collectionName,
  hasChildren,
  onRename,
  onChangeIcon,
  onAddSubfolder,
  onDuplicate,
  onDelete,
  onClose,
}: CollectionContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Keep menu within viewport
  const adjustedY = Math.min(y, window.innerHeight - 240);
  const adjustedX = Math.min(x, window.innerWidth - 180);

  return (
    <div
      ref={menuRef}
      className="collection-context-menu"
      style={{ top: adjustedY, left: adjustedX }}
      role="menu"
    >
      <div className="collection-context-header">{collectionName}</div>

      <button className="collection-context-item" onClick={onRename} role="menuitem">
        <IconPencil size={14} />
        <span>Rename</span>
      </button>

      <button className="collection-context-item" onClick={onChangeIcon} role="menuitem">
        <IconMoodSmile size={14} />
        <span>Change Icon</span>
      </button>

      <button className="collection-context-item" onClick={onAddSubfolder} role="menuitem">
        <IconFolderPlus size={14} />
        <span>Add Subfolder</span>
      </button>

      <button className="collection-context-item" onClick={onDuplicate} role="menuitem">
        <IconCopy size={14} />
        <span>Duplicate</span>
      </button>

      <div className="collection-context-separator" />

      <button
        className="collection-context-item collection-context-item--danger"
        onClick={onDelete}
        role="menuitem"
      >
        <IconTrash size={14} />
        <span>Delete{hasChildren ? ' (and subfolders)' : ''}</span>
      </button>
    </div>
  );
}
