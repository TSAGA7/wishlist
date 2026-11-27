import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { loadMapView, saveMapView, type MapViewState } from "@/features/cosmic/layout";

const MIN_SCALE = 0.68;
const MAX_SCALE = 1.85;

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** Zoom so the world point under (sx, sy) stays fixed. Coordinates are relative to the stage center. */
export function zoomAround(view: MapViewState, sx: number, sy: number, nextScale: number): MapViewState {
  const scale = clampScale(nextScale);
  const ratio = scale / view.scale;
  return {
    scale,
    x: sx - (sx - view.x) * ratio,
    y: sy - (sy - view.y) * ratio,
  };
}

/**
 * Pinch around the moving midpoint: the world point that was under the previous
 * gesture center lands under the current gesture center.
 */
export function pinchAround(
  view: MapViewState,
  previous: { x: number; y: number },
  next: { x: number; y: number },
  factor: number,
): MapViewState {
  const scale = clampScale(view.scale * factor);
  const worldX = (previous.x - view.x) / view.scale;
  const worldY = (previous.y - view.y) / view.scale;
  return {
    scale,
    x: next.x - worldX * scale,
    y: next.y - worldY * scale,
  };
}

function clampPan(view: MapViewState, width: number, height: number): MapViewState {
  if (width < 40 || height < 40) return view;
  const limitX = width * 0.62 * view.scale;
  const limitY = height * 0.62 * view.scale;
  return {
    ...view,
    x: Math.max(-limitX, Math.min(limitX, view.x)),
    y: Math.max(-limitY, Math.min(limitY, view.y)),
  };
}

export function useMapViewport(stageRef: RefObject<HTMLElement | null>) {
  const [view, setViewState] = useState<MapViewState>(() => loadMapView());
  const viewRef = useRef(view);
  viewRef.current = view;

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const last = useRef({ x: 0, y: 0 });
  const origin = useRef({ x: 0, y: 0 });
  const lastPinch = useRef<{ dist: number; sx: number; sy: number } | null>(null);
  const samples = useRef<Array<{ x: number; y: number; t: number }>>([]);
  const anim = useRef(0);
  const moved = useRef(false);
  const gestureId = useRef(0);
  const saveTimer = useRef(0);

  const stageSize = useCallback(() => {
    const rect = stageRef.current?.getBoundingClientRect();
    return { width: rect?.width ?? 0, height: rect?.height ?? 0, rect };
  }, [stageRef]);

  const commit = useCallback(
    (recipe: (current: MapViewState) => MapViewState) => {
      const { width, height } = stageSize();
      setViewState((current) => clampPan(recipe(current), width, height));
    },
    [stageSize],
  );

  const stopCoast = useCallback(() => {
    cancelAnimationFrame(anim.current);
    anim.current = 0;
  }, []);

  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveMapView(view), 180);
    return () => window.clearTimeout(saveTimer.current);
  }, [view]);

  useEffect(() => () => cancelAnimationFrame(anim.current), []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = event.clientX - rect.left - rect.width / 2;
      const sy = event.clientY - rect.top - rect.height / 2;
      const pixelDelta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * rect.height : event.deltaY;
      const factor = Math.exp(-pixelDelta * 0.0016);
      stopCoast();
      commit((current) => zoomAround(current, sx, sy, current.scale * factor));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [stageRef, commit, stopCoast]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* A second iOS touch can reject capture; events still reach the stage. */
      }
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      stopCoast();
      samples.current = [];

      if (pointers.current.size === 1) {
        last.current = { x: event.clientX, y: event.clientY };
        origin.current = { x: event.clientX, y: event.clientY };
        moved.current = false;
        gestureId.current += 1;
        lastPinch.current = null;
        samples.current.push({ x: event.clientX, y: event.clientY, t: performance.now() });
      } else if (pointers.current.size === 2) {
        moved.current = true;
        const rect = event.currentTarget.getBoundingClientRect();
        const pts = [...pointers.current.values()];
        const midX = (pts[0]!.x + pts[1]!.x) / 2;
        const midY = (pts[0]!.y + pts[1]!.y) / 2;
        lastPinch.current = {
          dist: Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y),
          sx: midX - rect.left - rect.width / 2,
          sy: midY - rect.top - rect.height / 2,
        };
      }
    },
    [stopCoast],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!pointers.current.has(event.pointerId)) return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointers.current.size === 1 && !lastPinch.current) {
        const dx = event.clientX - last.current.x;
        const dy = event.clientY - last.current.y;
        last.current = { x: event.clientX, y: event.clientY };
        if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 6) moved.current = true;
        const now = performance.now();
        samples.current.push({ x: event.clientX, y: event.clientY, t: now });
        const cutoff = now - 90;
        while (samples.current.length > 2 && samples.current[0]!.t < cutoff) samples.current.shift();
        if (dx || dy) commit((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
        return;
      }

      if (pointers.current.size >= 2 && lastPinch.current) {
        const rect = event.currentTarget.getBoundingClientRect();
        const pts = [...pointers.current.values()].slice(0, 2);
        const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
        const midX = (pts[0]!.x + pts[1]!.x) / 2;
        const midY = (pts[0]!.y + pts[1]!.y) / 2;
        const next = {
          x: midX - rect.left - rect.width / 2,
          y: midY - rect.top - rect.height / 2,
        };
        const previous = { x: lastPinch.current.sx, y: lastPinch.current.sy };
        const factor = dist / Math.max(lastPinch.current.dist, 1);
        moved.current = true;
        commit((current) => pinchAround(current, previous, next, factor));
        lastPinch.current = { dist, sx: next.x, sy: next.y };
      }
    },
    [commit],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      pointers.current.delete(event.pointerId);
      if (pointers.current.size >= 2) return;

      if (pointers.current.size === 1) {
        const remaining = [...pointers.current.values()][0]!;
        last.current = remaining;
        origin.current = remaining;
        lastPinch.current = null;
        samples.current = [{ x: remaining.x, y: remaining.y, t: performance.now() }];
        return;
      }

      lastPinch.current = null;
      const finishedGesture = gestureId.current;
      window.setTimeout(() => {
        if (gestureId.current === finishedGesture) moved.current = false;
      }, 0);
      const pts = samples.current;
      samples.current = [];
      if (pts.length < 2) return;
      const first = pts[0]!;
      const lastSample = pts[pts.length - 1]!;
      const dt = Math.max(16, lastSample.t - first.t);
      let vx = Math.max(-2.4, Math.min(2.4, (lastSample.x - first.x) / dt));
      let vy = Math.max(-2.4, Math.min(2.4, (lastSample.y - first.y) / dt));
      if (Math.hypot(vx, vy) < 0.08) return;

      let previous = performance.now();
      const step = (now: number) => {
        const frame = Math.min(34, now - previous);
        previous = now;
        const friction = Math.exp(-frame / 260);
        vx *= friction;
        vy *= friction;
        if (Math.hypot(vx, vy) < 0.012) return;
        commit((current) => ({ ...current, x: current.x + vx * frame, y: current.y + vy * frame }));
        anim.current = requestAnimationFrame(step);
      };
      anim.current = requestAnimationFrame(step);
    },
    [commit],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      stopCoast();
      commit((current) => zoomAround(current, 0, 0, current.scale * factor));
    },
    [commit, stopCoast],
  );

  const resetView = useCallback(() => {
    stopCoast();
    setViewState({ x: 0, y: 0, scale: 1 });
  }, [stopCoast]);

  const wasDrag = useCallback(() => moved.current, []);

  return { view, onPointerDown, onPointerMove, onPointerUp, zoomBy, resetView, wasDrag };
}
