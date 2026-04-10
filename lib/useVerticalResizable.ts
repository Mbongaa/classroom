import { useCallback, useEffect, useRef, useState } from 'react';

interface UseVerticalResizableConfig {
  /** Initial height in pixels */
  initialHeight: number;
  minHeight?: number;
  maxHeight?: number;
  /**
   * Custom height calculation from clientY.
   * Default: measures from bottom of viewport upward (for a panel below the video).
   */
  heightCalculation?: (clientY: number) => number;
}

interface UseVerticalResizableResult {
  height: number;
  setHeight: (height: number) => void;
  isResizing: boolean;
  handlePointerDown: (e: React.PointerEvent) => void;
}

/**
 * Vertical resize hook with pointer events (supports both mouse and touch).
 * Designed for mobile vertical panel resizing.
 */
export function useVerticalResizable({
  initialHeight,
  minHeight = 100,
  maxHeight = 600,
  heightCalculation = (clientY: number) => window.innerHeight - clientY,
}: UseVerticalResizableConfig): UseVerticalResizableResult {
  const [height, setHeight] = useState(initialHeight);
  const [isResizing, setIsResizing] = useState(false);
  const pointerIdRef = useRef<number | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    pointerIdRef.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsResizing(true);
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isResizing) return;
      const newHeight = heightCalculation(e.clientY);
      if (newHeight >= minHeight && newHeight <= maxHeight) {
        setHeight(newHeight);
      }
    },
    [isResizing, heightCalculation, minHeight, maxHeight],
  );

  const handlePointerUp = useCallback(() => {
    setIsResizing(false);
    pointerIdRef.current = null;
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
      document.addEventListener('pointercancel', handlePointerUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ns-resize';
      // Prevent scrolling while resizing on touch devices
      document.body.style.touchAction = 'none';

      return () => {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
        document.removeEventListener('pointercancel', handlePointerUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        document.body.style.touchAction = '';
      };
    }
  }, [isResizing, handlePointerMove, handlePointerUp]);

  return {
    height,
    setHeight,
    isResizing,
    handlePointerDown,
  };
}
