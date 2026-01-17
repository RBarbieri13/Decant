/**
 * ContentGrid - Main content display area with grid/list/board views
 *
 * Displays content items as visual cards with support for multiple
 * view modes, selection, drag-and-drop, and virtual scrolling.
 */

import { h, Fragment } from 'preact';
import { useMemo, useCallback, useRef, useState } from 'preact/hooks';
import { ContentCard } from './ContentCard';
import type { ContentItem, SpaceViewMode } from '../types';

interface ContentGridProps {
    items: ContentItem[];
    viewMode: SpaceViewMode;
    selectedItems: Set<string>;
    loading: boolean;
    onItemSelect: (itemId: string, multiSelect: boolean) => void;
    onItemMove: (itemId: string, targetSpaceId: string) => void;
    onItemDelete: (itemId: string) => void;
    onItemUpdate: (itemId: string, data: Partial<ContentItem>) => void;
}

interface DragState {
    isDragging: boolean;
    draggedId: string | null;
    dropTargetId: string | null;
}

export function ContentGrid({
    items,
    viewMode,
    selectedItems,
    loading,
    onItemSelect,
    onItemMove,
    onItemDelete,
    onItemUpdate,
}: ContentGridProps) {
    const gridRef = useRef<HTMLDivElement>(null);
    const [dragState, setDragState] = useState<DragState>({
        isDragging: false,
        draggedId: null,
        dropTargetId: null,
    });

    // Group items by type for board view
    const groupedItems = useMemo(() => {
        if (viewMode !== 'board') return null;

        const groups: Record<string, ContentItem[]> = {};
        items.forEach(item => {
            const type = item.type;
            if (!groups[type]) groups[type] = [];
            groups[type].push(item);
        });
        return groups;
    }, [items, viewMode]);

    // Drag handlers
    const handleDragStart = useCallback((e: DragEvent, itemId: string) => {
        if (!e.dataTransfer) return;

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', itemId);

        setDragState({
            isDragging: true,
            draggedId: itemId,
            dropTargetId: null,
        });
    }, []);

    const handleDragOver = useCallback((e: DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
        }
    }, []);

    const handleDragEnd = useCallback(() => {
        setDragState({
            isDragging: false,
            draggedId: null,
            dropTargetId: null,
        });
    }, []);

    const handleDrop = useCallback((e: DragEvent, targetSpaceId: string) => {
        e.preventDefault();

        const itemId = e.dataTransfer?.getData('text/plain');
        if (itemId && targetSpaceId) {
            onItemMove(itemId, targetSpaceId);
        }

        handleDragEnd();
    }, [onItemMove, handleDragEnd]);

    // Click handler with multi-select support
    const handleItemClick = useCallback((e: MouseEvent, itemId: string) => {
        const multiSelect = e.ctrlKey || e.metaKey || e.shiftKey;
        onItemSelect(itemId, multiSelect);
    }, [onItemSelect]);

    // Render loading skeleton
    if (loading) {
        return (
            <div className={`content-grid view-${viewMode} loading`}>
                {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="content-card skeleton">
                        <div className="skeleton-thumbnail" />
                        <div className="skeleton-content">
                            <div className="skeleton-title" />
                            <div className="skeleton-meta" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Render empty state
    if (items.length === 0) {
        return (
            <div className="content-grid empty">
                <div className="empty-state">
                    <i className="bx bx-folder-open" />
                    <h3>No items yet</h3>
                    <p>
                        Paste a URL in the quick capture bar above, or drag and drop
                        links from your browser to start collecting.
                    </p>
                </div>
            </div>
        );
    }

    // Board view (grouped by type)
    if (viewMode === 'board' && groupedItems) {
        const typeOrder = ['article', 'youtube', 'podcast', 'paper', 'tool', 'website', 'image', 'file', 'text'];
        const sortedTypes = Object.keys(groupedItems).sort(
            (a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b)
        );

        return (
            <div className="content-grid view-board" ref={gridRef}>
                {sortedTypes.map(type => (
                    <div key={type} className="board-column">
                        <div className="board-column-header">
                            <span className="column-title">{type}</span>
                            <span className="column-count">{groupedItems[type].length}</span>
                        </div>
                        <div className="board-column-content">
                            {groupedItems[type].map(item => (
                                <ContentCard
                                    key={item.id}
                                    item={item}
                                    viewMode="list"
                                    isSelected={selectedItems.has(item.id)}
                                    isDragging={dragState.draggedId === item.id}
                                    onClick={(e) => handleItemClick(e, item.id)}
                                    onDragStart={(e) => handleDragStart(e, item.id)}
                                    onDragEnd={handleDragEnd}
                                    onDelete={() => onItemDelete(item.id)}
                                    onUpdate={(data) => onItemUpdate(item.id, data)}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Grid, List, or Masonry view
    return (
        <div
            className={`content-grid view-${viewMode}`}
            ref={gridRef}
            onDragOver={handleDragOver}
        >
            {items.map(item => (
                <ContentCard
                    key={item.id}
                    item={item}
                    viewMode={viewMode}
                    isSelected={selectedItems.has(item.id)}
                    isDragging={dragState.draggedId === item.id}
                    onClick={(e) => handleItemClick(e, item.id)}
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onDragEnd={handleDragEnd}
                    onDelete={() => onItemDelete(item.id)}
                    onUpdate={(data) => onItemUpdate(item.id, data)}
                />
            ))}
        </div>
    );
}

export default ContentGrid;
