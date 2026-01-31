// ============================================================
// useDragAndDrop Hook Tests
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDragAndDrop, DropPosition } from '../useDragAndDrop';

// Mock DragEvent for testing
class MockDragEvent extends Event {
  dataTransfer: {
    data: Map<string, string>;
    effectAllowed: string;
    dropEffect: string;
    setData: (format: string, data: string) => void;
    getData: (format: string) => string;
  };
  clientY: number;

  constructor(type: string, init?: EventInit) {
    super(type, init);
    const dataMap = new Map<string, string>();
    this.dataTransfer = {
      data: dataMap,
      effectAllowed: 'none',
      dropEffect: 'none',
      setData: (format: string, data: string) => {
        dataMap.set(format, data);
      },
      getData: (format: string) => {
        return dataMap.get(format) || '';
      },
    };
    this.clientY = 0;
  }
}

describe('useDragAndDrop', () => {
  const mockOnDrop = vi.fn().mockResolvedValue(undefined);
  const mockCanDrop = vi.fn().mockReturnValue(true);
  const mockOnDragOverNode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with null state', () => {
    const { result } = renderHook(() =>
      useDragAndDrop({
        onDrop: mockOnDrop,
      })
    );

    expect(result.current.state).toEqual({
      draggedNodeId: null,
      dragOverNodeId: null,
      dropPosition: null,
    });
  });

  describe('onDragStart', () => {
    it('should set draggedNodeId when drag starts', () => {
      const { result } = renderHook(() =>
        useDragAndDrop({
          onDrop: mockOnDrop,
        })
      );

      const event = new MockDragEvent('dragstart') as any;
      act(() => {
        result.current.handlers.onDragStart('node-1')(event);
      });

      expect(result.current.state.draggedNodeId).toBe('node-1');
      expect(event.dataTransfer.getData('text/plain')).toBe('node-1');
      expect(event.dataTransfer.effectAllowed).toBe('move');
    });
  });

  describe('onDragOver', () => {
    it('should prevent default and calculate drop position', () => {
      const { result } = renderHook(() =>
        useDragAndDrop({
          onDrop: mockOnDrop,
        })
      );

      // Start dragging node-1
      const startEvent = new MockDragEvent('dragstart') as any;
      act(() => {
        result.current.handlers.onDragStart('node-1')(startEvent);
      });

      // Drag over node-2 at top position (before)
      const dragOverEvent = new MockDragEvent('dragover') as any;
      dragOverEvent.preventDefault = vi.fn();
      dragOverEvent.clientY = 5;
      const mockElement = {
        getBoundingClientRect: () => ({ top: 0, height: 100 }),
      };
      dragOverEvent.currentTarget = mockElement;

      act(() => {
        result.current.handlers.onDragOver('node-2')(dragOverEvent);
      });

      expect(dragOverEvent.preventDefault).toHaveBeenCalled();
      expect(result.current.state.dragOverNodeId).toBe('node-2');
      expect(result.current.state.dropPosition).toBe('before');
      expect(dragOverEvent.dataTransfer.dropEffect).toBe('move');
    });

    it('should calculate "inside" position when dragging over middle area', () => {
      const { result } = renderHook(() =>
        useDragAndDrop({
          onDrop: mockOnDrop,
        })
      );

      const startEvent = new MockDragEvent('dragstart') as any;
      act(() => {
        result.current.handlers.onDragStart('node-1')(startEvent);
      });

      const dragOverEvent = new MockDragEvent('dragover') as any;
      dragOverEvent.preventDefault = vi.fn();
      dragOverEvent.clientY = 50;
      const mockElement = {
        getBoundingClientRect: () => ({ top: 0, height: 100 }),
      };
      dragOverEvent.currentTarget = mockElement;

      act(() => {
        result.current.handlers.onDragOver('node-2')(dragOverEvent);
      });

      expect(result.current.state.dropPosition).toBe('inside');
    });

    it('should calculate "after" position when dragging over bottom area', () => {
      const { result } = renderHook(() =>
        useDragAndDrop({
          onDrop: mockOnDrop,
        })
      );

      const startEvent = new MockDragEvent('dragstart') as any;
      act(() => {
        result.current.handlers.onDragStart('node-1')(startEvent);
      });

      const dragOverEvent = new MockDragEvent('dragover') as any;
      dragOverEvent.preventDefault = vi.fn();
      dragOverEvent.clientY = 90;
      const mockElement = {
        getBoundingClientRect: () => ({ top: 0, height: 100 }),
      };
      dragOverEvent.currentTarget = mockElement;

      act(() => {
        result.current.handlers.onDragOver('node-2')(dragOverEvent);
      });

      expect(result.current.state.dropPosition).toBe('after');
    });

    it('should not allow dropping on self', () => {
      const { result } = renderHook(() =>
        useDragAndDrop({
          onDrop: mockOnDrop,
        })
      );

      const startEvent = new MockDragEvent('dragstart') as any;
      act(() => {
        result.current.handlers.onDragStart('node-1')(startEvent);
      });

      const dragOverEvent = new MockDragEvent('dragover') as any;
      dragOverEvent.preventDefault = vi.fn();
      dragOverEvent.clientY = 50;
      const mockElement = {
        getBoundingClientRect: () => ({ top: 0, height: 100 }),
      };
      dragOverEvent.currentTarget = mockElement;

      act(() => {
        result.current.handlers.onDragOver('node-1')(dragOverEvent);
      });

      expect(dragOverEvent.dataTransfer.dropEffect).toBe('none');
      expect(result.current.state.dragOverNodeId).toBeNull();
    });

    it('should respect canDrop callback', () => {
      const canDrop = vi.fn().mockReturnValue(false);
      const { result } = renderHook(() =>
        useDragAndDrop({
          onDrop: mockOnDrop,
          canDrop,
        })
      );

      const startEvent = new MockDragEvent('dragstart') as any;
      act(() => {
        result.current.handlers.onDragStart('node-1')(startEvent);
      });

      const dragOverEvent = new MockDragEvent('dragover') as any;
      dragOverEvent.preventDefault = vi.fn();
      dragOverEvent.clientY = 50;
      const mockElement = {
        getBoundingClientRect: () => ({ top: 0, height: 100 }),
      };
      dragOverEvent.currentTarget = mockElement;

      act(() => {
        result.current.handlers.onDragOver('node-2')(dragOverEvent);
      });

      expect(canDrop).toHaveBeenCalledWith('node-1', 'node-2', 'inside');
      expect(dragOverEvent.dataTransfer.dropEffect).toBe('none');
      expect(result.current.state.dragOverNodeId).toBeNull();
    });

    it('should trigger auto-expand after hover delay for "inside" position', () => {
      const onDragOverNode = vi.fn();
      const { result } = renderHook(() =>
        useDragAndDrop({
          onDrop: mockOnDrop,
          onDragOverNode,
        })
      );

      const startEvent = new MockDragEvent('dragstart') as any;
      act(() => {
        result.current.handlers.onDragStart('node-1')(startEvent);
      });

      const dragOverEvent = new MockDragEvent('dragover') as any;
      dragOverEvent.preventDefault = vi.fn();
      dragOverEvent.clientY = 50;
      const mockElement = {
        getBoundingClientRect: () => ({ top: 0, height: 100 }),
      };
      dragOverEvent.currentTarget = mockElement;

      act(() => {
        result.current.handlers.onDragOver('node-2')(dragOverEvent);
      });

      expect(onDragOverNode).not.toHaveBeenCalled();

      // Fast-forward time by 800ms
      act(() => {
        vi.advanceTimersByTime(800);
      });

      expect(onDragOverNode).toHaveBeenCalledWith('node-2');
    });

    it('should not trigger auto-expand for "before" or "after" positions', () => {
      const onDragOverNode = vi.fn();
      const { result } = renderHook(() =>
        useDragAndDrop({
          onDrop: mockOnDrop,
          onDragOverNode,
        })
      );

      const startEvent = new MockDragEvent('dragstart') as any;
      act(() => {
        result.current.handlers.onDragStart('node-1')(startEvent);
      });

      // Drag over at top (before position)
      const dragOverEvent = new MockDragEvent('dragover') as any;
      dragOverEvent.preventDefault = vi.fn();
      dragOverEvent.clientY = 10;
      const mockElement = {
        getBoundingClientRect: () => ({ top: 0, height: 100 }),
      };
      dragOverEvent.currentTarget = mockElement;

      act(() => {
        result.current.handlers.onDragOver('node-2')(dragOverEvent);
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onDragOverNode).not.toHaveBeenCalled();
    });
  });

  describe('onDragLeave', () => {
    it('should clear drag over state', () => {
      const { result } = renderHook(() =>
        useDragAndDrop({
          onDrop: mockOnDrop,
        })
      );

      // Start drag and drag over
      const startEvent = new MockDragEvent('dragstart') as any;
      act(() => {
        result.current.handlers.onDragStart('node-1')(startEvent);
      });

      const dragOverEvent = new MockDragEvent('dragover') as any;
      dragOverEvent.preventDefault = vi.fn();
      dragOverEvent.clientY = 50;
      dragOverEvent.currentTarget = {
        getBoundingClientRect: () => ({ top: 0, height: 100 }),
      };

      act(() => {
        result.current.handlers.onDragOver('node-2')(dragOverEvent);
      });

      expect(result.current.state.dragOverNodeId).toBe('node-2');

      // Drag leave
      act(() => {
        result.current.handlers.onDragLeave();
      });

      expect(result.current.state.dragOverNodeId).toBeNull();
      expect(result.current.state.dropPosition).toBeNull();
    });

    it('should clear hover timeout', () => {
      const onDragOverNode = vi.fn();
      const { result } = renderHook(() =>
        useDragAndDrop({
          onDrop: mockOnDrop,
          onDragOverNode,
        })
      );

      const startEvent = new MockDragEvent('dragstart') as any;
      act(() => {
        result.current.handlers.onDragStart('node-1')(startEvent);
      });

      const dragOverEvent = new MockDragEvent('dragover') as any;
      dragOverEvent.preventDefault = vi.fn();
      dragOverEvent.clientY = 50;
      dragOverEvent.currentTarget = {
        getBoundingClientRect: () => ({ top: 0, height: 100 }),
      };

      act(() => {
        result.current.handlers.onDragOver('node-2')(dragOverEvent);
      });

      // Leave before timeout
      act(() => {
        result.current.handlers.onDragLeave();
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onDragOverNode).not.toHaveBeenCalled();
    });
  });

  describe('onDrop', () => {
    it('should call onDrop callback with correct parameters', async () => {
      const { result } = renderHook(() =>
        useDragAndDrop({
          onDrop: mockOnDrop,
        })
      );

      // Start drag
      const startEvent = new MockDragEvent('dragstart') as any;
      act(() => {
        result.current.handlers.onDragStart('node-1')(startEvent);
      });

      // Drop
      const dropEvent = new MockDragEvent('drop') as any;
      dropEvent.preventDefault = vi.fn();
      dropEvent.stopPropagation = vi.fn();
      dropEvent.dataTransfer.setData('text/plain', 'node-1');
      dropEvent.clientY = 50;
      dropEvent.currentTarget = {
        getBoundingClientRect: () => ({ top: 0, height: 100 }),
      };

      await act(async () => {
        await result.current.handlers.onDrop('node-2')(dropEvent);
      });

      expect(dropEvent.preventDefault).toHaveBeenCalled();
      expect(dropEvent.stopPropagation).toHaveBeenCalled();
      expect(mockOnDrop).toHaveBeenCalledWith('node-1', 'node-2', 'inside');
      expect(result.current.state.draggedNodeId).toBeNull();
      expect(result.current.state.dragOverNodeId).toBeNull();
    });

    it('should not drop on self', async () => {
      const { result } = renderHook(() =>
        useDragAndDrop({
          onDrop: mockOnDrop,
        })
      );

      const startEvent = new MockDragEvent('dragstart') as any;
      act(() => {
        result.current.handlers.onDragStart('node-1')(startEvent);
      });

      const dropEvent = new MockDragEvent('drop') as any;
      dropEvent.preventDefault = vi.fn();
      dropEvent.stopPropagation = vi.fn();
      dropEvent.dataTransfer.setData('text/plain', 'node-1');
      dropEvent.clientY = 50;
      dropEvent.currentTarget = {
        getBoundingClientRect: () => ({ top: 0, height: 100 }),
      };

      await act(async () => {
        await result.current.handlers.onDrop('node-1')(dropEvent);
      });

      expect(mockOnDrop).not.toHaveBeenCalled();
      expect(result.current.state.draggedNodeId).toBeNull();
    });

    it('should respect canDrop callback on drop', async () => {
      const canDrop = vi.fn().mockReturnValue(false);
      const { result } = renderHook(() =>
        useDragAndDrop({
          onDrop: mockOnDrop,
          canDrop,
        })
      );

      const startEvent = new MockDragEvent('dragstart') as any;
      act(() => {
        result.current.handlers.onDragStart('node-1')(startEvent);
      });

      const dropEvent = new MockDragEvent('drop') as any;
      dropEvent.preventDefault = vi.fn();
      dropEvent.stopPropagation = vi.fn();
      dropEvent.dataTransfer.setData('text/plain', 'node-1');
      dropEvent.clientY = 50;
      dropEvent.currentTarget = {
        getBoundingClientRect: () => ({ top: 0, height: 100 }),
      };

      await act(async () => {
        await result.current.handlers.onDrop('node-2')(dropEvent);
      });

      expect(canDrop).toHaveBeenCalledWith('node-1', 'node-2', 'inside');
      expect(mockOnDrop).not.toHaveBeenCalled();
    });

    it('should handle drop errors gracefully', async () => {
      const onDrop = vi.fn().mockRejectedValue(new Error('Drop failed'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() =>
        useDragAndDrop({
          onDrop,
        })
      );

      const startEvent = new MockDragEvent('dragstart') as any;
      act(() => {
        result.current.handlers.onDragStart('node-1')(startEvent);
      });

      const dropEvent = new MockDragEvent('drop') as any;
      dropEvent.preventDefault = vi.fn();
      dropEvent.stopPropagation = vi.fn();
      dropEvent.dataTransfer.setData('text/plain', 'node-1');
      dropEvent.clientY = 50;
      dropEvent.currentTarget = {
        getBoundingClientRect: () => ({ top: 0, height: 100 }),
      };

      await act(async () => {
        await result.current.handlers.onDrop('node-2')(dropEvent);
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith('Drop failed:', expect.any(Error));
      expect(result.current.state.draggedNodeId).toBeNull();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('onDragEnd', () => {
    it('should reset all state when drag ends', () => {
      const { result } = renderHook(() =>
        useDragAndDrop({
          onDrop: mockOnDrop,
        })
      );

      // Start drag and drag over
      const startEvent = new MockDragEvent('dragstart') as any;
      act(() => {
        result.current.handlers.onDragStart('node-1')(startEvent);
      });

      const dragOverEvent = new MockDragEvent('dragover') as any;
      dragOverEvent.preventDefault = vi.fn();
      dragOverEvent.clientY = 50;
      dragOverEvent.currentTarget = {
        getBoundingClientRect: () => ({ top: 0, height: 100 }),
      };

      act(() => {
        result.current.handlers.onDragOver('node-2')(dragOverEvent);
      });

      // End drag
      act(() => {
        result.current.handlers.onDragEnd();
      });

      expect(result.current.state).toEqual({
        draggedNodeId: null,
        dragOverNodeId: null,
        dropPosition: null,
      });
    });

    it('should clear any pending hover timeouts', () => {
      const onDragOverNode = vi.fn();
      const { result } = renderHook(() =>
        useDragAndDrop({
          onDrop: mockOnDrop,
          onDragOverNode,
        })
      );

      const startEvent = new MockDragEvent('dragstart') as any;
      act(() => {
        result.current.handlers.onDragStart('node-1')(startEvent);
      });

      const dragOverEvent = new MockDragEvent('dragover') as any;
      dragOverEvent.preventDefault = vi.fn();
      dragOverEvent.clientY = 50;
      dragOverEvent.currentTarget = {
        getBoundingClientRect: () => ({ top: 0, height: 100 }),
      };

      act(() => {
        result.current.handlers.onDragOver('node-2')(dragOverEvent);
      });

      // End drag before timeout
      act(() => {
        result.current.handlers.onDragEnd();
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(onDragOverNode).not.toHaveBeenCalled();
    });
  });
});
