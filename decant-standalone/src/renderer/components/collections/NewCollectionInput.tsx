// ============================================================
// NewCollectionInput
// Dashed "+ New Collection" button that toggles to an inline input
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { IconPlus, IconCheck, IconX } from '@tabler/icons-react';
import { COLLECTION_ICON_PRESETS } from '../../hooks/useCollections';

interface NewCollectionInputProps {
  parentId?: string | null;
  depth?: number;
  onSubmit: (name: string, parentId: string | null, icon: string, color: string) => void;
  onCancel?: () => void;
  /** If true, start in input mode immediately */
  startEditing?: boolean;
}

export function NewCollectionInput({
  parentId = null,
  depth = 0,
  onSubmit,
  onCancel,
  startEditing = false,
}: NewCollectionInputProps) {
  const [isEditing, setIsEditing] = useState(startEditing);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Random preset for new collections
  const randomPreset = COLLECTION_ICON_PRESETS[
    Math.floor(Math.random() * COLLECTION_ICON_PRESETS.length)
  ];

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (trimmed.length > 0) {
      onSubmit(trimmed, parentId, randomPreset.icon, randomPreset.color);
      setName('');
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setName('');
    setIsEditing(false);
    onCancel?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (!isEditing) {
    return (
      <button
        className="collections-panel__new-button"
        onClick={() => setIsEditing(true)}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <IconPlus size={14} />
        <span>New Collection</span>
      </button>
    );
  }

  return (
    <div
      className="collection-new-input"
      style={{ paddingLeft: `${12 + depth * 16}px` }}
    >
      <span
        className="collection-item__icon"
        style={{ backgroundColor: randomPreset.color + '20', color: randomPreset.color }}
      >
        {randomPreset.icon}
      </span>
      <input
        ref={inputRef}
        className="collection-rename-field"
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Small delay to allow button click to register
          setTimeout(() => {
            if (name.trim().length === 0) handleCancel();
          }, 150);
        }}
        placeholder="Collection name..."
        maxLength={100}
      />
      <button
        className="collection-rename-confirm"
        onMouseDown={e => {
          e.preventDefault();
          handleSubmit();
        }}
        disabled={name.trim().length === 0}
        aria-label="Confirm"
      >
        <IconCheck size={14} />
      </button>
      <button
        className="collection-rename-cancel"
        onMouseDown={e => {
          e.preventDefault();
          handleCancel();
        }}
        aria-label="Cancel"
      >
        <IconX size={14} />
      </button>
    </div>
  );
}
