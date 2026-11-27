import type { WishKind } from "@/types/wishlist";

/** Asset paths that respect Vite `base` (GitHub Pages `/wishlist/`). */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "./";
  const normalized = path.replace(/^\/+/, "");
  return `${base}${normalized}`;
}

export function placeholderFor(kind: WishKind): string {
  switch (kind) {
    case "trip":
      return assetUrl("placeholder-trip.svg");
    case "venue":
      return assetUrl("placeholder-venue.svg");
    case "place":
      return assetUrl("placeholder-place.svg");
    case "event":
      return assetUrl("placeholder-event.svg");
    default:
      return assetUrl("placeholder-purchase.svg");
  }
}

export function isLocalPhotoRef(value: string | null | undefined): value is `idb:${string}` {
  return typeof value === "string" && value.startsWith("idb:");
}

export function photoIdFromRef(value: string): string | null {
  if (!isLocalPhotoRef(value)) return null;
  return value.slice(4) || null;
}
