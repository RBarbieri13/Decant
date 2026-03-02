// ============================================================
// useCollections Hook
// Manages collection panel state, tree data, and CRUD actions
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { collectionsAPI, CollectionTreeNode } from '../services/api';

// ============================================================
// Icon Presets
// ============================================================

export interface CollectionIconPreset {
  icon: string;
  color: string;
  label: string;
}

export const COLLECTION_ICON_PRESETS: CollectionIconPreset[] = [
  { icon: '❤️', color: '#E74C3C', label: 'Favorites' },
  { icon: '💻', color: '#3498DB', label: 'Code' },
  { icon: '🌿', color: '#27AE60', label: 'Green' },
  { icon: '💼', color: '#E67E22', label: 'Work' },
  { icon: '📚', color: '#9B59B6', label: 'Learning' },
  { icon: '⭐', color: '#F1C40F', label: 'Starred' },
  { icon: '🔬', color: '#1ABC9C', label: 'Research' },
  { icon: '🎨', color: '#E91E63', label: 'Design' },
  { icon: '🚀', color: '#673AB7', label: 'Projects' },
  { icon: '📌', color: '#FF5722', label: 'Pinned' },
  { icon: '🔖', color: '#795548', label: 'Bookmarks' },
  { icon: '🧠', color: '#607D8B', label: 'Ideas' },
  { icon: '🎯', color: '#F44336', label: 'Goals' },
  { icon: '🔧', color: '#78909C', label: 'Tools' },
  { icon: '📁', color: '#8B9A7D', label: 'Folder' },
];

// ============================================================
// Hook Interface
// ============================================================

export interface UseCollectionsReturn {
  // Data
  collections: CollectionTreeNode[];
  isLoading: boolean;
  error: string | null;
  totalCount: number;

  // Panel state
  isPanelExpanded: boolean;
  togglePanel: () => void;

  // Tree state
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;

  // CRUD
  createCollection: (name: string, parentId?: string | null, icon?: string, color?: string) => Promise<void>;
  renameCollection: (id: string, name: string) => Promise<void>;
  updateCollectionIcon: (id: string, icon: string, color: string) => Promise<void>;
  deleteCollection: (id: string) => Promise<boolean>;
  duplicateCollection: (id: string) => Promise<void>;

  // Node management
  addNodeToCollection: (collectionId: string, nodeId: string) => Promise<void>;
  removeNodeFromCollection: (collectionId: string, nodeId: string) => Promise<void>;

  // Refresh
  refresh: () => Promise<void>;
}

// ============================================================
// Hook Implementation
// ============================================================

export function useCollections(): UseCollectionsReturn {
  const [collections, setCollections] = useState<CollectionTreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ----------------------------------------
  // Load collections
  // ----------------------------------------
  const refresh = useCallback(async () => {
    try {
      setError(null);
      const tree = await collectionsAPI.getTree();
      setCollections(tree);
    } catch (err) {
      console.error('Failed to load collections:', err);
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ----------------------------------------
  // Computed
  // ----------------------------------------
  const totalCount = useMemo(
    () => collections.length,
    [collections]
  );

  // ----------------------------------------
  // Panel toggle
  // ----------------------------------------
  const togglePanel = useCallback(() => {
    setIsPanelExpanded(prev => !prev);
  }, []);

  // ----------------------------------------
  // Tree expand/collapse
  // ----------------------------------------
  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // ----------------------------------------
  // CRUD
  // ----------------------------------------
  const createCollection = useCallback(async (
    name: string,
    parentId: string | null = null,
    icon?: string,
    color?: string,
  ) => {
    try {
      await collectionsAPI.create({ name, icon, color, parentId });
      await refresh();
    } catch (err) {
      console.error('Failed to create collection:', err);
    }
  }, [refresh]);

  const renameCollection = useCallback(async (id: string, name: string) => {
    try {
      await collectionsAPI.update(id, { name });
      setRenamingId(null);
      await refresh();
    } catch (err) {
      console.error('Failed to rename collection:', err);
    }
  }, [refresh]);

  const updateCollectionIcon = useCallback(async (id: string, icon: string, color: string) => {
    try {
      await collectionsAPI.update(id, { icon, color });
      await refresh();
    } catch (err) {
      console.error('Failed to update icon:', err);
    }
  }, [refresh]);

  const deleteCollection = useCallback(async (id: string): Promise<boolean> => {
    try {
      await collectionsAPI.delete(id);
      if (selectedId === id) setSelectedId(null);
      await refresh();
      return true;
    } catch (err) {
      console.error('Failed to delete collection:', err);
      return false;
    }
  }, [refresh, selectedId]);

  const duplicateCollection = useCallback(async (id: string) => {
    // Find the collection in the tree
    const findInTree = (nodes: CollectionTreeNode[]): CollectionTreeNode | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        const found = findInTree(node.children);
        if (found) return found;
      }
      return null;
    };

    const original = findInTree(collections);
    if (original) {
      await createCollection(
        `${original.name} (copy)`,
        original.parentId,
        original.icon,
        original.color,
      );
    }
  }, [collections, createCollection]);

  // ----------------------------------------
  // Node management
  // ----------------------------------------
  const addNodeToCollection = useCallback(async (collectionId: string, nodeId: string) => {
    try {
      await collectionsAPI.addNode(collectionId, nodeId);
      await refresh();
    } catch (err) {
      console.error('Failed to add node to collection:', err);
    }
  }, [refresh]);

  const removeNodeFromCollection = useCallback(async (collectionId: string, nodeId: string) => {
    try {
      await collectionsAPI.removeNode(collectionId, nodeId);
      await refresh();
    } catch (err) {
      console.error('Failed to remove node from collection:', err);
    }
  }, [refresh]);

  // ----------------------------------------
  // Return
  // ----------------------------------------
  return {
    collections,
    isLoading,
    error,
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
    addNodeToCollection,
    removeNodeFromCollection,
    refresh,
  };
}
