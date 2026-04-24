'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';

/**
 * Small DocuSign-style canvas that captures a drawn signature with
 * mouse / touch / stylus via pointer events. Exposes an imperative API via
 * ref so parent forms can read the PNG data URL on submit.
 */

export interface SignaturePadHandle {
  clear(): void;
  getDataUrl(): string | null;
  isEmpty(): boolean;
}

interface SignaturePadProps {
  width?: number;
  height?: number;
  className?: string;
  /** Fired when the first stroke lands — lets parents enable submit. */
  onStrokeStart?: () => void;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad({ width = 480, height = 160, className, onStrokeStart }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const [isEmpty, setIsEmpty] = useState(true);

    const getContext = useCallback((): CanvasRenderingContext2D | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      return canvas.getContext('2d');
    }, []);

    // HiDPI: scale the backing store by devicePixelRatio so strokes stay crisp.
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#111111';
      }
    }, [width, height]);

    const pointerPos = (ev: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
      const rect = ev.currentTarget.getBoundingClientRect();
      return {
        x: ev.clientX - rect.left,
        y: ev.clientY - rect.top,
      };
    };

    const onPointerDown = (ev: React.PointerEvent<HTMLCanvasElement>) => {
      ev.preventDefault();
      ev.currentTarget.setPointerCapture(ev.pointerId);
      const point = pointerPos(ev);
      drawingRef.current = true;
      lastPointRef.current = point;
      if (isEmpty) {
        setIsEmpty(false);
        onStrokeStart?.();
      }
      // Draw a dot so a single tap still registers visually.
      const ctx = getContext();
      if (!ctx) return;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 1, 0, Math.PI * 2);
      ctx.fillStyle = '#111111';
      ctx.fill();
    };

    const onPointerMove = (ev: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      const ctx = getContext();
      const prev = lastPointRef.current;
      if (!ctx || !prev) return;
      const point = pointerPos(ev);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      lastPointRef.current = point;
    };

    const endStroke = (ev: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      lastPointRef.current = null;
      try {
        ev.currentTarget.releasePointerCapture(ev.pointerId);
      } catch {
        // Safari sometimes loses capture; harmless.
      }
    };

    useImperativeHandle(
      ref,
      (): SignaturePadHandle => ({
        clear: () => {
          const canvas = canvasRef.current;
          const ctx = getContext();
          if (!canvas || !ctx) return;
          // Reset transform so clearRect uses the full backing store, then
          // restore the dpr scale for subsequent strokes.
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.restore();
          setIsEmpty(true);
        },
        getDataUrl: () => {
          if (isEmpty) return null;
          return canvasRef.current?.toDataURL('image/png') ?? null;
        },
        isEmpty: () => isEmpty,
      }),
      [getContext, isEmpty],
    );

    return (
      <div
        className={cn(
          'relative select-none rounded-md border border-dashed border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950',
          className,
        )}
        style={{ width, height }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onPointerLeave={endStroke}
          style={{ touchAction: 'none', display: 'block', cursor: 'crosshair' }}
        />
        {isEmpty && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400 dark:text-slate-600"
            aria-hidden="true"
          >
            Sign here
          </div>
        )}
      </div>
    );
  },
);
