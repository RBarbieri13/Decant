import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';

interface BottomBarSlotProps {
  storageKey: string;
  defaultLeft: number;
  defaultWidth?: number;
  minWidth?: number;
  children: ReactNode;
}

export function BottomBarSlot({ storageKey, defaultLeft, defaultWidth = 180, minWidth = 100, children }: BottomBarSlotProps) {
  const [left, setLeft] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? Number(saved) : defaultLeft;
    } catch {
      return defaultLeft;
    }
  });

  const [width, setWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}-width`);
      return saved ? Number(saved) : defaultWidth;
    } catch {
      return defaultWidth;
    }
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragOrigin = useRef<{ mouseX: number; startLeft: number } | null>(null);
  const resizeOrigin = useRef<{ mouseX: number; startWidth: number } | null>(null);
  const slotRef = useRef<HTMLDivElement>(null);

  // Persist position
  useEffect(() => {
    localStorage.setItem(storageKey, String(left));
  }, [storageKey, left]);

  // Persist width
  useEffect(() => {
    localStorage.setItem(`${storageKey}-width`, String(width));
  }, [storageKey, width]);

  // Drag handler
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if ((e.target as HTMLElement).closest('.bottom-bar-slot__resize')) return;
    e.preventDefault();
    dragOrigin.current = { mouseX: e.clientX, startLeft: left };
    setIsDragging(true);
  }, [left]);

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent) => {
      if (!dragOrigin.current || !slotRef.current) return;
      const dx = e.clientX - dragOrigin.current.mouseX;
      const parentWidth = slotRef.current.parentElement?.clientWidth ?? window.innerWidth;
      const slotWidth = slotRef.current.clientWidth;
      const newLeft = Math.max(0, Math.min(dragOrigin.current.startLeft + dx, parentWidth - slotWidth));
      setLeft(newLeft);
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

  // Resize handler
  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeOrigin.current = { mouseX: e.clientX, startWidth: width };
    setIsResizing(true);
  }, [width]);

  useEffect(() => {
    if (!isResizing) return;

    const onMove = (e: MouseEvent) => {
      if (!resizeOrigin.current) return;
      const dx = e.clientX - resizeOrigin.current.mouseX;
      const newWidth = Math.max(minWidth, resizeOrigin.current.startWidth + dx);
      setWidth(newWidth);
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
  }, [isResizing, minWidth]);

  return (
    <div
      ref={slotRef}
      className={`bottom-bar-slot ${isDragging ? 'bottom-bar-slot--dragging' : ''} ${isResizing ? 'bottom-bar-slot--dragging' : ''}`}
      style={{ left, width }}
      onMouseDown={onMouseDown}
    >
      {children}
      <div
        className="bottom-bar-slot__resize"
        onMouseDown={onResizeMouseDown}
      />
    </div>
  );
}
