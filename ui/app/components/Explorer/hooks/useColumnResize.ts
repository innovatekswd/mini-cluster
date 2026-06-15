import { useCallback, useRef, useState } from 'react';

export interface ColumnWidths {
  name: number;   // px — flex min, acts as a min-width since name gets remaining space
  size: number;   // px fixed
  modified: number; // px fixed
}

const DEFAULTS: ColumnWidths = { name: 240, size: 80, modified: 160 };
const MIN: ColumnWidths = { name: 80, size: 60, modified: 100 };

export function useColumnResize() {
  const [cols, setCols] = useState<ColumnWidths>(DEFAULTS);
  const dragging = useRef<{ col: keyof ColumnWidths; startX: number; startW: number } | null>(null);

  const onMouseDown = useCallback((col: keyof ColumnWidths, e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = { col, startX: e.clientX, startW: cols[col] };

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = ev.clientX - dragging.current.startX;
      const newW = Math.max(MIN[dragging.current.col], dragging.current.startW + delta);
      setCols(prev => ({ ...prev, [dragging.current!.col]: newW }));
    };

    const onUp = () => {
      dragging.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [cols]);

  return { cols, onMouseDown };
}
