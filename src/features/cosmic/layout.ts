import { hashString, mulberry32 } from "@/lib/prng";
import type { Collection, Wish } from "@/types/wishlist";

export interface PlanetPose {
  x: number;
  y: number;
  size: number;
  hero: boolean;
}

export interface ConstellationLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

/** Composition from the cosmic reference: one large center orb, satellites around it. */
const SLOTS = [
  { x: 6, y: 18 },
  { x: -128, y: -168 },
  { x: 136, y: -146 },
  { x: -118, y: 186 },
  { x: 132, y: 172 },
  { x: 8, y: -292 },
  { x: -8, y: 312 },
  { x: 210, y: 20 },
];

function rank(wish: Wish): number {
  const pri = wish.priority === "critical" ? 4 : wish.priority === "high" ? 3 : wish.priority === "medium" ? 2 : 1;
  const money = wish.targetAmount ?? wish.price ?? 0;
  return pri * 1_000_000 + money;
}

function sizeFor(index: number, wish: Wish): number {
  if (index === 0) return wish.kind === "trip" ? 236 : 214;
  if (wish.priority === "critical" || wish.priority === "high") return 168;
  return 150;
}

export function computePlanetLayout(
  wishes: Wish[],
  collections: Collection[],
): { positions: Map<string, PlanetPose>; lines: ConstellationLine[] } {
  const ordered = [...wishes].sort((a, b) => rank(b) - rank(a) || a.order - b.order);
  const positions = new Map<string, PlanetPose>();
  ordered.forEach((wish, index) => {
    const slot = SLOTS[index % SLOTS.length]!;
    const ring = Math.floor(index / SLOTS.length);
    const jitter = mulberry32(hashString(wish.id));
    const spread = ring * 250;
    const x = slot.x + Math.cos(jitter() * Math.PI * 2) * spread;
    const y = slot.y + Math.sin(jitter() * Math.PI * 2) * spread;
    positions.set(wish.id, {
      x,
      y,
      size: sizeFor(index, wish),
      hero: index === 0,
    });
  });

  const lines: ConstellationLine[] = [];
  const groups = new Map<string, Wish[]>();
  wishes.forEach((wish) => {
    const key = wish.collectionId ?? "__all__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(wish);
  });
  // One constellation across the visible set, colored by collection when present.
  const chain = ordered;
  for (let i = 0; i < chain.length - 1; i += 1) {
    const a = positions.get(chain[i]!.id);
    const b = positions.get(chain[i + 1]!.id);
    if (!a || !b) continue;
    const col = collections.find((c) => c.id === chain[i]!.collectionId);
    lines.push({
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      color: col?.color ?? "rgba(210, 180, 255, 0.55)",
    });
  }
  return { positions, lines };
}

export interface MapViewState {
  x: number;
  y: number;
  scale: number;
}

const VIEW_KEY = "wishlist-map-view";

export function loadMapView(): MapViewState {
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    if (!raw) return { x: 0, y: 0, scale: 1 };
    const parsed = JSON.parse(raw) as MapViewState;
    if (typeof parsed.x === "number" && typeof parsed.y === "number" && typeof parsed.scale === "number") {
      return {
        x: parsed.x,
        y: parsed.y,
        scale: Math.min(2.4, Math.max(0.55, parsed.scale)),
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
