import { useState, useRef } from 'react';
import { IconDots, IconCheck, IconX } from '@tabler/icons-react';
import type { UserTag } from '../../services/api';

// ============================================
// PROPS
// ============================================

interface UserTagItemProps {
  tag: UserTag;
  isRenaming: boolean;
  onRename: (id: string, name: string) => void;
  onCancelRename: () => void;
  onContextMenu: (e: React.MouseEvent, tag: UserTag) => void;
  onClick: (tag: UserTag) => void;
}

// ============================================
// COMPONENT
// ============================================

export function UserTagItem({
  tag,
  isRenaming,
  onRename,
  onCancelRename,
  onContextMenu,
  onClick,
}: UserTagItemProps) {
  const [renameValue, setRenameValue] = useState(tag.name);
  const renameRef = useRef<HTMLInputElement>(null);

  // Focus rename input when entering rename mode
  if (isRenaming && renameRef.current && document.activeElement !== renameRef.current) {
    setRenameValue(tag.name);
    setTimeout(() => {
      renameRef.current?.focus();
      renameRef.current?.select();
    }, 10);
  }

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed.length > 0 && trimmed !== tag.name) {
      onRename(tag.id, trimmed);
    } else {
      onCancelRename();
    }
  };

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
    <div
      className="utag-item"
      data-tag-id={tag.id}
      onClick={() => onClick(tag)}
      onContextMenu={(e) => onContextMenu(e, tag)}
    >
      {/* Tag Chip Preview */}
      <span
        className="utag-chip"
        style={{ backgroundColor: tag.color }}
      >
        {tag.emblem && <span className="utag-chip-emblem">{tag.emblem}</span>}
        <span className="utag-chip-name">{tag.name}</span>
      </span>

      {/* Name or Rename Input */}
      {isRenaming ? (
        <div className="utag-item-rename">
          <input
            ref={renameRef}
            className="utag-rename-input"
            type="text"
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameSubmit}
            maxLength={32}
            onClick={e => e.stopPropagation()}
          />
          <button
            className="utag-rename-confirm"
            onMouseDown={e => {
              e.preventDefault();
              handleRenameSubmit();
            }}
            aria-label="Confirm"
          >
            <IconCheck size={12} />
          </button>
          <button
            className="utag-rename-cancel"
            onMouseDown={e => {
              e.preventDefault();
              onCancelRename();
            }}
            aria-label="Cancel"
          >
            <IconX size={12} />
          </button>
        </div>
      ) : (
        <span className="utag-item-name">{tag.name}</span>
      )}

      {/* Three-dots Menu Trigger */}
      {!isRenaming && (
        <button
          className="utag-item-menu"
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e, tag);
          }}
          aria-label="Tag options"
        >
          <IconDots size={14} />
        </button>
      )}
    </div>
  );
}
