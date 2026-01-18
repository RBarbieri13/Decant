/**
 * useDecantNotes Hook
 *
 * Fetches and manages Decant Spaces, Collections, and Items from Trilium.
 */

import { useState, useEffect, useCallback } from "preact/hooks";
import searchService from "../../../services/search.js";
import { useTriliumEvent } from "../../react/hooks.js";
import type {
    DecantSpace,
    DecantCollection,
    DecantItem,
    ContentType,
    SpaceColor
} from "../types/workspace.types.js";

/**
 * Space colors to cycle through
 */
const SPACE_COLORS: SpaceColor[] = ['pink', 'yellow', 'blue', 'green'];

/**
 * Detect content type from URL
 */
function detectContentType(url?: string, mimeType?: string): ContentType {
    if (!url) {
        if (mimeType?.startsWith('image/')) return 'image';
        if (mimeType?.includes('pdf')) return 'paper';
        return 'text';
    }

    const urlLower = url.toLowerCase();

    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
        return 'youtube';
    }
    if (urlLower.includes('github.com')) {
        return 'github';
    }
    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
        return 'tweet';
    }
    if (urlLower.includes('arxiv.org') || urlLower.includes('doi.org') || urlLower.endsWith('.pdf')) {
        return 'paper';
    }
    if (urlLower.includes('podcast') || urlLower.includes('spotify.com/episode') || urlLower.includes('anchor.fm')) {
        return 'podcast';
    }
    if (urlLower.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
        return 'image';
    }

    return 'article';
}

/**
 * Parse space color from label or assign based on index
 */
function getSpaceColor(colorLabel?: string, index: number = 0): SpaceColor {
    if (colorLabel && SPACE_COLORS.includes(colorLabel as SpaceColor)) {
        return colorLabel as SpaceColor;
    }
    return SPACE_COLORS[index % SPACE_COLORS.length];
}

/**
 * Build a DecantItem from a Trilium note
 */
async function buildItem(note: any): Promise<DecantItem> {
    const sourceUrl = note.getLabelValue('sourceUrl') || undefined;
    const contentTypeLabel = note.getLabelValue('contentType');
    const contentType = contentTypeLabel as ContentType || detectContentType(sourceUrl, note.mime);

    // Get tags from labels
    const tags: string[] = [];
    const labels = note.getLabels();
    for (const label of labels) {
        if (label.name === 'tag' && label.value) {
            tags.push(label.value);
        }
    }

    return {
        noteId: note.noteId,
        title: note.title,
        sourceUrl,
        contentType,
        favicon: note.getLabelValue('favicon') || undefined,
        thumbnail: note.getLabelValue('thumbnail') || undefined,
        aiSummary: note.getLabelValue('aiSummary') || undefined,
        tags,
        dateCreated: note.dateCreated,
        dateModified: note.dateModified
    };
}

/**
 * Build a DecantCollection from a Trilium note
 */
async function buildCollection(note: any): Promise<DecantCollection> {
    const childNotes = await note.getChildNotes();
    const items: DecantItem[] = [];

    for (const child of childNotes) {
        const decantType = child.getLabelValue('decantType');
        if (decantType === 'item' || !decantType) {
            // Include both explicit items and notes without decantType
            items.push(await buildItem(child));
        }
    }

    return {
        noteId: note.noteId,
        title: note.title,
        items,
        itemCount: items.length
    };
}

/**
 * Build a DecantSpace from a Trilium note
 */
async function buildSpace(note: any, index: number): Promise<DecantSpace> {
    const childNotes = await note.getChildNotes();
    const collections: DecantCollection[] = [];

    for (const child of childNotes) {
        const decantType = child.getLabelValue('decantType');
        if (decantType === 'collection') {
            collections.push(await buildCollection(child));
        }
    }

    const colorLabel = note.getLabelValue('spaceColor');

    return {
        noteId: note.noteId,
        title: note.title,
        color: getSpaceColor(colorLabel, index),
        description: note.getLabelValue('description') || undefined,
        collections,
        collectionCount: collections.length
    };
}

/**
 * Hook to fetch and manage Decant notes
 */
export function useDecantNotes() {
    const [spaces, setSpaces] = useState<DecantSpace[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /**
     * Fetch all spaces from Trilium
     */
    const fetchSpaces = useCallback(async (): Promise<DecantSpace[]> => {
        try {
            // Search for all notes with #decantType=space
            const spaceNotes = await searchService.searchForNotes('#decantType=space');

            const builtSpaces: DecantSpace[] = [];
            let index = 0;

            for (const spaceNote of spaceNotes) {
                if (!spaceNote) continue;
                builtSpaces.push(await buildSpace(spaceNote, index));
                index++;
            }

            return builtSpaces;
        } catch (err) {
            console.error('Error fetching Decant spaces:', err);
            throw err;
        }
    }, []);

    /**
     * Load spaces
     */
    const loadSpaces = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const loadedSpaces = await fetchSpaces();
            setSpaces(loadedSpaces);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load spaces';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [fetchSpaces]);

    /**
     * Initial load
     */
    useEffect(() => {
        loadSpaces();
    }, [loadSpaces]);

    /**
     * Listen for note changes and refresh
     */
    useTriliumEvent('entitiesReloaded', ({ loadResults }: any) => {
        // Check if any relevant notes were modified
        const affectedNoteIds = new Set<string>();

        // Collect affected note IDs from various result types
        if (loadResults.getNoteRows) {
            for (const row of loadResults.getNoteRows()) {
                affectedNoteIds.add(row.noteId);
            }
        }
        if (loadResults.getBranchRows) {
            for (const row of loadResults.getBranchRows()) {
                affectedNoteIds.add(row.noteId);
                affectedNoteIds.add(row.parentNoteId);
            }
        }
        if (loadResults.getAttributeRows) {
            for (const row of loadResults.getAttributeRows()) {
                affectedNoteIds.add(row.noteId);
            }
        }

        // Check if any of our spaces or their children were affected
        let needsRefresh = false;
        for (const space of spaces) {
            if (affectedNoteIds.has(space.noteId)) {
                needsRefresh = true;
                break;
            }
            for (const collection of space.collections) {
                if (affectedNoteIds.has(collection.noteId)) {
                    needsRefresh = true;
                    break;
                }
                for (const item of collection.items) {
                    if (affectedNoteIds.has(item.noteId)) {
                        needsRefresh = true;
                        break;
                    }
                }
                if (needsRefresh) break;
            }
            if (needsRefresh) break;
        }

        // Also refresh if new spaces might have been created
        if (!needsRefresh && loadResults.getAttributeRows) {
            for (const row of loadResults.getAttributeRows()) {
                if (row.name === 'decantType' && row.value === 'space') {
                    needsRefresh = true;
                    break;
                }
            }
        }

        if (needsRefresh) {
            loadSpaces();
        }
    });

    return {
        spaces,
        isLoading,
        error,
        refetch: loadSpaces,
        fetchSpaces
    };
}

export default useDecantNotes;
