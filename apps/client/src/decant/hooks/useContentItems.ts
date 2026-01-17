/**
 * useContentItems - Hook for managing content items within a space
 *
 * Provides CRUD operations and filtering for content items.
 */

import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import type { ContentItem, ContentImportRequest, ContentImportResult } from '../types';
import { contentImporter } from '../services/contentImporter';
import { isSystemSpace, SYSTEM_SPACES } from '../types/space';

interface FilterState {
    searchQuery: string;
    contentTypes: string[];
    tags: string[];
    sortBy: 'recent' | 'alphabetical' | 'type' | 'domain';
    sortOrder: 'asc' | 'desc';
}

interface UseContentItemsResult {
    items: ContentItem[];
    loading: boolean;
    error: Error | null;
    importContent: (request: ContentImportRequest) => Promise<ContentImportResult>;
    moveItem: (itemId: string, targetSpaceId: string) => Promise<void>;
    deleteItem: (itemId: string) => Promise<void>;
    updateItem: (itemId: string, data: Partial<ContentItem>) => Promise<void>;
    refresh: () => Promise<void>;
}

export function useContentItems(
    spaceId: string,
    filter: FilterState
): UseContentItemsResult {
    const [allItems, setAllItems] = useState<ContentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Load items for the current space
    const loadItems = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            let loadedItems: ContentItem[];

            if (isSystemSpace(spaceId)) {
                // Handle system spaces
                switch (spaceId) {
                    case SYSTEM_SPACES.ALL_ITEMS:
                        loadedItems = await contentImporter.getAllItems();
                        break;
                    case SYSTEM_SPACES.RECENT:
                        loadedItems = await contentImporter.getRecentItems(50);
                        break;
                    case SYSTEM_SPACES.FAVORITES:
                        loadedItems = await contentImporter.getFavoriteItems();
                        break;
                    case SYSTEM_SPACES.INBOX:
                        loadedItems = await contentImporter.getInboxItems();
                        break;
                    case SYSTEM_SPACES.ARCHIVE:
                        loadedItems = await contentImporter.getArchivedItems();
                        break;
                    default:
                        loadedItems = [];
                }
            } else {
                loadedItems = await contentImporter.getItemsBySpace(spaceId);
            }

            setAllItems(loadedItems);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load items'));
        } finally {
            setLoading(false);
        }
    }, [spaceId]);

    // Load on space change
    useEffect(() => {
        loadItems();
    }, [loadItems]);

    // Filter and sort items
    const items = useMemo(() => {
        let result = [...allItems];

        // Apply search filter
        if (filter.searchQuery) {
            const query = filter.searchQuery.toLowerCase();
            result = result.filter(item =>
                item.metadata.title.toLowerCase().includes(query) ||
                item.metadata.description?.toLowerCase().includes(query) ||
                item.metadata.domain.toLowerCase().includes(query) ||
                item.aiAnalysis?.tags.some(tag => tag.toLowerCase().includes(query))
            );
        }

        // Apply content type filter
        if (filter.contentTypes.length > 0) {
            result = result.filter(item => filter.contentTypes.includes(item.type));
        }

        // Apply tag filter
        if (filter.tags.length > 0) {
            result = result.filter(item =>
                item.aiAnalysis?.tags.some(tag => filter.tags.includes(tag))
            );
        }

        // Apply sorting
        result.sort((a, b) => {
            let comparison = 0;
            switch (filter.sortBy) {
                case 'recent':
                    comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    break;
                case 'alphabetical':
                    comparison = (a.metadata.title || '').localeCompare(b.metadata.title || '');
                    break;
                case 'type':
                    comparison = a.type.localeCompare(b.type);
                    break;
                case 'domain':
                    comparison = a.metadata.domain.localeCompare(b.metadata.domain);
                    break;
            }
            return filter.sortOrder === 'asc' ? comparison : -comparison;
        });

        return result;
    }, [allItems, filter]);

    // Import content
    const importContent = useCallback(async (request: ContentImportRequest): Promise<ContentImportResult> => {
        try {
            const result = await contentImporter.importUrl(request);
            if (result.success && result.contentItem) {
                setAllItems(prev => [result.contentItem!, ...prev]);
            }
            return result;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Import failed');
            setError(error);
            return { success: false, error: error.message };
        }
    }, []);

    // Move item to different space
    const moveItem = useCallback(async (itemId: string, targetSpaceId: string): Promise<void> => {
        try {
            await contentImporter.moveItem(itemId, targetSpaceId);
            // Remove from current view if not in target space
            if (!isSystemSpace(spaceId) && spaceId !== targetSpaceId) {
                setAllItems(prev => prev.filter(item => item.id !== itemId));
            } else {
                // Update the item's space
                setAllItems(prev =>
                    prev.map(item =>
                        item.id === itemId
                            ? { ...item, spaceId: targetSpaceId }
                            : item
                    )
                );
            }
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to move item'));
            throw err;
        }
    }, [spaceId]);

    // Delete item
    const deleteItem = useCallback(async (itemId: string): Promise<void> => {
        try {
            await contentImporter.deleteItem(itemId);
            setAllItems(prev => prev.filter(item => item.id !== itemId));
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to delete item'));
            throw err;
        }
    }, []);

    // Update item
    const updateItem = useCallback(async (itemId: string, data: Partial<ContentItem>): Promise<void> => {
        try {
            await contentImporter.updateItem(itemId, data);
            setAllItems(prev =>
                prev.map(item =>
                    item.id === itemId
                        ? { ...item, ...data, updatedAt: new Date().toISOString() }
                        : item
                )
            );
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to update item'));
            throw err;
        }
    }, []);

    return {
        items,
        loading,
        error,
        importContent,
        moveItem,
        deleteItem,
        updateItem,
        refresh: loadItems,
    };
}

export default useContentItems;
