import { useState, useEffect, useCallback, useMemo } from 'react';
import { userTagsAPI } from '../services/api';
import type { UserTag } from '../services/api';

// ============================================
// PRESET COLORS
// ============================================

export const TAG_COLOR_PRESETS = [
  { hex: '#E74C3C', name: 'Red' },
  { hex: '#E67E22', name: 'Orange' },
  { hex: '#F1C40F', name: 'Yellow' },
  { hex: '#27AE60', name: 'Green' },
  { hex: '#1ABC9C', name: 'Teal' },
  { hex: '#3498DB', name: 'Blue' },
  { hex: '#9B59B6', name: 'Purple' },
  { hex: '#E91E63', name: 'Pink' },
  { hex: '#795548', name: 'Brown' },
  { hex: '#607D8B', name: 'Slate' },
  { hex: '#34495E', name: 'Dark' },
  { hex: '#8B9A7D', name: 'Sage' },
];

// ============================================
// PRESET EMBLEMS
// ============================================

export const TAG_EMBLEM_PRESETS = [
  { value: '🔥', label: 'Fire' },
  { value: '⭐', label: 'Star' },
  { value: '✓', label: 'Check' },
  { value: '🤖', label: 'Robot' },
  { value: '📖', label: 'Book' },
  { value: '🎯', label: 'Target' },
  { value: '💡', label: 'Idea' },
  { value: '🔧', label: 'Tool' },
  { value: '🏷', label: 'Tag' },
  { value: '📌', label: 'Pin' },
  { value: '🧠', label: 'Brain' },
  { value: '🎨', label: 'Art' },
  { value: '🚀', label: 'Rocket' },
  { value: '💎', label: 'Gem' },
  { value: '⚡', label: 'Bolt' },
  { value: '🔒', label: 'Lock' },
];

// ============================================
// HOOK
// ============================================

export function useUserTags() {
  const [tags, setTags] = useState<UserTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  // ----------------------------------------
  // Load tags on mount
  // ----------------------------------------
  const loadTags = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await userTagsAPI.getAll();
      setTags(data);
    } catch (err: any) {
      console.error('Failed to load user tags:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  // ----------------------------------------
  // Computed
  // ----------------------------------------
  const totalCount = useMemo(() => tags.length, [tags]);

  // ----------------------------------------
  // Panel toggle
  // ----------------------------------------
  const togglePanel = useCallback(() => {
    setIsPanelExpanded(prev => !prev);
  }, []);

  // ----------------------------------------
  // CRUD
  // ----------------------------------------

  const createTag = useCallback(async (
    name: string,
    color: string,
    emblem: string,
  ): Promise<UserTag | null> => {
    setError(null);
    try {
      const tag = await userTagsAPI.create({ name, color, emblem });
      setTags(prev => [...prev, tag]);
      return tag;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  const renameTag = useCallback(async (id: string, name: string): Promise<boolean> => {
    setError(null);
    try {
      const updated = await userTagsAPI.update(id, { name });
      setTags(prev => prev.map(t => (t.id === id ? updated : t)));
      setRenamingId(null);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, []);

  const updateTag = useCallback(async (
    id: string,
    data: { name?: string; color?: string; emblem?: string },
  ): Promise<boolean> => {
    setError(null);
    try {
      const updated = await userTagsAPI.update(id, data);
      setTags(prev => prev.map(t => (t.id === id ? updated : t)));
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, []);

  const deleteTag = useCallback(async (id: string): Promise<boolean> => {
    setError(null);
    try {
      await userTagsAPI.delete(id);
      setTags(prev => prev.filter(t => t.id !== id));
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, []);

  const duplicateTag = useCallback(async (id: string): Promise<UserTag | null> => {
    const original = tags.find(t => t.id === id);
    if (!original) return null;

    let copyName = `${original.name} (copy)`;
    let counter = 1;
    while (tags.some(t => t.name.toLowerCase() === copyName.toLowerCase())) {
      counter++;
      copyName = `${original.name} (copy ${counter})`;
    }

    return createTag(copyName, original.color, original.emblem);
  }, [tags, createTag]);

  // ----------------------------------------
  // Return
  // ----------------------------------------

  return {
    tags,
    totalCount,
    isLoading,
    error,
    isPanelExpanded,
    togglePanel,
    setPanelExpanded: setIsPanelExpanded,
    createTag,
    renameTag,
    updateTag,
    deleteTag,
    duplicateTag,
    renamingId,
    setRenamingId,
    refresh: loadTags,
  };
}
