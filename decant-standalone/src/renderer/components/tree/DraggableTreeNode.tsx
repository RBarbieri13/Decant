// ============================================================
// DraggableTreeNode - Tree node with advanced drag and drop
// ============================================================

import React, { memo, useCallback, DragEvent } from 'react';
import type { TreeNode } from '../../../shared/types';
import type { DropPosition } from '../../hooks/useDragAndDrop';

interface DraggableTreeNodeProps {
  node: TreeNode;
  level: number;
  isSelected: boolean;
  isExpanded: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  dropPosition: DropPosition | null;
  searchHighlighted: boolean;

  // Handlers
  onSelect: () => void;
  onToggle: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;

  // Children
  children?: React.ReactNode;
}

/**
 * Draggable tree node with visual drop indicators
 *
 * Features:
 * - Semi-transparent when dragging
 * - Drop zone highlights (before/inside/after)
 * - Visual drop position indicator lines
 * - Draggable items only (categories are drop targets)
 * - Auto-expand on hover during drag
 */
export const DraggableTreeNode = memo(function DraggableTreeNode({
  node,
  level,
  isSelected,
  isExpanded,
  isDragging,
  isDragOver,
  dropPosition,
  searchHighlighted,
  onSelect,
  onToggle,
  onContextMenu,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: DraggableTreeNodeProps): React.ReactElement {

  const hasChildren = node.children && node.children.length > 0;
  const isDraggable = node.nodeType === 'item'; // Only items are draggable
  const canAcceptDrop = node.nodeType !== 'item'; // Categories can accept drops

  // Get content type badge color
  const getContentTypeBadgeClass = (code: string | null | undefined): string => {
    if (!code) return '';
    const colorMap: Record<string, string> = {
      T: 'gum-badge--pink',    // Tool
      A: 'gum-badge--blue',    // Article
      V: 'gum-badge--green',   // Video
      G: 'gum-badge--yellow',  // Repository
      P: '',                    // Podcast
      R: '',                    // Research
    };
    return colorMap[code] || '';
  };

  // Get node type indicator
  const getNodeTypeIndicator = (): string => {
    switch (node.nodeType) {
      case 'category':
        return '📁';
      case 'content_type':
        return '📂';
      case 'subcategory':
        return '📂';
      case 'item':
        return '';
      default:
        return '📁';
    }
  };

  return (
    <div className="tree-node-wrapper">
      <div
        className={`
          tree-node-row
          ${node.nodeType}
          ${isSelected ? 'selected' : ''}
          ${isDragging ? 'dragging' : ''}
          ${isDragOver && dropPosition === 'inside' ? 'drag-over-inside' : ''}
          ${isDragOver && dropPosition === 'before' ? 'drag-over-before' : ''}
          ${isDragOver && dropPosition === 'after' ? 'drag-over-after' : ''}
          ${searchHighlighted ? 'search-highlighted' : ''}
        `.trim()}
        style={{ paddingLeft: level * 16 + 8 }}
        draggable={isDraggable}
        onDragStart={isDraggable ? onDragStart : undefined}
        onDragEnd={isDraggable ? onDragEnd : undefined}
        onDragOver={canAcceptDrop ? onDragOver : undefined}
        onDragLeave={canAcceptDrop ? onDragLeave : undefined}
        onDrop={canAcceptDrop ? onDrop : undefined}
        onContextMenu={onContextMenu}
      >
        {/* Drop Position Indicator - Before */}
        {isDragOver && dropPosition === 'before' && (
          <div className="drop-indicator drop-indicator--before" />
        )}

        {/* Drop Position Indicator - After */}
        {isDragOver && dropPosition === 'after' && (
          <div className="drop-indicator drop-indicator--after" />
        )}

        {/* Expand/Collapse Button */}
        <button
          className={`tree-expand-btn ${hasChildren ? 'has-children' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle();
          }}
          disabled={!hasChildren}
        >
          {hasChildren ? (isExpanded ? '▼' : '▶') : ''}
        </button>

        {/* Node Content */}
        <div
          className="tree-node-content"
          onClick={onSelect}
        >
          {/* Favicon or Type Indicator */}
          {node.faviconPath ? (
            <img
              src={`file://${node.faviconPath}`}
              alt=""
              className="tree-node-favicon"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <span className="tree-node-type-icon">{getNodeTypeIndicator()}</span>
          )}

          {/* Title */}
          <span className="tree-node-title">{node.title}</span>

          {/* Content Type Badge */}
          {node.contentTypeCode && node.nodeType === 'item' && (
            <span className={`gum-badge gum-badge--small ${getContentTypeBadgeClass(node.contentTypeCode)}`}>
              {node.contentTypeCode}
            </span>
          )}

          {/* Drag Handle Indicator */}
          {isDraggable && (
            <span className="drag-handle" title="Drag to move">⋮⋮</span>
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div className="tree-node-children">
          {children}
        </div>
      )}

      <style>{`
        .tree-node-wrapper {
          position: relative;
        }

        .tree-node-row {
          position: relative;
          display: flex;
          align-items: center;
          padding: var(--space-xs) var(--space-sm);
          border-radius: var(--border-radius);
          cursor: pointer;
          transition: background var(--transition-fast), opacity var(--transition-fast);
        }

        .tree-node-row:hover {
          background: var(--gum-gray-100);
        }

        .tree-node-row.selected {
          background: var(--gum-yellow);
        }

        .tree-node-row.search-highlighted {
          background: rgba(255, 228, 0, 0.3);
        }

        .tree-node-row.search-highlighted.selected {
          background: var(--gum-yellow);
        }

        /* Dragging state */
        .tree-node-row.dragging {
          opacity: 0.4;
          cursor: grabbing;
        }

        /* Drop zone highlights */
        .tree-node-row.drag-over-inside {
          background: var(--gum-blue);
          border: 2px dashed var(--gum-black);
          box-shadow: 0 0 8px rgba(0, 102, 255, 0.3);
        }

        /* Drop position indicators */
        .drop-indicator {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--gum-pink);
          z-index: 100;
          pointer-events: none;
        }

        .drop-indicator::before {
          content: '';
          position: absolute;
          left: 0;
          top: -3px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--gum-pink);
          border: 2px solid var(--gum-black);
        }

        .drop-indicator--before {
          top: -1px;
        }

        .drop-indicator--after {
          bottom: -1px;
        }

        /* Category styling */
        .tree-node-row.category,
        .tree-node-row.content_type,
        .tree-node-row.subcategory {
          font-weight: var(--font-weight-medium);
        }

        /* Draggable cursor */
        .tree-node-row[draggable="true"] {
          cursor: grab;
        }

        .tree-node-row[draggable="true"]:active {
          cursor: grabbing;
        }

        /* Expand button */
        .tree-expand-btn {
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          cursor: default;
          font-size: 8px;
          color: var(--gum-gray-500);
          flex-shrink: 0;
          margin-right: var(--space-xs);
        }

        .tree-expand-btn.has-children {
          cursor: pointer;
        }

        .tree-expand-btn.has-children:hover {
          color: var(--gum-black);
        }

        /* Node content */
        .tree-node-content {
          display: flex;
          align-items: center;
          gap: var(--space-xs);
          flex: 1;
          min-width: 0;
        }

        .tree-node-favicon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          border-radius: 2px;
        }

        .tree-node-type-icon {
          font-size: 12px;
          flex-shrink: 0;
        }

        .tree-node-title {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Drag handle */
        .drag-handle {
          font-size: 10px;
          color: var(--gum-gray-400);
          margin-left: auto;
          padding: 0 4px;
          opacity: 0;
          transition: opacity var(--transition-fast);
        }

        .tree-node-row[draggable="true"]:hover .drag-handle {
          opacity: 1;
        }

        /* Badge */
        .gum-badge--small {
          padding: 2px 6px;
          font-size: 10px;
        }

        /* Children container */
        .tree-node-children {
          /* container for child nodes */
        }
      `}</style>
    </div>
  );
});
