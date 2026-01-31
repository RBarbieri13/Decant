// ============================================================
// useDragAndDrop - Advanced drag and drop hook for tree reorganization
// ============================================================

import { useState, useCallback, DragEvent } from 'react';

export type DropPosition = 'before' | 'inside' | 'after';

interface DragDropState {
  draggedNodeId: string | null;
  dragOverNodeId: string | null;
  dropPosition: DropPosition | null;
}

interface UseDragAndDropOptions {
  onDrop: (sourceId: string, targetId: string, position: DropPosition) => Promise<void>;
  canDrop?: (sourceId: string, targetId: string, position: DropPosition) => boolean;
  onDragOverNode?: (nodeId: string) => void; // Auto-expand callback
}

interface DragHandlers {
  onDragStart: (nodeId: string) => (e: DragEvent) => void;
  onDragOver: (nodeId: string) => (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (nodeId: string) => (e: DragEvent) => void;
  onDragEnd: () => void;
}

export interface UseDragAndDropReturn {
  state: DragDropState;
  handlers: DragHandlers;
}

/**
 * Advanced drag and drop hook with position indicators
 *
 * Usage:
 * ```tsx
 * const { state, handlers } = useDragAndDrop({
 *   onDrop: async (sourceId, targetId, position) => {
 *     await moveNode(sourceId, targetId, position);
 *   },
 *   canDrop: (sourceId, targetId) => {
 *     return !isDescendant(sourceId, targetId);
 *   }
 * });
 * ```
 */
export function useDragAndDrop(options: UseDragAndDropOptions): UseDragAndDropReturn {
  const { onDrop, canDrop, onDragOverNode } = options;

  const [state, setState] = useState<DragDropState>({
    draggedNodeId: null,
    dragOverNodeId: null,
    dropPosition: null,
  });

  // Track hover timeout for auto-expand
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);

  /**
   * Calculate drop position based on mouse position within element
   */
  const calculateDropPosition = useCallback((e: DragEvent, targetElement: HTMLElement): DropPosition => {
    const rect = targetElement.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    // Divide into three zones: top 25%, middle 50%, bottom 25%
    if (y < height * 0.25) {
      return 'before';
    } else if (y > height * 0.75) {
      return 'after';
    } else {
      return 'inside';
    }
  }, []);

  /**
   * Start dragging
   */
  const handleDragStart = useCallback((nodeId: string) => (e: DragEvent) => {
    e.dataTransfer.setData('text/plain', nodeId);
    e.dataTransfer.effectAllowed = 'move';

    setState(prev => ({
      ...prev,
      draggedNodeId: nodeId,
    }));
  }, []);

  /**
   * Dragging over a node
   */
  const handleDragOver = useCallback((nodeId: string) => (e: DragEvent) => {
    e.preventDefault();

    const draggedId = state.draggedNodeId;

    // Can't drop on self
    if (draggedId === nodeId) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    // Calculate position
    const position = calculateDropPosition(e, e.currentTarget as HTMLElement);

    // Check if drop is allowed
    if (canDrop && !canDrop(draggedId!, nodeId, position)) {
      e.dataTransfer.dropEffect = 'none';
      setState(prev => ({
        ...prev,
        dragOverNodeId: null,
        dropPosition: null,
      }));
      return;
    }

    e.dataTransfer.dropEffect = 'move';

    setState(prev => ({
      ...prev,
      dragOverNodeId: nodeId,
      dropPosition: position,
    }));

    // Auto-expand on hover (only for 'inside' position)
    if (position === 'inside' && onDragOverNode) {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }

      const timeout = setTimeout(() => {
        onDragOverNode(nodeId);
      }, 800); // 800ms hover delay before auto-expand

      setHoverTimeout(timeout);
    } else {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        setHoverTimeout(null);
      }
    }
  }, [state.draggedNodeId, calculateDropPosition, canDrop, onDragOverNode, hoverTimeout]);

  /**
   * Drag leaves node
   */
  const handleDragLeave = useCallback(() => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }

    setState(prev => ({
      ...prev,
      dragOverNodeId: null,
      dropPosition: null,
    }));
  }, [hoverTimeout]);

  /**
   * Drop on node
   */
  const handleDrop = useCallback((nodeId: string) => async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }

    const draggedNodeId = e.dataTransfer.getData('text/plain');

    if (!draggedNodeId || draggedNodeId === nodeId) {
      setState({
        draggedNodeId: null,
        dragOverNodeId: null,
        dropPosition: null,
      });
      return;
    }

    const position = calculateDropPosition(e, e.currentTarget as HTMLElement);

    // Check if drop is allowed
    if (canDrop && !canDrop(draggedNodeId, nodeId, position)) {
      setState({
        draggedNodeId: null,
        dragOverNodeId: null,
        dropPosition: null,
      });
      return;
    }

    // Clear state immediately for better UX
    setState({
      draggedNodeId: null,
      dragOverNodeId: null,
      dropPosition: null,
    });

    // Execute drop
    try {
      await onDrop(draggedNodeId, nodeId, position);
    } catch (err) {
      console.error('Drop failed:', err);
      // Error is handled by the onDrop callback
    }
  }, [calculateDropPosition, canDrop, onDrop, hoverTimeout]);

  /**
   * Drag ended
   */
  const handleDragEnd = useCallback(() => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }

    setState({
      draggedNodeId: null,
      dragOverNodeId: null,
      dropPosition: null,
    });
  }, [hoverTimeout]);

  return {
    state,
    handlers: {
      onDragStart: handleDragStart,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
      onDragEnd: handleDragEnd,
    },
  };
}
