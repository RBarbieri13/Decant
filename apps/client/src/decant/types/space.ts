/**
 * Space Types - Defines workspace/collection types
 */

export type SpaceViewMode = 'grid' | 'list' | 'board' | 'masonry';

export interface SpaceTheme {
    color: string;
    icon: string;
    gradient?: string;
}

export const DEFAULT_SPACE_COLORS = [
    '#3B82F6', // Blue
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#EF4444', // Red
    '#6366F1', // Indigo
    '#14B8A6', // Teal
    '#F97316', // Orange
    '#84CC16', // Lime
];

export const DEFAULT_SPACE_ICONS = [
    'bx-folder',
    'bx-collection',
    'bx-briefcase',
    'bx-bulb',
    'bx-book',
    'bx-code-block',
    'bx-palette',
    'bx-music',
    'bx-movie',
    'bx-news',
    'bx-trophy',
    'bx-heart',
    'bx-star',
    'bx-rocket',
    'bx-home',
];

export interface Space {
    id: string;
    noteId: string;
    name: string;
    description?: string;
    theme: SpaceTheme;
    viewMode: SpaceViewMode;
    position: number;
    itemCount: number;
    createdAt: string;
    updatedAt: string;
    isDefault: boolean;
    isArchived: boolean;
}

export interface SpaceCreateRequest {
    name: string;
    description?: string;
    theme?: Partial<SpaceTheme>;
    viewMode?: SpaceViewMode;
}

export interface SpaceUpdateRequest {
    name?: string;
    description?: string;
    theme?: Partial<SpaceTheme>;
    viewMode?: SpaceViewMode;
    position?: number;
    isArchived?: boolean;
}

export interface SpaceStats {
    totalItems: number;
    itemsByType: Record<string, number>;
    recentItems: number;
    tagsUsed: string[];
    lastUpdated: string;
}

export interface SpaceWithItems extends Space {
    items: import('./content').ContentItem[];
}

/**
 * Special system spaces
 */
export const SYSTEM_SPACES = {
    ALL_ITEMS: '__all__',
    RECENT: '__recent__',
    FAVORITES: '__favorites__',
    INBOX: '__inbox__',
    ARCHIVE: '__archive__',
} as const;

export type SystemSpaceId = typeof SYSTEM_SPACES[keyof typeof SYSTEM_SPACES];

export function isSystemSpace(spaceId: string): spaceId is SystemSpaceId {
    return Object.values(SYSTEM_SPACES).includes(spaceId as SystemSpaceId);
}
