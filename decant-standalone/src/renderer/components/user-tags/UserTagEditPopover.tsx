import { useState, useEffect, useRef } from 'react';
import { IconX, IconCheck } from '@tabler/icons-react';
import type { UserTag } from '../../services/api';
import { TAG_COLOR_PRESETS, TAG_EMBLEM_PRESETS } from '../../hooks/useUserTags';

// ============================================
// PROPS
// ============================================

interface UserTagEditPopoverProps {
  tag: UserTag;
  anchorRect: DOMRect | null;
  onSave: (id: string, data: { name?: string; color?: string; emblem?: string }) => void;
  onClose: () => void;
  existingNames: string[];
}

// ============================================
// COMPONENT
// ============================================

export function UserTagEditPopover({
  tag,
  anchorRect,
  onSave,
  onClose,
  existingNames,
}: UserTagEditPopoverProps) {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const [emblem, setEmblem] = useState(tag.emblem);
  const popoverRef = useRef<HTMLDivElement>(null);

  const trimmedName = name.trim();
  const isDuplicate = existingNames
    .filter(n => n.toLowerCase() !== tag.name.toLowerCase())
    .some(n => n.toLowerCase() === trimmedName.toLowerCase());
  const hasChanges = trimmedName !== tag.name || color !== tag.color || emblem !== tag.emblem;
  const canSave = trimmedName.length > 0 && !isDuplicate && hasChanges;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
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

  const handleSave = () => {
    if (!canSave) return;
    const data: { name?: string; color?: string; emblem?: string } = {};
    if (trimmedName !== tag.name) data.name = trimmedName;
    if (color !== tag.color) data.color = color;
    if (emblem !== tag.emblem) data.emblem = emblem;
    onSave(tag.id, data);
  };

  // Position the popover near the anchor
  const top = anchorRect ? Math.min(anchorRect.top - 10, window.innerHeight - 380) : 100;
  const left = anchorRect ? anchorRect.right + 8 : 260;

  return (
    <div
      ref={popoverRef}
      className="utag-edit-popover"
      style={{ top, left }}
    >
      {/* Header */}
      <div className="utag-edit-popover-header">
        <span className="utag-edit-popover-title">Edit Tag</span>
        <button className="utag-edit-popover-close" onClick={onClose} aria-label="Close">
          <IconX size={14} />
        </button>
      </div>

      <div className="utag-edit-popover-separator" />

      <div className="utag-edit-popover-body">
        {/* Name */}
        <div className="utag-create-field">
          <label className="utag-create-label">Name</label>
          <input
            className={`utag-create-input ${isDuplicate ? 'utag-create-input--error' : ''}`}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={32}
          />
          {isDuplicate && <span className="utag-create-error">Name already exists</span>}
        </div>

        {/* Color */}
        <div className="utag-create-field">
          <label className="utag-create-label">Color</label>
          <div className="utag-color-grid utag-color-grid--compact">
            {TAG_COLOR_PRESETS.map(preset => (
              <button
                key={preset.hex}
                className={`utag-color-circle ${color === preset.hex ? 'utag-color-circle--selected' : ''}`}
                style={{ backgroundColor: preset.hex }}
                onClick={() => setColor(preset.hex)}
                title={preset.name}
              >
                {color === preset.hex && (
                  <IconCheck size={11} color="white" strokeWidth={3} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Emblem */}
        <div className="utag-create-field">
          <label className="utag-create-label">Emblem</label>
          <div className="utag-emblem-grid">
            {TAG_EMBLEM_PRESETS.map(preset => (
              <button
                key={preset.value}
                className={`utag-emblem-option ${emblem === preset.value ? 'utag-emblem-option--selected' : ''}`}
                onClick={() => setEmblem(preset.value)}
                title={preset.label}
              >
                {preset.value}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="utag-create-field">
          <label className="utag-create-label">Preview</label>
          <div className="utag-create-preview">
            <span className="utag-chip" style={{ backgroundColor: color }}>
              {emblem && <span className="utag-chip-emblem">{emblem}</span>}
              <span className="utag-chip-name">{trimmedName || 'tag'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="utag-edit-popover-actions">
        <button className="utag-create-cancel" onClick={onClose}>Cancel</button>
        <button
          className="utag-create-submit"
          onClick={handleSave}
          disabled={!canSave}
        >
          Save
        </button>
      </div>
    </div>
  );
}
