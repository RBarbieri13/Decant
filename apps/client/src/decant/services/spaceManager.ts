/**
 * SpaceManager - Service for managing Spaces (collections)
 *
 * Handles CRUD operations for spaces, integrating with Trilium Notes backend.
 */

import type { Space, SpaceCreateRequest, SpaceUpdateRequest, SpaceStats } from '../types';
import { DEFAULT_SPACE_COLORS, DEFAULT_SPACE_ICONS } from '../types/space';

// Root note ID for Decant spaces (will be created on first use)
const DECANT_ROOT_NOTE_ID = 'decant_root';

/**
 * SpaceManager class for managing workspaces/collections
 */
class SpaceManager {
    private baseUrl = '/api/decant';
    private spacesCache: Space[] | null = null;

    /**
     * Get all spaces
     */
    async getSpaces(): Promise<Space[]> {
        try {
            const response = await fetch(`${this.baseUrl}/spaces`);

            if (!response.ok) {
                // If API doesn't exist yet, return demo data
                if (response.status === 404) {
                    return this.getDemoSpaces();
                }
                throw new Error(`Failed to fetch spaces: ${response.statusText}`);
            }

            const spaces = await response.json();
            this.spacesCache = spaces;
            return spaces;
        } catch (error) {
            console.warn('Using demo spaces due to API error:', error);
            return this.getDemoSpaces();
        }
    }

    /**
     * Get a single space by ID
     */
    async getSpace(spaceId: string): Promise<Space | null> {
        try {
            const response = await fetch(`${this.baseUrl}/spaces/${spaceId}`);

            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error(`Failed to fetch space: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to get space:', error);
            return null;
        }
    }

    /**
     * Create a new space
     */
    async createSpace(data: SpaceCreateRequest): Promise<Space> {
        try {
            const response = await fetch(`${this.baseUrl}/spaces`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                // If API doesn't exist yet, create mock space
                if (response.status === 404) {
                    return this.createMockSpace(data);
                }
                throw new Error(`Failed to create space: ${response.statusText}`);
            }

            const space = await response.json();
            this.spacesCache = null; // Invalidate cache
            return space;
        } catch (error) {
            console.warn('Creating mock space due to API error:', error);
            return this.createMockSpace(data);
        }
    }

    /**
     * Update an existing space
     */
    async updateSpace(spaceId: string, data: SpaceUpdateRequest): Promise<void> {
        try {
            const response = await fetch(`${this.baseUrl}/spaces/${spaceId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!response.ok && response.status !== 404) {
                throw new Error(`Failed to update space: ${response.statusText}`);
            }

            this.spacesCache = null; // Invalidate cache
        } catch (error) {
            console.error('Failed to update space:', error);
        }
    }

    /**
     * Delete a space
     */
    async deleteSpace(spaceId: string): Promise<void> {
        try {
            const response = await fetch(`${this.baseUrl}/spaces/${spaceId}`, {
                method: 'DELETE',
            });

            if (!response.ok && response.status !== 404) {
                throw new Error(`Failed to delete space: ${response.statusText}`);
            }

            this.spacesCache = null; // Invalidate cache
        } catch (error) {
            console.error('Failed to delete space:', error);
        }
    }

    /**
     * Reorder spaces by providing new order of IDs
     */
    async reorderSpaces(spaceIds: string[]): Promise<void> {
        try {
            const response = await fetch(`${this.baseUrl}/spaces/reorder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ spaceIds }),
            });

            if (!response.ok && response.status !== 404) {
                throw new Error(`Failed to reorder spaces: ${response.statusText}`);
            }

            this.spacesCache = null; // Invalidate cache
        } catch (error) {
            console.error('Failed to reorder spaces:', error);
        }
    }

    /**
     * Get statistics for a space
     */
    async getSpaceStats(spaceId: string): Promise<SpaceStats | null> {
        try {
            const response = await fetch(`${this.baseUrl}/spaces/${spaceId}/stats`);

            if (!response.ok) return null;

            return await response.json();
        } catch (error) {
            console.error('Failed to get space stats:', error);
            return null;
        }
    }

    /**
     * Archive a space
     */
    async archiveSpace(spaceId: string): Promise<void> {
        await this.updateSpace(spaceId, { isArchived: true });
    }

    /**
     * Unarchive a space
     */
    async unarchiveSpace(spaceId: string): Promise<void> {
        await this.updateSpace(spaceId, { isArchived: false });
    }

    // ============================================================
    // Demo/Mock Data Methods (used before backend is implemented)
    // ============================================================

    private getDemoSpaces(): Space[] {
        return [
            {
                id: 'demo-1',
                noteId: 'demo-note-1',
                name: 'Work Projects',
                description: 'Resources for work projects',
                theme: { icon: 'bx-briefcase', color: '#3B82F6' },
                viewMode: 'grid',
                position: 0,
                itemCount: 12,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isDefault: false,
                isArchived: false,
            },
            {
                id: 'demo-2',
                noteId: 'demo-note-2',
                name: 'Learning',
                description: 'Tutorials and educational content',
                theme: { icon: 'bx-book', color: '#8B5CF6' },
                viewMode: 'grid',
                position: 1,
                itemCount: 8,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isDefault: false,
                isArchived: false,
            },
            {
                id: 'demo-3',
                noteId: 'demo-note-3',
                name: 'Design Inspiration',
                description: 'UI/UX inspiration and references',
                theme: { icon: 'bx-palette', color: '#EC4899' },
                viewMode: 'masonry',
                position: 2,
                itemCount: 24,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isDefault: false,
                isArchived: false,
            },
            {
                id: 'demo-4',
                noteId: 'demo-note-4',
                name: 'Research Papers',
                description: 'Academic papers and research',
                theme: { icon: 'bx-book-open', color: '#059669' },
                viewMode: 'list',
                position: 3,
                itemCount: 6,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isDefault: false,
                isArchived: false,
            },
        ];
    }

    private createMockSpace(data: SpaceCreateRequest): Space {
        const id = `mock-${Date.now()}`;
        const position = this.spacesCache?.length ?? 0;

        return {
            id,
            noteId: `note-${id}`,
            name: data.name,
            description: data.description,
            theme: {
                icon: data.theme?.icon || DEFAULT_SPACE_ICONS[Math.floor(Math.random() * DEFAULT_SPACE_ICONS.length)],
                color: data.theme?.color || DEFAULT_SPACE_COLORS[Math.floor(Math.random() * DEFAULT_SPACE_COLORS.length)],
            },
            viewMode: data.viewMode || 'grid',
            position,
            itemCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isDefault: false,
            isArchived: false,
        };
    }
}

// Export singleton instance
export const spaceManager = new SpaceManager();
export default spaceManager;
