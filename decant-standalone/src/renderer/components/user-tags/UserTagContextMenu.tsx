import { useEffect, useRef } from 'react';
import {
  IconPencil,
  IconPalette,
  IconMoodSmile,
  IconCopy,
  IconTrash,
} from '@tabler/icons-react';

// ============================================
// PROPS
// ============================================

interface UserTagContextMenuProps {
  x: number;
  y: number;
  tagName: string;
  onEditTag: () => void;
  onChangeColor: () => void;
  onChangeEmblem: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

// ============================================
// COMPONENT
// ============================================

export function UserTagContextMenu({
  x,
  y,
  tagName,
  onEditTag,
  onChangeColor,
  onChangeEmblem,
  onDuplicate,
  onDelete,
  onClose,
}: UserTagContextMenuProps) {
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

  const adjustedY = Math.min(y, window.innerHeight - 240);
  const adjustedX = Math.min(x, window.innerWidth - 180);

  return (
    <div
      ref={menuRef}
      className="utag-context-menu"
      style={{ top: adjustedY, left: adjustedX }}
      role="menu"
    >
      <div className="utag-context-header">{tagName}</div>

      <button className="utag-context-item" onClick={onEditTag} role="menuitem">
        <IconPencil size={14} />
        <span>Edit Tag</span>
      </button>

      <button className="utag-context-item" onClick={onChangeColor} role="menuitem">
        <IconPalette size={14} />
        <span>Change Color</span>
      </button>

      <button className="utag-context-item" onClick={onChangeEmblem} role="menuitem">
        <IconMoodSmile size={14} />
        <span>Change Emblem</span>
      </button>

      <button className="utag-context-item" onClick={onDuplicate} role="menuitem">
        <IconCopy size={14} />
        <span>Duplicate</span>
      </button>

      <div className="utag-context-separator" />

      <button
        className="utag-context-item utag-context-item--danger"
        onClick={onDelete}
        role="menuitem"
      >
        <IconTrash size={14} />
        <span>Delete Tag</span>
      </button>
    </div>
  );
}
