// ============================================================
// Context Menu - Right-click menu for tree items
// ============================================================

import React, { useEffect, useRef } from 'react';
import type { TreeNode } from '../../../shared/types';

export type ContextMenuOption =
  | {
      label: string;
      icon?: string;
      shortcut?: string;
      action: () => void;
      disabled?: boolean;
      danger?: boolean;
      hasSubmenu?: boolean;
      divider?: false;
    }
  | {
      divider: true;
    };

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  node: TreeNode | null;
  options: ContextMenuOption[];
  onClose: () => void;
}

export function ContextMenu({
  isOpen,
  position,
  node,
  options,
  onClose,
}: ContextMenuProps): React.ReactElement {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !node) return <></>;

  const handleOptionClick = (option: ContextMenuOption) => {
    if ('divider' in option) return;
    if (!option.disabled) {
      option.action();
      onClose();
    }
  };

  return (
    <>
      {/* Context Menu Overlay (invisible click target) */}
      <div className="context-menu-overlay" onClick={onClose} />

      {/* Context Menu */}
      <div
        ref={menuRef}
        className="context-menu"
        style={{
          position: 'fixed',
          top: `${position.y}px`,
          left: `${position.x}px`,
        }}
      >
        {options.map((option, idx) => (
          <div key={idx}>
            {'divider' in option && option.divider ? (
              <div className="context-menu-divider" />
            ) : 'divider' in option ? null : (
              <button
                className={`context-menu-item ${option.disabled ? 'disabled' : ''} ${option.danger ? 'danger' : ''}`}
                onClick={() => handleOptionClick(option)}
                disabled={option.disabled}
              >
                <span className="context-menu-item-label">
                  {option.icon && <span className="context-menu-icon">{option.icon}</span>}
                  {option.label}
                </span>
                <span className="context-menu-item-right">
                  {option.shortcut && (
                    <span className="context-menu-shortcut">{option.shortcut}</span>
                  )}
                  {option.hasSubmenu && (
                    <span className="context-menu-submenu-indicator">▸</span>
                  )}
                </span>
              </button>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .context-menu-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 998;
          cursor: default;
        }

        .context-menu {
          position: fixed;
          background: var(--gum-white);
          border: 2px solid var(--gum-black);
          border-radius: var(--border-radius);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 999;
          min-width: 180px;
          max-width: 300px;
          overflow: hidden;
          animation: contextMenuAppear 0.1s ease-out;
        }

        @keyframes contextMenuAppear {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .context-menu-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: var(--space-xs) var(--space-sm);
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: var(--font-size-sm);
          text-align: left;
          transition: background var(--transition-fast);
          color: var(--gum-black);
        }

        .context-menu-item:hover:not(.disabled) {
          background: var(--gum-gray-100);
        }

        .context-menu-item:active:not(.disabled) {
          background: var(--gum-yellow);
        }

        .context-menu-item.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .context-menu-item.danger {
          color: #ff4444;
        }

        .context-menu-item.danger:hover:not(.disabled) {
          background: #fff0f0;
        }

        .context-menu-item.danger:active:not(.disabled) {
          background: #ffe0e0;
        }

        .context-menu-item-label {
          display: flex;
          align-items: center;
          gap: var(--space-xs);
          flex: 1;
          min-width: 0;
        }

        .context-menu-item-right {
          display: flex;
          align-items: center;
          gap: var(--space-xs);
          flex-shrink: 0;
        }

        .context-menu-icon {
          font-size: 14px;
          flex-shrink: 0;
        }

        .context-menu-shortcut {
          font-size: var(--font-size-xs);
          color: var(--gum-gray-500);
          flex-shrink: 0;
        }

        .context-menu-submenu-indicator {
          font-size: 10px;
          color: var(--gum-gray-400);
          flex-shrink: 0;
        }

        .context-menu-divider {
          height: 1px;
          background: var(--gum-gray-200);
          margin: 2px 0;
        }
      `}</style>
    </>
  );
}
