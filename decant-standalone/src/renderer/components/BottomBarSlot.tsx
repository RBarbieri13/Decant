import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';

interface BottomBarSlotProps {
  storageKey: string;
  defaultLeft: number;
  children: ReactNode;
}

export function BottomBarSlot({ storageKey, defaultLeft, children }: BottomBarSlotProps) {
  const [left, setLeft] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? Number(saved) : defaultLeft;
    } catch {
      return defaultLeft;
    }
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragOrigin = useRef<{ mouseX: number; startLeft: number } | null>(null);
  const slotRef = useRef<HTMLDivElement>(null);

  // Persist position
  useEffect(() => {
    localStorage.setItem(storageKey, String(left));
  }, [storageKey, left]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't start drag if clicking a button inside the panel
    if ((e.target as HTMLElement).closest('button')) return;
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

  return (
    <div
      ref={slotRef}
      className={`bottom-bar-slot ${isDragging ? 'bottom-bar-slot--dragging' : ''}`}
      style={{ left }}
      onMouseDown={onMouseDown}
    >
      {children}
    </div>
  );
}
