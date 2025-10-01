import { useCallback, useEffect, useState } from 'react';

interface UseResizableConfig {
  initialWidth: number;
  minWidth?: number;
  maxWidth?: number;
  /**
   * Custom width calculation function.
   * Defaults to e.clientX for left-edge resize.
   * Use (e) => window.innerWidth - e.clientX for right-edge resize.
   */
  widthCalculation?: (clientX: number) => number;
}

interface UseResizableResult {
  width: number;
  setWidth: (width: number) => void;
  isResizing: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
}

/**
 * Custom hook for handling resizable panels/sidebars
 * Consolidates the duplicate resize logic found across components
 */
export function useResizable({
  initialWidth,
  minWidth = 250,
  maxWidth = 600,
  widthCalculation = (clientX: number) => clientX,
}: UseResizableConfig): UseResizableResult {
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = widthCalculation(e.clientX);
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth);
      }
    },
    [isResizing, widthCalculation, minWidth, maxWidth],
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ew-resize';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return {
    width,
    setWidth,
    isResizing,
    handleMouseDown,
  };
}
