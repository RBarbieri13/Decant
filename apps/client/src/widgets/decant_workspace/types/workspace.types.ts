/**
 * Decant Workspace Types
 *
 * TypeScript interfaces for the Toby-like visual workspace widget.
 */

/**
 * Content types supported by Decant
 */
export type ContentType =
    | 'youtube'
    | 'article'
    | 'podcast'
    | 'paper'
    | 'github'
    | 'tweet'
    | 'image'
    | 'tool'
    | 'website'
    | 'file'
    | 'text'
    | 'other';

/**
 * Space color options (Gumroad palette)
 */
export type SpaceColor = 'pink' | 'yellow' | 'blue' | 'green';

/**
 * View mode options for the workspace
 */
export type ViewMode = 'grid' | 'list' | 'compact';

/**
 * Individual item in a collection (bookmark/note)
 */
export interface DecantItem {
    noteId: string;
    title: string;
    sourceUrl?: string;
    contentType: ContentType;
    favicon?: string;
    thumbnail?: string;
    aiSummary?: string;
    tags: string[];
    dateCreated: string;
    dateModified: string;
}

/**
 * Collection within a Space
 */
export interface DecantCollection {
    noteId: string;
    title: string;
    items: DecantItem[];
    itemCount: number;
}

/**
 * Top-level Space container
 */
export interface DecantSpace {
    noteId: string;
    title: string;
    color: SpaceColor;
    description?: string;
    collections: DecantCollection[];
    collectionCount: number;
}

/**
 * Workspace state for context
 */
export interface WorkspaceState {
    spaces: DecantSpace[];
    selectedSpaceId: string | null;
    selectedCollectionId: string | null;
    viewMode: ViewMode;
    searchQuery: string;
    isLoading: boolean;
    error: string | null;
}

/**
 * Workspace actions for context reducer
 */
export type WorkspaceAction =
    | { type: 'SET_SPACES'; payload: DecantSpace[] }
    | { type: 'SELECT_SPACE'; payload: string | null }
    | { type: 'SELECT_COLLECTION'; payload: string | null }
    | { type: 'SET_VIEW_MODE'; payload: ViewMode }
    | { type: 'SET_SEARCH_QUERY'; payload: string }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'REFRESH' };

/**
 * Workspace context value
 */
export interface WorkspaceContextValue {
    state: WorkspaceState;
    dispatch: (action: WorkspaceAction) => void;
    refetch: () => Promise<void>;
    selectedSpace: DecantSpace | null;
    selectedCollection: DecantCollection | null;
}

/**
 * Props for drag and drop operations
 */
export interface DragItem {
    noteId: string;
    type: 'item' | 'collection';
    sourceCollectionId?: string;
    sourceSpaceId?: string;
}

/**
 * Content type configuration for badges
 */
export interface ContentTypeConfig {
    label: string;
    icon: string;
    color: string;
}

/**
 * Map of content type to configuration
 */
export const CONTENT_TYPE_CONFIG: Record<ContentType, ContentTypeConfig> = {
    youtube: { label: 'YouTube', icon: '▶️', color: '#FF0000' },
    article: { label: 'Article', icon: '📄', color: '#90A8ED' },
    podcast: { label: 'Podcast', icon: '🎙️', color: '#23C66B' },
    paper: { label: 'Paper', icon: '📑', color: '#E1FF3C' },
    github: { label: 'GitHub', icon: '🐙', color: '#000000' },
    tweet: { label: 'Tweet', icon: '🐦', color: '#1DA1F2' },
    image: { label: 'Image', icon: '🖼️', color: '#90A8ED' },
    tool: { label: 'Tool', icon: '🔧', color: '#FF90E8' },
    website: { label: 'Website', icon: '🌐', color: '#666666' },
    file: { label: 'File', icon: '📁', color: '#888888' },
    text: { label: 'Text', icon: '📝', color: '#444444' },
    other: { label: 'Other', icon: '📎', color: '#999999' }
};

/**
 * Space color to CSS variable mapping
 */
export const SPACE_COLOR_MAP: Record<SpaceColor, string> = {
    pink: 'var(--gum-pink)',
    yellow: 'var(--gum-yellow)',
    blue: 'var(--gum-blue)',
    green: 'var(--gum-green)'
};
