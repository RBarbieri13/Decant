import { useState, useCallback, useRef, useEffect } from 'react';

// ============================================
// TYPES
// ============================================

interface PanelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseFloatingPanelOptions {
  /** localStorage key for persisting position/size */
  storageKey: string;
  /** Default width when first expanded */
  defaultWidth: number;
  /** Default height when first expanded */
  defaultHeight: number;
  /** Minimum width the panel can be resized to */
  minWidth?: number;
  /** Minimum height the panel can be resized to */
  minHeight?: number;
  /** Horizontal offset from center for default position */
  defaultOffsetX?: number;
  /** Vertical offset from bottom for default position */
  defaultOffsetY?: number;
}

interface UseFloatingPanelReturn {
  /** Current panel rect (position + size) */
  rect: PanelRect;
  /** Whether user is actively dragging */
  isDragging: boolean;
  /** Whether user is actively resizing */
  isResizing: boolean;
  /** Current z-index for this panel */
  zIndex: number;
  /** Call on any interaction to bring panel to front */
  bringToFront: () => void;
  /** Attach to the drag handle's onMouseDown */
  onDragStart: (e: React.MouseEvent) => void;
  /** Attach to the resize handle's onMouseDown */
  onResizeStart: (e: React.MouseEvent, direction: ResizeDirection) => void;
  /** Reset position/size to defaults */
  resetRect: () => void;
}

type ResizeDirection = 'e' | 's' | 'se';

// ============================================
// GLOBAL Z-INDEX COUNTER
// ============================================

let globalZCounter = 500;

function nextZIndex(): number {
  return ++globalZCounter;
}

// ============================================
// HELPERS
// ============================================

function loadRect(key: string): PanelRect | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed.x === 'number' &&
      typeof parsed.y === 'number' &&
      typeof parsed.width === 'number' &&
      typeof parsed.height === 'number'
    ) {
      return parsed as PanelRect;
    }
  } catch { /* ignore corrupt data */ }
  return null;
}

function saveRect(key: string, rect: PanelRect) {
  localStorage.setItem(key, JSON.stringify(rect));
}

function clampToViewport(rect: PanelRect): PanelRect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    ...rect,
    x: Math.max(0, Math.min(rect.x, vw - 80)),
    y: Math.max(0, Math.min(rect.y, vh - 40)),
    width: Math.min(rect.width, vw),
    height: Math.min(rect.height, vh),
  };
}

// ============================================
// HOOK
// ============================================

export function useFloatingPanel(options: UseFloatingPanelOptions): UseFloatingPanelReturn {
  const {
    storageKey,
    defaultWidth,
    defaultHeight,
    minWidth = 240,
    minHeight = 160,
    defaultOffsetX = 0,
    defaultOffsetY = 0,
  } = options;

  const getDefaultRect = useCallback((): PanelRect => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      x: Math.max(16, (vw - defaultWidth) / 2 + defaultOffsetX),
      y: Math.max(16, vh - defaultHeight - 60 + defaultOffsetY),
      width: defaultWidth,
      height: defaultHeight,
    };
  }, [defaultWidth, defaultHeight, defaultOffsetX, defaultOffsetY]);

  const [rect, setRect] = useState<PanelRect>(() => {
    const saved = loadRect(storageKey);
    return saved ? clampToViewport(saved) : getDefaultRect();
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [zIndex, setZIndex] = useState(() => nextZIndex());

  const dragOrigin = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);
  const resizeOrigin = useRef<{
    mouseX: number; mouseY: number;
    startW: number; startH: number;
    startX: number; startY: number;
    direction: ResizeDirection;
  } | null>(null);

  // Persist on change (debounced by animation frame)
  const rafRef = useRef<number>(0);
  useEffect(() => {
    rafRef.current = requestAnimationFrame(() => saveRect(storageKey, rect));
    return () => cancelAnimationFrame(rafRef.current);
  }, [storageKey, rect]);

  const bringToFront = useCallback(() => {
    setZIndex(nextZIndex());
  }, []);

  // ---- DRAG ----
  const onDragStart = useCallback((e: React.MouseEvent) => {
    // Don't drag if clicking a button inside the header
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    bringToFront();
    dragOrigin.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: rect.x,
      startY: rect.y,
    };
    setIsDragging(true);
  }, [rect.x, rect.y, bringToFront]);

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent) => {
      if (!dragOrigin.current) return;
      const dx = e.clientX - dragOrigin.current.mouseX;
      const dy = e.clientY - dragOrigin.current.mouseY;
      setRect(prev => clampToViewport({
        ...prev,
        x: dragOrigin.current!.startX + dx,
        y: dragOrigin.current!.startY + dy,
      }));
    };

    const onUp = () => {
      dragOrigin.current = null;
      setIsDragging(false);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  // ---- RESIZE ----
  const onResizeStart = useCallback((e: React.MouseEvent, direction: ResizeDirection) => {
    e.preventDefault();
    e.stopPropagation();
    bringToFront();
    resizeOrigin.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startW: rect.width,
      startH: rect.height,
      startX: rect.x,
      startY: rect.y,
      direction,
    };
    setIsResizing(true);
  }, [rect.width, rect.height, rect.x, rect.y, bringToFront]);

  useEffect(() => {
    if (!isResizing) return;

    const onMove = (e: MouseEvent) => {
      if (!resizeOrigin.current) return;
      const dx = e.clientX - resizeOrigin.current.mouseX;
      const dy = e.clientY - resizeOrigin.current.mouseY;
      const { direction, startW, startH } = resizeOrigin.current;

      setRect(prev => {
        const next = { ...prev };
        if (direction === 'e' || direction === 'se') {
          next.width = Math.max(minWidth, startW + dx);
        }
        if (direction === 's' || direction === 'se') {
          next.height = Math.max(minHeight, startH + dy);
        }
        return next;
      });
    };

    const onUp = () => {
      resizeOrigin.current = null;
      setIsResizing(false);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isResizing, minWidth, minHeight]);

  const resetRect = useCallback(() => {
    const defaultR = getDefaultRect();
    setRect(defaultR);
    saveRect(storageKey, defaultR);
  }, [storageKey, getDefaultRect]);

  return { rect, isDragging, isResizing, zIndex, bringToFront, onDragStart, onResizeStart, resetRect };
}
