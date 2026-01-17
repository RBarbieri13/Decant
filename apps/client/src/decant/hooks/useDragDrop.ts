/**
 * useDragDrop - Hook for drag and drop functionality
 *
 * Provides drag state management and handlers for content items
 * and spaces with support for reordering and moving between spaces.
 */

import { useState, useCallback, useRef } from 'preact/hooks';

interface DragState {
    isDragging: boolean;
    draggedId: string | null;
    draggedType: 'item' | 'space' | null;
    dropTargetId: string | null;
    dropPosition: 'before' | 'after' | 'inside' | null;
}

interface UseDragDropOptions {
    onItemMove?: (itemId: string, targetSpaceId: string) => void;
    onItemReorder?: (itemIds: string[]) => void;
    onSpaceReorder?: (spaceIds: string[]) => void;
}

interface UseDragDropResult {
    dragState: DragState;
    handleDragStart: (e: DragEvent, id: string, type: 'item' | 'space') => void;
    handleDragOver: (e: DragEvent, targetId: string, targetType: 'item' | 'space') => void;
    handleDragLeave: (e: DragEvent) => void;
    handleDrop: (e: DragEvent, targetId: string, targetType: 'item' | 'space') => void;
    handleDragEnd: () => void;
    isDragOver: (targetId: string) => boolean;
    getDropIndicator: (targetId: string) => 'before' | 'after' | 'inside' | null;
}

const INITIAL_STATE: DragState = {
    isDragging: false,
    draggedId: null,
    draggedType: null,
    dropTargetId: null,
    dropPosition: null,
};

export function useDragDrop(options: UseDragDropOptions = {}): UseDragDropResult {
    const [dragState, setDragState] = useState<DragState>(INITIAL_STATE);
    const dragCounterRef = useRef(0);

    const handleDragStart = useCallback((e: DragEvent, id: string, type: 'item' | 'space') => {
        if (!e.dataTransfer) return;

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/json', JSON.stringify({ id, type }));

        // Add drag image styling
        const element = e.target as HTMLElement;
        element.classList.add('dragging');

        setDragState({
            isDragging: true,
            draggedId: id,
            draggedType: type,
            dropTargetId: null,
            dropPosition: null,
        });
    }, []);

    const handleDragOver = useCallback((e: DragEvent, targetId: string, targetType: 'item' | 'space') => {
        e.preventDefault();

        if (!e.dataTransfer) return;

        // Don't allow dropping on itself
        if (targetId === dragState.draggedId) {
            e.dataTransfer.dropEffect = 'none';
            return;
        }

        e.dataTransfer.dropEffect = 'move';

        // Calculate drop position based on mouse position
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const y = e.clientY - rect.top;
        const height = rect.height;

        let dropPosition: 'before' | 'after' | 'inside';

        if (targetType === 'space' && dragState.draggedType === 'item') {
            // Items can only be dropped inside spaces
            dropPosition = 'inside';
        } else {
            // Calculate position for reordering
            if (y < height * 0.25) {
                dropPosition = 'before';
            } else if (y > height * 0.75) {
                dropPosition = 'after';
            } else {
                dropPosition = targetType === 'space' ? 'inside' : 'after';
            }
        }

        setDragState(prev => ({
            ...prev,
            dropTargetId: targetId,
            dropPosition,
        }));
    }, [dragState.draggedId, dragState.draggedType]);

    const handleDragLeave = useCallback((e: DragEvent) => {
        e.preventDefault();

        // Use counter to handle nested elements
        dragCounterRef.current--;

        if (dragCounterRef.current === 0) {
            setDragState(prev => ({
                ...prev,
                dropTargetId: null,
                dropPosition: null,
            }));
        }
    }, []);

    const handleDrop = useCallback((e: DragEvent, targetId: string, targetType: 'item' | 'space') => {
        e.preventDefault();

        const dataStr = e.dataTransfer?.getData('application/json');
        if (!dataStr) return;

        try {
            const { id: draggedId, type: draggedType } = JSON.parse(dataStr);

            // Don't drop on itself
            if (draggedId === targetId) return;

            // Handle different drop scenarios
            if (draggedType === 'item' && targetType === 'space') {
                // Move item to space
                options.onItemMove?.(draggedId, targetId);
            } else if (draggedType === 'item' && targetType === 'item') {
                // Reorder items
                options.onItemReorder?.([draggedId, targetId]);
            } else if (draggedType === 'space' && targetType === 'space') {
                // Reorder spaces
                options.onSpaceReorder?.([draggedId, targetId]);
            }
        } catch (err) {
            console.error('Failed to parse drag data:', err);
        }

        // Reset state
        setDragState(INITIAL_STATE);
        dragCounterRef.current = 0;
    }, [options]);

    const handleDragEnd = useCallback(() => {
        // Remove dragging class from any elements
        document.querySelectorAll('.dragging').forEach(el => {
            el.classList.remove('dragging');
        });

        setDragState(INITIAL_STATE);
        dragCounterRef.current = 0;
    }, []);

    const isDragOver = useCallback((targetId: string): boolean => {
        return dragState.dropTargetId === targetId;
    }, [dragState.dropTargetId]);

    const getDropIndicator = useCallback((targetId: string): 'before' | 'after' | 'inside' | null => {
        if (dragState.dropTargetId !== targetId) return null;
        return dragState.dropPosition;
    }, [dragState.dropTargetId, dragState.dropPosition]);

    return {
        dragState,
        handleDragStart,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        handleDragEnd,
        isDragOver,
        getDropIndicator,
    };
}

export default useDragDrop;
