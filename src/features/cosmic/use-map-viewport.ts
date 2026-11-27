import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { loadMapView, saveMapView, type MapViewState } from "@/features/cosmic/layout";

export function useMapViewport() {
  const [view, setView] = useState<MapViewState>(() => loadMapView());
  const viewRef = useRef(view);
  viewRef.current = view;

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const last = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const lastPinch = useRef<{ dist: number; midX: number; midY: number } | null>(null);
  const anim = useRef(0);
  const dragging = useRef(false);
  const moved = useRef(false);

  useEffect(() => {
    saveMapView(view);
  }, [view]);

  useEffect(() => () => cancelAnimationFrame(anim.current), []);

  const zoomAt = useCallback((clientX: number, clientY: number, factor: number, rect: DOMRect) => {
    setView((v) => {
      const nextScale = Math.min(3, Math.max(0.28, v.scale * factor));
      const ratio = nextScale / v.scale;
      const cx = clientX - rect.left - rect.width / 2;
      const cy = clientY - rect.top - rect.height / 2;
      return {
        scale: nextScale,
        x: cx - (cx - v.x) * ratio,
        y: cy - (cy - v.y) * ratio,
      };
    });
  }, []);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    cancelAnimationFrame(anim.current);
    velocity.current = { x: 0, y: 0 };
    moved.current = false;

    if (pointers.current.size === 1) {
      dragging.current = true;
      last.current = { x: e.clientX, y: e.clientY };
      lastPinch.current = null;
    } else if (pointers.current.size === 2) {
      dragging.current = false;
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      lastPinch.current = {
        dist,
        midX: (pts[0]!.x + pts[1]!.x) / 2,
        midY: (pts[0]!.y + pts[1]!.y) / 2,
      };
    }
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 1 && dragging.current) {
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved.current = true;
      last.current = { x: e.clientX, y: e.clientY };
      velocity.current = { x: dx, y: dy };
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
      return;
    }

    if (pointers.current.size === 2 && lastPinch.current) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      const midX = (pts[0]!.x + pts[1]!.x) / 2;
      const midY = (pts[0]!.y + pts[1]!.y) / 2;
      const factor = dist / Math.max(lastPinch.current.dist, 1);
      const rect = e.currentTarget.getBoundingClientRect();
      zoomAt(midX, midY, factor, rect);
      // also pan by midpoint delta
      const pdx = midX - lastPinch.current.midX;
      const pdy = midY - lastPinch.current.midY;
      if (pdx || pdy) setView((v) => ({ ...v, x: v.x + pdx, y: v.y + pdy }));
      lastPinch.current = { dist, midX, midY };
      moved.current = true;
    }
  }, [zoomAt]);

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      dragging.current = false;
      lastPinch.current = null;
      const step = () => {
        velocity.current.x *= 0.92;
        velocity.current.y *= 0.92;
        if (Math.abs(velocity.current.x) < 0.4 && Math.abs(velocity.current.y) < 0.4) return;
        setView((v) => ({
          ...v,
          x: v.x + velocity.current.x,
          y: v.y + velocity.current.y,
        }));
        anim.current = requestAnimationFrame(step);
      };
      anim.current = requestAnimationFrame(step);
    } else if (pointers.current.size === 1) {
      const remaining = [...pointers.current.values()][0]!;
      last.current = remaining;
      dragging.current = true;
      lastPinch.current = null;
    }
  }, []);

  const onWheel = useCallback(
    (e: ReactWheelEvent<HTMLElement>) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const rect = e.currentTarget.getBoundingClientRect();
      zoomAt(e.clientX, e.clientY, factor, rect);
    },
    [zoomAt],
  );

  const wasDrag = useCallback(() => moved.current || Math.hypot(velocity.current.x, velocity.current.y) > 2, []);

  return { view, setView, onPointerDown, onPointerMove, onPointerUp, onWheel, wasDrag, viewRef };
}
