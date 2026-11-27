/** Asset paths that respect Vite `base` (GitHub Pages `/wishlist/`). */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  const normalized = path.replace(/^\/+/, "");
  return `${base}${normalized}`;
}

export function placeholderFor(kind: "purchase" | "trip"): string {
  return assetUrl(kind === "trip" ? "placeholder-trip.svg" : "placeholder-purchase.svg");
}
