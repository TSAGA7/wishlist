import type { Wish } from "@/types/wishlist";

export type PlanetSize = "hero" | "satellite" | "moon";

export interface PlanetPose {
  x: number;
  y: number;
  size: PlanetSize;
}

/** Reference composition: one hero, four satellites, then moons. Percents of the world. */
const ANCHORS: ReadonlyArray<{ x: number; y: number; size: PlanetSize }> = [
  { x: 50, y: 51, size: "hero" },
  { x: 22, y: 25, size: "satellite" },
  { x: 78, y: 23, size: "satellite" },
  { x: 22, y: 76, size: "satellite" },
  { x: 79, y: 75, size: "satellite" },
  { x: 49, y: 88, size: "moon" },
  { x: 5, y: 94, size: "moon" },
  { x: 95, y: 49, size: "moon" },
];

export function positionFor(index: number): { x: number; y: number; size: PlanetSize } {
  const anchor = ANCHORS[index];
  if (anchor) return anchor;
  const n = index - ANCHORS.length;
  const angle = n * 2.399963229728653;
  const radius = 38 + Math.sqrt(n + 1) * 5.5;
  return {
    x: Math.max(7, Math.min(93, 50 + Math.cos(angle) * radius)),
    y: Math.max(12, Math.min(91, 51 + Math.sin(angle) * radius * 0.78)),
    size: "moon",
  };
}

export function isWorldPercent(x: number | null | undefined, y: number | null | undefined): x is number {
  return typeof x === "number" && typeof y === "number" && x >= 0 && x <= 100 && y >= 0 && y <= 100;
}

export function sizeAt(x: number, y: number): PlanetSize {
  let best: PlanetSize = "moon";
  let bestDistance = 25;
  for (const anchor of ANCHORS) {
    const distance = (anchor.x - x) ** 2 + (anchor.y - y) ** 2;
    if (distance < bestDistance) {
      best = anchor.size;
      bestDistance = distance;
    }
  }
  return best;
}

function importance(wish: Wish): number {
  const priority = wish.priority === "critical" ? 4 : wish.priority === "high" ? 3 : wish.priority === "medium" ? 2 : 1;
  return priority * 1_000_000 + (wish.targetAmount ?? wish.price ?? 0);
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Stable world positions in percent of the map.
 * When `trustStored` is false, previously saved pixel offsets are ignored and every wish is placed again.
 */
export function layoutPlanets(
  wishes: Wish[],
  trustStored: boolean,
): { placed: Map<string, PlanetPose>; updates: Array<{ id: string; mapX: number; mapY: number }> } {
  const placed = new Map<string, PlanetPose>();
  const updates: Array<{ id: string; mapX: number; mapY: number }> = [];
  const occupied: Array<{ x: number; y: number }> = [];
  const pending: Wish[] = [];

  for (const wish of wishes) {
    if (trustStored && isWorldPercent(wish.mapX, wish.mapY)) {
      const x = wish.mapX;
      const y = wish.mapY as number;
      occupied.push({ x, y });
      placed.set(wish.id, { x, y, size: sizeAt(x, y) });
    } else {
      pending.push(wish);
    }
  }

  pending.sort((a, b) => {
    if (a.archived !== b.archived) return a.archived ? 1 : -1;
    return importance(b) - importance(a) || a.order - b.order || a.createdAt - b.createdAt;
  });

  let slot = 0;
  for (const wish of pending) {
    let pose = positionFor(slot);
    let guard = 0;
    while (guard < 80 && occupied.some((point) => Math.hypot(point.x - pose.x, point.y - pose.y) < 3.5)) {
      slot += 1;
      pose = positionFor(slot);
      guard += 1;
    }
    const x = roundPercent(pose.x);
    const y = roundPercent(pose.y);
    occupied.push({ x, y });
    placed.set(wish.id, { x, y, size: sizeAt(x, y) });
    slot += 1;
    if (wish.mapX !== x || wish.mapY !== y) updates.push({ id: wish.id, mapX: x, mapY: y });
  }

  return { placed, updates };
}

export interface MapViewState {
  x: number;
  y: number;
  scale: number;
}

const VIEW_KEY = "wishlist-map-view-v2";

export function loadMapView(): MapViewState {
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    if (!raw) return { x: 0, y: 0, scale: 1 };
    const parsed = JSON.parse(raw) as MapViewState;
    if (typeof parsed.x === "number" && typeof parsed.y === "number" && typeof parsed.scale === "number") {
      return {
        x: parsed.x,
        y: parsed.y,
        scale: Math.min(1.85, Math.max(0.68, parsed.scale)),
      };
    }
  } catch {
    /* ignore */
  }
  return { x: 0, y: 0, scale: 1 };
}

export function saveMapView(view: MapViewState): void {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify(view));
  } catch {
    /* ignore */
  }
}
