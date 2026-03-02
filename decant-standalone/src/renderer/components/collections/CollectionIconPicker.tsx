// ============================================================
// CollectionIconPicker
// Popup grid of preset emoji icons for collection customization
// ============================================================

import { useEffect, useRef } from 'react';
import { COLLECTION_ICON_PRESETS } from '../../hooks/useCollections';

interface CollectionIconPickerProps {
  currentIcon: string;
  currentColor: string;
  onSelect: (icon: string, color: string) => void;
  onClose: () => void;
  anchorRect: DOMRect | null;
}

export function CollectionIconPicker({
  currentIcon,
  currentColor,
  onSelect,
  onClose,
  anchorRect,
}: CollectionIconPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
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

  const top = anchorRect ? anchorRect.bottom + 4 : 0;
  const left = anchorRect ? anchorRect.left : 0;

  return (
    <div
      ref={pickerRef}
      className="collection-icon-picker"
      style={{ top, left }}
    >
      <div className="collection-icon-picker__header">Choose Icon</div>
      <div className="collection-icon-picker__grid">
        {COLLECTION_ICON_PRESETS.map((preset, index) => {
          const isActive = preset.icon === currentIcon && preset.color === currentColor;

          return (
            <button
              key={index}
              className={`collection-icon-picker__item ${isActive ? 'collection-icon-picker__item--active' : ''}`}
              onClick={() => onSelect(preset.icon, preset.color)}
              title={preset.label}
              style={{
                backgroundColor: preset.color + '20',
                borderColor: isActive ? preset.color : 'transparent',
              }}
            >
              <span style={{ fontSize: '18px' }}>{preset.icon}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
