// ============================================================
// CollectionsPanel
// Slide-up panel at the bottom of the sidebar for managing
// user-created folder collections
// ============================================================

import { useState, useCallback } from 'react';
import {
  IconChevronUp,
  IconChevronDown,
  IconPlus,
  IconFolder,
} from '@tabler/icons-react';
import { useCollections } from '../../hooks/useCollections';
import { CollectionTree } from './CollectionTree';
import { CollectionContextMenu } from './CollectionContextMenu';
import { CollectionIconPicker } from './CollectionIconPicker';
import { NewCollectionInput } from './NewCollectionInput';
import './CollectionsPanel.css';

// ============================================================
// Component
// ============================================================

export function CollectionsPanel() {
  const {
    collections,
    totalCount,
    isPanelExpanded,
    togglePanel,
    expandedIds,
    toggleExpanded,
    renamingId,
    setRenamingId,
    selectedId,
    setSelectedId,
    createCollection,
    renameCollection,
    updateCollectionIcon,
    deleteCollection,
    duplicateCollection,
  } = useCollections();

  // ----------------------------------------
  // Local state
  // ----------------------------------------
  const [isCreating, setIsCreating] = useState(false);
  const [creatingParentId, setCreatingParentId] = useState<string | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    collectionId: string;
  } | null>(null);

  // Icon picker state
  const [iconPicker, setIconPicker] = useState<{
    collectionId: string;
    anchorRect: DOMRect | null;
  } | null>(null);

  // ----------------------------------------
  // Handlers
  // ----------------------------------------

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, [setSelectedId]);

  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, collectionId: id });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleRename = useCallback(async (id: string, name: string) => {
    await renameCollection(id, name);
  }, [renameCollection]);

  const handleCancelRename = useCallback(() => {
    setRenamingId(null);
  }, [setRenamingId]);

  const handleStartCreate = useCallback((parentId: string | null = null) => {
    setIsCreating(true);
    setCreatingParentId(parentId);
    if (parentId) {
      toggleExpanded(parentId);
    }
  }, [toggleExpanded]);

  const handleCreateSubmit = useCallback(async (
    name: string,
    parentId: string | null,
    icon: string,
    color: string,
  ) => {
    await createCollection(name, parentId, icon, color);
    setIsCreating(false);
    setCreatingParentId(null);
  }, [createCollection]);

  const handleCreateCancel = useCallback(() => {
    setIsCreating(false);
    setCreatingParentId(null);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    // Find collection info for confirmation
    const findInTree = (nodes: typeof collections): typeof collections[0] | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        const found = findInTree(node.children);
        if (found) return found;
      }
      return null;
    };

    const collection = findInTree(collections);
    const hasChildren = collection ? collection.children.length > 0 : false;

    const message = hasChildren
      ? `Delete "${collection?.name}" and all its subfolders?`
      : `Delete "${collection?.name}"?`;

    if (window.confirm(message)) {
      await deleteCollection(id);
    }
    setContextMenu(null);
  }, [collections, deleteCollection]);

  const handleChangeIcon = useCallback((id: string) => {
    const el = document.querySelector(`[data-collection-id="${id}"] .collection-item__icon`);
    const rect = el?.getBoundingClientRect() || null;
    setIconPicker({ collectionId: id, anchorRect: rect });
    setContextMenu(null);
  }, []);

  const handleIconSelect = useCallback(async (icon: string, color: string) => {
    if (iconPicker) {
      await updateCollectionIcon(iconPicker.collectionId, icon, color);
      setIconPicker(null);
    }
  }, [iconPicker, updateCollectionIcon]);

  const handleDuplicate = useCallback(async (id: string) => {
    await duplicateCollection(id);
    setContextMenu(null);
  }, [duplicateCollection]);

  // ----------------------------------------
  // Context menu target info
  // ----------------------------------------
  const findInTree = (nodes: typeof collections, targetId: string): typeof collections[0] | null => {
    for (const node of nodes) {
      if (node.id === targetId) return node;
      const found = findInTree(node.children, targetId);
      if (found) return found;
    }
    return null;
  };

  const contextTarget = contextMenu
    ? findInTree(collections, contextMenu.collectionId)
    : null;

  // ----------------------------------------
  // Render
  // ----------------------------------------

  return (
    <div className={`collections-panel ${isPanelExpanded ? 'collections-panel--expanded' : ''}`}>
      {/* ====== COLLAPSED BAR / HEADER ====== */}
      <div className="collections-panel__bar" onClick={togglePanel}>
        <div className="collections-panel__bar-left">
          <span className="collections-panel__bar-accent" />
          <IconFolder size={16} className="collections-panel__bar-icon" />
          <span className="collections-panel__bar-label">
            {isPanelExpanded ? 'My Collections' : 'Collections'}
          </span>
          {totalCount > 0 && (
            <span className="collections-panel__bar-count">{totalCount}</span>
          )}
        </div>

        <div className="collections-panel__bar-right">
          {isPanelExpanded
            ? <IconChevronDown size={16} className="collections-panel__bar-chevron" />
            : <IconChevronUp size={16} className="collections-panel__bar-chevron" />
          }
          <button
            className="collections-panel__bar-add"
            onClick={(e) => {
              e.stopPropagation();
              handleStartCreate(null);
            }}
            aria-label="New collection"
          >
            <IconPlus size={14} />
          </button>
        </div>
      </div>

      {/* ====== EXPANDED CONTENT ====== */}
      {isPanelExpanded && (
        <div className="collections-panel__content">
          {isPanelExpanded && totalCount > 0 && (
            <div className="collections-panel__subtitle">
              {totalCount} folder{totalCount !== 1 ? 's' : ''}
            </div>
          )}

          <CollectionTree
            collections={collections}
            expandedIds={expandedIds}
            renamingId={renamingId}
            selectedId={selectedId}
            onToggleExpand={toggleExpanded}
            onSelect={handleSelect}
            onRename={handleRename}
            onCancelRename={handleCancelRename}
            onContextMenu={handleContextMenu}
          />

          {/* Inline create at root level */}
          {isCreating && creatingParentId === null ? (
            <NewCollectionInput
              parentId={null}
              depth={0}
              onSubmit={handleCreateSubmit}
              onCancel={handleCreateCancel}
              startEditing
            />
          ) : (
            <NewCollectionInput
              parentId={null}
              depth={0}
              onSubmit={handleCreateSubmit}
              onCancel={handleCreateCancel}
            />
          )}
        </div>
      )}

      {/* ====== CONTEXT MENU ====== */}
      {contextMenu && contextTarget && (
        <CollectionContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          collectionName={contextTarget.name}
          hasChildren={contextTarget.children.length > 0}
          onRename={() => {
            setRenamingId(contextMenu.collectionId);
            setContextMenu(null);
          }}
          onChangeIcon={() => handleChangeIcon(contextMenu.collectionId)}
          onAddSubfolder={() => {
            handleStartCreate(contextMenu.collectionId);
            setContextMenu(null);
          }}
          onDuplicate={() => handleDuplicate(contextMenu.collectionId)}
          onDelete={() => handleDelete(contextMenu.collectionId)}
          onClose={handleCloseContextMenu}
        />
      )}

      {/* ====== ICON PICKER ====== */}
      {iconPicker && (() => {
        const target = findInTree(collections, iconPicker.collectionId);
        return target ? (
          <CollectionIconPicker
            currentIcon={target.icon}
            currentColor={target.color}
            onSelect={handleIconSelect}
            onClose={() => setIconPicker(null)}
            anchorRect={iconPicker.anchorRect}
          />
        ) : null;
      })()}
    </div>
  );
}
