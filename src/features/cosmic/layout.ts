import { hashString, mulberry32 } from "@/lib/prng";
import type { Collection, Wish } from "@/types/wishlist";

export interface PlanetPose {
  x: number;
  y: number;
  size: number;
}

export interface ConstellationLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

function prioritySize(wish: Wish): number {
  const base = wish.kind === "trip" ? 148 : 128;
  const bump =
    wish.priority === "critical" ? 48 : wish.priority === "high" ? 28 : wish.priority === "medium" ? 8 : 0;
  const savings = wish.targetAmount && wish.savedAmount > 0 ? 10 : 0;
  return base + bump + savings;
}

/** Stable fallback position from wish id — never random per render. */
export function stableFallbackPose(wish: Wish, index: number): { x: number; y: number } {
  const rnd = mulberry32(hashString(wish.id));
  const ring = 180 + (index % 5) * 95 + rnd() * 40;
  const angle = rnd() * Math.PI * 2 + index * 0.85;
  return {
    x: Math.cos(angle) * ring,
    y: Math.sin(angle) * ring * 0.72,
  };
}

export function computePlanetLayout(
  wishes: Wish[],
  collections: Collection[],
): { positions: Map<string, PlanetPose>; lines: ConstellationLine[] } {
  const groups = new Map<string | null, Wish[]>();
  wishes.forEach((w) => {
    const key = w.collectionId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(w);
  });

  const positions = new Map<string, PlanetPose>();
  const lines: ConstellationLine[] = [];
  let gi = 0;

  groups.forEach((list, cid) => {
    const col = collections.find((c) => c.id === cid);
    const color = col?.color || "rgba(190,160,255,0.55)";
    const groupRnd = mulberry32(hashString(cid ?? "ungrouped"));
    const gAngle = groupRnd() * Math.PI * 2;
    const gRadius = gi === 0 ? 0 : 420 + (gi - 1) * 380;
    const cx = Math.cos(gAngle) * gRadius;
    const cy = Math.sin(gAngle) * gRadius * 0.75;

    const pts: { id: string; x: number; y: number }[] = [];
    const sizes = list.map(prioritySize);
    const maxSize = Math.max(120, ...sizes);
    const gap = 56;
    const step = maxSize + gap;
    const orbit =
      list.length <= 1 ? 0 : step / (2 * Math.sin(Math.PI / list.length));
    list.forEach((w, i) => {
      const size = sizes[i] ?? prioritySize(w);
      let x: number;
      let y: number;
      if (typeof w.mapX === "number" && typeof w.mapY === "number") {
        x = w.mapX;
        y = w.mapY;
      } else {
        const ang = (i / Math.max(list.length, 1)) * Math.PI * 2 - Math.PI / 2;
        x = cx + Math.cos(ang) * orbit;
        y = cy + Math.sin(ang) * orbit;
      }
      positions.set(w.id, { x, y, size });
      pts.push({ id: w.id, x, y });
    });

    if (pts.length > 1) {
      for (let i = 0; i < pts.length - 1; i += 1) {
        lines.push({
          x1: pts[i]!.x,
          y1: pts[i]!.y,
          x2: pts[i + 1]!.x,
          y2: pts[i + 1]!.y,
          color,
        });
      }
      if (pts.length > 2) {
        lines.push({
          x1: pts[pts.length - 1]!.x,
          y1: pts[pts.length - 1]!.y,
          x2: pts[0]!.x,
          y2: pts[0]!.y,
          color,
        });
      }
    }
    gi += 1;
  });

  return { positions, lines };
}

export interface MapViewState {
  x: number;
  y: number;
  scale: number;
}

const VIEW_KEY = "wishlist-map-view";

export function fitMapView(positions: Map<string, PlanetPose>): MapViewState {
  if (!positions.size) return { x: 0, y: 0, scale: 0.85 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  positions.forEach((pose) => {
    minX = Math.min(minX, pose.x - pose.size / 2);
    maxX = Math.max(maxX, pose.x + pose.size / 2);
    minY = Math.min(minY, pose.y - pose.size / 2);
    maxY = Math.max(maxY, pose.y + pose.size / 2);
  });
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const span = Math.max(maxX - minX, maxY - minY, 240);
  const scale = Math.min(1, Math.max(0.45, 340 / span));
  return { x: -cx * scale, y: -cy * scale, scale };
}

export function loadMapView(): MapViewState {
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    if (!raw) return { x: 0, y: 0, scale: 0.85 };
    const parsed = JSON.parse(raw) as MapViewState;
    if (
      typeof parsed.x === "number" &&
      typeof parsed.y === "number" &&
      typeof parsed.scale === "number"
    ) {
      return {
        x: parsed.x,
        y: parsed.y,
        scale: Math.min(3, Math.max(0.28, parsed.scale)),
      };
    }
  } catch {
    /* ignore */
  }
  return { x: 0, y: 0, scale: 0.85 };
}

export function saveMapView(view: MapViewState): void {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify(view));
  } catch {
    /* ignore */
  }
}
