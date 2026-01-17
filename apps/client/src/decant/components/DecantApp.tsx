/**
 * DecantApp - Main application container for the visual content curation workspace
 *
 * This is the root component that orchestrates the entire Decant UI,
 * providing a Toby-like visual workspace experience.
 */

import { h, Fragment } from 'preact';
import { useState, useCallback, useMemo } from 'preact/hooks';
import { SpacesSidebar } from './SpacesSidebar';
import { ContentGrid } from './ContentGrid';
import { QuickCapture } from './QuickCapture';
import { SearchBar } from './SearchBar';
import { ImportModal } from './ImportModal';
import { useSpaces } from '../hooks/useSpaces';
import { useContentItems } from '../hooks/useContentItems';
import type { Space, ContentItem, SpaceViewMode, SystemSpaceId } from '../types';
import { SYSTEM_SPACES, isSystemSpace } from '../types/space';

interface DecantAppProps {
    initialSpaceId?: string;
}

interface FilterState {
    searchQuery: string;
    contentTypes: string[];
    tags: string[];
    sortBy: 'recent' | 'alphabetical' | 'type' | 'domain';
    sortOrder: 'asc' | 'desc';
}

const DEFAULT_FILTER: FilterState = {
    searchQuery: '',
    contentTypes: [],
    tags: [],
    sortBy: 'recent',
    sortOrder: 'desc',
};

export function DecantApp({ initialSpaceId }: DecantAppProps) {
    // State management
    const [activeSpaceId, setActiveSpaceId] = useState<string>(
        initialSpaceId || SYSTEM_SPACES.ALL_ITEMS
    );
    const [viewMode, setViewMode] = useState<SpaceViewMode>('grid');
    const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
    const [showImportModal, setShowImportModal] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    // Data hooks
    const { spaces, loading: spacesLoading, createSpace, updateSpace, deleteSpace } = useSpaces();
    const {
        items,
        loading: itemsLoading,
        importContent,
        moveItem,
        deleteItem,
        updateItem
    } = useContentItems(activeSpaceId, filter);

    // Computed values
    const activeSpace = useMemo(() => {
        if (isSystemSpace(activeSpaceId)) {
            return getSystemSpaceInfo(activeSpaceId);
        }
        return spaces.find(s => s.id === activeSpaceId);
    }, [activeSpaceId, spaces]);

    const filteredItems = useMemo(() => {
        let result = [...items];

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
                    comparison = a.metadata.title.localeCompare(b.metadata.title);
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
    }, [items, filter]);

    // Event handlers
    const handleSpaceSelect = useCallback((spaceId: string) => {
        setActiveSpaceId(spaceId);
        setSelectedItems(new Set());
    }, []);

    const handleQuickCapture = useCallback(async (url: string) => {
        const targetSpaceId = isSystemSpace(activeSpaceId)
            ? SYSTEM_SPACES.INBOX
            : activeSpaceId;
        await importContent({ url, spaceId: targetSpaceId });
    }, [activeSpaceId, importContent]);

    const handleBatchImport = useCallback(async (urls: string[]) => {
        const targetSpaceId = isSystemSpace(activeSpaceId)
            ? SYSTEM_SPACES.INBOX
            : activeSpaceId;

        for (const url of urls) {
            await importContent({ url, spaceId: targetSpaceId });
        }
        setShowImportModal(false);
    }, [activeSpaceId, importContent]);

    const handleItemSelect = useCallback((itemId: string, multiSelect: boolean) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (multiSelect) {
                if (next.has(itemId)) {
                    next.delete(itemId);
                } else {
                    next.add(itemId);
                }
            } else {
                if (next.has(itemId) && next.size === 1) {
                    next.clear();
                } else {
                    next.clear();
                    next.add(itemId);
                }
            }
            return next;
        });
    }, []);

    const handleItemMove = useCallback(async (itemId: string, targetSpaceId: string) => {
        await moveItem(itemId, targetSpaceId);
    }, [moveItem]);

    const handleFilterChange = useCallback((updates: Partial<FilterState>) => {
        setFilter(prev => ({ ...prev, ...updates }));
    }, []);

    const handleViewModeChange = useCallback((mode: SpaceViewMode) => {
        setViewMode(mode);
        if (activeSpace && !isSystemSpace(activeSpaceId)) {
            updateSpace(activeSpaceId, { viewMode: mode });
        }
    }, [activeSpace, activeSpaceId, updateSpace]);

    // Keyboard shortcuts
    // useEffect(() => {
    //     const handleKeyDown = (e: KeyboardEvent) => {
    //         // Cmd/Ctrl + K: Quick capture focus
    //         if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    //             e.preventDefault();
    //             // Focus quick capture input
    //         }
    //         // Cmd/Ctrl + I: Open import modal
    //         if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
    //             e.preventDefault();
    //             setShowImportModal(true);
    //         }
    //     };
    //     window.addEventListener('keydown', handleKeyDown);
    //     return () => window.removeEventListener('keydown', handleKeyDown);
    // }, []);

    const isLoading = spacesLoading || itemsLoading;

    return (
        <div className="decant-app">
            {/* Left Sidebar - Spaces Navigation */}
            <SpacesSidebar
                spaces={spaces}
                activeSpaceId={activeSpaceId}
                collapsed={sidebarCollapsed}
                onSpaceSelect={handleSpaceSelect}
                onSpaceCreate={createSpace}
                onSpaceUpdate={updateSpace}
                onSpaceDelete={deleteSpace}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

            {/* Main Content Area */}
            <main className="decant-main">
                {/* Top Bar - Quick Capture + Search */}
                <header className="decant-header">
                    <QuickCapture
                        onCapture={handleQuickCapture}
                        onBatchImport={() => setShowImportModal(true)}
                        disabled={isLoading}
                    />
                    <SearchBar
                        value={filter.searchQuery}
                        onChange={(query) => handleFilterChange({ searchQuery: query })}
                        viewMode={viewMode}
                        onViewModeChange={handleViewModeChange}
                        filter={filter}
                        onFilterChange={handleFilterChange}
                    />
                </header>

                {/* Space Header */}
                <div className="decant-space-header">
                    <div className="space-info">
                        {activeSpace && (
                            <>
                                <span
                                    className="space-icon"
                                    style={{ backgroundColor: activeSpace.theme?.color }}
                                >
                                    <i className={`bx ${activeSpace.theme?.icon || 'bx-folder'}`} />
                                </span>
                                <h1 className="space-title">{activeSpace.name}</h1>
                                <span className="space-count">
                                    {filteredItems.length} items
                                </span>
                            </>
                        )}
                    </div>
                    {selectedItems.size > 0 && (
                        <div className="selection-actions">
                            <span className="selection-count">
                                {selectedItems.size} selected
                            </span>
                            <button
                                className="btn-ghost"
                                onClick={() => setSelectedItems(new Set())}
                            >
                                Clear
                            </button>
                            <button className="btn-ghost">
                                <i className="bx bx-move" /> Move
                            </button>
                            <button
                                className="btn-ghost btn-danger"
                                onClick={() => {
                                    selectedItems.forEach(id => deleteItem(id));
                                    setSelectedItems(new Set());
                                }}
                            >
                                <i className="bx bx-trash" /> Delete
                            </button>
                        </div>
                    )}
                </div>

                {/* Content Grid */}
                <ContentGrid
                    items={filteredItems}
                    viewMode={viewMode}
                    selectedItems={selectedItems}
                    loading={isLoading}
                    onItemSelect={handleItemSelect}
                    onItemMove={handleItemMove}
                    onItemDelete={deleteItem}
                    onItemUpdate={updateItem}
                />
            </main>

            {/* Import Modal */}
            {showImportModal && (
                <ImportModal
                    onImport={handleBatchImport}
                    onClose={() => setShowImportModal(false)}
                    spaces={spaces}
                    defaultSpaceId={activeSpaceId}
                />
            )}
        </div>
    );
}

/**
 * Get display info for system spaces
 */
function getSystemSpaceInfo(spaceId: SystemSpaceId): Space {
    const systemSpaces: Record<SystemSpaceId, Partial<Space>> = {
        [SYSTEM_SPACES.ALL_ITEMS]: {
            name: 'All Items',
            theme: { icon: 'bx-grid-alt', color: '#6B7280' },
        },
        [SYSTEM_SPACES.RECENT]: {
            name: 'Recent',
            theme: { icon: 'bx-time', color: '#3B82F6' },
        },
        [SYSTEM_SPACES.FAVORITES]: {
            name: 'Favorites',
            theme: { icon: 'bx-star', color: '#F59E0B' },
        },
        [SYSTEM_SPACES.INBOX]: {
            name: 'Inbox',
            theme: { icon: 'bx-inbox', color: '#8B5CF6' },
        },
        [SYSTEM_SPACES.ARCHIVE]: {
            name: 'Archive',
            theme: { icon: 'bx-archive', color: '#9CA3AF' },
        },
    };

    return {
        id: spaceId,
        noteId: '',
        name: systemSpaces[spaceId]?.name || 'Unknown',
        theme: systemSpaces[spaceId]?.theme || { icon: 'bx-folder', color: '#6B7280' },
        viewMode: 'grid',
        position: 0,
        itemCount: 0,
        createdAt: '',
        updatedAt: '',
        isDefault: false,
        isArchived: false,
    };
}

export default DecantApp;
