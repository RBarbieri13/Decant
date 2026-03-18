import { useState, useCallback } from 'react';
import {
  IconChevronUp,
  IconChevronDown,
  IconPlus,
  IconTag,
} from '@tabler/icons-react';
import type { UserTag } from '../../services/api';
import { useUserTags } from '../../hooks/useUserTags';
import { useFloatingPanel } from '../../hooks/useFloatingPanel';
import { UserTagItem } from './UserTagItem';
import { UserTagCreateForm } from './UserTagCreateForm';
import { UserTagContextMenu } from './UserTagContextMenu';
import { UserTagEditPopover } from './UserTagEditPopover';
import './UserTagsPanel.css';

// ============================================
// COMPONENT
// ============================================

export function UserTagsPanel() {
  const {
    tags,
    totalCount,
    isLoading,
    isPanelExpanded,
    togglePanel,
    createTag,
    renameTag,
    updateTag,
    deleteTag,
    duplicateTag,
    renamingId,
    setRenamingId,
  } = useUserTags();

  const { rect, isDragging, isResizing, zIndex, bringToFront, onDragStart, onResizeStart } = useFloatingPanel({
    storageKey: 'decant-utag-panel-rect',
    defaultWidth: 340,
    defaultHeight: 360,
    minWidth: 260,
    minHeight: 180,
    defaultOffsetX: 180,
    defaultOffsetY: 0,
  });

  // ----------------------------------------
  // Local state
  // ----------------------------------------
  const [isCreating, setIsCreating] = useState(false);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tag: UserTag;
  } | null>(null);

  // Edit popover
  const [editPopover, setEditPopover] = useState<{
    tag: UserTag;
    anchorRect: DOMRect | null;
  } | null>(null);

  // ----------------------------------------
  // Handlers
  // ----------------------------------------

  const handleTagClick = useCallback((_tag: UserTag) => {
    // TODO: filter main table by this tag
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, tag: UserTag) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, tag });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleRename = useCallback(async (id: string, name: string) => {
    await renameTag(id, name);
  }, [renameTag]);

  const handleCancelRename = useCallback(() => {
    setRenamingId(null);
  }, [setRenamingId]);

  const handleCreateSubmit = useCallback(async (name: string, color: string, emblem: string) => {
    await createTag(name, color, emblem);
    setIsCreating(false);
  }, [createTag]);

  const handleCreateCancel = useCallback(() => {
    setIsCreating(false);
  }, []);

  const handleDelete = useCallback(async (tag: UserTag) => {
    if (window.confirm(`Delete "${tag.name}"?`)) {
      await deleteTag(tag.id);
    }
    setContextMenu(null);
  }, [deleteTag]);

  const handleEditTag = useCallback((tag: UserTag) => {
    const el = document.querySelector(`[data-tag-id="${tag.id}"]`);
    const rect = el?.getBoundingClientRect() || null;
    setEditPopover({ tag, anchorRect: rect });
    setContextMenu(null);
  }, []);

  const handleEditSave = useCallback(async (
    id: string,
    data: { name?: string; color?: string; emblem?: string },
  ) => {
    await updateTag(id, data);
    setEditPopover(null);
  }, [updateTag]);

  const handleDuplicate = useCallback(async (tag: UserTag) => {
    await duplicateTag(tag.id);
    setContextMenu(null);
  }, [duplicateTag]);

  const handleChangeColor = useCallback((tag: UserTag) => {
    handleEditTag(tag);
  }, [handleEditTag]);

  const handleChangeEmblem = useCallback((tag: UserTag) => {
    handleEditTag(tag);
  }, [handleEditTag]);

  const existingNames = tags.map(t => t.name);

  // ----------------------------------------
  // Render
  // ----------------------------------------

  return (
    <>
      {/* ====== COLLAPSED HEADER (always in sidebar) ====== */}
      <div className="utag-panel-anchor">
        <div className="utag-panel-header" onClick={togglePanel}>
          <div className="utag-panel-header-left">
            <span className="utag-panel-accent" />
            <IconTag size={16} className="utag-panel-header-icon" />
            <span className="utag-panel-header-label">
              My Tags
            </span>
            {totalCount > 0 && (
              <span className="utag-panel-header-count">{totalCount}</span>
            )}
          </div>

          <div className="utag-panel-header-right">
            <span className="utag-panel-chevron">
              {isPanelExpanded ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />}
            </span>
          </div>
        </div>
      </div>

      {/* ====== FLOATING EXPANDED PANEL ====== */}
      {isPanelExpanded && (
        <div
          className={`utag-floating-panel ${isDragging ? 'utag-floating-panel--dragging' : ''} ${isResizing ? 'utag-floating-panel--resizing' : ''}`}
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            zIndex,
          }}
          onMouseDown={bringToFront}
        >
          {/* Drag handle / floating header */}
          <div
            className="utag-floating-header"
            onMouseDown={onDragStart}
          >
            <div className="utag-floating-header-left">
              <IconTag size={16} className="utag-panel-header-icon" />
              <span className="utag-floating-title">My Tags</span>
              {totalCount > 0 && (
                <span className="utag-panel-header-count">{totalCount}</span>
              )}
              {totalCount > 0 && (
                <span className="utag-panel-header-subtitle">
                  {totalCount} tag{totalCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="utag-floating-header-right">
              <button
                className="utag-panel-add-button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCreating(true);
                }}
                title="New tag"
                aria-label="Create new tag"
              >
                <IconPlus size={14} />
              </button>
              <button
                className="utag-floating-close"
                onClick={togglePanel}
                aria-label="Close panel"
              >
                <IconChevronDown size={16} />
              </button>
            </div>
          </div>

          {/* Panel body */}
          <div className="utag-floating-body">
            {isLoading ? (
              <div className="utag-panel-loading">
                <span className="utag-panel-spinner" />
                <span>Loading...</span>
              </div>
            ) : tags.length === 0 && !isCreating ? (
              <div className="utag-panel-empty">
                <IconTag size={32} className="utag-panel-empty-icon" />
                <p className="utag-panel-empty-title">No custom tags yet</p>
                <p className="utag-panel-empty-text">
                  Create tags to organize and label your items with custom colors and emblems.
                </p>
                <button
                  className="utag-panel-empty-cta"
                  onClick={() => setIsCreating(true)}
                >
                  <IconTag size={14} />
                  Create Your First Tag
                </button>
              </div>
            ) : (
              <>
                <div className="utag-panel-scroll">
                  {tags.map(tag => (
                    <UserTagItem
                      key={tag.id}
                      tag={tag}
                      isRenaming={renamingId === tag.id}
                      onRename={handleRename}
                      onCancelRename={handleCancelRename}
                      onContextMenu={handleContextMenu}
                      onClick={handleTagClick}
                    />
                  ))}
                </div>

                {isCreating ? (
                  <UserTagCreateForm
                    onSubmit={handleCreateSubmit}
                    onCancel={handleCreateCancel}
                    existingNames={existingNames}
                  />
                ) : (
                  <button
                    className="utag-panel-new-button"
                    onClick={() => setIsCreating(true)}
                  >
                    <IconPlus size={14} />
                    <span>New Tag</span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Resize handles */}
          <div className="utag-resize-handle utag-resize-handle--e" onMouseDown={e => onResizeStart(e, 'e')} />
          <div className="utag-resize-handle utag-resize-handle--s" onMouseDown={e => onResizeStart(e, 's')} />
          <div className="utag-resize-handle utag-resize-handle--se" onMouseDown={e => onResizeStart(e, 'se')} />
        </div>
      )}

      {/* ====== CONTEXT MENU ====== */}
      {contextMenu && (
        <UserTagContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tagName={contextMenu.tag.name}
          onEditTag={() => handleEditTag(contextMenu.tag)}
          onChangeColor={() => handleChangeColor(contextMenu.tag)}
          onChangeEmblem={() => handleChangeEmblem(contextMenu.tag)}
          onDuplicate={() => handleDuplicate(contextMenu.tag)}
          onDelete={() => handleDelete(contextMenu.tag)}
          onClose={handleCloseContextMenu}
        />
      )}

      {/* ====== EDIT POPOVER ====== */}
      {editPopover && (
        <UserTagEditPopover
          tag={editPopover.tag}
          anchorRect={editPopover.anchorRect}
          onSave={handleEditSave}
          onClose={() => setEditPopover(null)}
          existingNames={existingNames}
        />
      )}
    </>
  );
}
