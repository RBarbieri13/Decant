import { useState, useRef, useEffect } from 'react';
import { IconCheck, IconX } from '@tabler/icons-react';
import { TAG_COLOR_PRESETS, TAG_EMBLEM_PRESETS } from '../../hooks/useUserTags';

// ============================================
// PROPS
// ============================================

interface UserTagCreateFormProps {
  onSubmit: (name: string, color: string, emblem: string) => void;
  onCancel: () => void;
  existingNames: string[];
}

// ============================================
// COMPONENT
// ============================================

export function UserTagCreateForm({ onSubmit, onCancel, existingNames }: UserTagCreateFormProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [emblem, setEmblem] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmedName = name.trim();
  const isDuplicate = existingNames.some(n => n.toLowerCase() === trimmedName.toLowerCase());
  const canSubmit = trimmedName.length > 0 && color.length > 0 && !isDuplicate;

  const handleNameChange = (value: string) => {
    setName(value);
    if (existingNames.some(n => n.toLowerCase() === value.trim().toLowerCase())) {
      setNameError('Tag name already exists');
    } else {
      setNameError(null);
    }
  };

  const handleSubmit = () => {
    if (canSubmit) {
      onSubmit(trimmedName, color, emblem || '🏷');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canSubmit) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="utag-create-form">
      <div className="utag-create-header">Create New Tag</div>

      {/* Name Input */}
      <div className="utag-create-field">
        <label className="utag-create-label">Name</label>
        <div className="utag-create-input-wrapper">
          <input
            ref={inputRef}
            className={`utag-create-input ${nameError ? 'utag-create-input--error' : ''}`}
            type="text"
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tag name..."
            maxLength={32}
          />
          {nameError && <span className="utag-create-error">{nameError}</span>}
        </div>
      </div>

      {/* Color Picker */}
      <div className="utag-create-field">
        <label className="utag-create-label">Color</label>
        <div className="utag-color-grid">
          {TAG_COLOR_PRESETS.map(preset => (
            <button
              key={preset.hex}
              className={`utag-color-circle ${color === preset.hex ? 'utag-color-circle--selected' : ''}`}
              style={{ backgroundColor: preset.hex }}
              onClick={() => setColor(preset.hex)}
              title={preset.name}
              aria-label={preset.name}
            >
              {color === preset.hex && (
                <IconCheck size={12} color="white" strokeWidth={3} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Emblem Picker */}
      <div className="utag-create-field">
        <label className="utag-create-label">Emblem</label>
        <div className="utag-emblem-grid">
          {TAG_EMBLEM_PRESETS.map(preset => (
            <button
              key={preset.value}
              className={`utag-emblem-option ${emblem === preset.value ? 'utag-emblem-option--selected' : ''}`}
              onClick={() => setEmblem(preset.value)}
              title={preset.label}
              aria-label={preset.label}
            >
              {preset.value}
            </button>
          ))}
        </div>
      </div>

      {/* Live Preview */}
      <div className="utag-create-field">
        <label className="utag-create-label">Preview</label>
        <div className="utag-create-preview">
          {color ? (
            <span
              className="utag-chip"
              style={{ backgroundColor: color }}
            >
              {emblem && <span className="utag-chip-emblem">{emblem}</span>}
              <span className="utag-chip-name">{trimmedName || 'tag name'}</span>
            </span>
          ) : (
            <span className="utag-chip utag-chip--placeholder">
              <span className="utag-chip-name">{trimmedName || 'tag name'}</span>
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="utag-create-actions">
        <button className="utag-create-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="utag-create-submit"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          Create Tag
        </button>
      </div>
    </div>
  );
}
