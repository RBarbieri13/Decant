/**
 * useSpaces - Hook for managing Spaces (collections)
 *
 * Provides CRUD operations for spaces with automatic sync to Trilium Notes.
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import type { Space, SpaceCreateRequest, SpaceUpdateRequest } from '../types';
import { spaceManager } from '../services/spaceManager';

interface UseSpacesResult {
    spaces: Space[];
    loading: boolean;
    error: Error | null;
    createSpace: (data: SpaceCreateRequest) => Promise<Space>;
    updateSpace: (spaceId: string, data: SpaceUpdateRequest) => Promise<void>;
    deleteSpace: (spaceId: string) => Promise<void>;
    reorderSpaces: (spaceIds: string[]) => Promise<void>;
    refresh: () => Promise<void>;
}

export function useSpaces(): UseSpacesResult {
    const [spaces, setSpaces] = useState<Space[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Load spaces
    const loadSpaces = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const loadedSpaces = await spaceManager.getSpaces();
            setSpaces(loadedSpaces);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load spaces'));
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        loadSpaces();
    }, [loadSpaces]);

    // Create space
    const createSpace = useCallback(async (data: SpaceCreateRequest): Promise<Space> => {
        try {
            const newSpace = await spaceManager.createSpace(data);
            setSpaces(prev => [...prev, newSpace]);
            return newSpace;
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to create space'));
            throw err;
        }
    }, []);

    // Update space
    const updateSpace = useCallback(async (spaceId: string, data: SpaceUpdateRequest): Promise<void> => {
        try {
            await spaceManager.updateSpace(spaceId, data);
            setSpaces(prev =>
                prev.map(s =>
                    s.id === spaceId
                        ? { ...s, ...data, updatedAt: new Date().toISOString() }
                        : s
                )
            );
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to update space'));
            throw err;
        }
    }, []);

    // Delete space
    const deleteSpace = useCallback(async (spaceId: string): Promise<void> => {
        try {
            await spaceManager.deleteSpace(spaceId);
            setSpaces(prev => prev.filter(s => s.id !== spaceId));
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to delete space'));
            throw err;
        }
    }, []);

    // Reorder spaces
    const reorderSpaces = useCallback(async (spaceIds: string[]): Promise<void> => {
        try {
            await spaceManager.reorderSpaces(spaceIds);
            setSpaces(prev => {
                const spaceMap = new Map(prev.map(s => [s.id, s]));
                return spaceIds
                    .map((id, index) => {
                        const space = spaceMap.get(id);
                        if (space) {
                            return { ...space, position: index };
                        }
                        return null;
                    })
                    .filter((s): s is Space => s !== null);
            });
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to reorder spaces'));
            throw err;
        }
    }, []);

    return {
        spaces,
        loading,
        error,
        createSpace,
        updateSpace,
        deleteSpace,
        reorderSpaces,
        refresh: loadSpaces,
    };
}

export default useSpaces;
